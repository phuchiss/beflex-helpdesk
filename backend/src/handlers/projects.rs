use axum::{extract::{Extension, Path, State}, Json};
use uuid::Uuid;
use crate::{AppError, AppResult, AppState, models::project::*, services::auth::Claims};

/// GET /users/:id/projects — ดึง projects ที่ user เลือกไว้
pub async fn get_user_projects(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    // อนุญาตให้ดูของตัวเอง หรือ admin ดูของใครก็ได้
    if claims.role != "admin" && claims.sub != user_id {
        return Err(AppError::Forbidden("Cannot view another user's projects".to_string()));
    }
    let projects = sqlx::query_as::<_, Project>(
        "SELECT p.* FROM projects p
         INNER JOIN user_projects up ON up.project_id = p.id
         WHERE up.user_id = $1 AND p.is_active = true
         ORDER BY p.name ASC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "data": projects })))
}

/// PUT /users/:id/projects — อัปเดต projects ที่ user เลือก (batch replace)
pub async fn update_user_projects(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateUserProjectsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    // อนุญาตให้แก้ของตัวเอง หรือ admin แก้ของใครก็ได้
    if claims.role != "admin" && claims.sub != user_id {
        return Err(AppError::Forbidden("Cannot update another user's projects".to_string()));
    }

    let mut tx = state.db.begin().await?;

    sqlx::query("DELETE FROM user_projects WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    for project_id in &body.project_ids {
        sqlx::query(
            "INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(user_id)
        .bind(project_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let projects = sqlx::query_as::<_, Project>(
        "SELECT p.* FROM projects p
         INNER JOIN user_projects up ON up.project_id = p.id
         WHERE up.user_id = $1 AND p.is_active = true
         ORDER BY p.name ASC"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "data": projects })))
}

/// GET /projects
pub async fn list_projects(
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects ORDER BY name ASC"
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "data": projects })))
}

/// POST /projects
pub async fn create_project(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateProjectRequest>,
) -> AppResult<Json<Project>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let project = sqlx::query_as::<_, Project>(
        "INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *"
    )
    .bind(&body.name)
    .bind(body.description.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(Json(project))
}

/// PUT /projects/:id
pub async fn update_project(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectRequest>,
) -> AppResult<Json<Project>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    let project = sqlx::query_as::<_, Project>(
        "UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description), is_active = COALESCE($4, is_active) WHERE id = $1 RETURNING *"
    )
    .bind(id)
    .bind(body.name.as_deref())
    .bind(body.description.as_deref())
    .bind(body.is_active)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Project {} not found", id)))?;
    Ok(Json(project))
}

/// DELETE /projects/:id
pub async fn delete_project(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin required".to_string()));
    }
    // ห้ามลบถ้ามี open tickets
    let open_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tickets WHERE project_id = $1 AND is_deleted = false AND status NOT IN ('closed')"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    if open_count > 0 {
        return Err(AppError::BadRequest(format!(
            "Cannot delete project: {} open ticket(s) still assigned", open_count
        )));
    }

    sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "message": "Project deleted" })))
}
