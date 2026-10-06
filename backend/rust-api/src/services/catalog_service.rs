use crate::cache::RedisClientWrapper;
use crate::db::MongoClientWrapper;
use crate::error::AppError;
use crate::models::{CatalogItem, CatalogQueryParams, CatalogResponse};
use mongodb::bson::doc;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct CatalogService {
    mongo: Option<MongoClientWrapper>,
    redis: Option<Arc<Mutex<RedisClientWrapper>>>,
}

impl CatalogService {
    pub fn new(mongo: Option<MongoClientWrapper>, redis: Option<Arc<Mutex<RedisClientWrapper>>>) -> Self {
        Self { mongo, redis }
    }

    pub async fn get_catalog(&self, params: CatalogQueryParams) -> Result<CatalogResponse, AppError> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(24).min(100);
        let cache_key = format!(
            "catalog:{}:{}:{}:{}",
            params.media_type.as_deref().unwrap_or("all"),
            params.query.as_deref().unwrap_or(""),
            page,
            limit
        );

        // 1. Check Redis Cache
        if let Some(redis_wrapper) = &self.redis {
            let mut redis = redis_wrapper.lock().await;
            if let Ok(Some(cached_json)) = redis.get(&cache_key).await {
                if let Ok(mut resp) = serde_json::from_str::<CatalogResponse>(&cached_json) {
                    resp.source = Some("cache".to_string());
                    return Ok(resp);
                }
            }
        }

        // 2. Fetch from Authoritative MongoDB
        let mongo = self.mongo.as_ref().ok_or_else(|| {
            AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
        })?;

        let collection = mongo.collection::<serde_json::Value>("titles");

        let mut filter = doc! {};
        if let Some(media_type) = &params.media_type {
            if media_type != "all" {
                filter.insert("mediaType", media_type.clone());
            }
        }

        let skip = ((page - 1) * limit) as u64;
        let find_options = mongodb::options::FindOptions::builder()
            .skip(skip)
            .limit(limit as i64)
            .sort(doc! { "uploadedAt": -1 })
            .build();

        let mut cursor = collection
            .find(filter)
            .with_options(find_options)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Find failed: {}", e)))?;

        let mut items: Vec<CatalogItem> = Vec::new();
        while cursor.advance().await.map_err(|e| AppError::DatabaseError(e.to_string()))? {
            let doc_val = cursor.deserialize_current().map_err(|e| AppError::DatabaseError(e.to_string()))?;
            if let Ok(item) = serde_json::from_value::<CatalogItem>(doc_val) {
                items.push(item);
            }
        }

        let total = items.len(); // Or count_documents
        let has_more = items.len() == limit;

        let response = CatalogResponse {
            success: true,
            items,
            total,
            page,
            limit,
            has_more,
            source: Some("database".to_string()),
        };

        // 3. Cache response in Redis with TTL (e.g. 10 minutes)
        if let Some(redis_wrapper) = &self.redis {
            if let Ok(serialized) = serde_json::to_string(&response) {
                let mut redis = redis_wrapper.lock().await;
                let _ = redis.set_ex(&cache_key, &serialized, 600).await;
            }
        }

        Ok(response)
    }
}
