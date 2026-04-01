use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    pub ticket_id: Option<Uuid>,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub notification_type: String,
    pub message: String,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct NotificationFilter {
    pub is_read: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub data: Vec<Notification>,
    pub unread_count: i64,
}
