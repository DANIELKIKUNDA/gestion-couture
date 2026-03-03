export function verifierPermission({ auth, permission }) {
  if (!permission) return true;
  const role = String(auth?.role || auth?.roleId || "").toUpperCase();
  if (role === "PROPRIETAIRE" || role === "ADMIN") return true;
  const permissions = Array.isArray(auth?.permissions) ? auth.permissions : [];
  return permissions.map((p) => String(p || "").toUpperCase()).includes(String(permission).toUpperCase());
}
