import { DEFAULT_ROLE_PERMISSIONS } from "../../domain/default-role-permissions.js";

export async function gererRolePermissions({ rolePermissionRepo, atelierId = "ATELIER" }) {
  const existing = await rolePermissionRepo.listByAtelier(atelierId);
  if (existing.length === 0) {
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      await rolePermissionRepo.save({ atelierId, role, permissions, updatedBy: "system" });
    }
    return rolePermissionRepo.listByAtelier(atelierId);
  }
  return existing;
}
