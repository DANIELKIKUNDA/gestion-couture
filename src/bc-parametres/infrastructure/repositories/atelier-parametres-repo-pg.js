import { pool } from "../../../shared/infrastructure/db.js";

export class AtelierParametresRepoPg {
  async getCurrent() {
    const res = await pool.query("SELECT payload, version, updated_at, updated_by FROM atelier_parametres WHERE id = 1");
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return {
      payload: row.payload,
      version: Number(row.version || 1),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || null
    };
  }

  async save({ payload, version = 1, updatedBy = null }) {
    const res = await pool.query(
      `INSERT INTO atelier_parametres (id, payload, version, updated_at, updated_by)
       VALUES (1, $1, $2, NOW(), $3)
       ON CONFLICT (id)
       DO UPDATE SET payload = $1, version = $2, updated_at = NOW(), updated_by = $3
       RETURNING payload, version, updated_at, updated_by`,
      [payload, version, updatedBy]
    );
    const row = res.rows[0];
    return {
      payload: row.payload,
      version: Number(row.version || 1),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || null
    };
  }
}
