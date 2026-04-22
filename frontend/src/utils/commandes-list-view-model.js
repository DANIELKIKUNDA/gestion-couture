import { computed } from "vue";

export function useCommandesListViewModel({
  commandes,
  commandesView,
  clients,
  clientDirectory,
  filters,
  commandeClientQuery,
  periodOptions,
  soldeOptions,
  commandesVisibleCount,
  todayIso,
  addDays
}) {
  const statusOptions = computed(() => {
    const dynamic = Array.from(new Set(commandes.value.map((row) => row.statutCommande).filter(Boolean)));
    const ordered = ["CREEE", "EN_COURS", "TERMINEE", "LIVREE", "ANNULEE"];
    const merged = ordered.filter((status) => dynamic.includes(status));
    const rest = dynamic.filter((status) => !ordered.includes(status));
    return ["ALL", ...merged, ...rest];
  });

  const commandesFiltered = computed(() => {
    const today = todayIso();
    const next7 = addDays(today, 7);
    const clientQuery = commandeClientQuery.value.trim().toLowerCase();

    return commandesView.value.filter((commande) => {
      if (filters.statut !== "ALL" && commande.statutCommande !== filters.statut) return false;
      if (filters.client !== "ALL" && commande.idClient !== filters.client) return false;

      if (clientQuery) {
        const ref = clientDirectory.value.get(commande.idClient) || { nomComplet: commande.clientNom || "", telephone: "" };
        const haystackClient = `${commande.idClient || ""} ${ref.nomComplet || ""} ${ref.telephone || ""}`.toLowerCase();
        if (!haystackClient.includes(clientQuery)) return false;
      }

      if (filters.periode === "TODAY" && commande.datePrevue !== today) return false;
      if (filters.periode === "OVERDUE" && (!commande.datePrevue || commande.datePrevue >= today)) return false;
      if (filters.periode === "NEXT_7") {
        if (!commande.datePrevue) return false;
        if (commande.datePrevue < today || commande.datePrevue > next7) return false;
      }

      if (filters.soldeRestant === "DUE" && commande.soldeRestant === 0) return false;
      if (filters.soldeRestant === "PAID" && commande.soldeRestant > 0) return false;

      const query = filters.recherche.trim().toLowerCase();
      if (!query) return true;

      const haystack = `${commande.idCommande} ${commande.clientNom} ${commande.statutCommande} ${commande.descriptionCommande}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const commandesSoldeRestantCount = computed(() => commandesFiltered.value.filter((commande) => commande.soldeRestant > 0).length);
  const commandesPaged = computed(() => commandesFiltered.value.slice(0, commandesVisibleCount.value));
  const commandesInfiniteEndReached = computed(() => commandesFiltered.value.length > 0 && commandesPaged.value.length >= commandesFiltered.value.length);

  const commandesKpi = computed(() => ({
    total: commandesFiltered.value.length,
    enCours: commandesFiltered.value.filter((item) => item.statutCommande === "EN_COURS").length,
    livrees: commandesFiltered.value.filter((item) => item.statutCommande === "LIVREE").length,
    avecSolde: commandesSoldeRestantCount.value
  }));

  const commandeClientOptions = computed(() => {
    const query = commandeClientQuery.value.trim().toLowerCase();
    if (!query) return clients.value;
    return clients.value.filter((client) => {
      const haystack = `${client.idClient || ""} ${client.nom || ""} ${client.prenom || ""} ${client.telephone || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const commandeFilterSummary = computed(() => {
    const summary = [];
    if (filters.statut !== "ALL") summary.push(`Statut: ${filters.statut}`);
    if (filters.client !== "ALL") summary.push("Client selectionne");
    if (filters.periode !== "ALL") summary.push(periodOptions.find((option) => option.value === filters.periode)?.label || "Periode filtree");
    if (filters.soldeRestant !== "ALL") summary.push(soldeOptions.find((option) => option.value === filters.soldeRestant)?.label || "Solde filtre");
    if (commandeClientQuery.value.trim()) summary.push("Recherche client active");
    if (filters.recherche.trim()) summary.push("Recherche texte active");
    return summary.length > 0 ? summary.join(" · ") : "Aucun filtre applique";
  });

  return {
    statusOptions,
    commandesFiltered,
    commandesSoldeRestantCount,
    commandesPaged,
    commandesInfiniteEndReached,
    commandesKpi,
    commandeClientOptions,
    commandeFilterSummary
  };
}
