// PostgreSQL pool (configure via env vars)
import "dotenv/config";
import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "atelier"
});
