export class RolePermissionAtelier {
  constructor({ atelierId = "ATELIER", role, permissions = [], updatedBy = null }) {
    this.atelierId = atelierId;
    this.role = String(role || "").toUpperCase();
    this.permissions = Array.from(new Set((permissions || []).map((p) => String(p || "").toUpperCase()).filter(Boolean)));
    this.updatedBy = updatedBy;
  }
}
