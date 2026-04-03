use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use uuid::Uuid;
use crate::{
    AppResult, AppState,
    models::notification::Notification,
    services::auth::Claims,
};

#[derive(Debug, serde::Deserialize)]
pub struct NotificationFilter {
    pub is_read: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

/// GET /notifications
pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<NotificationFilter>,
) -> AppResult<Json<serde_json::Value>> {
    let page = filter.page.unwrap_or(1).max(1);
    let per_page = filter.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let notifications = sqlx::query_as::<_, Notification>(
        r#"SELECT * FROM notifications
           WHERE user_id = $1
             AND ($2::bool IS NULL OR is_read = $2)
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4"#,
    )
    .bind(claims.sub)
    .bind(filter.is_read)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM notifications
           WHERE user_id = $1
             AND ($2::bool IS NULL OR is_read = $2)"#,
    )
    .bind(claims.sub)
    .bind(filter.is_read)
    .fetch_one(&state.db)
    .await?;

    let unread_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "data": notifications,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "per_page": per_page,
    })))
}

/// PUT /notifications/:id/read
pub async fn mark_as_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query(
        "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Notification marked as read" })))
}

/// PUT /notifications/read-all
pub async fn mark_all_as_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query(
        "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
    )
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "message": "All notifications marked as read",
        "updated": result.rows_affected()
    })))
}
