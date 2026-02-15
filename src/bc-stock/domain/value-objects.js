// Value objects & enums for Stock
export const UniteStock = Object.freeze({
  METRE: "METRE",
  PIECE: "PIECE",
  BOBINE: "BOBINE",
  AUTRE: "AUTRE"
});

export const CategorieArticle = Object.freeze({
  TISSU: "TISSU",
  FIL: "FIL",
  BOUTON: "BOUTON",
  FERMETURE: "FERMETURE",
  ACCESSOIRE: "ACCESSOIRE"
});

export const TypeMouvement = Object.freeze({
  ENTREE: "ENTREE",
  SORTIE: "SORTIE"
});

export const MotifMouvement = Object.freeze({
  ACHAT: "ACHAT",
  VENTE: "VENTE",
  USAGE_ATELIER: "USAGE_ATELIER",
  PERTE: "PERTE",
  AJUSTEMENT: "AJUSTEMENT"
});

export const StatutVente = Object.freeze({
  BROUILLON: "BROUILLON",
  VALIDEE: "VALIDEE",
  ANNULEE: "ANNULEE"
});

export function assertPositive(value, label) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new Error(`${label} must be > 0`);
  }
}

export function assertNonEmpty(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} required`);
  }
}
