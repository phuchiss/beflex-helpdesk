use sqlx::PgPool;
use uuid::Uuid;

/// สร้าง notification สำหรับ user คนเดียว
pub async fn create_notification(
    db: &PgPool,
    user_id: Uuid,
    ticket_id: Uuid,
    notification_type: &str,
    message: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO notifications (user_id, ticket_id, type, message) VALUES ($1, $2, $3, $4)"
    )
    .bind(user_id)
    .bind(ticket_id)
    .bind(notification_type)
    .bind(message)
    .execute(db)
    .await?;
    Ok(())
}

/// ส่ง notification ให้หลาย user โดยไม่รวม actor (คนทำ action)
pub async fn notify_users(
    db: &PgPool,
    user_ids: &[Uuid],
    ticket_id: Uuid,
    notification_type: &str,
    message: &str,
    exclude_user_id: Uuid,
) {
    for &user_id in user_ids {
        if user_id != exclude_user_id {
            if let Err(e) = create_notification(db, user_id, ticket_id, notification_type, message).await {
                tracing::warn!("Failed to create notification for user {}: {}", user_id, e);
            }
        }
    }
}

/// ดึง user ทั้งหมดที่เกี่ยวข้องกับ ticket (requester, assignee, participants)
pub async fn get_ticket_related_users(
    db: &PgPool,
    ticket_id: Uuid,
) -> Vec<Uuid> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT DISTINCT combined.user_id FROM (
            SELECT requester_id as user_id FROM tickets WHERE id = $1 AND requester_id IS NOT NULL
            UNION
            SELECT assignee_id as user_id FROM tickets WHERE id = $1 AND assignee_id IS NOT NULL
            UNION
            SELECT user_id FROM ticket_participants WHERE ticket_id = $1
        ) combined"#
    )
    .bind(ticket_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// ดึงเฉพาะ staff (admin/agent) ที่เกี่ยวข้องกับ ticket — ใช้สำหรับ internal comment notification
pub async fn get_ticket_related_staff(
    db: &PgPool,
    ticket_id: Uuid,
) -> Vec<Uuid> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT DISTINCT u.id FROM users u
           INNER JOIN (
               SELECT assignee_id as user_id FROM tickets WHERE id = $1 AND assignee_id IS NOT NULL
               UNION
               SELECT user_id FROM ticket_participants WHERE ticket_id = $1
           ) related ON u.id = related.user_id
           WHERE u.role IN ('admin', 'agent')"#
    )
    .bind(ticket_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}
