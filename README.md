# Notionish

Self-hosted, multi-user, block-based workspace. See [PLAN.md](./PLAN.md).

## Run with Docker

```bash
cp .env.example .env
# edit JWT_SECRET and passwords
docker compose up -d
```

Then open http://localhost:5173.

## Local dev (without Docker)

Requires Node 20+ and a running MySQL 8.

```bash
# db (only if you don't have MySQL running)
docker compose up -d db

# api
cd packages/api
cp ../../.env.example .env
npm install
npx prisma migrate dev
npm run dev

# web (in another terminal)
cd packages/web
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
