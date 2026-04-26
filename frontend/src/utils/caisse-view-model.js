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
  caisseOperationsVisibleCount
}) {
  const caisseStatus = computed(() => caisseJour.value?.statutCaisse || "INCONNUE");
  const caisseOuverte = computed(() => caisseStatus.value === "OUVERTE");

  const caisseOperations = computed(() =>
    [...(caisseJour.value?.operations || [])].sort((a, b) =>
      String(b.dateOperation || "").localeCompare(String(a.dateOperation || ""))
    )
  );

  const caisseOperationsPaged = computed(() => caisseOperations.value.slice(0, caisseOperationsVisibleCount.value));
  const caisseOperationsInfiniteEndReached = computed(
    () => caisseOperations.value.length > 0 && caisseOperationsPaged.value.length >= caisseOperations.value.length
  );

  const caisseTotals = computed(() => {
    const totalEntrees = Number(caisseJour.value?.totalEntreesJour ?? 0);
    const totalSortiesQuotidiennes = Number(caisseJour.value?.totalSortiesQuotidiennesJour ?? 0);
    const resultatJournalier = Number(caisseJour.value?.resultatJournalier ?? (totalEntrees - totalSortiesQuotidiennes));
    const soldeJournalierRestant = Number(caisseJour.value?.soldeJournalierRestant ?? resultatJournalier);
    const ops = caisseOperations.value.filter((op) => op.statutOperation !== "ANNULEE");
    const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
    const sourceTotals = caisseJour.value?.totauxParSource || {};
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
    const fallbackTotalGlobal =
      fallbackSourceTotals.totalCommandes +
      fallbackSourceTotals.totalRetouches +
      fallbackSourceTotals.totalVentes +
      fallbackSourceTotals.totalEntreesManuelles;
    return {
      totalEntrees,
      totalSorties,
      totalSortiesQuotidiennes,
      resultatJournalier,
      soldeJournalierRestant,
      totalCommandes: Number(sourceTotals.totalCommandes ?? fallbackSourceTotals.totalCommandes),
      totalRetouches: Number(sourceTotals.totalRetouches ?? fallbackSourceTotals.totalRetouches),
      totalVentes: Number(sourceTotals.totalVentes ?? fallbackSourceTotals.totalVentes),
      totalEntreesManuelles: Number(sourceTotals.totalEntreesManuelles ?? fallbackSourceTotals.totalEntreesManuelles),
      totalDepenses: Number(sourceTotals.totalDepenses ?? fallbackSourceTotals.totalDepenses),
      totalGlobal: Number(sourceTotals.totalGlobal ?? fallbackTotalGlobal)
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
