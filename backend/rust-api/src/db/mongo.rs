use crate::config::AppConfig;
use crate::error::AppError;
use mongodb::{options::ClientOptions, Client, Database};

#[derive(Clone, Debug)]
pub struct MongoClientWrapper {
    database: Database,
}

impl MongoClientWrapper {
    pub async fn connect(config: &AppConfig) -> Result<Option<Self>, AppError> {
        let uri = match &config.mongodb_uri {
            Some(u) if !u.is_empty() => u,
            _ => return Ok(None),
        };

        let mut client_options = ClientOptions::parse(uri)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to parse MongoDB URI: {}", e)))?;

        client_options.app_name = Some("CiNEPHiLE-Rust-API".to_string());

        let client = Client::with_options(client_options)
            .map_err(|e| AppError::DatabaseError(format!("Failed to initialize MongoDB client: {}", e)))?;

        let database = client.database(&config.mongodb_database);

        Ok(Some(Self { database }))
    }

    pub fn collection<T>(&self, name: &str) -> mongodb::Collection<T>
    where
        T: Send + Sync,
    {
        self.database.collection(name)
    }

    pub async fn ping(&self) -> Result<(), AppError> {
        self.database
            .run_command(mongodb::bson::doc! { "ping": 1 })
            .await
            .map_err(|e| AppError::DatabaseError(format!("Ping failed: {}", e)))?;
        Ok(())
    }
}
