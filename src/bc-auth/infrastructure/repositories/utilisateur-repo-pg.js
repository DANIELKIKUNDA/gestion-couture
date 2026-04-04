import { pool } from "../../../shared/infrastructure/db.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";

let schemaReady = false;
let hasLegacyNomComplet = false;
let hasLegacyRole = false;

async function getSchemaDiagnostics() {
  const [columnsResult, constraintsResult] = await Promise.all([
    pool.query(
      `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'utilisateurs'
       ORDER BY ordinal_position`
    ),
    pool.query(
      `SELECT c.conname, c.contype
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'utilisateurs'
       ORDER BY c.conname`
    )
  ]);

  return {
    columns: columnsResult.rows.map((row) => ({
      name: row.column_name,
      nullable: row.is_nullable,
      default: row.column_default
    })),
    constraints: constraintsResult.rows.map((row) => ({
      name: row.conname,
      type: row.contype
    }))
  };
}

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id_utilisateur TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      email TEXT NULL,
      telephone TEXT NULL,
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
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email TEXT NULL`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS telephone TEXT NULL`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS role_id TEXT NULL`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS atelier_id TEXT NOT NULL DEFAULT 'ATELIER'`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS etat_compte TEXT NOT NULL DEFAULT 'ACTIVE'`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS mot_de_passe_hash TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS date_creation TIMESTAMP NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS date_mise_a_jour TIMESTAMP NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE utilisateurs ALTER COLUMN atelier_id SET DEFAULT 'ATELIER'`);
  await pool.query(`ALTER TABLE utilisateurs ALTER COLUMN actif SET DEFAULT true`);
  await pool.query(`ALTER TABLE utilisateurs ALTER COLUMN etat_compte SET DEFAULT 'ACTIVE'`);
  await pool.query(`ALTER TABLE utilisateurs ALTER COLUMN token_version SET DEFAULT 1`);
  await pool.query(`ALTER TABLE utilisateurs ALTER COLUMN date_creation SET DEFAULT NOW()`);
  await pool.query(`ALTER TABLE utilisateurs ALTER COLUMN date_mise_a_jour SET DEFAULT NOW()`);

  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'utilisateurs'`
  );
  const availableColumns = new Set(cols.rows.map((row) => row.column_name));
  const requiredColumns = [
    "id_utilisateur",
    "nom",
    "email",
    "telephone",
    "role_id",
    "atelier_id",
    "actif",
    "etat_compte",
    "token_version",
    "mot_de_passe_hash",
    "date_creation",
    "date_mise_a_jour"
  ];
  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Schema utilisateurs incomplet: colonnes manquantes ${missingColumns.join(", ")}`);
  }
  hasLegacyNomComplet = cols.rows.some((row) => row.column_name === "nom_complet");
  hasLegacyRole = cols.rows.some((row) => row.column_name === "role");

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
  await pool.query(`UPDATE utilisateurs SET mot_de_passe_hash = '' WHERE mot_de_passe_hash IS NULL`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'utilisateurs'
          AND c.contype IN ('p', 'u')
          AND a.attname = 'id_utilisateur'
      ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_utilisateurs_id_utilisateur_unique
          ON public.utilisateurs (id_utilisateur);
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('ateliers') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'utilisateurs_atelier_fk'
         ) THEN
        ALTER TABLE utilisateurs
          ADD CONSTRAINT utilisateurs_atelier_fk
          FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
      END IF;
    END $$;
  `);
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
    telephone: row.telephone || "",
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
      `SELECT id_utilisateur, nom, email, telephone, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [value]
    );
    return mapRow(result.rows[0] || null);
  }

  async findByEmailInAtelier(email, atelierId = "ATELIER") {
    const value = String(email || "").trim().toLowerCase();
    const atelierValue = String(atelierId || "ATELIER");
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, telephone, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       WHERE LOWER(email) = $1
         AND atelier_id = $2
       LIMIT 1`,
      [value, atelierValue]
    );
    return mapRow(result.rows[0] || null);
  }

  async getById(id) {
    const value = String(id || "");
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, telephone, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
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
      `SELECT id_utilisateur, nom, email, telephone, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       ORDER BY date_creation DESC`
    );
    return result.rows.map(mapRow);
  }

  async listByAtelier(atelierId = "ATELIER") {
    const value = String(atelierId || "ATELIER");
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, telephone, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       WHERE atelier_id = $1
       ORDER BY date_creation DESC`,
      [value]
    );
    return result.rows.map(mapRow);
  }

  async getByIdAndAtelier(id, atelierId = "ATELIER") {
    const idValue = String(id || "");
    const atelierValue = String(atelierId || "ATELIER");
    await ensureSchema();
    const result = await pool.query(
      `SELECT id_utilisateur, nom, email, telephone, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash
       FROM utilisateurs
       WHERE id_utilisateur = $1
         AND atelier_id = $2
       LIMIT 1`,
      [idValue, atelierValue]
    );
    return mapRow(result.rows[0] || null);
  }

  async save(user) {
    const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const payload = {
      id: String(user.id || ""),
      nom: String(user.nom || "").trim(),
      email: String(user.email || "").trim().toLowerCase() || null,
      telephone: String(user.telephone || "").trim() || null,
      roleId: String(user.roleId || "").toUpperCase(),
      atelierId: String(user.atelierId || "ATELIER"),
      actif: etatCompte !== ACCOUNT_STATES.DISABLED,
      etatCompte,
      tokenVersion: Number(user.tokenVersion || 1),
      motDePasseHash: String(user.motDePasseHash || "")
    };
    await ensureSchema();
    const columns = [
      "id_utilisateur",
      "nom",
      "email",
      "telephone",
      "role_id",
      "atelier_id",
      "actif",
      "etat_compte",
      "token_version",
      "mot_de_passe_hash"
    ];
    const values = [
      payload.id,
      payload.nom,
      payload.email,
      payload.telephone,
      payload.roleId,
      payload.atelierId,
      payload.actif,
      payload.etatCompte,
      payload.tokenVersion,
      payload.motDePasseHash
    ];

    if (hasLegacyNomComplet) {
      columns.splice(2, 0, "nom_complet");
      values.splice(2, 0, payload.nom);
    }
    if (hasLegacyRole) {
      const roleInsertIndex = hasLegacyNomComplet ? 6 : 5;
      columns.splice(roleInsertIndex, 0, "role");
      values.splice(roleInsertIndex, 0, payload.roleId);
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const updates = [
      "nom = EXCLUDED.nom",
      "email = EXCLUDED.email",
      "telephone = EXCLUDED.telephone",
      "role_id = EXCLUDED.role_id",
      "atelier_id = EXCLUDED.atelier_id",
      "actif = EXCLUDED.actif",
      "etat_compte = EXCLUDED.etat_compte",
      "token_version = EXCLUDED.token_version",
      "mot_de_passe_hash = EXCLUDED.mot_de_passe_hash",
      "date_mise_a_jour = NOW()"
    ];
    if (hasLegacyNomComplet) updates.unshift("nom_complet = EXCLUDED.nom_complet");
    if (hasLegacyRole) updates.unshift("role = EXCLUDED.role");

    const sql = `INSERT INTO utilisateurs (${columns.join(", ")}, date_mise_a_jour)
       VALUES (${placeholders}, NOW())
       ON CONFLICT (id_utilisateur)
       DO UPDATE SET
         ${updates.join(", ")}`;

    try {
      await pool.query(sql, values);
    } catch (error) {
      let diagnostics = null;
      try {
        diagnostics = await getSchemaDiagnostics();
      } catch (diagnosticError) {
        diagnostics = {
          diagnosticsError: diagnosticError.message
        };
      }
      console.error("[auth][utilisateurs] echec upsert", {
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column,
        message: error.message,
        sql,
        payload: {
          id: payload.id,
          nom: payload.nom,
          email: payload.email,
          roleId: payload.roleId,
          atelierId: payload.atelierId,
          actif: payload.actif,
          etatCompte: payload.etatCompte,
          tokenVersion: payload.tokenVersion
        },
        diagnostics
      });
      throw error;
    }
    const saved = {
      id: payload.id,
      nom: payload.nom,
      email: payload.email,
      telephone: payload.telephone,
      roleId: payload.roleId,
      atelierId: payload.atelierId,
      actif: payload.actif,
      etatCompte: payload.etatCompte,
      tokenVersion: payload.tokenVersion,
      motDePasseHash: payload.motDePasseHash
    };
    return saved;
  }

  async hasAnyOwner(atelierId = null) {
    await ensureSchema();
    const params = [];
    let atelierSql = "";
    if (atelierId !== null && atelierId !== undefined) {
      params.push(String(atelierId || "ATELIER"));
      atelierSql = ` AND atelier_id = $1`;
    }
    const result = await pool.query(
      `SELECT 1
       FROM utilisateurs
       WHERE UPPER(role_id) = 'PROPRIETAIRE'
       ${atelierSql}
       LIMIT 1`,
      params
    );
    return result.rowCount > 0;
  }

  async countActiveOwners(atelierId = null) {
    await ensureSchema();
    const params = [];
    let atelierSql = "";
    if (atelierId !== null && atelierId !== undefined) {
      params.push(String(atelierId || "ATELIER"));
      atelierSql = ` AND atelier_id = $1`;
    }
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM utilisateurs
       WHERE UPPER(role_id) = 'PROPRIETAIRE'
         AND UPPER(COALESCE(etat_compte, 'ACTIVE')) = 'ACTIVE'
         AND actif = true
         ${atelierSql}`,
      params
    );
    return Number(result.rows[0]?.total || 0);
  }
}
