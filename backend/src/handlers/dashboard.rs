use axum::{extract::{Extension, State}, Json};
use crate::{AppResult, AppState, services::auth::Claims};

const VISIBILITY_FILTER: &str = "AND (NOT $1 OR t.requester_id = $2 OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp.ticket_id = t.id AND tp.user_id = $2))";

pub async fn get_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let is_customer = claims.role == "customer";
    let user_id = claims.sub;

    let total_open = sqlx::query_scalar::<_, i64>(
        &format!("SELECT COUNT(*) FROM tickets t WHERE t.status = 'open' AND t.is_deleted = false {VISIBILITY_FILTER}")
    )
    .bind(is_customer)
    .bind(user_id)
    .fetch_one(&state.db).await?;

    let total_in_progress = sqlx::query_scalar::<_, i64>(
        &format!("SELECT COUNT(*) FROM tickets t WHERE t.status = 'in_progress' AND t.is_deleted = false {VISIBILITY_FILTER}")
    )
    .bind(is_customer)
    .bind(user_id)
    .fetch_one(&state.db).await?;

    let total_resolved = sqlx::query_scalar::<_, i64>(
        &format!("SELECT COUNT(*) FROM tickets t WHERE t.status = 'resolved' AND t.is_deleted = false {VISIBILITY_FILTER}")
    )
    .bind(is_customer)
    .bind(user_id)
    .fetch_one(&state.db).await?;

    let total_closed = sqlx::query_scalar::<_, i64>(
        &format!("SELECT COUNT(*) FROM tickets t WHERE t.status = 'closed' AND t.is_deleted = false {VISIBILITY_FILTER}")
    )
    .bind(is_customer)
    .bind(user_id)
    .fetch_one(&state.db).await?;

    let total = sqlx::query_scalar::<_, i64>(
        &format!("SELECT COUNT(*) FROM tickets t WHERE t.is_deleted = false {VISIBILITY_FILTER}")
    )
    .bind(is_customer)
    .bind(user_id)
    .fetch_one(&state.db).await?;

    let recent_tickets = sqlx::query_as::<_, crate::models::ticket::Ticket>(
        &format!("SELECT t.* FROM tickets t WHERE t.is_deleted = false {VISIBILITY_FILTER} ORDER BY t.created_at DESC LIMIT 10")
    )
    .bind(is_customer)
    .bind(user_id)
    .fetch_all(&state.db).await?;

    Ok(Json(serde_json::json!({
        "stats": {
            "total": total,
            "open": total_open,
            "in_progress": total_in_progress,
            "resolved": total_resolved,
            "closed": total_closed,
        },
        "recent_tickets": recent_tickets
    })))
}
