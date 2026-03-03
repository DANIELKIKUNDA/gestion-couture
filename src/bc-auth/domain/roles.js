export const ROLES = {
  PROPRIETAIRE: "PROPRIETAIRE",
  CAISSIER: "CAISSIER",
  COUTURIER: "COUTURIER"
};

export function normalizeRole(role) {
  const v = String(role || "").trim().toUpperCase();
  if (Object.values(ROLES).includes(v)) return v;
  return ROLES.COUTURIER;
}
