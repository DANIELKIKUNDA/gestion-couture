function toMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return amount;
}

export function computeExplicitItemPaidTotal(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Math.max(0, toMoney(item?.montantPaye)), 0);
}

export function buildDisplayItemPaymentBreakdown(items = [], totalPaid = 0) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const explicitPaidTotal = computeExplicitItemPaidTotal(normalizedItems);
  let remainingImplicitPaid = Math.max(0, toMoney(totalPaid) - explicitPaidTotal);

  return normalizedItems.map((item) => {
    const montant = Math.max(0, toMoney(item?.prix));
    const explicitPaid = Math.min(montant, Math.max(0, toMoney(item?.montantPaye)));
    const implicitPaid = Math.min(Math.max(0, montant - explicitPaid), remainingImplicitPaid);
    remainingImplicitPaid = Math.max(0, remainingImplicitPaid - implicitPaid);
    const paye = explicitPaid + implicitPaid;
    return {
      montant,
      paye,
      reste: Math.max(0, montant - paye),
      explicitPaid,
      implicitPaid
    };
  });
}

export function applyPaymentToItemCollection({
  items = [],
  idItem,
  montant,
  rebuildItem,
  itemLabel = "Item"
}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedIdItem = String(idItem || "").trim();
  const normalizedMontant = toMoney(montant);

  if (!normalizedIdItem) throw new Error(`${itemLabel} introuvable`);
  if (normalizedMontant <= 0) throw new Error("montant doit etre > 0");

  const itemIndex = normalizedItems.findIndex((item) => String(item?.idItem || "").trim() === normalizedIdItem);
  if (itemIndex < 0) throw new Error(`${itemLabel} introuvable`);

  const currentItem = normalizedItems[itemIndex];
  const currentPaid = Math.max(0, toMoney(currentItem?.montantPaye));
  const itemPrice = Math.max(0, toMoney(currentItem?.prix));
  const nextPaid = currentPaid + normalizedMontant;
  if (nextPaid > itemPrice) {
    throw new Error("Le paiement depasse le montant de l'item");
  }

  const updatedItem = rebuildItem(currentItem, nextPaid);
  const nextItems = normalizedItems.map((item, index) => (index === itemIndex ? updatedItem : item));

  return {
    nextItems,
    currentItem,
    updatedItem,
    totalPaid: computeExplicitItemPaidTotal(nextItems)
  };
}
