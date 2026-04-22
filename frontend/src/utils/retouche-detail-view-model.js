import { computed } from "vue";

export function useRetoucheDetailViewModel({
  detailRetouche,
  detailRetoucheActions,
  detailRetoucheItemStatuses,
  soldeRestant,
  formatMesuresLines,
  humanizeContactLabel,
  buildItemPaymentBreakdown,
  resolveDetailItemStatus,
  resolveNextDetailItemStatus,
  resolveDetailItemStatusLabel,
  findFactureByOrigine,
  onPaiementRetoucheDetail,
  onLivrerRetoucheDetail,
  onTerminerRetoucheDetail,
  onAnnulerRetoucheDetail,
  onEmettreFactureRetoucheDetail
}) {
  const detailRetoucheSoldeRestant = computed(() => soldeRestant(detailRetouche.value));

  const canPayerRetoucheDetail = computed(() => {
    if (!detailRetouche.value) return false;
    if (detailRetoucheActions.value && typeof detailRetoucheActions.value.payer === "boolean") {
      return detailRetoucheActions.value.payer;
    }
    if (detailRetouche.value.statutRetouche === "LIVREE" || detailRetouche.value.statutRetouche === "ANNULEE") return false;
    return detailRetoucheSoldeRestant.value > 0;
  });

  const canLivrerRetoucheDetail = computed(() => {
    if (!detailRetouche.value) return false;
    if (detailRetoucheActions.value && typeof detailRetoucheActions.value.livrer === "boolean") {
      return detailRetoucheActions.value.livrer;
    }
    return false;
  });

  const canTerminerRetoucheDetail = computed(() => {
    if (!detailRetouche.value) return false;
    if (detailRetoucheActions.value && typeof detailRetoucheActions.value.terminer === "boolean") {
      return detailRetoucheActions.value.terminer;
    }
    return false;
  });

  const canAnnulerRetoucheDetail = computed(() => {
    if (!detailRetouche.value) return false;
    if (detailRetouche.value.statutRetouche === "TERMINEE") return false;
    if (detailRetoucheActions.value && typeof detailRetoucheActions.value.annuler === "boolean") {
      return detailRetoucheActions.value.annuler;
    }
    return false;
  });

  const canEditRetoucheDetail = computed(() => {
    if (!detailRetouche.value) return false;
    const locallyEditable =
      Number(detailRetouche.value.montantPaye || 0) === 0 &&
      detailRetouche.value.statutRetouche !== "LIVREE" &&
      detailRetouche.value.statutRetouche !== "ANNULEE";
    if (!locallyEditable) return false;
    if (detailRetoucheActions.value && typeof detailRetoucheActions.value.modifier === "boolean") {
      return detailRetoucheActions.value.modifier;
    }
    return locallyEditable;
  });

  const detailRetoucheFacture = computed(() => {
    const id = detailRetouche.value?.idRetouche;
    if (!id) return null;
    return findFactureByOrigine("RETOUCHE", id);
  });

  const canEmitRetoucheDetailFacture = computed(() => Boolean(detailRetouche.value && !detailRetoucheFacture.value && detailRetouche.value.statutRetouche !== "ANNULEE"));

  const detailRetoucheItemCards = computed(() => {
    const items = Array.isArray(detailRetouche.value?.items) ? detailRetouche.value.items : [];
    const breakdown = buildItemPaymentBreakdown(items, detailRetouche.value?.montantPaye || 0);
    return items.map((item, index) => {
      const mesuresLines = formatMesuresLines(item?.mesures);
      const finance = breakdown[index] || { montant: Number(item?.prix || 0), paye: 0, reste: Number(item?.prix || 0) };
      const statut = resolveDetailItemStatus(detailRetoucheItemStatuses, item, detailRetouche.value?.statutRetouche || "");
      return {
        id: item?.idItem || `retouche-item-${index + 1}`,
        index: index + 1,
        title: item?.description || humanizeContactLabel(item?.typeRetouche) || item?.typeRetouche || `Intervention ${index + 1}`,
        typeRetouche: item?.typeRetouche || "",
        typeHabit: item?.typeHabit || detailRetouche.value?.typeHabit || "",
        statut,
        prix: finance.montant,
        montantPaye: finance.paye,
        reste: finance.reste,
        mesuresLines,
        mesuresCount: mesuresLines.length,
        canPay: canPayerRetoucheDetail.value && finance.reste > 0,
        canEdit: canEditRetoucheDetail.value,
        canAdvanceStatus: Boolean(resolveNextDetailItemStatus(statut)),
        statusActionLabel: resolveDetailItemStatusLabel(statut)
      };
    });
  });

  const detailRetoucheStatusAction = computed(() => {
    if (canTerminerRetoucheDetail.value) {
      return { label: "Marquer comme termine", handler: onTerminerRetoucheDetail };
    }
    if (canLivrerRetoucheDetail.value) {
      return { label: "Marquer comme livre", handler: onLivrerRetoucheDetail };
    }
    if (canAnnulerRetoucheDetail.value) {
      return { label: "Annuler", handler: onAnnulerRetoucheDetail };
    }
    return null;
  });

  const retoucheDetailPrimaryAction = computed(() => {
    if (canPayerRetoucheDetail.value) {
      return {
        label: "Payer",
        subtitle: "Enregistrez rapidement un paiement sur cette retouche.",
        tone: "green",
        handler: onPaiementRetoucheDetail
      };
    }
    if (canLivrerRetoucheDetail.value) {
      return {
        label: "Marquer comme livre",
        subtitle: "Marquez la retouche comme livree depuis le detail.",
        tone: "blue",
        handler: onLivrerRetoucheDetail
      };
    }
    if (canTerminerRetoucheDetail.value) {
      return {
        label: "Marquer comme termine",
        subtitle: "Finalisez la retouche avant la livraison.",
        tone: "blue",
        handler: onTerminerRetoucheDetail
      };
    }
    if (canEmitRetoucheDetailFacture.value) {
      return {
        label: "Emettre facture",
        subtitle: "Generez la facture associee a cette retouche.",
        tone: "blue",
        handler: onEmettreFactureRetoucheDetail
      };
    }
    return null;
  });

  const detailRetoucheView = computed(() => ({
    idRetouche: detailRetouche.value?.idRetouche || "",
    idClient: detailRetouche.value?.idClient || "",
    clientNom: detailRetouche.value?.clientNom || "",
    typeRetouche: detailRetouche.value?.typeRetouche || "",
    descriptionRetouche: detailRetouche.value?.descriptionRetouche || "",
    statutRetouche: detailRetouche.value?.statutRetouche || "",
    dateDepot: detailRetouche.value?.dateDepot || "",
    datePrevue: detailRetouche.value?.datePrevue || "",
    typeHabit: detailRetouche.value?.typeHabit || "",
    montantTotal: Number(detailRetouche.value?.montantTotal || 0),
    montantPaye: Number(detailRetouche.value?.montantPaye || 0),
    items: Array.isArray(detailRetouche.value?.items) ? detailRetouche.value.items : []
  }));

  return {
    detailRetoucheSoldeRestant,
    canPayerRetoucheDetail,
    canLivrerRetoucheDetail,
    canTerminerRetoucheDetail,
    canAnnulerRetoucheDetail,
    canEditRetoucheDetail,
    detailRetoucheFacture,
    canEmitRetoucheDetailFacture,
    detailRetoucheItemCards,
    detailRetoucheStatusAction,
    retoucheDetailPrimaryAction,
    detailRetoucheView
  };
}
