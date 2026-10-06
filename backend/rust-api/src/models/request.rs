use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ContentRequest {
    pub id: String,
    pub title: String,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<String>,
    pub status: String, // "pending", "approved", "fulfilled", "rejected"
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "fulfilledLinkUrl", skip_serializing_if = "Option::is_none")]
    pub fulfilled_link_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateRequestPayload {
    pub title: String,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    pub year: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateRequestPayload {
    pub id: String,
    pub status: String,
    #[serde(rename = "fulfilledLinkUrl")]
    pub fulfilled_link_url: Option<String>,
}
