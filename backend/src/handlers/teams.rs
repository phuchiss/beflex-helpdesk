use axum::{
    extract::{Extension, Path, State},
    Json,
};
use uuid::Uuid;
use crate::{AppError, AppResult, AppState, models::team::*, services::auth::Claims};

pub async fn list_teams(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let teams = sqlx::query_as::<_, Team>(
        "SELECT * FROM teams ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "data": teams })))
}

pub async fn create_team(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTeamRequest>,
) -> AppResult<Json<Team>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let team = sqlx::query_as::<_, Team>(
        "INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING *"
    )
    .bind(&body.name)
    .bind(body.description.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(team))
}

pub async fn get_team(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Team>> {
    let team = sqlx::query_as::<_, Team>("SELECT * FROM teams WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Team {} not found", id)))?;
    Ok(Json(team))
}

pub async fn update_team(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateTeamRequest>,
) -> AppResult<Json<Team>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let team = sqlx::query_as::<_, Team>(
        "UPDATE teams SET name = $2, description = $3 WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.description.as_deref())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Team {} not found", id)))?;
    Ok(Json(team))
}

pub async fn delete_team(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    sqlx::query("DELETE FROM teams WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "message": "Team deleted" })))
}

#[derive(Debug, serde::Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
}

pub async fn add_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(team_id): Path<Uuid>,
    Json(body): Json<AddMemberRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    sqlx::query(
        "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
    )
    .bind(team_id)
    .bind(body.user_id)
    .execute(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "message": "Member added" })))
}

pub async fn remove_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    sqlx::query("DELETE FROM team_members WHERE team_id = $1 AND user_id = $2")
        .bind(team_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "message": "Member removed" })))
}

pub async fn list_categories(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let categories = sqlx::query_as::<_, Category>(
        "SELECT * FROM categories ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "data": categories })))
}

pub async fn create_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCategoryRequest>,
) -> AppResult<Json<Category>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let color = body.color.as_deref().unwrap_or("#6B7280");
    let category = sqlx::query_as::<_, Category>(
        "INSERT INTO categories (name, color) VALUES ($1, $2) RETURNING *"
    )
    .bind(&body.name)
    .bind(color)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(category))
}

pub async fn update_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateCategoryRequest>,
) -> AppResult<Json<Category>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let category = sqlx::query_as::<_, Category>(
        "UPDATE categories SET name = $2, color = COALESCE($3, color) WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.color.as_deref())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Category {} not found", id)))?;
    Ok(Json(category))
}

pub async fn delete_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "message": "Category deleted" })))
}

pub async fn list_tags(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let tags = sqlx::query_as::<_, Tag>("SELECT * FROM tags ORDER BY name ASC")
        .fetch_all(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "data": tags })))
}

pub async fn create_tag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTagRequest>,
) -> AppResult<Json<Tag>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let color = body.color.as_deref().unwrap_or("#6B7280");
    let tag = sqlx::query_as::<_, Tag>(
        "INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *"
    )
    .bind(&body.name)
    .bind(color)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(tag))
}

pub async fn delete_tag(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "message": "Tag deleted" })))
}
