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
