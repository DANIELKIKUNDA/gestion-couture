export const ROLES = {
  PROPRIETAIRE: "PROPRIETAIRE",
  CAISSIER: "CAISSIER",
  COUTURIER: "COUTURIER",
  MANAGER_SYSTEME: "MANAGER_SYSTEME"
};

export function normalizeRole(role) {
  const v = String(role || "").trim().toUpperCase();
  if (Object.values(ROLES).includes(v)) return v;
  return ROLES.COUTURIER;
}
