use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CuratedLink {
    pub id: String,
    pub title: String,
    pub url: String,
    pub quality: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub link_type: Option<String>,
    #[serde(rename = "addedAt", skip_serializing_if = "Option::is_none")]
    pub added_at: Option<String>,
    #[serde(rename = "r2Key", skip_serializing_if = "Option::is_none")]
    pub r2_key: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateCuratedLinkPayload {
    #[serde(rename = "movieId")]
    pub movie_id: serde_json::Value,
    pub link: CuratedLinkInput,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CuratedLinkInput {
    pub title: String,
    pub url: String,
    #[serde(default = "default_quality")]
    pub quality: String,
    pub size: Option<String>,
    #[serde(rename = "type")]
    pub link_type: Option<String>,
    #[serde(rename = "r2Key")]
    pub r2_key: Option<String>,
}

fn default_quality() -> String {
    "1080p".to_string()
}

#[derive(Clone, Debug, Deserialize)]
pub struct DeleteCuratedLinkPayload {
    #[serde(rename = "movieId")]
    pub movie_id: serde_json::Value,
    #[serde(rename = "linkId")]
    pub link_id: String,
}
