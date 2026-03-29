# BeFlex Helpdesk

ระบบ Helpdesk ครบวงจร พัฒนาด้วย Rust/Axum + Next.js + PostgreSQL

## Features

- Ticket management (CRUD, status, priority, assignment)
- Email-to-ticket (IMAP polling)
- Comment system with file attachments (images, PDFs, docs)
- User & team management
- Categories & tags
- Dashboard with statistics
- Role-based access (admin, agent, customer)
- JWT authentication

## Tech Stack

- **Backend**: Rust + Axum 0.7 + SQLx
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database**: PostgreSQL 16
- **Deploy**: Docker Compose + nginx

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) Rust 1.75+ and Node.js 20+ for local dev

### Production

```bash
cp .env.example .env
# Edit .env with your settings
docker-compose up -d
```

Access: http://localhost

### Development

```bash
# Start only PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# Backend (terminal 1)
cd backend
DATABASE_URL=postgresql://helpdesk:helpdesk_dev@localhost:5432/helpdesk_dev cargo run

# Frontend (terminal 2)
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

## Environment Variables

See `.env.example` for all variables.

Key variables:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `SMTP_HOST` | SMTP server hostname for email notifications |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USERNAME` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/register` | Register |
| `GET` | `/api/tickets` | List tickets (with filters) |
| `POST` | `/api/tickets` | Create ticket |
| `GET` | `/api/tickets/:id` | Get ticket detail |
| `POST` | `/api/tickets/:id/comments` | Add comment |
| `POST` | `/api/attachments` | Upload file |
| `GET` | `/api/email-accounts` | List email accounts (admin) |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |

## Email-to-Ticket Setup

1. Go to **Email Accounts** in the UI
2. Add IMAP account (Gmail, Outlook, etc.)
3. System polls every 60 seconds
4. New emails → new tickets
5. Email replies → comments on existing tickets

## File Attachments

- Max size: 50MB per file
- Supported: images, PDF, Word, Excel, ZIP, text files
- Stored in Docker volume: `uploads_data`
