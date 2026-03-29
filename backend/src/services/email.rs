use anyhow::{anyhow, Context};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use chrono::Utc;
use futures::TryStreamExt;
use mail_parser::MessageParser;
use rand::Rng;
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncReadCompatExt;
use uuid::Uuid;

use crate::{models::email_account::EmailAccount, AppState};

pub async fn test_imap_connection(account: &EmailAccount) -> anyhow::Result<()> {
    let addr = (account.imap_host.as_str(), account.imap_port as u16);
    if account.imap_tls {
        let tls = async_native_tls::TlsConnector::new();
        let tcp = TcpStream::connect(addr).await.context("TCP connect failed")?;
        let tls_stream = tls
            .connect(&account.imap_host, tcp.compat())
            .await
            .context("TLS handshake failed")?;
        let client = async_imap::Client::new(tls_stream);
        let mut session = client
            .login(&account.imap_username, &account.imap_password_encrypted)
            .await
            .map_err(|(e, _)| anyhow!("IMAP login failed: {}", e))?;
        session.logout().await.ok();
    } else {
        let tcp = TcpStream::connect(addr).await.context("TCP connect failed")?;
        let client = async_imap::Client::new(tcp.compat());
        let mut session = client
            .login(&account.imap_username, &account.imap_password_encrypted)
            .await
            .map_err(|(e, _)| anyhow!("IMAP login failed: {}", e))?;
        session.logout().await.ok();
    }
    Ok(())
}

pub async fn start_email_polling(state: AppState) {
    let mut ticker = tokio::time::interval(tokio::time::Duration::from_secs(60));
    loop {
        ticker.tick().await;
        poll_all_accounts(&state).await;
    }
}

async fn poll_all_accounts(state: &AppState) {
    let accounts = match sqlx::query_as::<_, EmailAccount>(
        "SELECT * FROM email_accounts WHERE is_active = true",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(a) => a,
        Err(e) => {
            tracing::error!("Failed to fetch active email accounts: {}", e);
            return;
        }
    };

    for account in &accounts {
        if let Err(e) = poll_account(state, account).await {
            tracing::error!(
                "Failed to poll email account '{}' ({}): {}",
                account.name,
                account.email,
                e
            );
        }
    }
}

async fn poll_account(state: &AppState, account: &EmailAccount) -> anyhow::Result<()> {
    let addr = (account.imap_host.as_str(), account.imap_port as u16);

    if account.imap_tls {
        let tls = async_native_tls::TlsConnector::new();
        let tcp = TcpStream::connect(addr).await.context("TCP connect failed")?;
        let tls_stream = tls
            .connect(&account.imap_host, tcp.compat())
            .await
            .context("TLS handshake failed")?;
        let client = async_imap::Client::new(tls_stream);
        let mut session = client
            .login(&account.imap_username, &account.imap_password_encrypted)
            .await
            .map_err(|(e, _)| anyhow!("IMAP login failed: {}", e))?;
        let result = process_inbox(state, account, &mut session).await;
        let _ = session.logout().await;
        result
    } else {
        let tcp = TcpStream::connect(addr).await.context("TCP connect failed")?;
        let client = async_imap::Client::new(tcp.compat());
        let mut session = client
            .login(&account.imap_username, &account.imap_password_encrypted)
            .await
            .map_err(|(e, _)| anyhow!("IMAP login failed: {}", e))?;
        let result = process_inbox(state, account, &mut session).await;
        let _ = session.logout().await;
        result
    }
}

