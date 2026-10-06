mod auth;
mod cache;
mod config;
mod db;
mod error;
mod models;
mod routes;
mod services;
mod storage;

use cache::RedisClientWrapper;
use config::AppConfig;
use db::MongoClientWrapper;
use services::{CatalogService, LinksService, MediaService};
use storage::R2Client;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub struct AppState {
    pub config: AppConfig,
    pub mongo: Option<MongoClientWrapper>,
    pub redis: Option<Arc<Mutex<RedisClientWrapper>>>,
    pub catalog_service: CatalogService,
    pub links_service: LinksService,
    pub media_service: MediaService,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize Tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,cinephile_rust_api=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting CiNEPHiLE Rust API Modernization Service...");

    // 2. Load Configuration
    let config = AppConfig::from_env();
    tracing::info!("Binding configuration loaded (Port: {})", config.port);

    // 3. Connect to Authoritative MongoDB (if configured)
    let mongo = match MongoClientWrapper::connect(&config).await {
        Ok(client) => {
            if client.is_some() {
                tracing::info!("Authoritative MongoDB Atlas connection initialized");
            } else {
                tracing::warn!("MongoDB URI not set; running without local MongoDB connection");
            }
            client
        }
        Err(e) => {
            tracing::warn!("MongoDB connection error: {}. Proceeding with degraded DB state", e);
            None
        }
    };

    // 4. Connect to Redis (if configured)
    let redis = match RedisClientWrapper::connect(&config).await {
        Ok(client) => {
            if client.is_some() {
                tracing::info!("Upstash Redis cache connection initialized");
            } else {
                tracing::warn!("Redis URL not set; running without cache layer");
            }
            client.map(|c| Arc::new(Mutex::new(c)))
        }
        Err(e) => {
            tracing::warn!("Redis connection error: {}. Proceeding without cache", e);
            None
        }
    };

    // 5. Initialize Cloudflare R2 Client (if configured)
    let r2 = R2Client::new(&config);
    if r2.is_some() {
        tracing::info!("Cloudflare R2 Object Storage client initialized");
    } else {
        tracing::warn!("R2 credentials not fully specified in environment");
    }

    // 6. Build Services
    let catalog_service = CatalogService::new(mongo.clone(), redis.clone());
    let links_service = LinksService::new(mongo.clone());
    let media_service = MediaService::new(r2);

    let state = Arc::new(AppState {
        config: config.clone(),
        mongo,
        redis,
        catalog_service,
        links_service,
        media_service,
    });

    // 7. Compose Router with CORS and Tracing
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::create_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // 8. Bind and Serve
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("CiNEPHiLE Rust API listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Graceful shutdown signal received. Terminating.");
}
