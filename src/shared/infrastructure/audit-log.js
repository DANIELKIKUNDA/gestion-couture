import { pool } from "./db.js";
import { randomUUID } from "node:crypto";

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
        atelierId,
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
