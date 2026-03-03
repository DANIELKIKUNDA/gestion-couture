import { getAuthStore } from "./_store.js";

export class RolePermissionAtelierRepoPg {
  constructor() {
    this.store = getAuthStore();
  }

  _key(atelierId, role) {
    return `${String(atelierId || "ATELIER")}::${String(role || "").toUpperCase()}`;
  }

  async listByAtelier(atelierId = "ATELIER") {
    return Array.from(this.store.rolePermissions.values())
      .filter((row) => String(row.atelierId || "ATELIER") === String(atelierId))
      .map((row) => ({ ...row }));
  }

  async save({ atelierId = "ATELIER", role, permissions = [], updatedBy = null }) {
    const row = { atelierId, role: String(role || "").toUpperCase(), permissions: [...permissions], updatedBy };
    this.store.rolePermissions.set(this._key(atelierId, role), row);
    return { ...row };
  }

  async get(atelierId = "ATELIER", role) {
    const row = this.store.rolePermissions.get(this._key(atelierId, role));
    return row ? { ...row } : null;
  }
}
