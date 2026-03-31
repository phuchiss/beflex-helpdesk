# FRONTEND — Next.js 14 App Router

## OVERVIEW

Next.js 14 App Router with TypeScript strict mode, Tailwind CSS + Radix UI, React Query for data fetching, Axios API client with JWT interceptors.

## STRUCTURE

```
frontend/
├── app/
│   ├── (auth)/             # Login + Register (centered layout, no sidebar)
│   ├── (dashboard)/        # All protected pages (sidebar + header layout)
│   │   ├── dashboard/      # Overview stats
│   │   ├── tickets/        # CRUD + [id] + [id]/edit + new
│   │   ├── settings/       # profile, users, categories, projects
│   │   ├── email-accounts/ # IMAP account management
│   │   └── reports/        # Reporting page
│   ├── layout.tsx          # Root: wraps Providers (React Query + Theme)
│   └── page.tsx            # Redirects to /dashboard
├── components/
│   ├── ui/                 # Radix UI primitives (button, dialog, select, etc.)
│   ├── tickets/            # Ticket-specific components (form, badge, list, detail)
│   ├── auth-guard.tsx      # Client-side route protection
│   ├── markdown-editor.tsx # Tiptap rich text editor
│   └── providers.tsx       # QueryClientProvider + ThemeProvider
├── lib/
│   ├── api.ts              # Axios instance + JWT interceptor + token refresh
│   ├── auth.ts             # Token/user storage in localStorage
│   └── utils.ts            # cn(), formatDate(), formatFileSize(), status/priority maps
└── types/
    └── index.ts            # All API response types (User, Ticket, Comment, etc.)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new page | `app/(dashboard)/{name}/page.tsx` | Export default async component |
| Add Radix UI component | `components/ui/` | Copy from shadcn/ui, uses `cn()` for class merging |
| Add feature component | `components/{feature}/` | Co-locate with related components |
| Add API call | `lib/api.ts` | Use `api.get/post/put/delete`, token auto-attached |
| Add type definition | `types/index.ts` | Keep all API types here, no scattered .d.ts files |
| Modify auth flow | `lib/auth.ts` + `components/auth-guard.tsx` | Token in localStorage |
| Add form | Use `react-hook-form` + `zod` | See existing ticket form for pattern |

## CONVENTIONS

- **Imports**: Always `@/components/...`, `@/lib/...`, `@/types/...` — never relative paths across directories
- **UI components**: Radix UI base in `components/ui/`, styled via Tailwind + `class-variance-authority`
- **Data fetching**: React Query (`@tanstack/react-query`) for server state, `api.ts` Axios instance for HTTP
- **Theme colors**: HSL CSS variables — use `bg-background`, `text-foreground`, `border-border` etc.
- **Route groups**: `(auth)` has centered layout, `(dashboard)` has sidebar + AuthGuard
- **Client components**: Add `"use client"` only when using hooks/browser APIs. Keep pages as server components where possible.
- **Form validation**: Zod schemas + `react-hook-form` resolver

## ANTI-PATTERNS

- **DO NOT** use `fetch()` directly — use `api.ts` Axios instance (handles JWT + refresh)
- **DO NOT** store auth state in React context — use `lib/auth.ts` localStorage helpers
- **DO NOT** create `.d.ts` files for API types — add to `types/index.ts`
- **No SSR data fetching** — all data fetched client-side via React Query
