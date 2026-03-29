# Architecture Decisions

## 2026-03-28 — Initial Architecture

### Backend: Rust + Axum
- Framework: `axum` (0.7+) — modern, tokio-based, excellent middleware support
- DB ORM: `sqlx` (async, compile-time checked queries)
- Auth: JWT with `jsonwebtoken` crate, passwords hashed with `argon2`
- Email: `async-imap` for IMAP polling, `lettre` for SMTP sending
- File storage: Local filesystem via Docker volume (`/uploads`), path: `/app/uploads`
- Serialization: `serde` + `serde_json`
- Error handling: `thiserror` + `anyhow`
- Logging: `tracing` + `tracing-subscriber`
- Validation: `validator` crate
- UUID: `uuid` v1 with `v4` feature
- DateTime: `chrono` with `serde` feature
- HTTP client: `reqwest` (for webhook/integration)
- Multipart: `axum-multipart` for file uploads
- CORS: `tower-http` with CorsLayer
- Config: `config` crate + dotenv

### Frontend: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui components
- State: TanStack Query (React Query v5) for server state
- Forms: react-hook-form + zod validation
- Editor: TipTap for rich text comments
- Auth: Custom JWT stored in httpOnly cookies
- File upload: Direct multipart POST to backend
- Icons: lucide-react
- Tables: TanStack Table v8
- Date: date-fns

### Database: PostgreSQL 16
- UUID primary keys (gen_random_uuid())
- pgcrypto extension for UUID generation
- Migrations via sqlx-cli
- Indexes on: ticket status, assignee_id, requester_id, created_at

### File Storage
- Local filesystem: `/app/uploads/{year}/{month}/{uuid}.{ext}`
- Max file size: 50MB per file
- Allowed types: images, documents, archives, text files

### Email Polling Strategy
- IMAP polling every 60 seconds (configurable)
- Track processed Message-IDs to avoid duplicates
- Support reply threading via `In-Reply-To` header
- Background tokio task for polling
- Store email_message_id on tickets for threading

### Authentication
- JWT access token (15 min expiry)
- Refresh token (7 days, stored in DB)
- Roles: admin, agent, customer
- httpOnly cookies for frontend

### Deployment
- Docker Compose with services: postgres, backend, frontend, nginx
- nginx reverse proxy: /api/* → backend:3001, /* → frontend:3000
- Named volumes: postgres_data, uploads_data
- Health checks on all services
