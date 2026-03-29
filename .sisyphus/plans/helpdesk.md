# Helpdesk System — Work Plan

## Overview
ระบบ Helpdesk ครบวงจรด้วย Rust/Axum backend, Next.js frontend, PostgreSQL database, deploy ด้วย Docker Compose

## Tech Stack
- **Backend**: Rust + Axum 0.7 + SQLx + PostgreSQL
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL 16
- **File Storage**: Local filesystem (Docker volume)
- **Email**: async-imap (IMAP polling) + lettre (SMTP)
- **Auth**: JWT (jsonwebtoken) + argon2
- **Deploy**: Docker Compose + nginx

## TODOs

### Phase 1: Infrastructure & Setup

- [x] **T1: Docker Compose & Project Structure**
  - สร้าง docker-compose.yml (services: postgres, backend, frontend, nginx)
  - สร้าง docker-compose.dev.yml สำหรับ development
  - สร้าง .env.example
  - สร้าง nginx/nginx.conf (reverse proxy)
  - สร้าง directory structure: backend/, frontend/, nginx/, uploads/
  - สร้าง .gitignore

### Phase 2: Backend Foundation

- [x] **T2: Rust Backend Project Setup**
  - สร้าง Cargo.toml พร้อม dependencies ทั้งหมด
  - สร้าง src/main.rs, src/config.rs, src/error.rs, src/db.rs
  - สร้าง module structure: handlers/, models/, services/, middleware/
  - ตั้งค่า tracing/logging
  - ตั้งค่า CORS, router, health check endpoint
  - สร้าง Dockerfile สำหรับ backend

- [x] **T3: Database Migrations (PostgreSQL Schema)**
  - Migration 001: users, refresh_tokens
  - Migration 002: teams, team_members, categories, tags
  - Migration 003: tickets, ticket_tags, ticket_history
  - Migration 004: comments, attachments
  - Migration 005: email_accounts, email_processing_log
  - Migration 006: notifications
  - สร้าง indexes และ constraints ทั้งหมด

- [x] **T4: Authentication System**
  - POST /api/auth/register — สมัครสมาชิก
  - POST /api/auth/login — login, return JWT + refresh token
  - POST /api/auth/refresh — refresh access token
  - POST /api/auth/logout — invalidate refresh token
  - GET /api/auth/me — ดูข้อมูล current user
  - PUT /api/auth/change-password — เปลี่ยนรหัสผ่าน
  - JWT middleware สำหรับ protect routes
  - Role-based access control (admin, agent, customer)

### Phase 3: Core Backend Features

- [x] **T5: User & Team Management API**
  - GET/POST /api/users — list users, create user (admin only)
  - GET/PUT/DELETE /api/users/:id — จัดการ user
  - GET/POST /api/teams — list/create teams
  - GET/PUT/DELETE /api/teams/:id — จัดการ team
  - POST /api/teams/:id/members — เพิ่มสมาชิกใน team
  - DELETE /api/teams/:id/members/:user_id — ลบสมาชิก
  - GET/POST/PUT/DELETE /api/categories — จัดการ categories
  - GET/POST/PUT/DELETE /api/tags — จัดการ tags

- [x] **T6: Ticket Management API**
  - GET /api/tickets — list tickets (with filters: status, priority, assignee, category, search, page)
  - POST /api/tickets — create ticket
  - GET /api/tickets/:id — get ticket detail
  - PUT /api/tickets/:id — update ticket (status, priority, assignee, etc.)
  - DELETE /api/tickets/:id — soft delete ticket
  - POST /api/tickets/:id/assign — assign to agent/team
  - GET /api/tickets/:id/history — ดู audit log
  - GET /api/dashboard/stats — ticket statistics
  - Ticket history/audit trail สำหรับทุก field change

- [x] **T7: Comment & Attachment API**
  - GET /api/tickets/:id/comments — list comments
  - POST /api/tickets/:id/comments — create comment (supports internal notes)
  - PUT /api/tickets/:id/comments/:comment_id — edit comment
  - DELETE /api/tickets/:id/comments/:comment_id — delete comment
  - POST /api/attachments — upload file (multipart/form-data, max 50MB)
  - GET /api/attachments/:id/download — download/view file
  - DELETE /api/attachments/:id — delete attachment
  - Support: ภาพ, PDF, Word, Excel, ZIP, text files
  - Virus scan: skip (future feature)

- [x] **T8: Email-to-Ticket System (IMAP Polling)**
  - GET/POST/PUT/DELETE /api/email-accounts — จัดการ email accounts
  - POST /api/email-accounts/:id/test — ทดสอบ IMAP connection
  - Background tokio task: polling ทุก 60 วินาที
  - Parse email: subject → ticket title, body → description
  - Handle attachments จาก email
  - Threading: In-Reply-To → เพิ่มเป็น comment ใน existing ticket
  - Deduplication: ตรวจ Message-ID ไม่ให้ import email ซ้ำ
  - Auto-create requester จาก email address ถ้ายังไม่มีใน system

### Phase 4: Frontend Foundation

