# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-30
**Commit:** 3fdf86c
**Branch:** feat/user-project-selection

## OVERVIEW

Helpdesk ticketing system — monorepo: Next.js 14 frontend + Rust/Axum backend + PostgreSQL. Docker-based deployment with nginx reverse proxy, SSL via Let's Encrypt.

## STRUCTURE

```
beflex-helpdesk/
├── frontend/           # Next.js 14 App Router (TypeScript + Tailwind + Radix UI)
├── backend/            # Rust/Axum REST API (SQLx + Tokio)
├── deploy/             # Production docker-compose + SSL init script
├── nginx/              # Dev reverse proxy config
├── docker-compose.yml  # Development environment
└── .github/workflows/  # CI/CD: build → push → deploy → release
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API endpoint | `backend/src/handlers/` + register in `mod.rs` | Follow handler → model → service pattern |
| Add page/route | `frontend/app/(dashboard)/` | Next.js App Router with route groups |
| Add UI component | `frontend/components/` | Radix UI primitives in `ui/`, feature components alongside |
| Change DB schema | `backend/migrations/` | Numbered SQL files (20240001+), run by SQLx |
| Auth logic | `backend/src/handlers/auth.rs` + `frontend/lib/auth.ts` | JWT + Argon2, client-side token in localStorage |
| Email integration | `backend/src/services/email.rs` | IMAP polling + SMTP notifications |
| Deployment config | `deploy/` | Separate docker-compose + env for production |
| Types/interfaces | `frontend/types/index.ts` | All API response types centralized |

## CONVENTIONS

- **Path alias**: `@/*` maps to frontend root — always use `@/components/...`, `@/lib/...`
- **No shared types**: Frontend/backend types are maintained independently (no codegen)
- **Route groups**: `(auth)` for login/register, `(dashboard)` for protected pages
- **Naming**: kebab-case files (frontend), snake_case (backend Rust)
- **Styling**: Tailwind CSS with CSS variables for theming (HSL), dark mode via `class` strategy
- **API proxy**: Nginx routes `/api/*` → backend:3001, `/*` → frontend:3000

## ANTI-PATTERNS (THIS PROJECT)

- **NO test framework configured** — neither frontend nor backend have tests. CI/CD skips testing.
- **JWT_SECRET has insecure default** — `config.rs` falls back to hardcoded string if env var missing. Treat as known debt.
- **CORS allows all origins** — `main.rs` uses `CorsLayer::new().allow_origin(Any)`. Production risk.
- **Email passwords stored unencrypted** — `email_accounts` table stores IMAP passwords in plaintext.
- **Client-side auth only** — `AuthGuard` component checks localStorage. No server-side route protection in Next.js middleware.
- **middleware.ts is pass-through** — Next.js middleware exists but has no logic.

## COMMANDS

```bash
# Development (Docker)
docker-compose up -d                    # Start all services
docker-compose logs -f backend          # Backend logs

# Frontend dev (standalone)
cd frontend && npm run dev              # Port 4000

# Backend dev (standalone)
cd backend && cargo run                 # Port 3001

# Production deploy
git tag v1.0.0 && git push origin v1.0.0   # Triggers CI/CD

# Deployment SSL init
cd deploy && ./init-letsencrypt.sh      # First-time SSL setup
```

## NOTES

- Frontend dev port is **4000** (not default 3000) — set in package.json scripts
- Backend expects `DATABASE_URL` env var for SQLx compile-time query checking
- Docker images push to private registry `reg.bcecm.com` (not Docker Hub)
- Deploy target: `helpdesk.bcircle.dev` via SSH in GitHub Actions
- Migrations auto-run on backend startup
- Admin user auto-seeded if `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars present
