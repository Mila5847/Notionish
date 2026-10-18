# Notionish — Build Plan

Self-hosted, multi-user, block-based workspace. Notion-alike minus calendar,
custom databases, and mail.

---

## Locked decisions

| Concern | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Editor | BlockNote (Notion-style block editor on TipTap) |
| Styling | Tailwind CSS + shadcn/ui + Radix primitives |
| Icons | Lucide |
| Fonts | Inter (UI), JetBrains Mono (code) |
| Motion | Framer Motion |
| DnD | dnd-kit |
| Code highlight | Shiki |
| Math | KaTeX |
| Emoji picker | emoji-mart |
| Command palette | cmdk |
| Backend | Node + Express + TypeScript |
| ORM | Prisma |
| Database | MySQL 8 |
| Search | MySQL FULLTEXT indexes |
| Auth | JWT in httpOnly cookie + bcrypt |
| Uploads | Local disk (Docker volume) |
| Workspaces | Multi-workspace from day one |
| Deploy | Docker Compose (db + api + web) |

---

## Repo layout

```
notionish/
  docker-compose.yml
  .env.example
  README.md
  PLAN.md                     ← this file
  packages/
    api/
      src/
        index.ts              ← Express bootstrap
        env.ts                ← env parsing/validation
        db.ts                 ← Prisma client singleton
        auth/                 ← register/login/logout/me + middleware
        workspaces/
        pages/
        blocks/
        assets/
        search/
        lib/                  ← errors, logger, fractional index, helpers
      prisma/
        schema.prisma
        migrations/
      uploads/                ← mounted volume (gitignored)
      package.json
      tsconfig.json
      Dockerfile
    web/
      src/
        main.tsx
        app/                  ← routes, layout, providers
        features/
          auth/
          workspace/
          sidebar/
          editor/             ← BlockNote wrapper + slash menu config
          page/
          search/
          command-palette/
        components/ui/        ← shadcn-generated primitives
        lib/                  ← api client, hooks, utils
        styles/               ← tailwind + theme tokens
      index.html
      package.json
      tsconfig.json
      vite.config.ts
      Dockerfile
```

Two independent `package.json`s. No monorepo tooling.

---

## Data model (Prisma schema sketch)

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  avatarUrl    String?
  createdAt    DateTime @default(now())

  memberships  Membership[]
  createdPages Page[]        @relation("PageCreatedBy")
  uploads      Asset[]
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  iconUrl   String?
  createdAt DateTime @default(now())

  members   Membership[]
  pages     Page[]
  assets    Asset[]
}

enum Role { OWNER EDITOR VIEWER }

