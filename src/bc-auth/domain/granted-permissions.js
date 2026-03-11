import { listSystemPermissions, listTenantPermissions } from "./permissions.js";
import { ROLES } from "./roles.js";

function normalizePermissions(permissions = []) {
  return Array.from(new Set((permissions || []).map((permission) => String(permission || "").trim().toUpperCase()).filter(Boolean)));
}

export function resolveGrantedPermissions(roleId, permissions = []) {
  const role = String(roleId || "").trim().toUpperCase();
  const explicitPermissions = normalizePermissions(permissions);

  if (role === ROLES.PROPRIETAIRE) return listTenantPermissions();
  if (role === ROLES.MANAGER_SYSTEME) {
    return explicitPermissions.length > 0 ? explicitPermissions : listSystemPermissions();
  }
  return explicitPermissions;
}
