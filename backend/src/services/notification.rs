use lettre::{
    message::header::ContentType,
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;

/// All involved user IDs for a ticket (requester + assignee + participants), excluding `exclude_user_id`.
pub async fn get_ticket_recipients(
    db: &PgPool,
    ticket_id: Uuid,
    exclude_user_id: Uuid,
) -> anyhow::Result<Vec<(Uuid, String, String)>> {
    // Returns (id, email, name) for all involved users except the actor
    let rows = sqlx::query_as::<_, (Uuid, String, String)>(
        r#"
        SELECT DISTINCT u.id, u.email, u.name
        FROM users u
        WHERE u.is_active = true
          AND u.id != $2
          AND (
              u.id IN (SELECT requester_id FROM tickets WHERE id = $1 AND requester_id IS NOT NULL)
              OR u.id IN (SELECT assignee_id FROM tickets WHERE id = $1 AND assignee_id IS NOT NULL)
              OR u.id IN (SELECT user_id FROM ticket_participants WHERE ticket_id = $1)
          )
        "#,
    )
    .bind(ticket_id)
    .bind(exclude_user_id)
    .fetch_all(db)
    .await?;

    Ok(rows)
}

/// Send email notification and save to notifications table.
/// Runs in background — errors are logged but not propagated.
pub fn send_ticket_notification(
    db: PgPool,
    config: Config,
    ticket_id: Uuid,
    actor_id: Uuid,
    notification_type: String,
    subject: String,
    body_html: String,
) {
    tokio::spawn(async move {
        if let Err(e) = do_send_notification(
            &db,
            &config,
            ticket_id,
            actor_id,
            &notification_type,
            &subject,
            &body_html,
        )
        .await
        {
            tracing::error!("Failed to send notification for ticket {}: {}", ticket_id, e);
        }
    });
}

async fn do_send_notification(
    db: &PgPool,
    config: &Config,
    ticket_id: Uuid,
    actor_id: Uuid,
    notification_type: &str,
    subject: &str,
    body_html: &str,
) -> anyhow::Result<()> {
    let recipients = get_ticket_recipients(db, ticket_id, actor_id).await?;

    if recipients.is_empty() {
        tracing::debug!("No recipients for notification on ticket {}", ticket_id);
        return Ok(());
    }

    // Save in-app notifications
    for (user_id, _, _) in &recipients {
        sqlx::query(
            "INSERT INTO notifications (user_id, ticket_id, type, message) VALUES ($1, $2, $3, $4)",
        )
        .bind(user_id)
        .bind(ticket_id)
        .bind(notification_type)
        .bind(subject)
        .execute(db)
        .await?;
    }

    // Send emails if SMTP is configured
    let (Some(smtp_host), Some(smtp_username), Some(smtp_password), Some(from_email)) = (
        config.smtp_host.as_ref(),
        config.smtp_username.as_ref(),
        config.smtp_password.as_ref(),
        config.smtp_from_email.as_ref(),
    ) else {
        tracing::debug!("SMTP not configured, skipping email send");
        return Ok(());
    };

    let creds = Credentials::new(smtp_username.clone(), smtp_password.clone());

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(smtp_host)?
        .port(config.smtp_port)
        .credentials(creds)
        .build();

    let from_address = format!("{} <{}>", config.smtp_from_name, from_email);

    for (_, email, name) in &recipients {
        let to_address = format!("{} <{}>", name, email);

        let message = match Message::builder()
            .from(from_address.parse()?)
            .to(to_address.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body_html.to_string())
        {
            Ok(m) => m,
            Err(e) => {
                tracing::error!("Failed to build email for {}: {}", email, e);
                continue;
            }
        };

        if let Err(e) = mailer.send(message).await {
            tracing::error!("Failed to send email to {}: {}", email, e);
        } else {
            tracing::info!("Email notification sent to {}", email);
        }
    }

    Ok(())
}

// ── Notification helpers for building email content ──

pub fn build_comment_notification(
    actor_name: &str,
    ticket_number: i64,
    ticket_subject: &str,
    comment_content: &str,
    app_url: &str,
    ticket_id: Uuid,
) -> (String, String) {
    let subject = format!(
        "[Ticket #{}] New comment from {} - {}",
        ticket_number, actor_name, ticket_subject
    );

    let body = format!(
        r#"<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Comment on Ticket #{}</h2>
            <p><strong>{}</strong> commented on <strong>{}</strong>:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                {}
            </div>
            <a href="{}/tickets/{}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">View Ticket</a>
        </div>"#,
        ticket_number,
        actor_name,
        html_escape(ticket_subject),
        html_escape(comment_content),
        app_url,
        ticket_id
    );

    (subject, body)
}

pub fn build_status_notification(
    actor_name: &str,
    ticket_number: i64,
    ticket_subject: &str,
    old_status: &str,
    new_status: &str,
    app_url: &str,
    ticket_id: Uuid,
) -> (String, String) {
    let subject = format!(
        "[Ticket #{}] Status changed to {} - {}",
        ticket_number, new_status, ticket_subject
    );

    let body = format!(
        r#"<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Ticket #{} Status Updated</h2>
            <p><strong>{}</strong> changed the status of <strong>{}</strong>:</p>
            <p style="font-size: 16px;">
                <span style="background: #e5e7eb; padding: 4px 12px; border-radius: 4px;">{}</span>
                →
                <span style="background: #dbeafe; padding: 4px 12px; border-radius: 4px; color: #1d4ed8;">{}</span>
            </p>
            <a href="{}/tickets/{}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Ticket</a>
        </div>"#,
        ticket_number,
        actor_name,
        html_escape(ticket_subject),
        old_status,
        new_status,
        app_url,
        ticket_id
    );

    (subject, body)
}

pub fn build_assignment_notification(
    actor_name: &str,
    ticket_number: i64,
    ticket_subject: &str,
    assignee_name: &str,
    app_url: &str,
    ticket_id: Uuid,
) -> (String, String) {
    let subject = format!(
        "[Ticket #{}] Assigned to {} - {}",
        ticket_number, assignee_name, ticket_subject
    );

    let body = format!(
        r#"<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Ticket #{} Assigned</h2>
            <p><strong>{}</strong> assigned <strong>{}</strong> to <strong>{}</strong>.</p>
            <a href="{}/tickets/{}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Ticket</a>
        </div>"#,
        ticket_number,
        actor_name,
        html_escape(ticket_subject),
        assignee_name,
        app_url,
        ticket_id
    );

    (subject, body)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
