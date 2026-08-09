import { pool } from "../../../shared/infrastructure/db.js";

const DEFAULTS = Object.freeze({
  pageAccueil: "dashboard",
  restaurerDernierePage: true
});

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateur_preferences (
      utilisateur_id TEXT PRIMARY KEY,
      atelier_id TEXT NOT NULL,
      page_accueil TEXT NOT NULL DEFAULT 'dashboard',
      restaurer_derniere_page BOOLEAN NOT NULL DEFAULT true,
      date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT utilisateur_preferences_utilisateur_fk
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id_utilisateur) ON DELETE CASCADE
    )
  `);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS atelier_id TEXT NOT NULL DEFAULT 'ATELIER'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS page_accueil TEXT NOT NULL DEFAULT 'dashboard'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS restaurer_derniere_page BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW()`);
  schemaReady = true;
}

function mapRow(row) {
  if (!row) return { ...DEFAULTS };
  return {
    pageAccueil: String(row.page_accueil || DEFAULTS.pageAccueil),
    restaurerDernierePage: row.restaurer_derniere_page !== false,
    updatedAt: row.date_mise_a_jour ? new Date(row.date_mise_a_jour).toISOString() : null
  };
}

export class UtilisateurPreferencesRepoPg {
  async get(utilisateurId, atelierId = "ATELIER") {
    await ensureSchema();
    const result = await pool.query(
      `SELECT page_accueil, restaurer_derniere_page, date_mise_a_jour
       FROM utilisateur_preferences
       WHERE utilisateur_id = $1 AND atelier_id = $2
       LIMIT 1`,
      [String(utilisateurId || ""), String(atelierId || "ATELIER")]
    );
    return mapRow(result.rows[0] || null);
  }

  async save({ utilisateurId, atelierId = "ATELIER", pageAccueil = DEFAULTS.pageAccueil, restaurerDernierePage = true } = {}) {
    await ensureSchema();
    const result = await pool.query(
      `INSERT INTO utilisateur_preferences (
         utilisateur_id, atelier_id, page_accueil, restaurer_derniere_page, date_mise_a_jour
       ) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (utilisateur_id)
       DO UPDATE SET
         atelier_id = EXCLUDED.atelier_id,
         page_accueil = EXCLUDED.page_accueil,
         restaurer_derniere_page = EXCLUDED.restaurer_derniere_page,
         date_mise_a_jour = NOW()
       RETURNING page_accueil, restaurer_derniere_page, date_mise_a_jour`,
      [
        String(utilisateurId || ""),
        String(atelierId || "ATELIER"),
        String(pageAccueil || DEFAULTS.pageAccueil),
        restaurerDernierePage !== false
      ]
    );
    return mapRow(result.rows[0] || null);
  }
}

export const DEFAULT_USER_PREFERENCES = DEFAULTS;
