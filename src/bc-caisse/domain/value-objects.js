// Value objects & enums for Caisse
export const StatutCaisse = Object.freeze({
  OUVERTE: "OUVERTE",
  CLOTUREE: "CLOTUREE"
});

export const TypeOperation = Object.freeze({
  ENTREE: "ENTREE",
  SORTIE: "SORTIE"
});

export const TypeDepense = Object.freeze({
  QUOTIDIENNE: "QUOTIDIENNE",
  EXCEPTIONNELLE: "EXCEPTIONNELLE"
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
  PAIEMENT_COMMANDE_ITEM: "PAIEMENT_COMMANDE_ITEM",
  PAIEMENT_RETOUCHE: "PAIEMENT_RETOUCHE",
  PAIEMENT_RETOUCHE_ITEM: "PAIEMENT_RETOUCHE_ITEM",
  VENTE_STOCK: "VENTE_STOCK",
  PAIEMENT_STOCK: "PAIEMENT_STOCK",
  ACHAT_STOCK: "ACHAT_STOCK",
  DEPENSE_ATELIER: "DEPENSE_ATELIER",
  REMBOURSEMENT_COMMANDE_ANNULEE: "REMBOURSEMENT_COMMANDE_ANNULEE",
  REMBOURSEMENT_RETOUCHE_ANNULEE: "REMBOURSEMENT_RETOUCHE_ANNULEE",
  ENTREE_MANUELLE: "ENTREE_MANUELLE",
  AUTRE: "AUTRE"
});

export const TypeBilan = Object.freeze({
  HEBDO: "HEBDO",
  MENSUEL: "MENSUEL",
  ANNUEL: "ANNUEL"
});

export function assertPositive(value, label) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new Error(`${label} doit etre > 0`);
  }
}