model Membership {
  id          String    @id @default(cuid())
  userId      String
  workspaceId String
  role        Role
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

model Page {
  id           String    @id @default(cuid())
  workspaceId  String
  parentPageId String?
  title        String
  icon         String?              // emoji or asset URL
  coverUrl     String?
  position     String               // fractional index within siblings
  createdById  String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  archivedAt   DateTime?

  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  parent       Page?     @relation("PageChildren", fields: [parentPageId], references: [id])
  children     Page[]    @relation("PageChildren")
  createdBy    User      @relation("PageCreatedBy", fields: [createdById], references: [id])
  blocks       Block[]

  @@index([workspaceId, parentPageId])
  @@fulltext([title])
}

model Block {
  id            String   @id @default(cuid())
  pageId        String
  parentBlockId String?
  type          String              // "paragraph", "heading", "todo", ...
  content       Json                // BlockNote block content
  position      String              // fractional index
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  page          Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  parent        Block?   @relation("BlockChildren", fields: [parentBlockId], references: [id])
  children      Block[]  @relation("BlockChildren")

  @@index([pageId, parentBlockId])
  @@fulltext([content])             // for search on serialized text
}

model Asset {
  id          String   @id @default(cuid())
  workspaceId String
  uploaderId  String
  filename    String
  mimeType    String
  sizeBytes   Int
  path        String              // relative path in uploads volume
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  uploader    User      @relation(fields: [uploaderId], references: [id])
}
```

**Notes**
- Fractional indexing (string keys like `"a0"`, `"a1"`, `"a0V"`) — insert
  between two blocks without renumbering. Library: `fractional-indexing`.
- Block `content` is BlockNote's block JSON, stored verbatim.
- Permissions v1: workspace role decides everything. Per-page ACLs can be added
  later with a `PagePermission` table without breaking anything.

---

## API surface

All authenticated routes require the session cookie. Workspace routes enforce
role via middleware.

```
Auth
  POST   /auth/register              { email, password, name }
  POST   /auth/login                 { email, password }
  POST   /auth/logout
  GET    /auth/me
  PATCH  /auth/me                    { name?, avatarUrl? }
  POST   /auth/change-password       { current, next }

Workspaces
  GET    /workspaces
  POST   /workspaces                 { name }
  PATCH  /workspaces/:id             { name?, iconUrl? }
  DELETE /workspaces/:id
  GET    /workspaces/:id/members
  POST   /workspaces/:id/members     { email, role }
  PATCH  /workspaces/:id/members/:userId  { role }
  DELETE /workspaces/:id/members/:userId

Pages
  GET    /workspaces/:id/pages       → nested tree, excludes archived
  GET    /workspaces/:id/trash
  POST   /pages                      { workspaceId, parentPageId?, title }
  GET    /pages/:id                  → page + blocks
  PATCH  /pages/:id                  { title?, icon?, coverUrl? }
  POST   /pages/:id/move             { parentPageId?, beforePageId?, afterPageId? }
  POST   /pages/:id/duplicate
  POST   /pages/:id/archive
  POST   /pages/:id/restore
  DELETE /pages/:id                  → hard delete (trash only)
  POST   /pages/:id/favorite
  DELETE /pages/:id/favorite

Blocks
  PUT    /pages/:id/blocks           { blocks: [...] }   ← debounced bulk save

Assets
  POST   /workspaces/:id/assets      (multipart)
  GET    /assets/:id                 → streams file with auth check

Search
  GET    /workspaces/:id/search?q=…  → { pages: [...], blocks: [...] }

Utility
  GET    /unsplash/search?q=…        → proxied Unsplash results (for covers)
  GET    /bookmark/preview?url=…     → OpenGraph fetch for /bookmark blocks
```

---

## Milestones

Each milestone ends at a mergeable, usable checkpoint. Estimates are focused
work-days (solo).

### M0 — Foundation & design system (2 days)
- Init both packages with TS strict mode, ESLint, Prettier
- Tailwind + shadcn/ui setup, theme tokens (light/dark), Inter + JetBrains Mono
- Docker Compose: MySQL 8, api (nodemon dev), web (vite dev), volume for uploads
- Prisma init, first migration (User, Workspace, Membership empty tables)
- Health-check endpoint, one styled "Hello" page proving the whole stack

### M1 — Auth & workspaces skeleton (3 days)
- Register, login, logout, `/me` endpoints; bcrypt + JWT cookie
- Auth middleware, protected route wrapper on the frontend
- Workspace CRUD + create-first-workspace-on-register flow
- Workspace switcher in sidebar header
- Empty sidebar + empty content pane, both styled

### M2 — Pages + editor (5 days)
- Page CRUD, one Page model row + one Block row per new page
- BlockNote integrated, configured with our slash-menu block set
- Debounced autosave of blocks (bulk PUT)
- Markdown shortcuts (`#`, `-`, `[]`, `>`, ` ``` `, `---`)
- All block types wired: text, h1-3, todo, bullet, number, quote, callout,
  divider, toggle, code (Shiki), math (KaTeX)
- Block handle (`⋮⋮`) with menu: turn-into, duplicate, delete, color, copy link
- Text formatting toolbar on selection

### M3 — Page tree + navigation (4 days)
- Sidebar tree, expand/collapse, unlimited nesting
- Create subpage, rename inline, drag to reorder / reparent (dnd-kit)
- Breadcrumbs with parent hover-preview
- Favorites section (star/unstar)
- Archive to trash, restore, hard-delete from trash, 30-day auto-purge job
- Duplicate page (deep copy blocks + children)

### M4 — Multi-user (3 days)
- Invite by email, roles (Owner/Editor/Viewer), member management UI
- API middleware enforcing role per workspace and per method
- `@user` mention block + autocomplete
- `[[page]]` inline page link + autocomplete
- Cross-page link block via `/link`

### M5 — Media & embeds (4 days)
- `/image` `/video` `/file` upload → local volume via multer
- Auth-checked streaming download route
- Cover images: upload + Unsplash picker (server proxies the API)
- Emoji picker for page icons (emoji-mart), custom image icon option
- `/bookmark` via OpenGraph fetch
- `/embed` (YouTube, Twitter/X, generic iframe)
- `/columns` and `/table` (simple grid) blocks

### M6 — Search, palette, polish (4 days)
- MySQL FULLTEXT indexes on `Page.title` and `Block.content`
- Search endpoint, results UI grouped by page
- `Cmd+K` command palette (cmdk): jump to page, create page, switch workspace,
  toggle theme, open settings
- Focus mode, keyboard shortcut help modal (`Cmd+/`)
- Word count + read time popover
- Loading skeletons, empty states, motion polish pass
- Final theming pass, accessibility audit

**Total: ~25 focused days.** Realistic calendar with life happening: 5–8 weeks.

---

## Self-hosting

- `docker compose up -d` on the home box
- `.env` holds: `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`, `PUBLIC_ORIGIN`,
  optional `UNSPLASH_ACCESS_KEY`
- Uploads volume mounted at `./uploads` on the host
- Backup script: `mysqldump` + `tar` of `uploads/`
- Reverse-proxy behind Caddy/nginx if exposing beyond LAN (out of scope for v1
  docs, but the setup won't fight it)

---

## Non-goals (v1)

- Real-time multi-cursor collaboration (autosave-on-debounce instead)
- Calendar, custom databases, mail
- Mobile app (web is responsive; native later)
- Public page sharing (workspace-only for v1)
- Per-page permissions (workspace role is the sole ACL)
- API for third-party integrations
- Import from Notion/other tools

Each of these has a natural place to slot in later without schema rewrites.
