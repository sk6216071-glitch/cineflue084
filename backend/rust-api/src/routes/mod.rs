pub mod health;
pub mod catalog;
pub mod links;
pub mod media;
pub mod reports;
pub mod requests;

use axum::{
    routing::{get, post, delete},
    Router,
};
use std::sync::Arc;
use crate::AppState;

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        // Health Check
        .route("/health", get(health::health_check))

        // Catalog APIs
        .route("/api/catalog", get(catalog::get_catalog))

        // Curated Links APIs
        .route("/api/curated-links", get(links::get_curated_links))
        .route("/api/curated-links", post(links::add_curated_link))
        .route("/api/curated-links", delete(links::delete_curated_link))

        // Cloudflare R2 Media APIs
        .route("/api/media/presign", post(media::presign_media))
        .route("/api/media/verify", post(media::verify_media))

        // Reports APIs
        .route("/api/reports", post(reports::create_report))
        .route("/api/reports", get(reports::list_reports))

        // Requests APIs
        .route("/api/requests", post(requests::create_request))
        .route("/api/requests", get(requests::list_requests))

        .with_state(state)
}
