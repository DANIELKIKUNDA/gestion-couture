import { computed } from "vue";

function resolveSourceFlux(op = {}) {
  const explicit = String(op?.sourceFlux || "").trim().toUpperCase();
  if (explicit) return explicit;
  if (String(op?.typeOperation || "").trim().toUpperCase() === "SORTIE") return "DEPENSE";
  const motif = String(op?.motif || "").trim().toUpperCase();
  if (["PAIEMENT_COMMANDE", "PAIEMENT_COMMANDE_ITEM"].includes(motif)) return "COMMANDE";
  if (["PAIEMENT_RETOUCHE", "PAIEMENT_RETOUCHE_ITEM"].includes(motif)) return "RETOUCHE";
  if (["VENTE_STOCK", "PAIEMENT_STOCK"].includes(motif)) return "VENTE";
  if (motif === "ENTREE_MANUELLE") return "MANUEL";
  return String(op?.typeOperation || "").trim().toUpperCase() === "ENTREE" ? "AUTRE_ENTREE" : "AUTRE";
}

export function useCaisseViewModel({
  caisseJour,
  caisseOperationsVisibleCount,
  caisseQuickFilter
}) {
  const caisseStatus = computed(() => caisseJour.value?.statutCaisse || "INCONNUE");
  const caisseOuverte = computed(() => caisseStatus.value === "OUVERTE");

  const allCaisseOperations = computed(() =>
    [...(caisseJour.value?.operations || [])].sort((a, b) => String(b.dateOperation || "").localeCompare(String(a.dateOperation || "")))
  );

  const caisseOperations = computed(() => {
    const filter = String(caisseQuickFilter?.value || "ALL").trim().toUpperCase();
    return allCaisseOperations.value
      .filter((op) => {
        const typeOperation = String(op?.typeOperation || "").trim().toUpperCase();
        const activite = String(op?.activite || "ATELIER").trim().toUpperCase();
        const sourceFlux = resolveSourceFlux(op);
        if (filter === "ATELIER") return activite === "ATELIER";
        if (filter === "STOCK") return activite === "STOCK";
        if (filter === "ENTREES") return typeOperation === "ENTREE";
        if (filter === "SORTIES") return typeOperation === "SORTIE";
        if (filter === "MANUEL") return sourceFlux === "MANUEL";
        if (filter === "DEPENSES") return sourceFlux === "DEPENSE";
        return true;
      });
  });

  const caisseOperationsPaged = computed(() => caisseOperations.value.slice(0, caisseOperationsVisibleCount.value));
  const caisseOperationsInfiniteEndReached = computed(
    () => caisseOperations.value.length > 0 && caisseOperationsPaged.value.length >= caisseOperations.value.length
  );

  const caisseTotals = computed(() => {
    const ops = allCaisseOperations.value.filter((op) => op.statutOperation !== "ANNULEE");
    const fallbackTotalEntrees = ops.filter((op) => op.typeOperation === "ENTREE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const fallbackSortiesQuotidiennes = ops
      .filter((op) => op.typeOperation === "SORTIE" && String(op?.typeDepense || "QUOTIDIENNE").trim().toUpperCase() !== "EXCEPTIONNELLE")
      .reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const fallbackSortiesExceptionnelles = ops
      .filter((op) => op.typeOperation === "SORTIE" && String(op?.typeDepense || "").trim().toUpperCase() === "EXCEPTIONNELLE")
      .reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const rawTotalEntrees = Number(caisseJour.value?.totalEntreesJour ?? 0);
    const rawSortiesQuotidiennes = Number(caisseJour.value?.totalSortiesQuotidiennesJour ?? 0);
    const totalEntrees = rawTotalEntrees > 0 ? rawTotalEntrees : fallbackTotalEntrees;
    const totalSortiesQuotidiennes = rawSortiesQuotidiennes > 0 ? rawSortiesQuotidiennes : fallbackSortiesQuotidiennes;
    const resultatJournalier = Number(caisseJour.value?.resultatJournalier ?? (totalEntrees - totalSortiesQuotidiennes));
    const soldeJournalierRestant = Number(caisseJour.value?.soldeJournalierRestant ?? resultatJournalier);
    const sourceTotals = caisseJour.value?.totauxParSource || {};
    const activityTotals = caisseJour.value?.totauxParActivite || {};
    const fallbackSourceTotals = ops.reduce(
      (acc, op) => {
        const sourceFlux = resolveSourceFlux(op);
        const montant = Number(op.montant || 0);
        if (sourceFlux === "COMMANDE") acc.totalCommandes += montant;
        else if (sourceFlux === "RETOUCHE") acc.totalRetouches += montant;
        else if (sourceFlux === "VENTE") acc.totalVentes += montant;
        else if (sourceFlux === "MANUEL") acc.totalEntreesManuelles += montant;
        else if (sourceFlux === "DEPENSE") acc.totalDepenses += montant;
        return acc;
      },
      {
        totalCommandes: 0,
        totalRetouches: 0,
        totalVentes: 0,
        totalEntreesManuelles: 0,
        totalDepenses: totalSorties
      }
    );
    const fallbackActivityTotals = ops.reduce(
      (acc, op) => {
        const activite = String(op?.activite || "ATELIER").trim().toUpperCase() === "STOCK" ? "STOCK" : "ATELIER";
        const montant = Number(op.montant || 0);
        if (activite === "STOCK") {
          if (op.typeOperation === "SORTIE") {
            acc.depensesStock += montant;
            acc.netStock -= montant;
          } else {
            acc.totalStock += montant;
            acc.netStock += montant;
          }
          return acc;
        }
        if (op.typeOperation === "SORTIE") {
          acc.depensesAtelier += montant;
          acc.netAtelier -= montant;
        } else {
          acc.totalAtelier += montant;
          acc.netAtelier += montant;
        }
        return acc;
      },
      {
        totalAtelier: 0,
        totalStock: 0,
        depensesAtelier: 0,
        depensesStock: 0,
        netAtelier: 0,
        netStock: 0
      }
    );
    const fallbackTotalGlobal =
      fallbackSourceTotals.totalCommandes +
      fallbackSourceTotals.totalRetouches +
      fallbackSourceTotals.totalVentes +
      fallbackSourceTotals.totalEntreesManuelles;
    const totalAtelier = Number(activityTotals.totalAtelier ?? fallbackActivityTotals.totalAtelier);
    const totalStock = Number(activityTotals.totalStock ?? fallbackActivityTotals.totalStock);
    const depensesAtelier = Number(activityTotals.depensesAtelier ?? fallbackActivityTotals.depensesAtelier);
    const depensesStock = Number(activityTotals.depensesStock ?? fallbackActivityTotals.depensesStock);
    const netAtelier = totalAtelier - depensesAtelier;
    const netStock = totalStock - depensesStock;
    const netJour = totalEntrees - totalSortiesQuotidiennes;
    const totalSortiesExceptionnelles = Math.max(
      0,
      Number(caisseJour.value?.totalSortiesExceptionnellesJour ?? caisseJour.value?.total_sorties_exceptionnelles_jour ?? fallbackSortiesExceptionnelles)
    );
    return {
      totalEntrees,
      totalSorties,
      totalSortiesQuotidiennes,
      totalSortiesExceptionnelles,
      resultatJournalier,
      soldeJournalierRestant,
      totalAtelier,
      totalStock,
      depensesAtelier,
      depensesStock,
      netAtelier,
      netStock,
      netJour,
      totalCommandes: Number(sourceTotals.totalCommandes ?? fallbackSourceTotals.totalCommandes),
      totalRetouches: Number(sourceTotals.totalRetouches ?? fallbackSourceTotals.totalRetouches),
      totalVentes: Number(sourceTotals.totalVentes ?? fallbackSourceTotals.totalVentes),
      totalEntreesManuelles: Number(sourceTotals.totalEntreesManuelles ?? fallbackSourceTotals.totalEntreesManuelles),
      totalDepenses: Number(sourceTotals.totalDepenses ?? fallbackSourceTotals.totalDepenses),
      totalEncaissements: Number(sourceTotals.totalGlobal ?? fallbackTotalGlobal),
      totalGlobal: netJour
    };
  });

  return {
    caisseStatus,
    caisseOuverte,
    caisseOperations,
    caisseOperationsPaged,
    caisseOperationsInfiniteEndReached,
    caisseTotals
  };
}
