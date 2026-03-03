import { pool } from "../../../shared/infrastructure/db.js";
import { getAuthStore } from "./_store.js";

let schemaReady = false;
let useMemory = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_session (
      refresh_token TEXT PRIMARY KEY,
      utilisateur_id TEXT NOT NULL,
      expire_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP NULL,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
}

export class AuthSessionRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async save(session) {
    const payload = {
      refreshToken: String(session.refreshToken || ""),
      utilisateurId: String(session.utilisateurId || ""),
      expiresAt: String(session.expiresAt || "9999-12-31T23:59:59.000Z"),
      revokedAt: session.revokedAt || null
    };
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `INSERT INTO auth_session (refresh_token, utilisateur_id, expire_at, revoked_at)
           VALUES ($1, $2, $3::timestamp, $4::timestamp)
           ON CONFLICT (refresh_token)
           DO UPDATE SET
             utilisateur_id = EXCLUDED.utilisateur_id,
             expire_at = EXCLUDED.expire_at,
             revoked_at = EXCLUDED.revoked_at`,
          [payload.refreshToken, payload.utilisateurId, payload.expiresAt, payload.revokedAt]
        );
        return;
      } catch {
        useMemory = true;
      }
    }
    this.store.sessions.set(payload.refreshToken, { ...payload });
  }

  async findByRefreshToken(refreshToken) {
    const token = String(refreshToken || "");
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT refresh_token, utilisateur_id, expire_at, revoked_at
           FROM auth_session
           WHERE refresh_token = $1
           LIMIT 1`,
          [token]
        );
        const row = result.rows[0];
        if (!row) return null;
        if (row.revoked_at) return null;
        return {
          refreshToken: row.refresh_token,
          utilisateurId: row.utilisateur_id,
          expiresAt: new Date(row.expire_at).toISOString(),
          revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null
        };
      } catch {
        useMemory = true;
      }
    }
    const row = this.store.sessions.get(token);
    if (!row) return null;
    if (row.revokedAt) return null;
    return { ...row };
  }

  async revoke(refreshToken) {
    const token = String(refreshToken || "");
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `UPDATE auth_session
           SET revoked_at = NOW()
           WHERE refresh_token = $1`,
          [token]
        );
        return;
      } catch {
        useMemory = true;
      }
    }
    const row = this.store.sessions.get(token);
    if (!row) return;
    row.revokedAt = new Date().toISOString();
  }
}
