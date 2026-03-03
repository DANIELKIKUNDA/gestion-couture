// Value objects & enums for Caisse
export const StatutCaisse = Object.freeze({
  OUVERTE: "OUVERTE",
  CLOTUREE: "CLOTUREE"
});

export const TypeOperation = Object.freeze({
  ENTREE: "ENTREE",
  SORTIE: "SORTIE"
});

export const ModePaiement = Object.freeze({
  CASH: "CASH",
  MOBILE_MONEY: "MOBILE_MONEY",
  AUTRE: "AUTRE"
});

export const StatutOperation = Object.freeze({
  VALIDE: "VALIDE",
  ANNULEE: "ANNULEE"
});

export const MotifOperation = Object.freeze({
  PAIEMENT_COMMANDE: "PAIEMENT_COMMANDE",
  PAIEMENT_RETOUCHE: "PAIEMENT_RETOUCHE",
  VENTE_STOCK: "VENTE_STOCK",
  ACHAT_STOCK: "ACHAT_STOCK",
  DEPENSE_ATELIER: "DEPENSE_ATELIER",
  AUTRE: "AUTRE"
});

export const TypeBilan = Object.freeze({
  HEBDO: "HEBDO",
  MENSUEL: "MENSUEL"
});

export function assertPositive(value, label) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new Error(`${label} must be > 0`);
  }
}
