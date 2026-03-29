use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub ticket_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub filename: String,
    pub original_filename: String,
    pub mime_type: String,
    pub file_size: i64,
    pub storage_path: String,
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
