export function buildAuthContext(payload) {
  return {
    utilisateurId: payload?.sub || null,
    nom: payload?.nom || null,
    role: payload?.role || payload?.roleId || null,
    roleId: payload?.roleId || payload?.role || null,
    atelierId: payload?.atelierId || "ATELIER",
    permissions: Array.isArray(payload?.permissions) ? payload.permissions : []
  };
}
