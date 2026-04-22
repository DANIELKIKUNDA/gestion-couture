import { computed } from "vue";

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function useDashboardFinanceMetrics({
  dashboardPeriod,
  caisseJour,
  commandesView,
  retouches,
  ventes,
  todayIso,
  addDays
}) {
  const financeMetrics = computed(() => {
    const today = todayIso();
    const last7 = addDays(today, -7);
    const last30 = addDays(today, -30);
    const ops = (caisseJour.value?.operations || []).filter((op) => op.statutOperation !== "ANNULEE");
    const totalEntrees = ops.filter((op) => op.typeOperation === "ENTREE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const isWithinDashboardPeriod = (dateRef) => {
      if (!dateRef) return true;
      if (dashboardPeriod.value === "TODAY") return dateRef === today;
      if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
      if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
      return true;
    };
    const acomptesCommandes = commandesView.value
      .filter((commande) => isWithinDashboardPeriod(dateOnly(commande.dateCreation || commande.datePrevue || "")))
      .reduce((sum, commande) => sum + Number(commande.montantPaye || 0), 0);
    const acomptesRetouches = retouches.value
      .filter((retouche) => isWithinDashboardPeriod(dateOnly(retouche.dateDepot || retouche.datePrevue || "")))
      .reduce((sum, retouche) => sum + Number(retouche.montantPaye || 0), 0);

    return {
      soldeCaisse: Number(caisseJour.value?.soldeCourant || 0),
      totalEncaissement: totalEntrees,
      depensesJour: totalSorties,
      acomptesEncaisses: acomptesCommandes + acomptesRetouches
    };
  });

  const dashboardSalesMetrics = computed(() => {
    const today = todayIso();
    const last7 = addDays(today, -7);
    const last30 = addDays(today, -30);
    const rows = ventes.value.filter((vente) => {
      if (vente.statut !== "VALIDEE") return false;
      const dateRef = dateOnly(vente.date || "");
      if (!dateRef) return true;
      if (dashboardPeriod.value === "TODAY") return dateRef === today;
      if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
      if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
      return true;
    });

    const nombreVentes = rows.length;
    const chiffreAffaires = rows.reduce((sum, vente) => sum + Number(vente.total || 0), 0);
    const beneficeBrut = rows.reduce((sum, vente) => sum + Number(vente.beneficeTotal || 0), 0);
    const totalPrixAchat = rows.reduce((sum, vente) => sum + Number(vente.totalPrixAchat || 0), 0);

    return {
      nombreVentes,
      chiffreAffaires,
      beneficeBrut,
      margeMoyenne: chiffreAffaires > 0 ? (beneficeBrut / chiffreAffaires) * 100 : 0,
      rentabilite: totalPrixAchat > 0 ? (beneficeBrut / totalPrixAchat) * 100 : 0
    };
  });

  return {
    financeMetrics,
    dashboardSalesMetrics
  };
}
