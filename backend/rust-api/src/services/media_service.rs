use crate::error::AppError;
use crate::models::{GeneratePresignedUrlRequest, PresignedUrlResponse, R2ObjectMeta};
use crate::storage::R2Client;

pub struct MediaService {
    r2_client: Option<R2Client>,
}

impl MediaService {
    pub fn new(r2_client: Option<R2Client>) -> Self {
        Self { r2_client }
    }

    pub fn is_configured(&self) -> bool {
        self.r2_client.is_some()
    }

    pub fn generate_presigned_url(
        &self,
        req: GeneratePresignedUrlRequest,
    ) -> Result<PresignedUrlResponse, AppError> {
        let client = self.r2_client.as_ref().ok_or_else(|| {
            AppError::StorageError("Cloudflare R2 is not configured in backend environment.".to_string())
        })?;

        let ttl = req.expires_in_seconds.unwrap_or(3600); // 1 hour default
        client.generate_presigned_url(&req.key, &req.action, ttl)
    }

    pub async fn verify_asset(&self, key: &str) -> Result<R2ObjectMeta, AppError> {
        let client = self.r2_client.as_ref().ok_or_else(|| {
            AppError::StorageError("Cloudflare R2 is not configured in backend environment.".to_string())
        })?;

        client.head_object(key).await
    }
}
