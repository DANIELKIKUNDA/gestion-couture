import { pool } from "../db.js";

function mapRow(row) {
  if (!row) return null;
  return {
    idAtelier: row.id_atelier,
    nom: row.nom,
    slug: row.slug,
    actif: row.actif !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const schemaReadyByConnection = new WeakSet();

async function ensureSchema(db = pool) {
  if (schemaReadyByConnection.has(db)) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ateliers (
      id_atelier TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      actif BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ateliers_slug_lower ON ateliers ((LOWER(slug)))`);
  schemaReadyByConnection.add(db);
}

export class AtelierRepoPg {
  constructor(db = pool) {
    this.db = db;
  }

  async listAll() {
    await ensureSchema(this.db);
    const result = await this.db.query(
      `SELECT id_atelier, nom, slug, actif, created_at, updated_at
       FROM ateliers
       ORDER BY created_at DESC`
    );
    return result.rows.map(mapRow);
  }

  async getById(idAtelier) {
    await ensureSchema(this.db);
    const result = await this.db.query(
      `SELECT id_atelier, nom, slug, actif, created_at, updated_at
       FROM ateliers
       WHERE id_atelier = $1
       LIMIT 1`,
      [String(idAtelier || "")]
    );
    return mapRow(result.rows[0] || null);
  }

  async getBySlug(slug) {
    await ensureSchema(this.db);
    const result = await this.db.query(
      `SELECT id_atelier, nom, slug, actif, created_at, updated_at
       FROM ateliers
       WHERE LOWER(slug) = $1
       LIMIT 1`,
      [normalizeSlug(slug)]
    );
    return mapRow(result.rows[0] || null);
  }

  async save({ idAtelier, nom, slug, actif = true }) {
    await ensureSchema(this.db);
    const payload = {
      idAtelier: String(idAtelier || "").trim(),
      nom: String(nom || "").trim(),
      slug: normalizeSlug(slug),
      actif: actif !== false
    };
    const result = await this.db.query(
      `INSERT INTO ateliers (id_atelier, nom, slug, actif, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id_atelier)
       DO UPDATE SET
         nom = EXCLUDED.nom,
         slug = EXCLUDED.slug,
         actif = EXCLUDED.actif,
         updated_at = NOW()
       RETURNING id_atelier, nom, slug, actif, created_at, updated_at`,
      [payload.idAtelier, payload.nom, payload.slug, payload.actif]
    );
    return mapRow(result.rows[0] || null);
  }

  async setActive(idAtelier, actif) {
    await ensureSchema(this.db);
    const result = await this.db.query(
      `UPDATE ateliers
       SET actif = $2,
           updated_at = NOW()
       WHERE id_atelier = $1
       RETURNING id_atelier, nom, slug, actif, created_at, updated_at`,
      [String(idAtelier || ""), actif !== false]
    );
    return mapRow(result.rows[0] || null);
  }
}
