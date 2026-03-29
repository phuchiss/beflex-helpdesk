use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod error;
mod handlers;
mod middleware;
mod models;
mod services;

pub use error::{AppError, AppResult};

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub config: config::Config,
}

async fn seed_admin(db: &sqlx::PgPool, config: &config::Config) -> anyhow::Result<()> {
    let (Some(email), Some(password)) = (&config.admin_email, &config.admin_password) else {
        return Ok(()); // ไม่ได้ตั้งค่า — ข้ามไป
    };

    // ตรวจว่ามี user นี้อยู่แล้วหรือยัง
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
    )
    .bind(email)
    .fetch_one(db)
    .await?;

    if exists {
        tracing::info!("Admin user '{}' already exists, skipping seed", email);
        return Ok(());
    }

    // Hash password
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("Hash error: {}", e))?
        .to_string();

    sqlx::query(
        "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'admin')"
    )
    .bind(email)
    .bind("Administrator")
    .bind(&password_hash)
    .execute(db)
    .await?;

    tracing::info!("✅ Admin user '{}' created successfully", email);
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "helpdesk_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;
    
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(&db).await?;
    tracing::info!("Migrations complete");

    // Seed admin user if configured
    seed_admin(&db, &config).await?;

    let state = AppState { db, config: config.clone() };

    let email_state = state.clone();
    tokio::spawn(async move {
        services::email::start_email_polling(email_state).await;
    });

    let app = handlers::create_router(state)
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let addr: SocketAddr = format!("{}:{}", config.server_host, config.server_port).parse()?;
    tracing::info!("Server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
