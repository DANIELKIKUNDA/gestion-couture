import { pool } from "../../../shared/infrastructure/db.js";
import {
  DEFAULT_USER_PREFERENCES,
  normalizeUserPreferences
} from "../../domain/utilisateur-preferences.js";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateur_preferences (
      utilisateur_id TEXT PRIMARY KEY,
      atelier_id TEXT NOT NULL,
      page_accueil TEXT NOT NULL DEFAULT 'dashboard',
      restaurer_derniere_page BOOLEAN NOT NULL DEFAULT false,
      mode_demarrage TEXT NOT NULL DEFAULT 'PAGE_ACCUEIL',
      theme TEXT NOT NULL DEFAULT 'SYSTEME',
      date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT utilisateur_preferences_utilisateur_fk
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id_utilisateur) ON DELETE CASCADE
    )
  `);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS atelier_id TEXT NOT NULL DEFAULT 'ATELIER'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS page_accueil TEXT NOT NULL DEFAULT 'dashboard'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS restaurer_derniere_page BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS mode_demarrage TEXT NOT NULL DEFAULT 'PAGE_ACCUEIL'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'SYSTEME'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ADD COLUMN IF NOT EXISTS date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE utilisateur_preferences ALTER COLUMN restaurer_derniere_page SET DEFAULT false`);
  await pool.query(`ALTER TABLE utilisateur_preferences ALTER COLUMN mode_demarrage SET DEFAULT 'PAGE_ACCUEIL'`);
  await pool.query(`ALTER TABLE utilisateur_preferences ALTER COLUMN theme SET DEFAULT 'SYSTEME'`);
  schemaReady = true;
}

function mapRow(row) {
  if (!row) return { ...DEFAULT_USER_PREFERENCES };
  const preferences = normalizeUserPreferences({
    pageAccueil: row.page_accueil,
    modeDemarrage: row.mode_demarrage,
    restaurerDernierePage: row.restaurer_derniere_page,
    theme: row.theme
  });
  return {
    ...preferences,
    updatedAt: row.date_mise_a_jour ? new Date(row.date_mise_a_jour).toISOString() : null
  };
}

export class UtilisateurPreferencesRepoPg {
  async get(utilisateurId, atelierId = "ATELIER") {
    await ensureSchema();
    const result = await pool.query(
      `SELECT page_accueil, restaurer_derniere_page, mode_demarrage, theme, date_mise_a_jour
       FROM utilisateur_preferences
       WHERE utilisateur_id = $1 AND atelier_id = $2
       LIMIT 1`,
      [String(utilisateurId || ""), String(atelierId || "ATELIER")]
    );
    return mapRow(result.rows[0] || null);
  }

  async save({
    utilisateurId,
    atelierId = "ATELIER",
    pageAccueil = DEFAULT_USER_PREFERENCES.pageAccueil,
    modeDemarrage = undefined,
    restaurerDernierePage = undefined,
    theme = DEFAULT_USER_PREFERENCES.theme
  } = {}) {
    await ensureSchema();
    const preferences = normalizeUserPreferences({ pageAccueil, modeDemarrage, restaurerDernierePage, theme });
    const result = await pool.query(
      `INSERT INTO utilisateur_preferences (
         utilisateur_id,
         atelier_id,
         page_accueil,
         restaurer_derniere_page,
         mode_demarrage,
         theme,
         date_mise_a_jour
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (utilisateur_id)
       DO UPDATE SET
         atelier_id = EXCLUDED.atelier_id,
         page_accueil = EXCLUDED.page_accueil,
         restaurer_derniere_page = EXCLUDED.restaurer_derniere_page,
         mode_demarrage = EXCLUDED.mode_demarrage,
         theme = EXCLUDED.theme,
         date_mise_a_jour = NOW()
       RETURNING page_accueil, restaurer_derniere_page, mode_demarrage, theme, date_mise_a_jour`,
      [
        String(utilisateurId || ""),
        String(atelierId || "ATELIER"),
        preferences.pageAccueil,
        preferences.restaurerDernierePage,
        preferences.modeDemarrage,
        preferences.theme
      ]
    );
    return mapRow(result.rows[0] || null);
  }
}

export { DEFAULT_USER_PREFERENCES };
