export function buildAuthContext(payload) {
  return {
    utilisateurId: payload?.sub || null,
    email: payload?.email || null,
    role: payload?.role || null,
    roleId: payload?.role || null,
    atelierId: payload?.atelierId || null,
    tokenVersion: payload?.tokenVersion === undefined || payload?.tokenVersion === null ? null : Number(payload.tokenVersion)
  };
}
