use crate::config::AppConfig;
use crate::error::AppError;
use crate::models::{PresignedUrlResponse, R2ObjectMeta};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug)]
pub struct R2Client {
    account_id: String,
    access_key_id: String,
    secret_access_key: String,
    bucket: String,
    endpoint: Option<String>,
    public_url: Option<String>,
    client: reqwest::Client,
}

impl R2Client {
    pub fn new(config: &AppConfig) -> Option<Self> {
        let account_id = config.r2_account_id.clone()?;
        let access_key_id = config.r2_access_key_id.clone()?;
        let secret_access_key = config.r2_secret_access_key.clone()?;
        let bucket = config.r2_bucket.clone().unwrap_or_else(|| "cinephile-media".to_string());
        let endpoint = config.r2_endpoint.clone();
        let public_url = config.r2_public_url.clone();

        Some(Self {
            account_id,
            access_key_id,
            secret_access_key,
            bucket,
            endpoint,
            public_url,
            client: reqwest::Client::new(),
        })
    }

    fn endpoint_host(&self) -> String {
        if let Some(ref ep) = self.endpoint {
            ep.trim_start_matches("https://")
                .trim_start_matches("http://")
                .trim_end_matches('/')
                .to_string()
        } else {
            format!("{}.r2.cloudflarestorage.com", self.account_id)
        }
    }

    fn endpoint_url(&self, key: &str) -> String {
        let clean_key = key.trim_start_matches('/');
        format!("https://{}/{}/{}", self.endpoint_host(), self.bucket, clean_key)
    }

    /// Generates AWS SigV4 signing key
    fn get_signature_key(secret: &str, date_stamp: &str, region: &str, service: &str) -> Vec<u8> {
        let k_secret = format!("AWS4{}", secret);
        let mut k_date = HmacSha256::new_from_slice(k_secret.as_bytes()).unwrap();
        k_date.update(date_stamp.as_bytes());
        let k_date = k_date.finalize().into_bytes();

        let mut k_region = HmacSha256::new_from_slice(&k_date).unwrap();
        k_region.update(region.as_bytes());
        let k_region = k_region.finalize().into_bytes();

        let mut k_service = HmacSha256::new_from_slice(&k_region).unwrap();
        k_service.update(service.as_bytes());
        let k_service = k_service.finalize().into_bytes();

        let mut k_signing = HmacSha256::new_from_slice(&k_service).unwrap();
        k_signing.update(b"aws4_request");
        k_signing.finalize().into_bytes().to_vec()
    }

    /// Generate presigned URL for direct streaming or client uploads (zero egress)
    pub fn generate_presigned_url(
        &self,
        key: &str,
        method: &str,
        expires_in_seconds: u64,
    ) -> Result<PresignedUrlResponse, AppError> {
        let clean_key = key.trim_start_matches('/');
        let now: DateTime<Utc> = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();
        let region = "auto";
        let service = "s3";

        let host = self.endpoint_host();
        let canonical_uri = format!("/{}/{}", self.bucket, clean_key);

        let credential = format!("{}/{}/{}/{}/aws4_request", self.access_key_id, date_stamp, region, service);
        let signed_headers = "host";

        let mut query_params = vec![
            ("X-Amz-Algorithm", "AWS4-HMAC-SHA256".to_string()),
            ("X-Amz-Credential", credential.clone()),
            ("X-Amz-Date", amz_date.clone()),
            ("X-Amz-Expires", expires_in_seconds.to_string()),
            ("X-Amz-SignedHeaders", signed_headers.to_string()),
        ];
        query_params.sort_by(|a, b| a.0.cmp(b.0));

        let canonical_query = query_params
            .iter()
            .map(|(k, v)| format!("{}={}", k, urlencoding(v)))
            .collect::<Vec<_>>()
            .join("&");

        let canonical_headers = format!("host:{}\n", host);
        let payload_hash = "UNSIGNED-PAYLOAD";

        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method.to_uppercase(),
            canonical_uri,
            canonical_query,
            canonical_headers,
            signed_headers,
            payload_hash
        );

        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{}\n{}/{}/{}/aws4_request\n{}",
            amz_date,
            date_stamp,
            region,
            service,
            hex::encode(Sha256::digest(canonical_request.as_bytes()))
        );

        let signing_key = Self::get_signature_key(&self.secret_access_key, &date_stamp, region, service);
        let mut mac = HmacSha256::new_from_slice(&signing_key)
            .map_err(|e| AppError::Internal(format!("HMAC key error: {}", e)))?;
        mac.update(string_to_sign.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        let final_url = format!(
            "https://{}{}?{}&X-Amz-Signature={}",
            host, canonical_uri, canonical_query, signature
        );

        let expires_at = (now + chrono::Duration::seconds(expires_in_seconds as i64)).to_rfc3339();

        Ok(PresignedUrlResponse {
            success: true,
            url: final_url,
            key: clean_key.to_string(),
            method: method.to_uppercase(),
            expires_at,
            headers_to_include: None,
        })
    }

    /// Checks if a media asset exists in R2 and returns metadata
    pub async fn head_object(&self, key: &str) -> Result<R2ObjectMeta, AppError> {
        let clean_key = key.trim_start_matches('/');
        let url = self.endpoint_url(clean_key);

        let now: DateTime<Utc> = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();
        let region = "auto";
        let service = "s3";
        let host = self.endpoint_host();

        let empty_payload_hash = hex::encode(Sha256::digest(b""));
        let canonical_uri = format!("/{}/{}", self.bucket, clean_key);
        let canonical_headers = format!("host:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n", host, empty_payload_hash, amz_date);
        let signed_headers = "host;x-amz-content-sha256;x-amz-date";

        let canonical_request = format!(
            "HEAD\n{}\n\n{}\n{}\n{}",
            canonical_uri, canonical_headers, signed_headers, empty_payload_hash
        );

        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{}\n{}/{}/{}/aws4_request\n{}",
            amz_date,
            date_stamp,
            region,
            service,
            hex::encode(Sha256::digest(canonical_request.as_bytes()))
        );

        let signing_key = Self::get_signature_key(&self.secret_access_key, &date_stamp, region, service);
        let mut mac = HmacSha256::new_from_slice(&signing_key)
            .map_err(|e| AppError::Internal(format!("HMAC error: {}", e)))?;
        mac.update(string_to_sign.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        let auth_header = format!(
            "AWS4-HMAC-SHA256 Credential={}/{}/{}/{}/aws4_request, SignedHeaders={}, Signature={}",
            self.access_key_id, date_stamp, region, service, signed_headers, signature
        );

        let resp = self
            .client
            .head(&url)
            .header("host", &host)
            .header("x-amz-date", &amz_date)
            .header("x-amz-content-sha256", &empty_payload_hash)
            .header("authorization", &auth_header)
            .send()
            .await
            .map_err(|e| AppError::StorageError(format!("Network error: {}", e)))?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::NotFound(format!("Asset not found in R2: {}", clean_key)));
        }

        if !resp.status().is_success() {
            return Err(AppError::StorageError(format!("R2 responded with status {}", resp.status())));
        }

        let size = resp
            .headers()
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let content_type = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_string();

        let etag = resp
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .trim_matches('"')
            .to_string();

        let last_modified = resp
            .headers()
            .get("last-modified")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let public_url = self.public_url.as_ref().map(|base| {
            format!("{}/{}", base.trim_end_matches('/'), clean_key)
        });

        Ok(R2ObjectMeta {
            key: clean_key.to_string(),
            size,
            content_type,
            last_modified,
            etag,
            public_url,
        })
    }
}

