use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

const SESSION_TTL_SECONDS: i64 = 4 * 60 * 60; // 4 hours

pub fn create_admin_session_token(secret: &str, user: &str) -> Result<String, String> {
    if secret.is_empty() {
        return Err("Secret key not configured".to_string());
    }

    let timestamp = Utc::now().timestamp();
    let payload = format!("admin:{}:{}", user, timestamp);

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| format!("HMAC key initialization error: {}", e))?;
    mac.update(payload.as_bytes());
    let sig = hex::encode(mac.finalize().into_bytes());

    Ok(format!("{}.{}", payload, sig))
}

pub fn verify_admin_session_token(token: &str, secret: &str) -> bool {
    if secret.is_empty() || token.is_empty() {
        return false;
    }

    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return false;
    }

    let payload = parts[0];
    let provided_sig = parts[1];

    let payload_parts: Vec<&str> = payload.split(':').collect();
    if payload_parts.len() != 3 || payload_parts[0] != "admin" {
        return false;
    }

    let timestamp: i64 = match payload_parts[2].parse() {
        Ok(t) => t,
        Err(_) => return false,
    };

    let now = Utc::now().timestamp();
    // Allow up to 60s future clock skew, expire after SESSION_TTL_SECONDS
    if timestamp > now + 60 || now - timestamp > SESSION_TTL_SECONDS {
        return false;
    }

    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(payload.as_bytes());
    let expected_sig = hex::encode(mac.finalize().into_bytes());

    // Constant-time comparison
    if provided_sig.len() != expected_sig.len() {
        return false;
    }

    provided_sig.as_bytes().ct_eq(expected_sig.as_bytes()).into()
}
