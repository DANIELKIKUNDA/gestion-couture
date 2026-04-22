import { computed } from "vue";

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
    return { totalEntrees, totalSorties, totalSortiesQuotidiennes, resultatJournalier, soldeJournalierRestant };
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
