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

        let collection = mongo.collection::<serde_json::Value>("links");

        let mut pipeline = Vec::new();

        let mut match_doc = doc! {};
        if let Some(media_type) = &params.media_type {
            if media_type != "all" {
                match_doc.insert("mediaType", media_type.clone());
            }
        }
        if let Some(query) = &params.query {
            if !query.trim().is_empty() {
                match_doc.insert("movieTitle", doc! { "$regex": query.trim(), "$options": "i" });
            }
        }

        if !match_doc.is_empty() {
            pipeline.push(doc! { "$match": match_doc });
        }

        pipeline.push(doc! {
            "$sort": { "createdAt": -1, "_id": -1 }
        });

        pipeline.push(doc! {
            "$group": {
                "_id": "$movieId",
                "movieTitle": { "$first": "$movieTitle" },
                "title": { "$first": "$title" },
                "mediaType": { "$first": "$mediaType" },
                "posterPath": { "$first": "$posterPath" },
                "backdropPath": { "$first": "$backdropPath" },
                "quality": { "$first": "$quality" },
                "audio": { "$first": "$audioLanguage" },
                "createdAt": { "$first": "$createdAt" },
                "linksCount": { "$sum": 1 }
            }
        });

        pipeline.push(doc! {
            "$sort": { "createdAt": -1, "_id": 1 }
        });

        let skip = ((page - 1) * limit) as i64;
        pipeline.push(doc! { "$skip": skip });
        pipeline.push(doc! { "$limit": limit as i64 });

        let mut cursor = collection
            .aggregate(pipeline)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Aggregate failed: {}", e)))?;

        let mut items: Vec<CatalogItem> = Vec::new();
        while cursor.advance().await.map_err(|e| AppError::DatabaseError(e.to_string()))? {
            let doc_val = cursor.deserialize_current().map_err(|e| AppError::DatabaseError(e.to_string()))?;

            let id_val: serde_json::Value = doc_val
                .get("_id")
                .map(|b| b.clone().into())
                .unwrap_or(serde_json::Value::Null);

            let title_val = doc_val
                .get_str("movieTitle")
                .ok()
                .filter(|s| !s.is_empty())
                .or_else(|| doc_val.get_str("title").ok())
                .unwrap_or("Unknown Title")
                .to_string();

            let media_type_val = doc_val
                .get_str("mediaType")
                .ok()
                .unwrap_or("movie")
                .to_string();

            let poster_path = doc_val.get_str("posterPath").ok().map(|s| s.to_string());
            let backdrop_path = doc_val.get_str("backdropPath").ok().map(|s| s.to_string());
            let quality = doc_val.get_str("quality").ok().map(|s| s.to_string());
            let audio = doc_val.get_str("audio").ok().map(|s| s.to_string());
            let uploaded_at = doc_val.get_str("createdAt").ok().map(|s| s.to_string());

            let custom_links_count = doc_val
                .get("linksCount")
                .and_then(|v| {
                    v.as_i32()
                        .map(|n| n as usize)
                        .or_else(|| v.as_i64().map(|n| n as usize))
                });

            items.push(CatalogItem {
                id: id_val,
                media_type: media_type_val,
                title: title_val,
                overview: None,
                poster_path,
                backdrop_path,
                vote_average: None,
                release_date: None,
                quality,
                audio,
                uploaded_at,
                has_custom_links: Some(true),
                custom_links_count,
            });
        }

        let has_more = items.len() == limit;
        let total = if has_more { page * limit + 1 } else { (page - 1) * limit + items.len() };

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
