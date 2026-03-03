import { pool } from "../../../shared/infrastructure/db.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";
import { getAuthStore } from "./_store.js";

let schemaReady = false;
let useMemory = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id_utilisateur TEXT PRIMARY KEY,
      nom_complet TEXT NOT NULL,
      email TEXT NULL,
      telephone TEXT NULL,
      role TEXT NOT NULL,
      actif BOOLEAN NOT NULL DEFAULT true,
      mot_de_passe_hash TEXT NOT NULL,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS etat_compte TEXT NOT NULL DEFAULT 'ACTIVE'`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`);
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
    nom: row.nom_complet,
    email: row.email,
    roleId: row.role,
    actif: etatCompte !== ACCOUNT_STATES.DISABLED,
    etatCompte,
    tokenVersion: Number(row.token_version || 1),
    motDePasseHash: row.mot_de_passe_hash,
    atelierId: "ATELIER"
  };
}

function mapMemoryUser(user) {
  if (!user) return null;
  return {
    ...user,
    etatCompte: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
    tokenVersion: Number(user.tokenVersion || 1),
    actif: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)) !== ACCOUNT_STATES.DISABLED
  };
}

export class UtilisateurRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  async findByEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT id_utilisateur, nom_complet, email, role, actif, etat_compte, token_version, mot_de_passe_hash
           FROM utilisateurs
           WHERE LOWER(email) = $1
           LIMIT 1`,
          [value]
        );
        return mapRow(result.rows[0] || null);
      } catch {
        useMemory = true;
      }
    }
    for (const user of this.store.users.values()) {
      if (String(user.email || "").toLowerCase() === value) return mapMemoryUser(user);
    }
    return null;
  }

  async getById(id) {
    const value = String(id || "");
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT id_utilisateur, nom_complet, email, role, actif, etat_compte, token_version, mot_de_passe_hash
           FROM utilisateurs
           WHERE id_utilisateur = $1
           LIMIT 1`,
          [value]
        );
        return mapRow(result.rows[0] || null);
      } catch {
        useMemory = true;
      }
    }
    return mapMemoryUser(this.store.users.get(value));
  }

  async list() {
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT id_utilisateur, nom_complet, email, role, actif, etat_compte, token_version, mot_de_passe_hash
           FROM utilisateurs
           ORDER BY date_creation DESC`
        );
        return result.rows.map(mapRow);
      } catch {
        useMemory = true;
      }
    }
    return Array.from(this.store.users.values()).map((u) => mapMemoryUser(u));
  }

  async save(user) {
    const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const payload = {
      id: String(user.id || ""),
      nom: String(user.nom || "").trim(),
      email: String(user.email || "").trim().toLowerCase() || null,
      roleId: String(user.roleId || "").toUpperCase(),
      actif: etatCompte !== ACCOUNT_STATES.DISABLED,
      etatCompte,
      tokenVersion: Number(user.tokenVersion || 1),
      motDePasseHash: String(user.motDePasseHash || "")
    };
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `INSERT INTO utilisateurs (id_utilisateur, nom_complet, email, role, actif, etat_compte, token_version, mot_de_passe_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id_utilisateur)
           DO UPDATE SET
             nom_complet = EXCLUDED.nom_complet,
             email = EXCLUDED.email,
             role = EXCLUDED.role,
             actif = EXCLUDED.actif,
             etat_compte = EXCLUDED.etat_compte,
             token_version = EXCLUDED.token_version,
             mot_de_passe_hash = EXCLUDED.mot_de_passe_hash`,
          [payload.id, payload.nom, payload.email, payload.roleId, payload.actif, payload.etatCompte, payload.tokenVersion, payload.motDePasseHash]
        );
      } catch {
        useMemory = true;
      }
    }
    const saved = {
      id: payload.id,
      nom: payload.nom,
      email: payload.email,
      roleId: payload.roleId,
      actif: payload.actif,
      etatCompte: payload.etatCompte,
      tokenVersion: payload.tokenVersion,
      motDePasseHash: payload.motDePasseHash,
      atelierId: "ATELIER"
    };
    if (useMemory) this.store.users.set(saved.id, { ...saved });
    return saved;
  }

  async hasAnyOwner() {
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT 1
           FROM utilisateurs
           WHERE UPPER(role) = 'PROPRIETAIRE'
           LIMIT 1`
        );
        return result.rowCount > 0;
      } catch {
        useMemory = true;
      }
    }
    return Array.from(this.store.users.values()).some((u) => String(u.roleId || "").toUpperCase() === "PROPRIETAIRE");
  }
}
