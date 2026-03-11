# Atelier Backend (Node + Express + PostgreSQL)
\n[![CI](https://github.com/DANIELKIKUNDA/gestion-couture/actions/workflows/ci.yml/badge.svg)](https://github.com/DANIELKIKUNDA/gestion-couture/actions/workflows/ci.yml)\n
## Prerequisites
- Node.js 18+ (or 20+ recommended)
- PostgreSQL client tools (`psql`) for DB init

## Backend Setup
1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
copy .env.example .env
```

Edit `.env` if needed.

3. Initialize database schema

```bash
npm run initdb
```

If you already have an existing database from before the multi-tenant rollout, apply migrations once:

```bash
npm run migrate
```

4. (Optional) Seed demo data

```bash
npm run seed
```

5. Start server (watch mode)

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

## Frontend Setup (Vite + Vue)
1. Install dependencies

```bash
cd frontend
npm install
```

2. Start dev server

```bash
npm run dev
```

3. Build for production

```bash
npm run build
```

## API Examples
See `docs/http-examples.md`.

## Onboarding multi-tenant
- `POST /api/ateliers` cree un atelier avec son proprietaire initial.
- `GET /api/auth/bootstrap-owner/status`, `POST /api/auth/bootstrap-owner` et `POST /api/auth/login` acceptent `atelierSlug` dans le body, la query string, ou le header `X-Atelier-Slug`.
- `GET /api/ateliers/current` retourne l'atelier associe au token courant.
- `GET /api/system/bootstrap-manager/status` et `POST /api/system/bootstrap-manager` permettent d'initialiser le premier `MANAGER_SYSTEME`.
- `GET /api/system/ateliers`, `POST /api/system/ateliers` et `PATCH /api/system/ateliers/:id/activation` sont reserves au `MANAGER_SYSTEME`.

## API Docs (OpenAPI)
OpenAPI JSON is available at:

```
http://localhost:3000/openapi.json
```

## Project Structure
- `src/bc-*` per bounded context (domain, application, infrastructure, interfaces)
- `src/shared` shared helpers
- `schema_*.sql` per BC
- `scripts` for DB init and seeding

## Tests
```bash
npm test
```

Integration smoke test:

```bash
npm run test:integration
```

Multi-tenant integration checks:

```bash
npm run test:integration:multi-tenant
```

Read-only integration tests (skip if DB is unreachable):

```bash
npm run test:integration:readonly
```

## Windows Launcher (One Icon)
Create a single desktop icon that starts backend + frontend in background and opens the app:

```powershell
npm run app:install-icon
```

Then use only `Atelier Couture.lnk` on Desktop (double-click).  
Manual start without shortcut:

```powershell
npm run app:open
```
