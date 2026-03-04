import { pool } from "../../../shared/infrastructure/db.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id_utilisateur TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      email TEXT NULL,
      role_id TEXT NOT NULL,
      atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
      actif BOOLEAN NOT NULL DEFAULT true,
      etat_compte TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1,
      mot_de_passe_hash TEXT NOT NULL,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
      date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS nom TEXT NULL`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS role_id TEXT NULL`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS atelier_id TEXT NOT NULL DEFAULT 'ATELIER'`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS etat_compte TEXT NOT NULL DEFAULT 'ACTIVE'`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW()`);

  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'utilisateurs'`
  );
  const hasLegacyNomComplet = cols.rows.some((row) => row.column_name === "nom_complet");
  const hasLegacyRole = cols.rows.some((row) => row.column_name === "role");

  if (hasLegacyNomComplet) {
    await pool.query(`
      UPDATE utilisateurs
      SET nom = COALESCE(NULLIF(nom, ''), nom_complet)
      WHERE (nom IS NULL OR nom = '') AND nom_complet IS NOT NULL
    `);
  }

  if (hasLegacyRole) {
    await pool.query(`
      UPDATE utilisateurs
      SET role_id = COALESCE(NULLIF(role_id, ''), role)
      WHERE (role_id IS NULL OR role_id = '') AND role IS NOT NULL
    `);
  }

  await pool.query(`UPDATE utilisateurs SET nom = 'Utilisateur' WHERE nom IS NULL OR nom = ''`);
  await pool.query(`UPDATE utilisateurs SET role_id = 'COUTURIER' WHERE role_id IS NULL OR role_id = ''`);
  await pool.query(`UPDATE utilisateurs SET atelier_id = 'ATELIER' WHERE atelier_id IS NULL OR atelier_id = ''`);
  await pool.query(`UPDATE utilisateurs SET date_mise_a_jour = NOW() WHERE date_mise_a_jour IS NULL`);
  schemaReady = true;
}

function buildAccountState(row) {
  if (row?.etat_compte) return normalizeAccountState(row.etat_compte);
  return row?.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE;
}

function mapRow(row) {
  if (!row) return null;
  const etatCompte = buildAccountState(row);
  return {
    id: row.id_utilisateur,
    nom: row.nom,
    email: row.email,
    roleId: row.role_id,
    actif: etatCompte !== ACCOUNT_STATES.DISABLED,
    etatCompte,
    tokenVersion: Number(row.token_version || 1),
    motDePasseHash: row.mot_de_passe_hash,
    atelierId: row.atelier_id || "ATELIER"
  };
}

export class UtilisateurRepoPg {
  async findByEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [value]
    );
    return mapRow(result.rows[0] || null);
  }

  async getById(id) {
    const value = String(id || "");
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       WHERE id_utilisateur = $1
       LIMIT 1`,
      [value]
    );
    return mapRow(result.rows[0] || null);
  }

  async list() {
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       ORDER BY date_creation DESC`
    );
    return result.rows.map(mapRow);
  }

  async save(user) {
    const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const payload = {
      id: String(user.id || ""),
      nom: String(user.nom || "").trim(),
      email: String(user.email || "").trim().toLowerCase() || null,
      roleId: String(user.roleId || "").toUpperCase(),
      atelierId: String(user.atelierId || "ATELIER"),
      actif: etatCompte !== ACCOUNT_STATES.DISABLED,
      etatCompte,
      tokenVersion: Number(user.tokenVersion || 1),
      motDePasseHash: String(user.motDePasseHash || "")
    };
    await ensureSchema();
    await pool.query(
      `INSERT INTO utilisateurs (id_utilisateur, nom, email, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash, date_mise_a_jour)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id_utilisateur)
       DO UPDATE SET
         nom = EXCLUDED.nom,
         email = EXCLUDED.email,
         role_id = EXCLUDED.role_id,
         atelier_id = EXCLUDED.atelier_id,
         actif = EXCLUDED.actif,
         etat_compte = EXCLUDED.etat_compte,
         token_version = EXCLUDED.token_version,
         mot_de_passe_hash = EXCLUDED.mot_de_passe_hash,
         date_mise_a_jour = NOW()`,
      [payload.id, payload.nom, payload.email, payload.roleId, payload.atelierId, payload.actif, payload.etatCompte, payload.tokenVersion, payload.motDePasseHash]
    );
    const saved = {
      id: payload.id,
      nom: payload.nom,
      email: payload.email,
      roleId: payload.roleId,
      atelierId: payload.atelierId,
      actif: payload.actif,
      etatCompte: payload.etatCompte,
      tokenVersion: payload.tokenVersion,
      motDePasseHash: payload.motDePasseHash
    };
    return saved;
  }

  async hasAnyOwner() {
    await ensureSchema();
    const result = await pool.query(
      `SELECT 1
       FROM utilisateurs
       WHERE UPPER(role_id) = 'PROPRIETAIRE'
       LIMIT 1`
    );
    return result.rowCount > 0;
  }
}
