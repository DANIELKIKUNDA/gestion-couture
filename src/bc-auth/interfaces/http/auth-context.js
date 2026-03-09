export function buildAuthContext(payload) {
  return {
    utilisateurId: payload?.sub || null,
    email: payload?.email || null,
    role: payload?.role || null,
    roleId: payload?.role || null
  };
}
