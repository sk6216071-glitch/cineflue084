use crate::config::AppConfig;
use crate::error::AppError;
use subtle::ConstantTimeEq;

pub fn validate_admin_credentials(
    admin_key_header: Option<&str>,
    bearer_token: Option<&str>,
    config: &AppConfig,
) -> Result<(), AppError> {
    // 1. Direct admin key verification (constant-time)
    if let Some(key) = admin_key_header {
        if !config.admin_secret_key.is_empty()
            && key.len() == config.admin_secret_key.len()
            && key.as_bytes().ct_eq(config.admin_secret_key.as_bytes()).into()
        {
            return Ok(());
        }

        if let Some(pass) = &config.admin_password {
            if !pass.is_empty() && key.len() == pass.len() && key.as_bytes().ct_eq(pass.as_bytes()).into() {
                return Ok(());
            }
        }
    }

    // 2. Bearer session token verification
    if let Some(token) = bearer_token {
        let clean_token = token.strip_prefix("Bearer ").unwrap_or(token).trim();

        // Verify HMAC session token
        if !config.admin_secret_key.is_empty()
            && super::session::verify_admin_session_token(clean_token, &config.admin_secret_key)
        {
            return Ok(());
        }
    }

    Err(AppError::Unauthorized(
        "Administrative privileges required. Invalid or missing authentication credentials.".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_auth_config() -> AppConfig {
        AppConfig {
            host: "127.0.0.1".to_string(),
            port: 8080,
            admin_secret_key: "secure_admin_key_test_12345".to_string(),
            admin_password: Some("admin_pass_987".to_string()),
            admin_emails: vec!["admin@cinephile.test".to_string()],
            mongodb_uri: None,
            mongodb_database: "test".to_string(),
            redis_url: None,
            r2_account_id: None,
            r2_access_key_id: None,
            r2_secret_access_key: None,
            r2_bucket: None,
            r2_endpoint: None,
            r2_public_url: None,
            tmdb_api_key: None,
        }
    }

    #[test]
    fn test_valid_admin_secret_key() {
        let config = mock_auth_config();
        assert!(validate_admin_credentials(Some("secure_admin_key_test_12345"), None, &config).is_ok());
    }

    #[test]
    fn test_valid_admin_password() {
        let config = mock_auth_config();
        assert!(validate_admin_credentials(Some("admin_pass_987"), None, &config).is_ok());
    }

    #[test]
    fn test_invalid_key_rejected() {
        let config = mock_auth_config();
        assert!(validate_admin_credentials(Some("wrong_key"), None, &config).is_err());
    }

    #[test]
    fn test_missing_credentials_rejected() {
        let config = mock_auth_config();
        assert!(validate_admin_credentials(None, None, &config).is_err());
    }
}