- [x] **T9: Next.js Project Setup & Design System**
  - สร้าง Next.js 14 project พร้อม TypeScript + Tailwind CSS
  - ติดตั้ง shadcn/ui components
  - ตั้งค่า theme: primary color, font (Inter)
  - สร้าง lib/api.ts — API client พร้อม auth header
  - สร้าง lib/auth.ts — JWT management, cookie handling
  - สร้าง types/index.ts — TypeScript types ทั้งหมด
  - สร้าง providers: QueryProvider, AuthProvider
  - สร้าง layout: Sidebar navigation, Header, main content area
  - สร้าง Dockerfile สำหรับ frontend

- [x] **T10: Authentication UI**
  - /login — หน้า Login (email + password)
  - /register — หน้า Register (ชื่อ, email, password)
  - Auth middleware (Next.js middleware.ts) — redirect ถ้ายัง login ไม่ได้
  - Profile dropdown ใน header (avatar, logout)
  - Persistent auth state via httpOnly cookies

### Phase 5: Core Frontend Features

- [x] **T11: Dashboard & Navigation**
  - /dashboard — Dashboard หน้าหลัก
    - Stats cards: Total tickets, Open, In Progress, Resolved, Overdue
    - Recent tickets table
    - Ticket distribution chart (by status, priority)
  - Sidebar navigation: Dashboard, Tickets, Email Accounts, Settings
  - Breadcrumb navigation
  - Global search bar (search tickets)
  - Notification bell icon

- [x] **T12: Ticket List Page**
  - /tickets — หน้า list tickets
  - Filters: status dropdown, priority dropdown, assignee, category, date range
  - Search box (subject/description)
  - Sortable columns: ticket#, subject, status, priority, assignee, created_at
  - Pagination
  - Bulk actions: change status, assign, delete
  - "New Ticket" button
  - Color-coded priority badges, status badges
  - Quick status change inline

- [x] **T13: Ticket Detail Page**
  - /tickets/[id] — หน้า ticket detail
  - Header: ticket# + subject, status badge, priority badge
  - Info panel (right): assignee, requester, team, category, tags, created/updated date
  - Description with rich text display
  - Comment thread (แยก public/internal notes)
  - Comment input: TipTap rich text editor + file upload dropzone
  - Attachment list: preview images inline, download link for files
  - Status change dropdown
  - Assign to agent/team
  - Activity/History log (collapsible)
  - Edit ticket button (for admin/agent)

- [x] **T14: Create & Edit Ticket**
  - /tickets/new — Create ticket
  - /tickets/[id]/edit — Edit ticket
  - Form fields: subject, description (TipTap), status, priority, category, assignee, team, tags, due date
  - File attachment dropzone (multi-file)
  - Preview attached files before submit
  - Auto-save draft (localStorage)
  - Validation with zod

### Phase 6: Advanced Frontend Features

- [x] **T15: Email Account Management UI**
  - /email-accounts — list email accounts
  - Add/Edit email account modal: name, email, IMAP host/port/username/password, TLS, polling interval
  - Test connection button
  - Enable/disable toggle
  - Last polled timestamp
  - Manual poll button

- [x] **T16: Settings & Admin Pages**
  - /settings/profile — แก้ไขโปรไฟล์, เปลี่ยนรหัสผ่าน
  - /settings/categories — จัดการ categories (admin)
  - /settings/tags — จัดการ tags (admin)
  - /settings/teams — จัดการ teams (admin)
  - /settings/users — จัดการ users (admin): list, create, edit, deactivate

### Final Verification Wave

- [x] **F1: Security Review**
  - ตรวจ JWT validation ครบทุก protected endpoint
  - ตรวจ role-based access control (admin-only routes)
  - ตรวจ input validation ใน Rust handlers
  - ตรวจ SQL injection prevention (sqlx parameterized queries)
  - ตรวจ file upload validation (mime type, file size)
  - ตรวจ CORS configuration
  - ตรวจ rate limiting (ถ้ามี)

- [x] **F2: API Completeness Review**
  - ทดสอบทุก API endpoint ด้วย curl
  - ตรวจ error handling ครบถ้วน (400, 401, 403, 404, 500)
  - ตรวจ pagination ทำงานถูกต้อง
  - ตรวจ file upload/download ทำงาน
  - ตรวจ email polling ทำงานกับ real IMAP account

- [x] **F3: Frontend UI/UX Review**
  - ตรวจทุกหน้าด้วย Playwright
  - ตรวจ responsive design (mobile, tablet, desktop)
  - ตรวจ form validation แสดง error message ถูกต้อง
  - ตรวจ loading states และ error states
  - ตรวจ file upload UI ทำงานถูกต้อง
  - ตรวจ TipTap editor ทำงานถูกต้อง

- [x] **F4: Docker Deployment Test**
  - `docker-compose up -d` สำเร็จโดยไม่มี error
  - ทุก service healthy
  - Frontend เข้าถึงได้ผ่าน http://localhost
  - API เข้าถึงได้ผ่าน http://localhost/api
  - Database migrations รันอัตโนมัติ
  - File upload/download ทำงานผ่าน Docker volume

## Definition of Done
- [ ] ทุก T-task ผ่าน automated + manual verification
- [ ] ทุก F-task ผ่านและ APPROVE
- [ ] `docker-compose up` สร้างระบบทำงานได้สมบูรณ์
- [ ] README.md อธิบายวิธี setup และ run
