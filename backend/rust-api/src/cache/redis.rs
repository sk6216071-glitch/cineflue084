use crate::config::AppConfig;
use crate::error::AppError;
use redis::aio::MultiplexedConnection;
use redis::AsyncCommands;

#[derive(Clone)]
pub struct RedisClientWrapper {
    client: redis::Client,
    connection: MultiplexedConnection,
    namespace_prefix: String,
}

impl RedisClientWrapper {
    pub async fn connect(config: &AppConfig) -> Result<Option<Self>, AppError> {
        let url = match &config.redis_url {
            Some(u) if !u.is_empty() => u,
            _ => return Ok(None),
        };

        let client = redis::Client::open(url.as_str())
            .map_err(|e| AppError::CacheError(format!("Failed to parse Redis URL: {}", e)))?;

        let connection = client
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| AppError::CacheError(format!("Failed to connect to Redis: {}", e)))?;

        Ok(Some(Self {
            client,
            connection,
            namespace_prefix: "cinefuel:production".to_string(),
        }))
    }

    pub fn prefixed_key(&self, key: &str) -> String {
        format!("{}:{}", self.namespace_prefix, key)
    }

    pub async fn get(&mut self, key: &str) -> Result<Option<String>, AppError> {
        let full_key = self.prefixed_key(key);
        self.connection
            .get(full_key)
            .await
            .map_err(|e| AppError::CacheError(format!("Redis GET error: {}", e)))
    }

    pub async fn set_ex(&mut self, key: &str, value: &str, ttl_seconds: u64) -> Result<(), AppError> {
        let full_key = self.prefixed_key(key);
        self.connection
            .set_ex(full_key, value, ttl_seconds)
            .await
            .map_err(|e| AppError::CacheError(format!("Redis SETEX error: {}", e)))
    }

    pub async fn ping(&mut self) -> Result<(), AppError> {
        let _: String = redis::cmd("PING")
            .query_async(&mut self.connection)
            .await
            .map_err(|e| AppError::CacheError(format!("Redis PING error: {}", e)))?;
        Ok(())
    }
}
