import { pool } from "../../../shared/infrastructure/db.js";

export class ConflitVersionParametresError extends Error {
  constructor(currentVersion = null) {
    super("Conflit de version des parametres. Rechargez puis reessayez.");
    this.name = "ConflitVersionParametresError";
    this.currentVersion = currentVersion;
  }
}

export class AtelierParametresRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId, db = this.db) {
    return new AtelierParametresRepoPg(atelierId, db);
  }

  async getCurrent() {
    const res = await this.db.query("SELECT payload, version, updated_at, updated_by FROM atelier_parametres WHERE atelier_id = $1 LIMIT 1", [this.atelierId]);
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
    const res = await this.db.query(
      `INSERT INTO atelier_parametres (id, atelier_id, payload, version, updated_at, updated_by)
       VALUES (COALESCE((SELECT MAX(ap.id) + 1 FROM atelier_parametres ap), 1), $1, $2, 1, NOW(), $3)
       ON CONFLICT (atelier_id)
       DO UPDATE SET
         payload = EXCLUDED.payload,
         version = atelier_parametres.version + 1,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       WHERE ($4::int IS NULL OR atelier_parametres.version = $4::int)
       RETURNING payload, version, updated_at, updated_by`,
      [this.atelierId, payload, updatedBy, expectedVersion]
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
