export function resolveAchatMontants({
  quantite,
  prixAchatUnitaire = null,
  montantAchatTotal = null,
  allowEmpty = false
} = {}) {
  const qty = Number(quantite);
  if (!Number.isFinite(qty) || qty < 0) {
    throw new Error("quantite invalide");
  }

  const hasUnit = prixAchatUnitaire !== null && prixAchatUnitaire !== undefined && prixAchatUnitaire !== "";
  const hasTotal = montantAchatTotal !== null && montantAchatTotal !== undefined && montantAchatTotal !== "";

  if (!hasUnit && !hasTotal) {
    if (allowEmpty) return { prixAchatUnitaire: 0, montantAchatTotal: 0 };
    throw new Error("Prix d'achat unitaire ou montant total du lot requis");
  }

  const unit = hasUnit ? Number(prixAchatUnitaire) : null;
  const total = hasTotal ? Number(montantAchatTotal) : null;
  if (hasUnit && (!Number.isFinite(unit) || unit < 0)) throw new Error("prixAchatUnitaire invalide");
  if (hasTotal && (!Number.isFinite(total) || total < 0)) throw new Error("montantAchatTotal invalide");

  if (hasTotal && qty <= 0 && total > 0) {
    throw new Error("Une quantite superieure a zero est requise pour calculer le prix unitaire depuis le total du lot");
  }

  const resolvedUnit = hasUnit ? unit : qty > 0 ? total / qty : 0;
  const resolvedTotal = hasTotal ? total : qty * resolvedUnit;

  if (hasUnit && hasTotal) {
    const expectedTotal = qty * unit;
    const tolerance = Math.max(0.01, Math.abs(total) * 0.000001);
    if (Math.abs(expectedTotal - total) > tolerance) {
      throw new Error("Le prix unitaire et le montant total du lot sont incoherents");
    }
  }

  return {
    prixAchatUnitaire: resolvedUnit,
    montantAchatTotal: resolvedTotal
  };
}
