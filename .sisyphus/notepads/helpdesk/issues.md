# Issues & Gotchas

(will be populated during development)

## 2026-03-28 — T4: Frontend Setup Issues

### next.config.ts ไม่ supported ใน Next.js 14
- Task ระบุ `next.config.ts` แต่ Next.js 14 ไม่รองรับ
- แก้ไข: ใช้ `next.config.mjs` แทน (content เหมือนกัน แต่ไม่มี TypeScript types)
- หาก upgrade เป็น Next.js 15 ในอนาคต สามารถ rename กลับเป็น `.ts` ได้

### tailwind `border-border` ไม่รู้จัก
- Error: "The `border-border` class does not exist"
- Root cause: globals.css ใช้ `@apply border-border` แต่ tailwind.config.ts ไม่มี `border` ใน colors
- แก้ไข: เพิ่ม `border: "hsl(var(--border))"` ใน theme.extend.colors ของ tailwind.config.ts
