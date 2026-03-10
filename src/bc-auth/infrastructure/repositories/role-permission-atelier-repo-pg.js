import { randomUUID } from "node:crypto";
import { pool } from "../../../shared/infrastructure/db.js";
import { getAuthStore } from "./_store.js";

let schemaReady = false;
let useMemory = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permission_atelier (
      id_role_permission TEXT PRIMARY KEY,
      atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
      role TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      actif BOOLEAN NOT NULL DEFAULT true,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(atelier_id, role, permission_code)
    )
  `);
  await pool.query(`ALTER TABLE role_permission_atelier ADD COLUMN IF NOT EXISTS atelier_id TEXT NOT NULL DEFAULT 'ATELIER'`);
  await pool.query(`UPDATE role_permission_atelier SET atelier_id = 'ATELIER' WHERE atelier_id IS NULL OR atelier_id = ''`);
  await pool.query(`ALTER TABLE role_permission_atelier DROP CONSTRAINT IF EXISTS role_permission_atelier_role_permission_code_key`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'role_permission_atelier_atelier_role_permission_key'
      ) THEN
        ALTER TABLE role_permission_atelier
          ADD CONSTRAINT role_permission_atelier_atelier_role_permission_key
          UNIQUE (atelier_id, role, permission_code);
      END IF;
    END $$;
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_permission_atelier_atelier_id ON role_permission_atelier (atelier_id)`);
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('ateliers') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'role_permission_atelier_atelier_fk'
         ) THEN
        ALTER TABLE role_permission_atelier
          ADD CONSTRAINT role_permission_atelier_atelier_fk
          FOREIGN KEY (atelier_id) REFERENCES ateliers(id_atelier);
      END IF;
    END $$;
  `);
  schemaReady = true;
}

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

function normalizePermissions(permissions = []) {
  return Array.from(new Set((permissions || []).map((p) => String(p || "").trim().toUpperCase()).filter(Boolean)));
}

export class RolePermissionAtelierRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  _key(atelierId, role) {
    return `${String(atelierId || "ATELIER")}::${normalizeRole(role)}`;
  }

  async listByAtelier(atelierId = "ATELIER") {
    if (!useMemory) {
      try {
        await ensureSchema();
        const roleRows = await pool.query(
          `SELECT DISTINCT role
           FROM role_permission_atelier
           WHERE atelier_id = $1
             AND actif = true
           ORDER BY role ASC`,
          [String(atelierId || "ATELIER")]
        );
        const items = [];
        for (const row of roleRows.rows) {
          const role = normalizeRole(row.role);
          const perms = await this.get(atelierId, role);
          items.push({
            atelierId: String(atelierId || "ATELIER"),
            role,
            permissions: perms?.permissions || [],
            updatedBy: null
          });
        }
        return items;
      } catch {
        useMemory = true;
      }
    }
    return Array.from(this.store.rolePermissions.values())
      .filter((row) => String(row.atelierId || "ATELIER") === String(atelierId || "ATELIER"))
      .map((row) => ({ ...row }));
  }

  async save({ atelierId = "ATELIER", role, permissions = [], updatedBy = null }) {
    const roleValue = normalizeRole(role);
    const permissionValues = normalizePermissions(permissions);
    if (!useMemory) {
      try {
        await ensureSchema();
        await pool.query(`DELETE FROM role_permission_atelier WHERE atelier_id = $1 AND role = $2`, [String(atelierId || "ATELIER"), roleValue]);
        for (const permission of permissionValues) {
          await pool.query(
            `INSERT INTO role_permission_atelier (id_role_permission, atelier_id, role, permission_code, actif)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (atelier_id, role, permission_code)
             DO UPDATE SET actif = true`,
            [randomUUID(), String(atelierId || "ATELIER"), roleValue, permission]
          );
        }
      } catch {
        useMemory = true;
      }
    }
    const row = { atelierId: String(atelierId || "ATELIER"), role: roleValue, permissions: permissionValues, updatedBy };
    if (useMemory) this.store.rolePermissions.set(this._key(atelierId, roleValue), { ...row });
    return row;
  }

  async get(atelierId = "ATELIER", role) {
    const roleValue = normalizeRole(role);
    if (!useMemory) {
      try {
        await ensureSchema();
        const result = await pool.query(
          `SELECT permission_code
           FROM role_permission_atelier
           WHERE atelier_id = $1
             AND role = $2
             AND actif = true
           ORDER BY permission_code ASC`,
          [String(atelierId || "ATELIER"), roleValue]
        );
        if (result.rowCount === 0) return null;
        return {
          atelierId: String(atelierId || "ATELIER"),
          role: roleValue,
          permissions: result.rows.map((row) => String(row.permission_code || "").toUpperCase()),
          updatedBy: null
        };
      } catch {
        useMemory = true;
      }
    }
    const row = this.store.rolePermissions.get(this._key(atelierId, roleValue));
    return row ? { ...row } : null;
  }
}
