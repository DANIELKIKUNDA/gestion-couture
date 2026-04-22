import { computed } from "vue";

export function useRetouchesListViewModel({
  retouches,
  retouchesView,
  clients,
  clientDirectory,
  retoucheFilters,
  retoucheClientQuery,
  periodOptions,
  soldeOptions,
  retouchesVisibleCount,
  todayIso,
  addDays
}) {
  const retoucheStatusOptions = computed(() => {
    const dynamic = Array.from(new Set(retouches.value.map((row) => row.statutRetouche).filter(Boolean)));
    const ordered = ["DEPOSEE", "EN_COURS", "TERMINEE", "LIVREE", "ANNULEE"];
    const merged = ordered.filter((status) => dynamic.includes(status));
    const rest = dynamic.filter((status) => !ordered.includes(status));
    return ["ALL", ...merged, ...rest];
  });

  const retouchesFiltered = computed(() => {
    const today = todayIso();
    const next7 = addDays(today, 7);
    const clientQuery = retoucheClientQuery.value.trim().toLowerCase();

    return retouchesView.value.filter((retouche) => {
      if (retoucheFilters.statut !== "ALL" && retouche.statutRetouche !== retoucheFilters.statut) return false;
      if (retoucheFilters.client !== "ALL" && retouche.idClient !== retoucheFilters.client) return false;

      if (clientQuery) {
        const ref = clientDirectory.value.get(retouche.idClient) || { nomComplet: retouche.clientNom || "", telephone: "" };
        const haystackClient = `${retouche.idClient || ""} ${ref.nomComplet || ""} ${ref.telephone || ""}`.toLowerCase();
        if (!haystackClient.includes(clientQuery)) return false;
      }

      if (retoucheFilters.periode === "TODAY" && retouche.datePrevue !== today) return false;
      if (retoucheFilters.periode === "OVERDUE" && (!retouche.datePrevue || retouche.datePrevue >= today)) return false;
      if (retoucheFilters.periode === "NEXT_7") {
        if (!retouche.datePrevue) return false;
        if (retouche.datePrevue < today || retouche.datePrevue > next7) return false;
      }

      if (retoucheFilters.soldeRestant === "DUE" && retouche.soldeRestant === 0) return false;
      if (retoucheFilters.soldeRestant === "PAID" && retouche.soldeRestant > 0) return false;

      const query = retoucheFilters.recherche.trim().toLowerCase();
      if (!query) return true;

      const haystack = `${retouche.idRetouche} ${retouche.clientNom} ${retouche.statutRetouche} ${retouche.descriptionRetouche}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const retouchesSoldeRestantCount = computed(() => retouchesFiltered.value.filter((retouche) => retouche.soldeRestant > 0).length);
  const retouchesPaged = computed(() => retouchesFiltered.value.slice(0, retouchesVisibleCount.value));
  const retouchesInfiniteEndReached = computed(() => retouchesFiltered.value.length > 0 && retouchesPaged.value.length >= retouchesFiltered.value.length);

  const retouchesKpi = computed(() => ({
    total: retouchesFiltered.value.length,
    enCours: retouchesFiltered.value.filter((item) => item.statutRetouche === "EN_COURS").length,
    livrees: retouchesFiltered.value.filter((item) => item.statutRetouche === "LIVREE").length,
    avecSolde: retouchesSoldeRestantCount.value
  }));

  const retoucheClientOptions = computed(() => {
    const query = retoucheClientQuery.value.trim().toLowerCase();
    if (!query) return clients.value;
    return clients.value.filter((client) => {
      const haystack = `${client.idClient || ""} ${client.nom || ""} ${client.prenom || ""} ${client.telephone || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const retoucheFilterSummary = computed(() => {
    const summary = [];
    if (retoucheFilters.statut !== "ALL") summary.push(`Statut: ${retoucheFilters.statut}`);
    if (retoucheFilters.client !== "ALL") summary.push("Client selectionne");
    if (retoucheFilters.periode !== "ALL") summary.push(periodOptions.find((option) => option.value === retoucheFilters.periode)?.label || "Periode filtree");
    if (retoucheFilters.soldeRestant !== "ALL") summary.push(soldeOptions.find((option) => option.value === retoucheFilters.soldeRestant)?.label || "Solde filtre");
    if (retoucheClientQuery.value.trim()) summary.push("Recherche client active");
    if (retoucheFilters.recherche.trim()) summary.push("Recherche texte active");
    return summary.length > 0 ? summary.join(" · ") : "Aucun filtre applique";
  });

  return {
    retoucheStatusOptions,
    retouchesFiltered,
    retouchesSoldeRestantCount,
    retouchesPaged,
    retouchesInfiniteEndReached,
    retouchesKpi,
    retoucheClientOptions,
    retoucheFilterSummary
  };
}
