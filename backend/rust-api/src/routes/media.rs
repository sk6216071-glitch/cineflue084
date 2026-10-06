use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;
use crate::auth::validate_admin_credentials;
use crate::error::AppError;
use crate::models::{GeneratePresignedUrlRequest, VerifyMediaPayload};
use crate::AppState;

/// Generate presigned URL for direct R2 streaming or upload (zero egress!)
pub async fn presign_media(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<GeneratePresignedUrlRequest>,
) -> Result<Json<Value>, AppError> {
    // If generating an upload (PUT) URL, require admin privileges
    if payload.action.to_lowercase() == "put" {
        let admin_key = headers.get("x-admin-key").and_then(|h| h.to_str().ok());
        let bearer = headers.get("authorization").and_then(|h| h.to_str().ok());
        validate_admin_credentials(admin_key, bearer, &state.config)?;
    }

    let presigned = state.media_service.generate_presigned_url(payload)?;
    Ok(Json(json!(presigned)))
}

/// Verify if an asset exists in Cloudflare R2 and retrieve metadata
pub async fn verify_media(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VerifyMediaPayload>,
) -> Result<Json<Value>, AppError> {
    let meta = state.media_service.verify_asset(&payload.key).await?;
    Ok(Json(json!({
        "success": true,
        "asset": meta
    })))
}
