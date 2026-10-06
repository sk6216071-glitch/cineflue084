use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use crate::models::{CatalogQueryParams, CatalogResponse};
use crate::AppState;

pub async fn get_catalog(
    State(state): State<Arc<AppState>>,
    Query(params): Query<CatalogQueryParams>,
) -> Result<Json<CatalogResponse>, crate::error::AppError> {
    let result = state.catalog_service.get_catalog(params).await?;
    Ok(Json(result))
}
