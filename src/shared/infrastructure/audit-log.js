import { pool } from "./db.js";
import { randomUUID } from "node:crypto";

let auditSchemaReady = false;

export async function ensureEvenementAuditSchema() {
  if (auditSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evenement_audit (
      id_evenement TEXT PRIMARY KEY,
      utilisateur_id TEXT NULL,
      role TEXT NULL,
      atelier_id TEXT NULL,
      action TEXT NOT NULL,
      entite TEXT NULL,
      entite_id TEXT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      date_evenement TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_evenement_audit_date ON evenement_audit (date_evenement DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_evenement_audit_action ON evenement_audit (action)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_evenement_audit_entite ON evenement_audit (entite)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_evenement_audit_atelier_date ON evenement_audit (atelier_id, date_evenement DESC)`);
  auditSchemaReady = true;
}

export async function enregistrerEvenementAudit({
  utilisateurId = null,
  role = null,
  atelierId = null,
  action,
  entite = null,
  entiteId = null,
  payload = {}
}) {
  try {
    const normalizedAtelierId = String(atelierId || "").trim() || null;
    await ensureEvenementAuditSchema();
    await pool.query(
      `INSERT INTO evenement_audit (
         id_evenement,
         utilisateur_id,
         role,
         atelier_id,
         action,
         entite,
         entite_id,
         payload,
         date_evenement
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW())`,
      [
        randomUUID(),
        utilisateurId,
        role,
        normalizedAtelierId,
        action || "UNKNOWN_ACTION",
        entite,
        entiteId,
        JSON.stringify(payload || {})
      ]
    );
  } catch {
    // Do not block business flow if audit persistence fails.
  }
}
