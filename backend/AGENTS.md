# BACKEND — Rust/Axum REST API

## OVERVIEW

Axum 0.7 REST API with SQLx (PostgreSQL, compile-time checked queries), JWT + Argon2 auth, IMAP email polling, file upload/download. Single binary deployment.

## STRUCTURE

```
backend/
├── src/
│   ├── main.rs             # Entry: DB pool → migrations → admin seed → email poll → router
│   ├── config.rs           # Env var loading (DATABASE_URL, JWT_SECRET, SMTP_*, etc.)
│   ├── error.rs            # AppError enum + AppResult<T> type alias
│   ├── handlers/
│   │   ├── mod.rs          # Router definition: public + protected routes
│   │   ├── auth.rs         # login, register, refresh, me, change-password
│   │   ├── tickets.rs      # CRUD + assign + history + participants
│   │   ├── comments.rs     # CRUD per ticket
│   │   ├── attachments.rs  # Upload (multipart), download, delete
│   │   ├── users.rs        # Admin user management
│   │   ├── teams.rs        # Team CRUD + member management
│   │   ├── projects.rs     # Project CRUD + user assignment
│   │   ├── email_accounts.rs # IMAP account CRUD + test connection
│   │   ├── dashboard.rs    # Stats aggregation
│   │   └── reports.rs      # Reporting queries
│   ├── models/             # SQLx query structs (one per domain entity)
│   ├── services/
│   │   ├── auth.rs         # JWT token generation + validation
│   │   ├── email.rs        # IMAP polling loop + SMTP sending
│   │   └── storage.rs      # File system storage for attachments
│   └── middleware/
│       └── auth.rs         # JWT Bearer token extraction + Claims injection
├── migrations/             # Numbered SQL: 20240001 → 20240009
└── Cargo.toml
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add endpoint | `handlers/{resource}.rs` + register in `handlers/mod.rs` | Protected routes need `.route_layer(require_auth)` |
| Add DB query | `models/{entity}.rs` | Use `sqlx::query_as!` for compile-time checking |
| Add business logic | `services/{domain}.rs` | Keep handlers thin, logic in services |
| Change schema | `migrations/` | Add new file `20240010_description.sql`, auto-runs on startup |
| Add middleware | `middleware/` + apply in `handlers/mod.rs` | Use Axum `middleware::from_fn_with_state` |
| Error handling | `error.rs` | Add variant to `AppError` enum, implement `IntoResponse` |
| Config | `config.rs` | Add env var with `std::env::var()`, provide default or panic |

## CONVENTIONS

- **Handler pattern**: Extract → Validate → Query → Respond. Handlers call models directly or through services.
- **Error handling**: Return `AppResult<Json<T>>`. Use `AppError::NotFound`, `AppError::BadRequest`, etc.
- **Auth**: `claims: Claims` extractor in handler params — injected by auth middleware from JWT.
- **SQL queries**: `sqlx::query_as!` with compile-time verification. Requires `DATABASE_URL` at build time.
- **Naming**: snake_case everything. One handler file per REST resource.
- **Migrations**: Sequential numbered files. Never modify existing migrations — add new ones.
- **CORS**: Currently `allow_origin(Any)` — known debt for production hardening.

## ANTI-PATTERNS

- **DO NOT** use `unwrap()` in handlers — use `?` operator with `AppError`
- **DO NOT** modify existing migration files — create new ones for schema changes
- **DO NOT** put business logic in handlers — extract to `services/` if complex
- **Email polling has no restart logic** — `tokio::spawn` in main.rs without supervision
