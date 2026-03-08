import { createHash, randomUUID } from "node:crypto";
import { pool } from "../../../shared/infrastructure/db.js";
import { getAuthStore } from "./_store.js";

let schemaReady = false;
let useMemory = false;

function hashResetToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_token (
      id_token TEXT PRIMARY KEY,
      id_utilisateur TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expire_at TIMESTAMP NOT NULL,
      utilise BOOLEAN NOT NULL DEFAULT false,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_token (id_utilisateur)`);
  schemaReady = true;
}

export class PasswordResetTokenRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async save({ token, utilisateurId, expiresAt }) {
    const payload = {
      token: String(token || ""),
      tokenHash: hashResetToken(token),
      utilisateurId: String(utilisateurId || ""),
      expiresAt: String(expiresAt || new Date().toISOString())
    };
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `INSERT INTO password_reset_token (id_token, id_utilisateur, token_hash, expire_at, utilise)
           VALUES ($1, $2, $3, $4::timestamp, false)`,
          [randomUUID(), payload.utilisateurId, payload.tokenHash, payload.expiresAt]
        );
        return;
      } catch {
        useMemory = true;
      }
    }
    this.store.resetTokens.set(payload.tokenHash, {
      tokenHash: payload.tokenHash,
      utilisateurId: payload.utilisateurId,
      expiresAt: payload.expiresAt,
      usedAt: null
    });
  }

  async findValid(token) {
    const value = String(token || "");
    const tokenHash = hashResetToken(value);
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT id_token, id_utilisateur, token_hash, expire_at, utilise
           FROM password_reset_token
           WHERE token_hash = $1
           ORDER BY date_creation DESC
           LIMIT 1`,
          [tokenHash]
        );
        const row = result.rows[0];
        if (!row) return null;
        if (row.utilise) return null;
        if (new Date(row.expire_at).getTime() < Date.now()) return null;
        return {
          tokenHash,
          utilisateurId: row.id_utilisateur,
          expiresAt: new Date(row.expire_at).toISOString(),
          usedAt: row.utilise ? new Date().toISOString() : null
        };
      } catch {
        useMemory = true;
      }
    }
    const row = this.store.resetTokens.get(tokenHash);
    if (!row) return null;
    if (row.usedAt) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    return { ...row };
  }

  async markUsed(token) {
    const tokenHash = hashResetToken(token);
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `UPDATE password_reset_token
           SET utilise = true
           WHERE token_hash = $1`,
          [tokenHash]
        );
        return;
      } catch {
        useMemory = true;
      }
    }
    const row = this.store.resetTokens.get(tokenHash);
    if (!row) return;
    row.usedAt = new Date().toISOString();
  }
}
