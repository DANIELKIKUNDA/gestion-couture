export const PURCHASE_PRICE_MODES = Object.freeze({
  UNIT: "UNITAIRE",
  LOT_TOTAL: "LOT_TOTAL"
});

function asFiniteNonNegative(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN;
}

export function resolvePurchaseEntry({ quantity, mode = PURCHASE_PRICE_MODES.UNIT, amount = 0 } = {}) {
  const qty = asFiniteNonNegative(quantity, 0);
  const enteredAmount = asFiniteNonNegative(amount, 0);
  const normalizedMode = mode === PURCHASE_PRICE_MODES.LOT_TOTAL ? PURCHASE_PRICE_MODES.LOT_TOTAL : PURCHASE_PRICE_MODES.UNIT;

  if (!Number.isFinite(qty)) {
    return { valid: false, error: "La quantite est invalide.", quantity: 0, unitPrice: 0, totalAmount: 0, mode: normalizedMode };
  }
  if (!Number.isFinite(enteredAmount)) {
    return { valid: false, error: "Le montant d'achat est invalide.", quantity: qty, unitPrice: 0, totalAmount: 0, mode: normalizedMode };
  }
  if (normalizedMode === PURCHASE_PRICE_MODES.LOT_TOTAL && enteredAmount > 0 && qty <= 0) {
    return {
      valid: false,
      error: "Indiquez une quantite superieure a zero pour calculer le cout unitaire du lot.",
      quantity: qty,
      unitPrice: 0,
      totalAmount: enteredAmount,
      mode: normalizedMode
    };
  }

  const unitPrice = normalizedMode === PURCHASE_PRICE_MODES.LOT_TOTAL && qty > 0 ? enteredAmount / qty : enteredAmount;
  const totalAmount = normalizedMode === PURCHASE_PRICE_MODES.LOT_TOTAL ? enteredAmount : qty * enteredAmount;
  return { valid: true, error: "", quantity: qty, unitPrice, totalAmount, mode: normalizedMode };
}

function safeNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function calculateStockFinancialSummary(articles = []) {
  return (Array.isArray(articles) ? articles : []).reduce(
    (summary, article) => {
      const quantity = safeNonNegative(article?.quantiteDisponible);
      const purchaseUnit = safeNonNegative(article?.prixAchatMoyen);
      const saleUnit = safeNonNegative(article?.prixVenteUnitaire);
      const purchaseValue = quantity * purchaseUnit;
      const potentialSaleValue = quantity * saleUnit;

      summary.purchaseValue += purchaseValue;
      summary.potentialSaleValue += potentialSaleValue;
      summary.potentialGrossProfit += potentialSaleValue - purchaseValue;
      if (quantity > 0) {
        summary.articlesWithStock += 1;
        if (purchaseUnit === 0) summary.articlesWithoutPurchaseCost += 1;
        if (saleUnit === 0) summary.articlesWithoutSalePrice += 1;
      }
      if (article?.actif !== false && quantity <= safeNonNegative(article?.seuilAlerte)) summary.lowStockCount += 1;
      return summary;
    },
    {
      purchaseValue: 0,
      potentialSaleValue: 0,
      potentialGrossProfit: 0,
      articlesWithStock: 0,
      lowStockCount: 0,
      articlesWithoutPurchaseCost: 0,
      articlesWithoutSalePrice: 0
    }
  );
}
