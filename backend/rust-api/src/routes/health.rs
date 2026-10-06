use axum::{extract::State, Json};
use serde::Serialize;
use std::sync::Arc;
use crate::AppState;

#[derive(Serialize)]
pub struct HealthStatus {
    pub status: String,
    pub service: String,
    pub version: String,
    pub rust_version: String,
    pub cloudflare_r2: bool,
    pub authoritative_mongodb: bool,
    pub redis_cache: bool,
    pub timestamp: String,
}

pub async fn health_check(State(state): State<Arc<AppState>>) -> Json<HealthStatus> {
    let r2_configured = state.media_service.is_configured();
    let mongo_ok = state.mongo.is_some();
    let redis_ok = state.redis.is_some();

    Json(HealthStatus {
        status: "healthy".to_string(),
        service: "CiNEPHiLE-Rust-API".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        rust_version: "1.98.1".to_string(),
        cloudflare_r2: r2_configured,
        authoritative_mongodb: mongo_ok,
        redis_cache: redis_ok,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}
