use axum::{
    extract::{Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use crate::auth::validate_admin_credentials;
use crate::error::AppError;
use crate::models::{CreateCuratedLinkPayload, CuratedLink, DeleteCuratedLinkPayload};
use crate::AppState;

#[derive(Deserialize)]
pub struct GetLinksQuery {
    #[serde(rename = "movieId")]
    pub movie_id: Value,
}

pub async fn get_curated_links(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetLinksQuery>,
) -> Result<Json<Value>, AppError> {
    let links = state.links_service.get_links_for_movie(&params.movie_id).await?;
    Ok(Json(json!({
        "success": true,
        "links": links
    })))
}

pub async fn add_curated_link(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateCuratedLinkPayload>,
) -> Result<Json<Value>, AppError> {
    // Admin Authorization
    let admin_key = headers.get("x-admin-key").and_then(|h| h.to_str().ok());
    let bearer = headers.get("authorization").and_then(|h| h.to_str().ok());
    validate_admin_credentials(admin_key, bearer, &state.config)?;

    let link = state.links_service.add_curated_link(payload).await?;
    Ok(Json(json!({
        "success": true,
        "link": link
    })))
}

pub async fn delete_curated_link(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<DeleteCuratedLinkPayload>,
) -> Result<Json<Value>, AppError> {
    // Admin Authorization
    let admin_key = headers.get("x-admin-key").and_then(|h| h.to_str().ok());
    let bearer = headers.get("authorization").and_then(|h| h.to_str().ok());
    validate_admin_credentials(admin_key, bearer, &state.config)?;

    let deleted = state.links_service.delete_curated_link(payload).await?;
    Ok(Json(json!({
        "success": deleted
    })))
}
