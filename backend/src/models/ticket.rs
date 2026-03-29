use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub ticket_number: i64,
    pub subject: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub requester_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub source: String,
    pub email_message_id: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTicketRequest {
    pub subject: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub category_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub tag_ids: Option<Vec<Uuid>>,
    pub project_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketRequest {
    pub subject: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub category_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
    pub due_date: Option<DateTime<Utc>>,
    pub project_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AssignTicketRequest {
    pub assignee_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct TicketFilter {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub search: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TicketListResponse {
    pub data: Vec<Ticket>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TicketHistory {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub created_at: DateTime<Utc>,
}
