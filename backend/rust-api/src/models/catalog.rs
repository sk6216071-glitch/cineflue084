use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CatalogItem {
    pub id: serde_json::Value,
    #[serde(rename = "mediaType")]
    pub media_type: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overview: Option<String>,
    #[serde(rename = "posterPath", skip_serializing_if = "Option::is_none")]
    pub poster_path: Option<String>,
    #[serde(rename = "backdropPath", skip_serializing_if = "Option::is_none")]
    pub backdrop_path: Option<String>,
    #[serde(rename = "voteAverage", skip_serializing_if = "Option::is_none")]
    pub vote_average: Option<f64>,
    #[serde(rename = "releaseDate", skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<String>,
    #[serde(rename = "uploadedAt", skip_serializing_if = "Option::is_none")]
    pub uploaded_at: Option<String>,
    #[serde(rename = "hasCustomLinks", skip_serializing_if = "Option::is_none")]
    pub has_custom_links: Option<bool>,
    #[serde(rename = "customLinksCount", skip_serializing_if = "Option::is_none")]
    pub custom_links_count: Option<usize>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CatalogResponse {
    pub success: bool,
    pub items: Vec<CatalogItem>,
    pub total: usize,
    pub page: usize,
    pub limit: usize,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CatalogQueryParams {
    #[serde(rename = "type")]
    pub media_type: Option<String>,
    pub quality: Option<String>,
    pub category: Option<String>,
    pub audio: Option<String>,
    pub ott: Option<String>,
    #[serde(rename = "q")]
    pub query: Option<String>,
    pub page: Option<usize>,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}
