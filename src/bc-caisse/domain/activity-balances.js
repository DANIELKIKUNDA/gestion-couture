export const CAISSE_ACTIVITIES = Object.freeze({
  ATELIER: "ATELIER",
  STOCK: "STOCK"
});

function amount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeActivity(value) {
  return String(value || "ATELIER").trim().toUpperCase() === CAISSE_ACTIVITIES.STOCK
    ? CAISSE_ACTIVITIES.STOCK
    : CAISSE_ACTIVITIES.ATELIER;
}

export function calculateActivityBalances({
  openingBalance = 0,
  initialAllocation = null,
  operations = []
} = {}) {
  const globalOpening = amount(openingBalance);
  const allocationConfigured = Boolean(initialAllocation?.configured);
  const initialAtelier = allocationConfigured ? amount(initialAllocation?.soldeAtelierInitial) : 0;
  const initialStock = allocationConfigured ? amount(initialAllocation?.soldeStockInitial) : 0;
  const initialUnallocated = globalOpening - initialAtelier - initialStock;

  let mouvementAtelier = 0;
  let mouvementStock = 0;
  let totalEntreesAtelier = 0;
  let totalSortiesAtelier = 0;
  let totalEntreesStock = 0;
  let totalSortiesStock = 0;

  for (const op of Array.isArray(operations) ? operations : []) {
    if (String(op?.statutOperation || op?.statut_operation || "").trim().toUpperCase() === "ANNULEE") continue;
    const type = String(op?.typeOperation || op?.type_operation || "").trim().toUpperCase();
    if (type !== "ENTREE" && type !== "SORTIE") continue;
    const value = amount(op?.montant);
    const activity = normalizeActivity(op?.activite);
    const signed = type === "ENTREE" ? value : -value;

    if (activity === CAISSE_ACTIVITIES.STOCK) {
      mouvementStock += signed;
      if (type === "ENTREE") totalEntreesStock += value;
      else totalSortiesStock += value;
    } else {
      mouvementAtelier += signed;
      if (type === "ENTREE") totalEntreesAtelier += value;
      else totalSortiesAtelier += value;
    }
  }

  const soldeAtelier = initialAtelier + mouvementAtelier;
  const soldeStock = initialStock + mouvementStock;
  const soldeNonReparti = initialUnallocated;
  const soldeGlobalCalcule = soldeAtelier + soldeStock + soldeNonReparti;

  return {
    allocationConfigured,
    soldeOuvertureInitial: globalOpening,
    soldeAtelierInitial: initialAtelier,
    soldeStockInitial: initialStock,
    soldeNonReparti,
    mouvementAtelier,
    mouvementStock,
    soldeAtelier,
    soldeStock,
    soldeGlobalCalcule,
    totalEntreesAtelier,
    totalSortiesAtelier,
    totalEntreesStock,
    totalSortiesStock
  };
}
