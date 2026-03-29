use axum::{
    extract::{Extension, State},
    Json,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    models::user::{AuthResponse, ChangePasswordRequest, LoginRequest, RefreshRequest, RegisterRequest, User},
    services::auth::{create_access_token, create_refresh_token, Claims},
    AppError, AppResult, AppState,
};

#[derive(Debug, FromRow)]
struct RefreshTokenRow {
    pub user_id: Uuid,
    pub email: String,
    pub role: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> AppResult<Json<AuthResponse>> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
    )
    .bind(&body.email)
    .fetch_one(&state.db)
    .await?;

    if exists {
        return Err(AppError::BadRequest("Email already registered".to_string()));
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing error: {}", e)))?
        .to_string();

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'agent') RETURNING *",
    )
    .bind(&body.email)
    .bind(&body.name)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await?;

    let access_token =
        create_access_token(user.id, &user.email, &user.role, &state.config.jwt_secret)?;
    let refresh_token = create_refresh_token();

    let expires_at = Utc::now() + Duration::days(7);
    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(user.id)
    .bind(&refresh_token)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        user,
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1 AND is_active = true",
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

    // Security: constant-time comparison via argon2 verify to prevent timing attacks
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hash parse error: {}", e)))?;

    let valid = Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .is_ok();

    if !valid {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    let access_token =
        create_access_token(user.id, &user.email, &user.role, &state.config.jwt_secret)?;
    let refresh_token = create_refresh_token();

    let expires_at = Utc::now() + Duration::days(7);
    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(user.id)
    .bind(&refresh_token)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok(Json(AuthResponse {
        access_token,
        refresh_token,
        user,
    }))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, RefreshTokenRow>(
        r#"SELECT rt.user_id, u.email, u.role
           FROM refresh_tokens rt
           JOIN users u ON rt.user_id = u.id
           WHERE rt.token = $1 AND rt.expires_at > NOW() AND u.is_active = true"#,
    )
    .bind(&body.refresh_token)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid or expired refresh token".to_string()))?;

    let access_token =
        create_access_token(row.user_id, &row.email, &row.role, &state.config.jwt_secret)?;

    Ok(Json(serde_json::json!({
        "access_token": access_token
    })))
}

pub async fn logout(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM refresh_tokens WHERE token = $1")
        .bind(&body.refresh_token)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Logged out successfully" })))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<User>> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1 AND is_active = true",
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user))
}

pub async fn change_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ChangePasswordRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await?;

    // Security: verify current password before allowing change
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hash parse error: {}", e)))?;

    let valid = Argon2::default()
        .verify_password(body.current_password.as_bytes(), &parsed_hash)
        .is_ok();

    if !valid {
        return Err(AppError::BadRequest(
            "Current password is incorrect".to_string(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(body.new_password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing error: {}", e)))?
        .to_string();

    sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
        .bind(&new_hash)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    // Security: invalidate all refresh tokens to force re-login on all devices
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    Ok(Json(
        serde_json::json!({ "message": "Password changed successfully" }),
    ))
}
