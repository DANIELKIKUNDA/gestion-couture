import { createHash } from "node:crypto";
import { pool } from "../../../shared/infrastructure/db.js";
import { getAuthStore } from "./_store.js";

let schemaReady = false;
let useMemory = false;

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_access_token_revocation (
      token_hash TEXT PRIMARY KEY,
      utilisateur_id TEXT NULL,
      reason TEXT NULL,
      date_revocation TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
}

export class AccessTokenRevocationRepoPg {
  constructor() {
    this.store = getAuthStore();
    if (!this.store.revokedAccessTokens) this.store.revokedAccessTokens = new Map();
  }

  async revoke({ token, utilisateurId = null, reason = null }) {
    const tokenHash = hashToken(token);
    if (!tokenHash) return;
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `INSERT INTO auth_access_token_revocation (token_hash, utilisateur_id, reason)
           VALUES ($1, $2, $3)
           ON CONFLICT (token_hash)
           DO UPDATE SET
             utilisateur_id = EXCLUDED.utilisateur_id,
             reason = EXCLUDED.reason,
             date_revocation = NOW()`,
          [tokenHash, utilisateurId, reason]
        );
        return;
      } catch {
        useMemory = true;
      }
    }
    this.store.revokedAccessTokens.set(tokenHash, {
      tokenHash,
      utilisateurId: utilisateurId || null,
      reason: reason || null,
      dateRevocation: new Date().toISOString()
    });
  }

  async isRevoked(token) {
    const tokenHash = hashToken(token);
    if (!tokenHash) return false;
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT 1
           FROM auth_access_token_revocation
           WHERE token_hash = $1
           LIMIT 1`,
          [tokenHash]
        );
        return result.rowCount > 0;
      } catch {
        useMemory = true;
      }
    }
    return this.store.revokedAccessTokens.has(tokenHash);
  }
}
