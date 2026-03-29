use axum::{
    extract::{Extension, Path, State},
    Json,
};
use uuid::Uuid;
use crate::{
    AppError, AppResult, AppState,
    models::email_account::*,
    services::auth::Claims,
};

pub async fn list_email_accounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let accounts = sqlx::query_as::<_, EmailAccount>(
        "SELECT * FROM email_accounts ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "data": accounts })))
}

pub async fn get_email_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<EmailAccount>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let account = sqlx::query_as::<_, EmailAccount>(
        "SELECT * FROM email_accounts WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Email account {} not found", id)))?;
    Ok(Json(account))
}

pub async fn create_email_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateEmailAccountRequest>,
) -> AppResult<Json<EmailAccount>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let account = sqlx::query_as::<_, EmailAccount>(
        r#"INSERT INTO email_accounts
           (name, email, imap_host, imap_port, imap_username, imap_password_encrypted, imap_tls, smtp_host, smtp_port)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *"#,
    )
    .bind(&body.name)
    .bind(&body.email)
    .bind(&body.imap_host)
    .bind(body.imap_port.unwrap_or(993))
    .bind(&body.imap_username)
    .bind(&body.imap_password)
    .bind(body.imap_tls.unwrap_or(true))
    .bind(body.smtp_host.as_deref())
    .bind(body.smtp_port)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(account))
}

pub async fn update_email_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEmailAccountRequest>,
) -> AppResult<Json<EmailAccount>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let account = sqlx::query_as::<_, EmailAccount>(
        r#"UPDATE email_accounts SET
            name = COALESCE($2, name),
            imap_password_encrypted = COALESCE($3, imap_password_encrypted),
            is_active = COALESCE($4, is_active)
           WHERE id = $1
           RETURNING *"#,
    )
    .bind(id)
    .bind(body.name.as_deref())
    .bind(body.imap_password.as_deref())
    .bind(body.is_active)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Email account {} not found", id)))?;
    Ok(Json(account))
}

pub async fn delete_email_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    sqlx::query("DELETE FROM email_accounts WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "message": "Email account deleted" })))
}

pub async fn test_email_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let account = sqlx::query_as::<_, EmailAccount>(
        "SELECT * FROM email_accounts WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Email account {} not found", id)))?;

    match crate::services::email::test_imap_connection(&account).await {
        Ok(_) => Ok(Json(serde_json::json!({ "success": true, "message": "Connection successful" }))),
        Err(e) => Ok(Json(serde_json::json!({ "success": false, "message": e.to_string() }))),
    }
}
