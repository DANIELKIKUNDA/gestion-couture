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
      role TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      actif BOOLEAN NOT NULL DEFAULT true,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(role, permission_code)
    )
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
        const roleRows = await pool.query(`SELECT DISTINCT role FROM role_permission_atelier WHERE actif = true ORDER BY role ASC`);
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
        await pool.query(`DELETE FROM role_permission_atelier WHERE role = $1`, [roleValue]);
        for (const permission of permissionValues) {
          await pool.query(
            `INSERT INTO role_permission_atelier (id_role_permission, role, permission_code, actif)
             VALUES ($1, $2, $3, true)
             ON CONFLICT (role, permission_code)
             DO UPDATE SET actif = true`,
            [randomUUID(), roleValue, permission]
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
           WHERE role = $1 AND actif = true
           ORDER BY permission_code ASC`,
          [roleValue]
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
