# System Requirements - BeFlex Helpdesk

## Overview

BeFlex Helpdesk ประกอบด้วย 4 services ที่ทำงานบน Docker:

| Service | Image | หน้าที่ |
|---|---|---|
| PostgreSQL 16 | `postgres:16-alpine` | ฐานข้อมูลหลัก |
| Rust/Axum Backend | `debian:bookworm-slim` | REST API, IMAP polling, SMTP |
| Next.js 14 Frontend | `node:20-alpine` (standalone) | Web UI |
| Nginx | `nginx:alpine` | Reverse proxy, static files |

---

## Prerequisites

- Docker Engine 24+
- Docker Compose v2+
- OS: Linux (Ubuntu 22.04+ / Debian 12+ แนะนำ) หรือ macOS / Windows (WSL2)

---

## Minimum Spec

สำหรับ **1-10 concurrent users** / ทดสอบ / ใช้งานภายในทีมเล็ก

| Resource | Spec |
|---|---|
| CPU | 1 vCPU |
| RAM | 2 GB |
| Storage | 20 GB SSD |
| Network | 10 Mbps |

### RAM Breakdown (โดยประมาณ)

| Component | Usage |
|---|---|
| PostgreSQL | ~256 MB |
| Rust Backend | ~50-100 MB |
| Next.js Frontend | ~150-200 MB |
| Nginx | ~10 MB |
| Docker + OS Overhead | ~300 MB |
| **รวม** | **~800 MB - 1 GB** |

> หมายเหตุ: ให้ RAM 2 GB เพื่อเผื่อ buffer สำหรับ peak load และ OS operations

---

## Recommended Spec

สำหรับ **10-50 concurrent users** / Production ทั่วไป

| Resource | Spec |
|---|---|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Storage | 50 GB SSD |
| Network | 100 Mbps |

### เหตุผล

- PostgreSQL ต้องการ RAM เพิ่มสำหรับ connection pool และ query cache
- File uploads รองรับสูงสุด 50 MB/ไฟล์ ต้องเผื่อ storage
- IMAP polling + SMTP notification ใช้ network bandwidth เพิ่มเติม
- เผื่อ headroom สำหรับ Docker image updates และ log files

---

## Production / High-Load Spec

สำหรับ **50+ concurrent users** / องค์กรขนาดกลาง-ใหญ่

| Resource | Spec |
|---|---|
| CPU | 4 vCPU |
| RAM | 8 GB |
| Storage | 100 GB+ SSD (NVMe preferred) |
| Network | 100+ Mbps |
| Backup Storage | แยก volume/disk สำหรับ DB backup |

### คำแนะนำเพิ่มเติม

- แยก PostgreSQL ไปใช้ managed database service (เช่น AWS RDS, Cloud SQL) เพื่อลด overhead
- ใช้ external storage (เช่น S3) สำหรับ file attachments แทน local volume
- ตั้ง monitoring (CPU, RAM, Disk I/O) เพื่อ scale ทันเวลา

---

## Storage Estimation

Storage เป็นตัวแปรสำคัญที่สุด ขึ้นอยู่กับปริมาณ file attachments:

| รายการ | ขนาดโดยประมาณ |
|---|---|
| Docker images (ทั้ง 4 services) | ~1.5 GB |
| PostgreSQL data (10,000 tickets) | ~500 MB - 1 GB |
| File attachments (max 50 MB/ไฟล์) | ขึ้นอยู่กับการใช้งาน |
| Logs | ~500 MB - 1 GB (ควรตั้ง log rotation) |
| OS + Docker overhead | ~3-5 GB |

### ตัวอย่างการคำนวณ Storage

| Scenario | Tickets/เดือน | Avg. Attachment/Ticket | Storage ต่อเดือน | Storage ต่อปี |
|---|---|---|---|---|
| ใช้งานเบา | 100 | 1 ไฟล์ (2 MB) | ~200 MB | ~2.5 GB |
| ใช้งานปานกลาง | 500 | 2 ไฟล์ (5 MB) | ~5 GB | ~60 GB |
| ใช้งานหนัก | 2,000 | 3 ไฟล์ (10 MB) | ~60 GB | ~720 GB |

---

## Network Ports

| Port | Service | หมายเหตุ |
|---|---|---|
| 80 | Nginx (HTTP) | เข้าถึงจากภายนอก |
| 443 | Nginx (HTTPS) | เข้าถึงจากภายนอก (ถ้าตั้ง SSL) |
| 3000 | Next.js Frontend | ภายใน Docker network |
| 3001 | Rust Backend API | ภายใน Docker network |
| 5432 | PostgreSQL | ภายใน Docker network (ไม่ควรเปิดออกภายนอก) |

---

## Performance Notes

- **Rust backend มี resource usage ต่ำมาก** เมื่อเทียบกับ Node.js/Python backend ทำให้ระบบโดยรวมเบา
- **Bottleneck หลักคือ PostgreSQL** — ถ้า concurrent users เยอะ ควรเพิ่ม RAM ให้ database ก่อน
- **IMAP polling** ทำงานทุก 60 วินาทีต่อ email account — ถ้ามีหลาย account ให้เผื่อ CPU
- **Next.js standalone mode** ลดขนาด deployment ลงมากเทียบกับ full Next.js build