async fn process_inbox<S>(
    state: &AppState,
    account: &EmailAccount,
    session: &mut async_imap::Session<S>,
) -> anyhow::Result<()>
where
    S: futures::io::AsyncRead + futures::io::AsyncWrite + Unpin + Send + std::fmt::Debug,
{
    session.select("INBOX").await.context("SELECT INBOX failed")?;

    let uids = session
        .uid_search("UNSEEN")
        .await
        .context("UID SEARCH UNSEEN failed")?;

    if uids.is_empty() {
        update_last_polled(state, account.id).await?;
        return Ok(());
    }

    let uid_set: String = uids
        .iter()
        .map(|u| u.to_string())
        .collect::<Vec<_>>()
        .join(",");

    let messages: Vec<_> = session
        .uid_fetch(&uid_set, "RFC822")
        .await
        .context("UID FETCH RFC822 failed")?
        .try_collect()
        .await
        .context("Stream collect failed")?;

    let parser = MessageParser::default();

    for msg in &messages {
        let uid = msg.uid.unwrap_or(0);

        let raw_body = match msg.body() {
            Some(b) => b,
            None => {
                tracing::warn!("Message UID {} has no body, skipping", uid);
                continue;
            }
        };

        let parsed = match parser.parse(raw_body) {
            Some(m) => m,
            None => {
                tracing::warn!("Failed to parse message UID {}, skipping", uid);
                continue;
            }
        };

        let message_id = parsed.message_id().unwrap_or("").to_string();
        if message_id.is_empty() {
            tracing::warn!("Message UID {} has no Message-ID, skipping", uid);
            continue;
        }

        let already_processed = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM email_processing_log WHERE email_account_id = $1 AND message_id = $2)",
        )
        .bind(account.id)
        .bind(&message_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false);

        if already_processed {
            continue;
        }

        let subject = parsed.subject().unwrap_or("No Subject").to_string();

        let from_addr = parsed.from().and_then(|f| f.first());
        let from_email = from_addr
            .and_then(|a| a.address())
            .unwrap_or("")
            .to_string();
        let from_name = from_addr
            .and_then(|a| a.name())
            .map(|n| n.to_string())
            .unwrap_or_else(|| from_email.clone());

        let in_reply_to: Option<String> = parsed
            .in_reply_to()
            .as_text_list()
            .and_then(|list| list.first().map(|s| s.to_string()));

        let body_text = parsed
            .body_text(0)
            .map(|b| b.to_string())
            .unwrap_or_default();

        if from_email.is_empty() {
            tracing::warn!("Message UID {} has no From address, skipping", uid);
            continue;
        }

        let user_id = match find_or_create_user(state, &from_email, &from_name).await {
            Ok(id) => id,
            Err(e) => {
                tracing::error!("Failed to find/create user for {}: {}", from_email, e);
                continue;
            }
        };

        let existing_ticket_id: Option<Uuid> = if let Some(ref reply_to_id) = in_reply_to {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM tickets WHERE email_message_id = $1 AND is_deleted = false LIMIT 1",
            )
            .bind(reply_to_id)
            .fetch_optional(&state.db)
            .await?
        } else {
            None
        };

        let ticket_id = if let Some(tid) = existing_ticket_id {
            sqlx::query(
                "INSERT INTO comments (ticket_id, author_id, content, is_internal) VALUES ($1, $2, $3, false)",
            )
            .bind(tid)
            .bind(user_id)
            .bind(&body_text)
            .execute(&state.db)
            .await?;
            tid
        } else {
            sqlx::query_scalar::<_, Uuid>(
                r#"INSERT INTO tickets
                   (subject, description, status, priority, requester_id, source, email_message_id)
                   VALUES ($1, $2, 'open', 'medium', $3, 'email', $4)
                   RETURNING id"#,
            )
            .bind(&subject)
            .bind(&body_text)
            .bind(user_id)
            .bind(&message_id)
            .fetch_one(&state.db)
            .await?
        };

        if let Err(e) = sqlx::query(
            "INSERT INTO email_processing_log (email_account_id, message_id, ticket_id) VALUES ($1, $2, $3)",
        )
        .bind(account.id)
        .bind(&message_id)
        .bind(ticket_id)
        .execute(&state.db)
        .await
        {
            tracing::error!("Failed to insert processing log for {}: {}", message_id, e);
        }
    }

    session
        .uid_store(&uid_set, "+FLAGS (\\Seen)")
        .await
        .ok();

    update_last_polled(state, account.id).await?;
    Ok(())
}

async fn find_or_create_user(
    state: &AppState,
    email: &str,
    name: &str,
) -> anyhow::Result<Uuid> {
    if let Some(id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE email = $1 LIMIT 1")
        .bind(email)
        .fetch_optional(&state.db)
        .await?
    {
        return Ok(id);
    }

    let random_password: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(random_password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Password hash failed: {}", e))?
        .to_string();

    let display_name = if name.is_empty() { email } else { name };

    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'customer') RETURNING id",
    )
    .bind(email)
    .bind(display_name)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await?;

    Ok(id)
}

async fn update_last_polled(state: &AppState, account_id: Uuid) -> anyhow::Result<()> {
    sqlx::query("UPDATE email_accounts SET last_polled_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(account_id)
        .execute(&state.db)
        .await?;
    Ok(())
}
