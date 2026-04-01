use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use uuid::Uuid;
use crate::{
    AppResult, AppState,
    models::notification::*,
    services::auth::Claims,
};

pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<NotificationFilter>,
) -> AppResult<Json<NotificationListResponse>> {
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

    let unread_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false"
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(NotificationListResponse { data: notifications, unread_count }))
}

pub async fn get_unread_count(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false"
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "unread_count": count })))
}

pub async fn mark_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query(
        "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Notification marked as read" })))
}

pub async fn mark_all_read(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query(
        "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false"
    )
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "All notifications marked as read" })))
}

pub async fn delete_notification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query(
        "DELETE FROM notifications WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Notification deleted" })))
}
