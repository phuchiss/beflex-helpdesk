# Learnings & Conventions

## Project Structure
```
beflex-helpdesk/
├── backend/           # Rust/Axum API server
├── frontend/          # Next.js app
├── nginx/             # nginx config
├── uploads/           # file storage volume (gitignored)
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

## Naming Conventions
- Rust: snake_case for everything
- TypeScript: camelCase for variables, PascalCase for components/types
- Database: snake_case for table and column names
- API routes: kebab-case (e.g., /email-accounts)
- Environment variables: SCREAMING_SNAKE_CASE

## API Response Format
All API responses follow this format:
```json
// Success
{ "data": {...}, "message": "Success" }

// List
{ "data": [...], "total": 100, "page": 1, "per_page": 20 }

// Error
{ "error": "Error message", "code": "ERROR_CODE" }
```

## Database Schema Key Points
- All tables use UUID primary keys
- ticket_number is SERIAL for human-readable IDs (e.g., #1234)
- Soft delete: tickets have is_deleted boolean (not hard delete)
- All timestamps are TIMESTAMPTZ (timezone-aware)

## File Upload Convention
- Upload endpoint: POST /api/attachments (multipart/form-data)
- Response includes: { id, url, filename, mime_type, file_size }
- Files stored at: /app/uploads/{year}/{month}/{uuid}-{original_name}
- URL served at: /api/attachments/{id}/download

## Email Threading
- When email comes in, check In-Reply-To header
- If matches existing ticket's email_message_id → add as comment
- Otherwise → create new ticket
- Reply emails contain ticket number in subject: "Re: [Ticket #1234]"

## Docker & Infrastructure Setup (2026-03-28)
- docker-compose.yml: 4 services (postgres, backend, frontend, nginx) + 2 named volumes
- docker-compose.dev.yml: postgres only (backend/frontend run natively in dev)
- nginx strips /api/ prefix when proxying → backend receives requests at /
- uploads_data volume shared between backend (/app/uploads) and nginx (/var/www/uploads:ro)
- Dockerfile uses multi-stage build (rust:1.75-slim builder → debian:bookworm-slim runtime)
- Layer caching: copy Cargo.toml first, build dummy main.rs, then copy actual source
- Health checks: postgres uses pg_isready, backend uses curl /health

## 2026-03-28 — T2: Backend Skeleton Structure

### Cargo.toml Fix
- `async-imap ^0.9` ไม่มี feature `rustls-tls` — features จริงคือ `runtime-tokio`, `runtime-async-std`
- ต้องลบ `features = ["rustls-tls"]` ออก หรือใช้ default features แทน
- TLS สำหรับ IMAP ใช้ `async-native-tls` แยก crate แทน

### Axum Handler Patterns
- Handler params ที่ไม่ใช้ให้ prefix `_` เพื่อหลีกเลี่ยง dead_code warnings
- Route ที่มี nested params (e.g., `/tickets/:ticket_id/comments/:id`) ต้อง destructure `Path((a, b)): Path<(Uuid, Uuid)>`
- `middleware::from_fn_with_state` ต้อง clone state ก่อน layer

### cargo check Result
- ผ่าน (Finished dev profile) พร้อม 29 warnings ปกติสำหรับ stub code
- warnings เป็น dead_code และ unused_imports ทั้งหมด (ไม่ใช่ errors)

## 2026-03-28 — T3: Auth Handler Implementation

### argon2 0.5 API (ไม่ใช่ old API)
```rust
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
// Hash
let salt = SaltString::generate(&mut OsRng);
let hash = Argon2::default().hash_password(pwd.as_bytes(), &salt)?.to_string();
// Verify
let parsed = PasswordHash::new(&stored_hash)?;
let valid = Argon2::default().verify_password(pwd.as_bytes(), &parsed).is_ok();
```

### sqlx Dynamic Queries (ไม่ใช่ macro)
- ใช้ `sqlx::query_as::<_, T>()` + `sqlx::query_scalar::<_, bool>()` แทน `sqlx::query!`
- เพราะ `sqlx::query!` macro ต้องการ DATABASE_URL หรือ offline mode ตอน compile
- สำหรับ JOIN query ที่ต้องการ partial fields → สร้าง struct เล็กๆ + `#[derive(FromRow)]`

### anyhow::Error → AppError::Internal conversion
- `AppError::Internal` ใช้ `#[from] anyhow::Error` → `create_access_token()?` ทำงานได้ตรงๆ
- argon2 errors ต้อง map เอง: `.map_err(|e| AppError::Internal(anyhow::anyhow!("{}", e)))?`

### Extension<Claims> ใน Protected Routes
- middleware/auth.rs ทำ `req.extensions_mut().insert(claims)` แล้ว
- handler รับด้วย `Extension(claims): Extension<Claims>` ได้เลย
- Claims มี `#[derive(Clone)]` อยู่แล้วใน services/auth.rs

## 2026-03-28 — T4: Frontend Setup

### Next.js 14 Config
- `next.config.ts` ไม่ supported ใน Next.js 14 — ต้องใช้ `next.config.mjs` แทน
- `next.config.ts` support เพิ่มมาใน Next.js 15 เท่านั้น

### Tailwind + shadcn/ui CSS Variables Pattern
- ใช้ `@apply border-border` ใน globals.css ต้อง define `border` color ใน tailwind.config.ts ด้วย
- Pattern: `border: "hsl(var(--border))"` ใน theme.extend.colors
- CSS variables ใช้ format: `--border: 214.3 31.8% 91.4%;` (space-separated HSL channels)
- ไม่ใช่ `#hex` หรือ `hsl(...)` ทั้งหมด — แค่ channel values เท่านั้น

### Installed Packages
- @tanstack/react-query, axios, zod, react-hook-form, @hookform/resolvers
- date-fns, lucide-react, clsx, tailwind-merge, class-variance-authority
- @tiptap/react, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-image, @tiptap/extension-link
- @radix-ui/react-{dialog,dropdown-menu,select,toast,separator,avatar,label,switch,tabs,tooltip}

### lib/api.ts Pattern
- axios interceptor: auto-attach Bearer token จาก localStorage
- 401 refresh flow: retry once with new token, then redirect /login
- `originalRequest._retry` flag ป้องกัน infinite retry loop
