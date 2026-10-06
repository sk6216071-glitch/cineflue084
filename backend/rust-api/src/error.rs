use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Authentication required: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Internal server error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message, code) = match &self {
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone(), Some("UNAUTHORIZED".to_string())),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone(), Some("FORBIDDEN".to_string())),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone(), Some("BAD_REQUEST".to_string())),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone(), Some("NOT_FOUND".to_string())),
            AppError::DatabaseError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", msg), Some("DB_ERROR".to_string())),
            AppError::CacheError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Cache error: {}", msg), Some("CACHE_ERROR".to_string())),
            AppError::StorageError(msg) => (StatusCode::BAD_GATEWAY, format!("Storage error: {}", msg), Some("STORAGE_ERROR".to_string())),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone(), Some("INTERNAL_ERROR".to_string())),
        };

        let body = Json(ErrorResponse {
            success: false,
            error: message,
            code,
        });

        (status, body).into_response()
    }
}
