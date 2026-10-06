use axum::{
    extract::{Query, State},
    http::HeaderMap,
    Json,
};
use chrono::Utc;
use mongodb::bson::doc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;
use crate::auth::validate_admin_credentials;
use crate::error::AppError;
use crate::models::{BrokenLinkReport, CreateReportPayload, UpdateReportPayload};
use crate::AppState;

#[derive(Deserialize)]
pub struct GetReportsQuery {
    pub status: Option<String>,
}

pub async fn create_report(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateReportPayload>,
) -> Result<Json<Value>, AppError> {
    let mongo = state.mongo.as_ref().ok_or_else(|| {
        AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
    })?;

    let new_report = BrokenLinkReport {
        id: format!("rep_{}", Uuid::new_v4().simple()),
        movie_id: payload.movie_id,
        media_type: payload.media_type,
        reason: payload.reason,
        details: payload.details,
        reported_url: payload.reported_url,
        status: "pending".to_string(),
        created_at: Utc::now().to_rfc3339(),
    };

    let collection = mongo.collection::<serde_json::Value>("broken_link_reports");
    let doc_to_insert = serde_json::to_value(&new_report)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    collection
        .insert_one(doc_to_insert)
        .await
        .map_err(|e| AppError::DatabaseError(format!("Insert failed: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "report": new_report
    })))
}

pub async fn list_reports(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<GetReportsQuery>,
) -> Result<Json<Value>, AppError> {
    // Admin Only
    let admin_key = headers.get("x-admin-key").and_then(|h| h.to_str().ok());
    let bearer = headers.get("authorization").and_then(|h| h.to_str().ok());
    validate_admin_credentials(admin_key, bearer, &state.config)?;

    let mongo = state.mongo.as_ref().ok_or_else(|| {
        AppError::DatabaseError("Authoritative MongoDB not connected".to_string())
    })?;

    let collection = mongo.collection::<serde_json::Value>("broken_link_reports");
    let mut filter = doc! {};
    if let Some(status) = &query.status {
        filter.insert("status", status.clone());
    }

    let mut cursor = collection
        .find(filter)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut reports = Vec::new();
    while cursor.advance().await.map_err(|e| AppError::DatabaseError(e.to_string()))? {
        let doc_val = cursor.deserialize_current().map_err(|e| AppError::DatabaseError(e.to_string()))?;
        reports.push(doc_val);
    }

    Ok(Json(json!({
        "success": true,
        "reports": reports
    })))
}
