use crate::db::MongoClientWrapper;
use crate::error::AppError;
use crate::models::{CreateCuratedLinkPayload, CuratedLink, DeleteCuratedLinkPayload};
use chrono::Utc;
use mongodb::bson::doc;
use uuid::Uuid;

pub struct LinksService {
    mongo: Option<MongoClientWrapper>,
}

impl LinksService {
    pub fn new(mongo: Option<MongoClientWrapper>) -> Self {
        Self { mongo }
    }

    pub async fn get_links_for_movie(&self, movie_id: &serde_json::Value) -> Result<Vec<CuratedLink>, AppError> {
        let mongo = self.mongo.as_ref().ok_or_else(|| {
            AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
        })?;

        let collection = mongo.collection::<serde_json::Value>("curated_links");
        let id_str = match movie_id {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => movie_id.to_string(),
        };

        let filter = doc! { "movieId": id_str };
        let mut cursor = collection
            .find(filter)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        let mut links = Vec::new();
        while cursor.advance().await.map_err(|e| AppError::DatabaseError(e.to_string()))? {
            let doc_val = cursor.deserialize_current().map_err(|e| AppError::DatabaseError(e.to_string()))?;
            if let Ok(link) = serde_json::from_value::<CuratedLink>(doc_val) {
                links.push(link);
            }
        }

        Ok(links)
    }

    pub async fn add_curated_link(&self, payload: CreateCuratedLinkPayload) -> Result<CuratedLink, AppError> {
        // Validate URL
        if !payload.link.url.starts_with("http://") && !payload.link.url.starts_with("https://") {
            return Err(AppError::BadRequest("Only HTTP and HTTPS URLs are accepted".to_string()));
        }

        let mongo = self.mongo.as_ref().ok_or_else(|| {
            AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
        })?;

        let new_link = CuratedLink {
            id: format!("lnk_{}", Uuid::new_v4().simple()),
            title: payload.link.title,
            url: payload.link.url,
            quality: payload.link.quality,
            size: payload.link.size,
            link_type: payload.link.link_type,
            added_at: Some(Utc::now().to_rfc3339()),
            r2_key: payload.link.r2_key,
        };

        let collection = mongo.collection::<serde_json::Value>("curated_links");
        let doc_to_insert = serde_json::to_value(&new_link)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        collection
            .insert_one(doc_to_insert)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Insert failed: {}", e)))?;

        Ok(new_link)
    }

    pub async fn delete_curated_link(&self, payload: DeleteCuratedLinkPayload) -> Result<bool, AppError> {
        let mongo = self.mongo.as_ref().ok_or_else(|| {
            AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
        })?;

        let collection = mongo.collection::<serde_json::Value>("curated_links");
        let filter = doc! { "id": &payload.link_id };

        let result = collection
            .delete_one(filter)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

        Ok(result.deleted_count > 0)
    }
}
