use axum::{
    body::Body,
    extract::{Extension, Multipart, Path, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use uuid::Uuid;
use crate::{
    AppError, AppResult, AppState,
    models::attachment::Attachment,
    services::{auth::Claims, storage},
};

const ALLOWED_MIME_TYPES: &[&str] = &[
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
    "text/plain", "text/csv",
];

const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;

pub async fn upload_attachment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> AppResult<Json<Attachment>> {
    let mut file_data: Option<Vec<u8>> = None;
    let mut original_filename = String::new();
    let mut mime_type = String::new();

    while let Some(field) = multipart.next_field().await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            original_filename = field.file_name()
                .unwrap_or("unknown")
                .to_string();
            mime_type = field.content_type()
                .unwrap_or("application/octet-stream")
                .to_string();

            if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
                return Err(AppError::BadRequest(
                    format!("File type '{}' is not allowed", mime_type)
                ));
            }

            let data = field.bytes().await
                .map_err(|e| AppError::BadRequest(format!("Failed to read file: {}", e)))?;

            if data.len() > MAX_FILE_SIZE {
                return Err(AppError::BadRequest("File size exceeds 50MB limit".to_string()));
            }

            file_data = Some(data.to_vec());
        }
    }

    let data = file_data.ok_or_else(|| AppError::BadRequest("No file provided".to_string()))?;

    let file_info = storage::save_file(&state.config.upload_dir, &data, &original_filename, &mime_type)
        .await
        .map_err(|e| AppError::Internal(e))?;

    let attachment = sqlx::query_as::<_, Attachment>(
        r#"INSERT INTO attachments
           (filename, original_filename, mime_type, file_size, storage_path, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *"#,
    )
    .bind(&file_info.filename)
    .bind(&original_filename)
    .bind(&file_info.mime_type)
    .bind(file_info.file_size)
    .bind(&file_info.storage_path)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(attachment))
}

pub async fn download_attachment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Response> {
    let attachment = sqlx::query_as::<_, Attachment>(
        "SELECT * FROM attachments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Attachment {} not found", id)))?;

    let file_path = storage::get_full_path(&state.config.upload_dir, &attachment.storage_path);

    if !file_path.exists() {
        return Err(AppError::NotFound("File not found on disk".to_string()));
    }

    let data = tokio::fs::read(&file_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, attachment.mime_type.as_str())
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", attachment.original_filename)
        )
        .header(header::CONTENT_LENGTH, data.len() as u64)
        .body(Body::from(data))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Response build error: {}", e)))?;

    Ok(response)
}

pub async fn delete_attachment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let attachment = sqlx::query_as::<_, Attachment>(
        "SELECT * FROM attachments WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Attachment {} not found", id)))?;

    if attachment.uploaded_by != Some(claims.sub) && claims.role != "admin" {
        return Err(AppError::Forbidden("Cannot delete this attachment".to_string()));
    }

    storage::delete_file(&state.config.upload_dir, &attachment.storage_path)
        .await
        .map_err(|e| AppError::Internal(e))?;

    sqlx::query("DELETE FROM attachments WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Attachment deleted" })))
}
