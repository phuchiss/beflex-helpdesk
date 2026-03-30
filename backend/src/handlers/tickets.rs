use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use chrono::Utc;
use uuid::Uuid;
use crate::{
    AppError, AppResult, AppState,
    models::ticket::*,
    services::auth::Claims,
};

#[derive(Debug, serde::Deserialize)]
pub struct AddParticipantRequest {
    pub user_id: Uuid,
}

/// GET /tickets?status=&priority=&assignee_id=&search=&page=&per_page=
pub async fn list_tickets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<TicketFilter>,
) -> AppResult<Json<TicketListResponse>> {
    let page = filter.page.unwrap_or(1).max(1);
    let per_page = filter.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let is_customer = claims.role == "customer";
    let user_id = claims.sub;

    let tickets = sqlx::query_as::<_, Ticket>(
        r#"SELECT t.* FROM tickets t
           WHERE t.is_deleted = false
             AND ($1::text IS NULL OR t.status = $1)
             AND ($2::text IS NULL OR t.priority = $2)
             AND ($3::uuid IS NULL OR t.assignee_id = $3)
             AND ($4::uuid IS NULL OR t.category_id = $4)
             AND ($5::uuid IS NULL OR t.project_id = $5)
             AND ($6::text IS NULL OR (t.subject ILIKE '%' || $6 || '%' OR t.description ILIKE '%' || $6 || '%'))
             AND (NOT $9 OR t.requester_id = $10 OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp.ticket_id = t.id AND tp.user_id = $10))
           ORDER BY t.created_at DESC
           LIMIT $7 OFFSET $8"#,
    )
    .bind(filter.status.as_deref())
    .bind(filter.priority.as_deref())
    .bind(filter.assignee_id)
    .bind(filter.category_id)
    .bind(filter.project_id)
    .bind(filter.search.as_deref())
    .bind(per_page)
    .bind(offset)
    .bind(is_customer)
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM tickets t
           WHERE t.is_deleted = false
             AND ($1::text IS NULL OR t.status = $1)
             AND ($2::text IS NULL OR t.priority = $2)
             AND ($3::uuid IS NULL OR t.assignee_id = $3)
             AND ($4::uuid IS NULL OR t.category_id = $4)
             AND ($5::uuid IS NULL OR t.project_id = $5)
             AND ($6::text IS NULL OR (t.subject ILIKE '%' || $6 || '%' OR t.description ILIKE '%' || $6 || '%'))
             AND (NOT $7 OR t.requester_id = $8 OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp.ticket_id = t.id AND tp.user_id = $8))"#,
    )
    .bind(filter.status.as_deref())
    .bind(filter.priority.as_deref())
    .bind(filter.assignee_id)
    .bind(filter.category_id)
    .bind(filter.project_id)
    .bind(filter.search.as_deref())
    .bind(is_customer)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(TicketListResponse { data: tickets, total, page, per_page }))
}

/// GET /tickets/:id
pub async fn get_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = $1 AND is_deleted = false"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Ticket {} not found", id)))?;

    if claims.role == "customer" {
        let is_requester = ticket.requester_id == Some(claims.sub);
        let is_participant = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM ticket_participants WHERE ticket_id = $1 AND user_id = $2)"
        )
        .bind(id)
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await?;

        if !is_requester && !is_participant {
            return Err(AppError::Forbidden("Access denied".to_string()));
        }
    }

    Ok(Json(ticket))
}

/// POST /tickets
pub async fn create_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTicketRequest>,
) -> AppResult<Json<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"INSERT INTO tickets (subject, description, priority, category_id, assignee_id, team_id, due_date, requester_id, project_id, source)
           VALUES ($1, $2, COALESCE($3, 'medium'), $4, $5, $6, $7, $8, $9, 'web')
           RETURNING *"#,
    )
    .bind(&body.subject)
    .bind(body.description.as_deref())
    .bind(body.priority.as_deref())
    .bind(body.category_id)
    .bind(body.assignee_id)
    .bind(body.team_id)
    .bind(body.due_date)
    .bind(claims.sub)
    .bind(body.project_id)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        "INSERT INTO ticket_history (ticket_id, user_id, action, new_value) VALUES ($1, $2, 'created', $3)"
    )
    .bind(ticket.id)
    .bind(claims.sub)
    .bind(&ticket.subject)
    .execute(&state.db)
    .await?;

    if let Some(tag_ids) = &body.tag_ids {
        for tag_id in tag_ids {
            sqlx::query(
                "INSERT INTO ticket_tags (ticket_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
            )
            .bind(ticket.id)
            .bind(tag_id)
            .execute(&state.db)
            .await?;
        }
    }

    if let Some(attachment_ids) = &body.attachment_ids {
        for att_id in attachment_ids {
            sqlx::query(
                "UPDATE attachments SET ticket_id = $2 WHERE id = $1 AND uploaded_by = $3"
            )
            .bind(att_id)
            .bind(ticket.id)
            .bind(claims.sub)
            .execute(&state.db)
            .await?;
        }
    }

    Ok(Json(ticket))
}

