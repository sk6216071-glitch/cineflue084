use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub admin_secret_key: String,
    pub admin_password: Option<String>,
    pub admin_emails: Vec<String>,
    pub mongodb_uri: Option<String>,
    pub mongodb_database: String,
    pub redis_url: Option<String>,
    pub r2_account_id: Option<String>,
    pub r2_access_key_id: Option<String>,
    pub r2_secret_access_key: Option<String>,
    pub r2_bucket: Option<String>,
    pub r2_public_url: Option<String>,
    pub tmdb_api_key: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        // Attempt to load .env if available, ignore errors if missing
        let _ = dotenvy::dotenv();

        let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080);

        let admin_secret_key = env::var("ADMIN_SECRET_KEY").unwrap_or_default();
        let admin_password = env::var("ADMIN_PASSWORD").ok().filter(|s| !s.is_empty());
        let admin_emails = env::var("ADMIN_EMAILS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();

        let mongodb_uri = env::var("MONGODB_URI").ok().filter(|s| !s.is_empty());
        let mongodb_database = env::var("MONGODB_DATABASE").unwrap_or_else(|_| "cinefuel".to_string());
        let redis_url = env::var("REDIS_URL")
            .or_else(|_| env::var("UPSTASH_REDIS_REST_URL"))
            .ok()
            .filter(|s| !s.is_empty());

        let r2_account_id = env::var("R2_ACCOUNT_ID").ok().filter(|s| !s.is_empty());
        let r2_access_key_id = env::var("R2_ACCESS_KEY_ID").ok().filter(|s| !s.is_empty());
        let r2_secret_access_key = env::var("R2_SECRET_ACCESS_KEY").ok().filter(|s| !s.is_empty());
        let r2_bucket = env::var("R2_BUCKET").ok().filter(|s| !s.is_empty());
        let r2_public_url = env::var("R2_PUBLIC_URL").ok().filter(|s| !s.is_empty());

        let tmdb_api_key = env::var("TMDB_API_KEY")
            .or_else(|_| env::var("NEXT_PUBLIC_TMDB_API_KEY"))
            .ok()
            .filter(|s| !s.is_empty());

        Self {
            host,
            port,
            admin_secret_key,
            admin_password,
            admin_emails,
            mongodb_uri,
            mongodb_database,
            redis_url,
            r2_account_id,
            r2_access_key_id,
            r2_secret_access_key,
            r2_bucket,
            r2_public_url,
            tmdb_api_key,
        }
    }
}
