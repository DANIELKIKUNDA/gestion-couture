import { pool } from "../../../shared/infrastructure/db.js";
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
  schemaReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id_utilisateur,
    nom: row.nom_complet,
    email: row.email,
    roleId: row.role,
    actif: row.actif !== false,
    motDePasseHash: row.mot_de_passe_hash,
    atelierId: "ATELIER"
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
          `SELECT id_utilisateur, nom_complet, email, role, actif, mot_de_passe_hash
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
      if (String(user.email || "").toLowerCase() === value) return { ...user };
    }
    return null;
  }

  async getById(id) {
    const value = String(id || "");
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT id_utilisateur, nom_complet, email, role, actif, mot_de_passe_hash
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
    const user = this.store.users.get(value);
    return user ? { ...user } : null;
  }

  async list() {
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT id_utilisateur, nom_complet, email, role, actif, mot_de_passe_hash
           FROM utilisateurs
           ORDER BY date_creation DESC`
        );
        return result.rows.map(mapRow);
      } catch {
        useMemory = true;
      }
    }
    return Array.from(this.store.users.values()).map((u) => ({ ...u }));
  }

  async save(user) {
    const payload = {
      id: String(user.id || ""),
      nom: String(user.nom || "").trim(),
      email: String(user.email || "").trim().toLowerCase() || null,
      roleId: String(user.roleId || "").toUpperCase(),
      actif: user.actif !== false,
      motDePasseHash: String(user.motDePasseHash || "")
    };
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(
          `INSERT INTO utilisateurs (id_utilisateur, nom_complet, email, role, actif, mot_de_passe_hash)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id_utilisateur)
           DO UPDATE SET
             nom_complet = EXCLUDED.nom_complet,
             email = EXCLUDED.email,
             role = EXCLUDED.role,
             actif = EXCLUDED.actif,
             mot_de_passe_hash = EXCLUDED.mot_de_passe_hash`,
          [payload.id, payload.nom, payload.email, payload.roleId, payload.actif, payload.motDePasseHash]
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
