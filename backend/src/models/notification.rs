use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    pub ticket_id: Option<Uuid>,
    #[serde(rename = "type")]
    pub r#type: String,
    pub message: String,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}
