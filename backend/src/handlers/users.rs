use axum::{
    extract::{Extension, Path, State},
    Json,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use uuid::Uuid;
use crate::{AppError, AppResult, AppState, models::user::*, services::auth::Claims};

pub async fn list_users(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": users })))
}

pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1 AND is_active = true"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    Ok(Json(user))
}

pub async fn create_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateUserRequest>,
) -> AppResult<Json<User>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin access required".to_string()));
    }

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
    )
    .bind(&body.email)
    .fetch_one(&state.db)
    .await?;

    if exists {
        return Err(AppError::BadRequest("Email already exists".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Hash error: {}", e)))?
        .to_string();

    let role = body.role.as_deref().unwrap_or("agent");

    let mut tx = state.db.begin().await?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(&body.email)
    .bind(&body.name)
    .bind(&password_hash)
    .bind(role)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(project_ids) = &body.project_ids {
        for project_id in project_ids {
            sqlx::query(
                "INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
            )
            .bind(user.id)
            .bind(project_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(Json(user))
}

pub async fn update_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUserRequest>,
) -> AppResult<Json<User>> {
    // Allow admin to edit anyone, agents can only edit themselves
    if claims.role != "admin" && claims.sub != id {
        return Err(AppError::Forbidden("Cannot update another user".to_string()));
    }

    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET
            name = COALESCE($2, name),
            role = COALESCE($3, role),
            is_active = COALESCE($4, is_active),
            updated_at = NOW()
         WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(body.name.as_deref())
    .bind(body.role.as_deref())
    .bind(body.is_active)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    Ok(Json(user))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin access required".to_string()));
    }

    sqlx::query("UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "User deactivated" })))
}
