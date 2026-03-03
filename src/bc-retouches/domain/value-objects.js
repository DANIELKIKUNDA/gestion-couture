// Value objects & enums for Retouche
export const StatutRetouche = Object.freeze({
  DEPOSEE: "DEPOSEE",
  EN_COURS: "EN_COURS",
  TERMINEE: "TERMINEE",
  LIVREE: "LIVREE",
  ANNULEE: "ANNULEE"
});

export const TypeRetouche = Object.freeze({
  OURLET: "OURLET",
  RESSERRAGE: "RESSERRAGE",
  AGRANDISSEMENT: "AGRANDISSEMENT",
  REPARATION: "REPARATION",
  FERMETURE: "FERMETURE",
  AUTRE: "AUTRE"
});

export function assertNonEmpty(value, label) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}
