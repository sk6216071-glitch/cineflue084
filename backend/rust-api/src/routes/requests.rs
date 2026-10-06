use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use chrono::Utc;
use mongodb::bson::doc;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;
use crate::auth::validate_admin_credentials;
use crate::error::AppError;
use crate::models::{ContentRequest, CreateRequestPayload, UpdateRequestPayload};
use crate::AppState;

pub async fn create_request(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateRequestPayload>,
) -> Result<Json<Value>, AppError> {
    let mongo = state.mongo.as_ref().ok_or_else(|| {
        AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
    })?;

    let new_request = ContentRequest {
        id: format!("req_{}", Uuid::new_v4().simple()),
        title: payload.title,
        media_type: payload.media_type,
        year: payload.year,
        status: "pending".to_string(),
        created_at: Utc::now().to_rfc3339(),
        fulfilled_link_url: None,
    };

    let collection = mongo.collection::<serde_json::Value>("requests");
    let doc_to_insert = serde_json::to_value(&new_request)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    collection
        .insert_one(doc_to_insert)
        .await
        .map_err(|e| AppError::DatabaseError(format!("Insert failed: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "request": new_request
    })))
}

pub async fn list_requests(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, AppError> {
    let mongo = state.mongo.as_ref().ok_or_else(|| {
        AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
    })?;

    let collection = mongo.collection::<serde_json::Value>("requests");
    let mut cursor = collection
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .limit(50)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut requests = Vec::new();
    while cursor.advance().await.map_err(|e| AppError::DatabaseError(e.to_string()))? {
        let doc_val = cursor.deserialize_current().map_err(|e| AppError::DatabaseError(e.to_string()))?;
        requests.push(doc_val);
    }

    Ok(Json(json!({
        "success": true,
        "requests": requests
    })))
}
