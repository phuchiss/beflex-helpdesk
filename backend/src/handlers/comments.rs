use axum::{
    extract::{Extension, Path, State},
    Json,
};
use uuid::Uuid;
use crate::{
    AppError, AppResult, AppState,
    models::comment::*,
    models::attachment::Attachment,
    services::auth::Claims,
};

pub async fn list_comments(
    State(state): State<AppState>,
    Path(ticket_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let comments = sqlx::query_as::<_, Comment>(
        "SELECT * FROM comments WHERE ticket_id = $1 ORDER BY created_at ASC"
    )
    .bind(ticket_id)
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::new();
    for comment in comments {
        let attachments = sqlx::query_as::<_, Attachment>(
            "SELECT * FROM attachments WHERE comment_id = $1"
        )
        .bind(comment.id)
        .fetch_all(&state.db)
        .await?;

        result.push(serde_json::json!({
            "id": comment.id,
            "ticket_id": comment.ticket_id,
            "author_id": comment.author_id,
            "content": comment.content,
            "is_internal": comment.is_internal,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
            "attachments": attachments
        }));
    }

    Ok(Json(serde_json::json!({ "data": result })))
}

pub async fn create_comment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_id): Path<Uuid>,
    Json(body): Json<CreateCommentRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let ticket_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM tickets WHERE id = $1 AND is_deleted = false)"
    )
    .bind(ticket_id)
    .fetch_one(&state.db)
    .await?;

    if !ticket_exists {
        return Err(AppError::NotFound(format!("Ticket {} not found", ticket_id)));
    }

    let comment = sqlx::query_as::<_, Comment>(
        "INSERT INTO comments (ticket_id, author_id, content, is_internal) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(ticket_id)
    .bind(claims.sub)
    .bind(&body.content)
    .bind(body.is_internal.unwrap_or(false))
    .fetch_one(&state.db)
    .await?;

    if let Some(attachment_ids) = &body.attachment_ids {
        for att_id in attachment_ids {
            sqlx::query(
                "UPDATE attachments SET comment_id = $2, ticket_id = $3 WHERE id = $1 AND uploaded_by = $4"
            )
            .bind(att_id)
            .bind(comment.id)
            .bind(ticket_id)
            .bind(claims.sub)
            .execute(&state.db)
            .await?;
        }
    }

    sqlx::query("UPDATE tickets SET updated_at = NOW() WHERE id = $1")
        .bind(ticket_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({
        "id": comment.id,
        "ticket_id": comment.ticket_id,
        "author_id": comment.author_id,
        "content": comment.content,
        "is_internal": comment.is_internal,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    })))
}

pub async fn update_comment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_ticket_id, comment_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateCommentRequest>,
) -> AppResult<Json<Comment>> {
    let comment = sqlx::query_as::<_, Comment>(
        "SELECT * FROM comments WHERE id = $1"
    )
    .bind(comment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Comment not found".to_string()))?;

    if comment.author_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden("Cannot edit another user's comment".to_string()));
    }

    let updated = sqlx::query_as::<_, Comment>(
        "UPDATE comments SET content = $2, updated_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(comment_id)
    .bind(&body.content)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_comment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_ticket_id, comment_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let comment = sqlx::query_as::<_, Comment>(
        "SELECT * FROM comments WHERE id = $1"
    )
    .bind(comment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Comment not found".to_string()))?;

    if comment.author_id != claims.sub && claims.role != "admin" {
        return Err(AppError::Forbidden("Cannot delete another user's comment".to_string()));
    }

    sqlx::query("DELETE FROM comments WHERE id = $1")
        .bind(comment_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Comment deleted" })))
}
