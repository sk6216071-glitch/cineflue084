use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BrokenLinkReport {
    pub id: String,
    #[serde(rename = "movieId")]
    pub movie_id: serde_json::Value,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(rename = "reportedUrl", skip_serializing_if = "Option::is_none")]
    pub reported_url: Option<String>,
    pub status: String, // "pending", "investigating", "fixed", "rejected"
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateReportPayload {
    #[serde(rename = "movieId")]
    pub movie_id: serde_json::Value,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    pub reason: String,
    pub details: Option<String>,
    #[serde(rename = "reportedUrl")]
    pub reported_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateReportPayload {
    pub id: String,
    pub status: String,
    #[serde(rename = "adminNotes")]
    pub admin_notes: Option<String>,
}
