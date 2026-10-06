use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct R2ObjectMeta {
    pub key: String,
    pub size: u64,
    #[serde(rename = "contentType")]
    pub content_type: String,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
    pub etag: String,
    #[serde(rename = "publicUrl", skip_serializing_if = "Option::is_none")]
    pub public_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct GeneratePresignedUrlRequest {
    pub key: String,
    #[serde(default = "default_action")]
    pub action: String, // "get" or "put"
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    #[serde(rename = "expiresInSeconds")]
    pub expires_in_seconds: Option<u64>,
}

fn default_action() -> String {
    "get".to_string()
}

#[derive(Clone, Debug, Serialize)]
pub struct PresignedUrlResponse {
    pub success: bool,
    pub url: String,
    pub key: String,
    pub method: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    #[serde(rename = "headersToInclude", skip_serializing_if = "Option::is_none")]
    pub headers_to_include: Option<std::collections::HashMap<String, String>>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct VerifyMediaPayload {
    pub key: String,
}
