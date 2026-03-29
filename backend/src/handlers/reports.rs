use axum::{
    extract::{Extension, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use crate::{AppError, AppResult, AppState, services::auth::Claims};

#[derive(Debug, Deserialize)]
pub struct ReportFilter {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

pub async fn get_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<ReportFilter>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" && claims.role != "agent" {
        return Err(AppError::Forbidden("Admin or Agent required".to_string()));
    }

    let from = filter.from;
    let to = filter.to;

    let by_status = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT status, COUNT(*) as count FROM tickets
           WHERE is_deleted = false
             AND ($1::timestamptz IS NULL OR created_at >= $1)
             AND ($2::timestamptz IS NULL OR created_at <= $2)
           GROUP BY status ORDER BY count DESC"#
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let by_priority = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT priority, COUNT(*) as count FROM tickets
           WHERE is_deleted = false
             AND ($1::timestamptz IS NULL OR created_at >= $1)
             AND ($2::timestamptz IS NULL OR created_at <= $2)
           GROUP BY priority ORDER BY count DESC"#
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let by_project = sqlx::query_as::<_, (Option<String>, i64)>(
        r#"SELECT p.name, COUNT(*) as count FROM tickets t
           LEFT JOIN projects p ON t.project_id = p.id
           WHERE t.is_deleted = false
             AND ($1::timestamptz IS NULL OR t.created_at >= $1)
             AND ($2::timestamptz IS NULL OR t.created_at <= $2)
           GROUP BY p.name ORDER BY count DESC"#
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let by_assignee = sqlx::query_as::<_, (Option<String>, i64)>(
        r#"SELECT u.name, COUNT(*) as count FROM tickets t
           LEFT JOIN users u ON t.assignee_id = u.id
           WHERE t.is_deleted = false
             AND ($1::timestamptz IS NULL OR t.created_at >= $1)
             AND ($2::timestamptz IS NULL OR t.created_at <= $2)
           GROUP BY u.name ORDER BY count DESC"#
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let per_day = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') as day, COUNT(*) as count
           FROM tickets
           WHERE is_deleted = false
             AND ($1::timestamptz IS NULL OR created_at >= $1)
             AND ($2::timestamptz IS NULL OR created_at <= $2)
             AND (($1::timestamptz IS NOT NULL) OR created_at >= NOW() - INTERVAL '30 days')
           GROUP BY created_at::date ORDER BY day ASC"#
    )
    .bind(from)
    .bind(to)
    .fetch_all(&state.db)
    .await?;

    let avg_resolution = sqlx::query_scalar::<_, Option<f64>>(
        r#"SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::float8
           FROM tickets
           WHERE is_deleted = false AND resolved_at IS NOT NULL
             AND ($1::timestamptz IS NULL OR created_at >= $1)
             AND ($2::timestamptz IS NULL OR created_at <= $2)"#
    )
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM tickets
           WHERE is_deleted = false
             AND ($1::timestamptz IS NULL OR created_at >= $1)
             AND ($2::timestamptz IS NULL OR created_at <= $2)"#
    )
    .bind(from)
    .bind(to)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "total": total,
        "avg_resolution_hours": avg_resolution.unwrap_or(0.0),
        "by_status": by_status.iter().map(|(s, c)| serde_json::json!({"label": s, "count": c})).collect::<Vec<_>>(),
        "by_priority": by_priority.iter().map(|(p, c)| serde_json::json!({"label": p, "count": c})).collect::<Vec<_>>(),
        "by_project": by_project.iter().map(|(p, c)| serde_json::json!({"label": p.as_deref().unwrap_or("Unassigned"), "count": c})).collect::<Vec<_>>(),
        "by_assignee": by_assignee.iter().map(|(a, c)| serde_json::json!({"label": a.as_deref().unwrap_or("Unassigned"), "count": c})).collect::<Vec<_>>(),
        "per_day": per_day.iter().map(|(d, c)| serde_json::json!({"date": d, "count": c})).collect::<Vec<_>>(),
    })))
}