fn urlencoding(input: &str) -> String {
    let mut encoded = String::new();
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;

    fn mock_config(endpoint: Option<String>) -> AppConfig {
        AppConfig {
            host: "127.0.0.1".to_string(),
            port: 8080,
            admin_secret_key: "test_secret".to_string(),
            admin_password: None,
            admin_emails: vec!["admin@test.com".to_string()],
            mongodb_uri: None,
            mongodb_database: "testdb".to_string(),
            redis_url: None,
            r2_account_id: Some("mock_acc_123".to_string()),
            r2_access_key_id: Some("mock_key_id".to_string()),
            r2_secret_access_key: Some("mock_secret_key".to_string()),
            r2_bucket: Some("cinephile-staging".to_string()),
            r2_endpoint: endpoint,
            r2_public_url: Some("https://media-staging.cinephile.test".to_string()),
            tmdb_api_key: None,
        }
    }

    #[test]
    fn test_endpoint_host_default() {
        let config = mock_config(None);
        let client = R2Client::new(&config).expect("client should initialize");
        assert_eq!(client.endpoint_host(), "mock_acc_123.r2.cloudflarestorage.com");
    }

    #[test]
    fn test_endpoint_host_custom() {
        let config = mock_config(Some("https://custom-r2.endpoint.net/".to_string()));
        let client = R2Client::new(&config).expect("client should initialize");
        assert_eq!(client.endpoint_host(), "custom-r2.endpoint.net");
    }

    #[test]
    fn test_generate_presigned_url_get() {
        let config = mock_config(None);
        let client = R2Client::new(&config).expect("client should initialize");
        let res = client.generate_presigned_url("movies/550/1080p.mp4", "GET", 3600)
            .expect("presigned URL should be generated");

        assert!(res.success);
        assert_eq!(res.key, "movies/550/1080p.mp4");
        assert_eq!(res.method, "GET");
        assert!(res.url.starts_with("https://mock_acc_123.r2.cloudflarestorage.com/cinephile-staging/movies/550/1080p.mp4"));
        assert!(res.url.contains("X-Amz-Algorithm=AWS4-HMAC-SHA256"));
        assert!(res.url.contains("X-Amz-Signature="));
        assert!(res.url.contains("X-Amz-Expires=3600"));
    }

    #[test]
    fn test_generate_presigned_url_put() {
        let config = mock_config(None);
        let client = R2Client::new(&config).expect("client should initialize");
        let res = client.generate_presigned_url("uploads/test.mp4", "PUT", 900)
            .expect("presigned URL should be generated");

        assert!(res.success);
        assert_eq!(res.key, "uploads/test.mp4");
        assert_eq!(res.method, "PUT");
        assert!(res.url.contains("X-Amz-Expires=900"));
        assert!(res.url.contains("X-Amz-Signature="));
    }
}
