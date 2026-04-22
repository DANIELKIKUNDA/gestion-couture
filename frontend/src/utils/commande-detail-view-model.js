import { computed } from "vue";

export function useCommandeDetailViewModel({
  detailCommande,
  detailCommandeActions,
  detailCommandeItemStatuses,
  soldeRestant,
  formatMesuresLines,
  humanizeContactLabel,
  buildItemPaymentBreakdown,
  resolveDetailItemStatus,
  resolveNextDetailItemStatus,
  resolveDetailItemStatusLabel,
  findFactureByOrigine,
  onPaiementDetail,
  onLivrerDetail,
  onTerminerDetail,
  onAnnulerDetail,
  onEmettreFactureCommandeDetail
}) {
  const detailSoldeRestant = computed(() => soldeRestant(detailCommande.value));

  const canPayerDetail = computed(() => {
    if (!detailCommande.value) return false;
    if (detailCommandeActions.value && typeof detailCommandeActions.value.payer === "boolean") {
      return detailCommandeActions.value.payer;
    }
    if (detailCommande.value.statutCommande === "LIVREE" || detailCommande.value.statutCommande === "ANNULEE") return false;
    return detailSoldeRestant.value > 0;
  });

  const canLivrerDetail = computed(() => {
    if (!detailCommande.value) return false;
    if (detailCommandeActions.value && typeof detailCommandeActions.value.livrer === "boolean") {
      return detailCommandeActions.value.livrer;
    }
    return false;
  });

  const canTerminerDetail = computed(() => {
    if (!detailCommande.value) return false;
    if (detailCommandeActions.value && typeof detailCommandeActions.value.terminer === "boolean") {
      return detailCommandeActions.value.terminer;
    }
    return false;
  });

  const canAnnulerDetail = computed(() => {
    if (!detailCommande.value) return false;
    if (detailCommande.value.statutCommande === "TERMINEE") return false;
    if (detailCommandeActions.value && typeof detailCommandeActions.value.annuler === "boolean") {
      return detailCommandeActions.value.annuler;
    }
    return false;
  });

  const canEditCommandeDetail = computed(() => {
    if (!detailCommande.value) return false;
    const locallyEditable =
      Number(detailCommande.value.montantPaye || 0) === 0 &&
      detailCommande.value.statutCommande !== "LIVREE" &&
      detailCommande.value.statutCommande !== "ANNULEE";
    if (!locallyEditable) return false;
    if (detailCommandeActions.value && typeof detailCommandeActions.value.modifier === "boolean") {
      return detailCommandeActions.value.modifier;
    }
    return locallyEditable;
  });

  const detailCommandeFacture = computed(() => {
    const id = detailCommande.value?.idCommande;
    if (!id) return null;
    return findFactureByOrigine("COMMANDE", id);
  });

  const canEmitCommandeDetailFacture = computed(() => Boolean(detailCommande.value && !detailCommandeFacture.value && detailCommande.value.statutCommande !== "ANNULEE"));

  const detailCommandeItemCards = computed(() => {
    const items = Array.isArray(detailCommande.value?.items) ? detailCommande.value.items : [];
    const breakdown = buildItemPaymentBreakdown(items, detailCommande.value?.montantPaye || 0);
    return items.map((item, index) => {
      const mesuresLines = formatMesuresLines(item?.mesures || null);
      const finance = breakdown[index] || { montant: Number(item?.prix || 0), paye: 0, reste: Number(item?.prix || 0) };
      const statut = resolveDetailItemStatus(detailCommandeItemStatuses, item, detailCommande.value?.statutCommande || "");
      return {
        id: item?.idItem || `detail-item-${index + 1}`,
        index: index + 1,
        title: item?.description || humanizeContactLabel(item?.typeHabit) || item?.typeHabit || `Habit ${index + 1}`,
        typeHabit: item?.typeHabit || "",
        statut,
        prix: finance.montant,
        montantPaye: finance.paye,
        reste: finance.reste,
        mesuresLines,
        mesuresCount: mesuresLines.length,
        canPay: canPayerDetail.value && finance.reste > 0,
        canEdit: canEditCommandeDetail.value,
        canAdvanceStatus: Boolean(resolveNextDetailItemStatus(statut)),
        statusActionLabel: resolveDetailItemStatusLabel(statut)
      };
    });
  });

  const detailCommandeStatusAction = computed(() => {
    if (canTerminerDetail.value) {
      return { label: "Marquer comme termine", handler: onTerminerDetail };
    }
    if (canLivrerDetail.value) {
      return { label: "Marquer comme livre", handler: onLivrerDetail };
    }
    if (canAnnulerDetail.value) {
      return { label: "Annuler", handler: onAnnulerDetail };
    }
    return null;
  });

  const commandeDetailPrimaryAction = computed(() => {
    if (canPayerDetail.value) {
      return {
        label: "Payer",
        subtitle: "Enregistrez rapidement un paiement sur cette commande.",
        tone: "green",
        handler: onPaiementDetail
      };
    }
    if (canLivrerDetail.value) {
      return {
        label: "Marquer comme livre",
        subtitle: "Marquez la commande comme livree depuis le detail.",
        tone: "blue",
        handler: onLivrerDetail
      };
    }
    if (canTerminerDetail.value) {
      return {
        label: "Marquer comme termine",
        subtitle: "Finalisez la commande pour preparer la livraison.",
        tone: "blue",
        handler: onTerminerDetail
      };
    }
    if (canEmitCommandeDetailFacture.value) {
      return {
        label: "Emettre facture",
        subtitle: "Generez la facture associee a cette commande.",
        tone: "blue",
        handler: onEmettreFactureCommandeDetail
      };
    }
    return null;
  });

  const detailCommandeView = computed(() => ({
    idCommande: detailCommande.value?.idCommande || "",
    idClient: detailCommande.value?.idClient || "",
    clientNom: detailCommande.value?.clientNom || "",
    descriptionCommande: detailCommande.value?.descriptionCommande || "",
    statutCommande: detailCommande.value?.statutCommande || "",
    dateCreation: detailCommande.value?.dateCreation || "",
    datePrevue: detailCommande.value?.datePrevue || "",
    typeHabit: detailCommande.value?.typeHabit || "",
    montantTotal: Number(detailCommande.value?.montantTotal || 0),
    montantPaye: Number(detailCommande.value?.montantPaye || 0),
    nombreBeneficiaires: Number(detailCommande.value?.nombreBeneficiaires || 0),
    nombreLignes: Number(detailCommande.value?.nombreLignes || 0),
    items: Array.isArray(detailCommande.value?.items) ? detailCommande.value.items : []
  }));

  return {
    detailSoldeRestant,
    canPayerDetail,
    canLivrerDetail,
    canTerminerDetail,
    canAnnulerDetail,
    canEditCommandeDetail,
    detailCommandeFacture,
    canEmitCommandeDetailFacture,
    detailCommandeItemCards,
    detailCommandeStatusAction,
    commandeDetailPrimaryAction,
    detailCommandeView
  };
}
