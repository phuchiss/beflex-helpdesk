use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EmailAccount {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub imap_host: String,
    pub imap_port: i32,
    pub imap_username: String,
    #[serde(skip_serializing)]
    pub imap_password_encrypted: String,
    pub imap_tls: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i32>,
    pub is_active: bool,
    pub last_polled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEmailAccountRequest {
    pub name: String,
    pub email: String,
    pub imap_host: String,
    pub imap_port: Option<i32>,
    pub imap_username: String,
    pub imap_password: String,
    pub imap_tls: Option<bool>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmailAccountRequest {
    pub name: Option<String>,
    pub imap_password: Option<String>,
    pub is_active: Option<bool>,
}