/// PUT /tickets/:id
pub async fn update_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTicketRequest>,
) -> AppResult<Json<Ticket>> {
    let old = sqlx::query_as::<_, Ticket>(
        "SELECT * FROM tickets WHERE id = $1 AND is_deleted = false"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Ticket {} not found", id)))?;

    // Only admin or the ticket creator can edit
    let is_admin = claims.role == "admin";
    let is_requester = old.requester_id == Some(claims.sub);
    if !is_admin && !is_requester {
        return Err(AppError::Forbidden("Only admin or ticket creator can edit".to_string()));
    }

    let resolved_at = if body.status.as_deref() == Some("resolved") && old.resolved_at.is_none() {
        Some(Utc::now())
    } else {
        old.resolved_at
    };

    let closed_at = if body.status.as_deref() == Some("closed") && old.closed_at.is_none() {
        Some(Utc::now())
    } else {
        old.closed_at
    };

    let updated = sqlx::query_as::<_, Ticket>(
        r#"UPDATE tickets SET
            subject = COALESCE($2, subject),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            priority = COALESCE($5, priority),
            category_id = COALESCE($6, category_id),
            assignee_id = COALESCE($7, assignee_id),
            team_id = COALESCE($8, team_id),
            due_date = COALESCE($9, due_date),
            resolved_at = $10,
            closed_at = $11,
            project_id = COALESCE($12, project_id),
            updated_at = NOW()
           WHERE id = $1 AND is_deleted = false
           RETURNING *"#,
    )
    .bind(id)
    .bind(body.subject.as_deref())
    .bind(body.description.as_deref())
    .bind(body.status.as_deref())
    .bind(body.priority.as_deref())
    .bind(body.category_id)
    .bind(body.assignee_id)
    .bind(body.team_id)
    .bind(body.due_date)
    .bind(resolved_at)
    .bind(closed_at)
    .bind(body.project_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Ticket {} not found", id)))?;

    if body.status.is_some() && body.status.as_deref() != Some(&old.status) {
        sqlx::query(
            "INSERT INTO ticket_history (ticket_id, user_id, action, old_value, new_value) VALUES ($1, $2, 'status_changed', $3, $4)"
        )
        .bind(id)
        .bind(claims.sub)
        .bind(&old.status)
        .bind(body.status.as_deref())
        .execute(&state.db)
        .await?;
    }

    if body.assignee_id.is_some() && body.assignee_id != old.assignee_id {
        sqlx::query(
            "INSERT INTO ticket_history (ticket_id, user_id, action, old_value, new_value) VALUES ($1, $2, 'assignee_changed', $3, $4)"
        )
        .bind(id)
        .bind(claims.sub)
        .bind(old.assignee_id.map(|uid| uid.to_string()))
        .bind(body.assignee_id.map(|uid| uid.to_string()))
        .execute(&state.db)
        .await?;
    }

    Ok(Json(updated))
}

/// DELETE /tickets/:id (soft delete)
pub async fn delete_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" && claims.role != "agent" {
        return Err(AppError::Forbidden("Admin or Agent required to delete tickets".to_string()));
    }

    sqlx::query(
        "UPDATE tickets SET is_deleted = true, updated_at = NOW() WHERE id = $1"
    )
    .bind(id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Ticket deleted" })))
}

/// POST /tickets/:id/assign
pub async fn assign_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignTicketRequest>,
) -> AppResult<Json<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"UPDATE tickets SET
            assignee_id = $2,
            team_id = COALESCE($3, team_id),
            updated_at = NOW()
           WHERE id = $1 AND is_deleted = false
           RETURNING *"#,
    )
    .bind(id)
    .bind(body.assignee_id)
    .bind(body.team_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Ticket {} not found", id)))?;

    sqlx::query(
        "INSERT INTO ticket_history (ticket_id, user_id, action, new_value) VALUES ($1, $2, 'assigned', $3)"
    )
    .bind(id)
    .bind(claims.sub)
    .bind(body.assignee_id.map(|uid| uid.to_string()))
    .execute(&state.db)
    .await?;

    Ok(Json(ticket))
}

/// GET /tickets/:id/history
pub async fn get_ticket_history(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let history = sqlx::query_as::<_, TicketHistory>(
        "SELECT * FROM ticket_history WHERE ticket_id = $1 ORDER BY created_at ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": history })))
}

/// GET /tickets/:id/participants
pub async fn list_participants(
    State(state): State<AppState>,
    Path(ticket_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let participants = sqlx::query_as::<_, crate::models::user::User>(
        r#"SELECT u.* FROM users u
           INNER JOIN ticket_participants tp ON tp.user_id = u.id
           WHERE tp.ticket_id = $1
           ORDER BY tp.created_at ASC"#
    )
    .bind(ticket_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "data": participants })))
}

/// POST /tickets/:id/participants
pub async fn add_participant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_id): Path<Uuid>,
    Json(body): Json<AddParticipantRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" && claims.role != "agent" {
        return Err(AppError::Forbidden("Admin or Agent required".to_string()));
    }

    sqlx::query(
        "INSERT INTO ticket_participants (ticket_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
    )
    .bind(ticket_id)
    .bind(body.user_id)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "message": "Participant added" })))
}

/// DELETE /tickets/:id/participants/:user_id
pub async fn remove_participant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((ticket_id, user_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    if claims.role != "admin" && claims.role != "agent" {
        return Err(AppError::Forbidden("Admin or Agent required".to_string()));
    }

    sqlx::query("DELETE FROM ticket_participants WHERE ticket_id = $1 AND user_id = $2")
        .bind(ticket_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Participant removed" })))
}
