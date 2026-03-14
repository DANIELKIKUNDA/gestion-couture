import { pool } from "../../../shared/infrastructure/db.js";

let schemaReady = false;

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
  async save(session) {
    const payload = {
      refreshToken: String(session.refreshToken || ""),
      utilisateurId: String(session.utilisateurId || ""),
      expiresAt: String(session.expiresAt || "9999-12-31T23:59:59.000Z"),
      revokedAt: session.revokedAt || null
    };
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
  }

  async findByRefreshToken(refreshToken) {
    const token = String(refreshToken || "");
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
    if (new Date(row.expire_at).getTime() <= Date.now()) return null;
    return {
      refreshToken: row.refresh_token,
      utilisateurId: row.utilisateur_id,
      expiresAt: new Date(row.expire_at).toISOString(),
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null
    };
  }

  async revoke(refreshToken) {
    const token = String(refreshToken || "");
    await ensureSchema();
    await pool.query(
      `UPDATE auth_session
       SET revoked_at = NOW()
       WHERE refresh_token = $1`,
      [token]
    );
  }

  async listActiveByUtilisateurId(utilisateurId, { limit = 5 } = {}) {
    const userId = String(utilisateurId || "");
    const safeLimit = Math.max(1, Math.min(20, Number(limit || 5)));
    await ensureSchema();
    const result = await pool.query(
      `SELECT refresh_token, utilisateur_id, expire_at, revoked_at, date_creation
       FROM auth_session
       WHERE utilisateur_id = $1
         AND revoked_at IS NULL
         AND expire_at > NOW()
       ORDER BY date_creation DESC
       LIMIT $2`,
      [userId, safeLimit]
    );
    return result.rows.map((row) => ({
      refreshToken: row.refresh_token,
      utilisateurId: row.utilisateur_id,
      expiresAt: new Date(row.expire_at).toISOString(),
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
      createdAt: row.date_creation ? new Date(row.date_creation).toISOString() : null
    }));
  }

  async countActiveByUtilisateurId(utilisateurId) {
    const userId = String(utilisateurId || "");
    await ensureSchema();
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM auth_session
       WHERE utilisateur_id = $1
         AND revoked_at IS NULL
         AND expire_at > NOW()`,
      [userId]
    );
    return Number(result.rows[0]?.total || 0);
  }

  async revokeByUtilisateurId(utilisateurId) {
    const userId = String(utilisateurId || "");
    await ensureSchema();
    const result = await pool.query(
      `UPDATE auth_session
       SET revoked_at = NOW()
       WHERE utilisateur_id = $1
         AND revoked_at IS NULL`,
      [userId]
    );
    return Number(result.rowCount || 0);
  }
}
