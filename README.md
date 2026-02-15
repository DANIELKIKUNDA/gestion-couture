# Atelier Backend (Node + Express + PostgreSQL)

## Prerequisites
- Node.js 18+ (or 20+ recommended)
- PostgreSQL client tools (`psql`) for DB init

## Setup
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

4. (Optional) Seed demo data

```bash
npm run seed
```

5. Start server

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

## API Examples
See `docs/http-examples.md`.

## Project Structure
- `src/bc-*` per bounded context (domain, application, infrastructure, interfaces)
- `src/shared` shared helpers
- `schema_*.sql` per BC
- `scripts` for DB init and seeding

## Tests
```bash
npm test
```
