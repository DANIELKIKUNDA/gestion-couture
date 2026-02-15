// Value objects & enums for Commande
export const StatutCommande = Object.freeze({
  CREEE: "CREEE",
  EN_COURS: "EN_COURS",
  TERMINEE: "TERMINEE",
  LIVREE: "LIVREE",
  ANNULEE: "ANNULEE"
});

export function assertNonEmpty(value, label) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}
