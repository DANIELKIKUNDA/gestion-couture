# Production Go-Live Checklist

- Verify `.env` production secrets are set and rotated.
- Apply all SQL migrations with `npm run migrate`.
- Run backend tests with `npm test`.
- Run integration tests with `npm run test:integration`.
- Validate `/health` and `/openapi.json` in production.
- Confirm backup and restore procedure.
