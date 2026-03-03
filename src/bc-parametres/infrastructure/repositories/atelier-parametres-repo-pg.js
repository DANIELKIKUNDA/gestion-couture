import { pool } from "../../../shared/infrastructure/db.js";

export class ConflitVersionParametresError extends Error {
  constructor(currentVersion = null) {
    super("Conflit de version des parametres. Rechargez puis reessayez.");
    this.name = "ConflitVersionParametresError";
    this.currentVersion = currentVersion;
  }
}

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

  async save({ payload, expectedVersion = null, updatedBy = null }) {
    const res = await pool.query(
      `INSERT INTO atelier_parametres (id, payload, version, updated_at, updated_by)
       VALUES (1, $1, 1, NOW(), $2)
       ON CONFLICT (id)
       DO UPDATE SET
         payload = EXCLUDED.payload,
         version = atelier_parametres.version + 1,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       WHERE ($3::int IS NULL OR atelier_parametres.version = $3::int)
       RETURNING payload, version, updated_at, updated_by`,
      [payload, updatedBy, expectedVersion]
    );
    if (res.rowCount === 0) {
      const current = await this.getCurrent();
      throw new ConflitVersionParametresError(current?.version || null);
    }
    const row = res.rows[0];
    return {
      payload: row.payload,
      version: Number(row.version || 1),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || null
    };
  }
}
