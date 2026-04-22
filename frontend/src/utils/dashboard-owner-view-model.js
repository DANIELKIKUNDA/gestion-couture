import { computed } from "vue";

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function useDashboardOwnerViewModel({
  dashboardPeriod,
  commandesView,
  retouchesView,
  retouches,
  clients,
  clientMap,
  ventes,
  caisseJour,
  dashboardContactBoard,
  formatDashboardClientFollowUpDescription,
  formatDashboardPendingCommandeDescription,
  formatDashboardPendingRetoucheDescription,
  todayIso,
  addDays
}) {
  const dashboardScopedCommandes = computed(() => {
    const today = todayIso();
    const last7 = addDays(today, -7);
    const last30 = addDays(today, -30);
    return commandesView.value.filter((commande) => {
      const dateRef = dateOnly(commande.dateCreation || commande.datePrevue || "");
      if (!dateRef) return true;
      if (dashboardPeriod.value === "TODAY") return dateRef === today;
      if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
      if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
      return true;
    });
  });

  const dashboardScopedRetouches = computed(() => {
    const today = todayIso();
    const last7 = addDays(today, -7);
    const last30 = addDays(today, -30);
    return retouchesView.value.filter((retouche) => {
      const dateRef = dateOnly(retouche.dateDepot || retouche.datePrevue || "");
      if (!dateRef) return true;
      if (dashboardPeriod.value === "TODAY") return dateRef === today;
      if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
      if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
      return true;
    });
  });

  const dashboardCards = computed(() => [
    {
      label:
        dashboardPeriod.value === "TODAY"
          ? "Commandes creees aujourd'hui"
          : dashboardPeriod.value === "LAST_7"
            ? "Commandes creees ces 7 derniers jours"
            : "Commandes creees ces 30 derniers jours",
      value: dashboardScopedCommandes.value.filter((c) => Boolean(dateOnly(c.dateCreation))).length,
      tone: "blue"
    },
    {
      label:
        dashboardPeriod.value === "TODAY"
          ? "Retouches creees aujourd'hui"
          : dashboardPeriod.value === "LAST_7"
            ? "Retouches creees ces 7 derniers jours"
            : "Retouches creees ces 30 derniers jours",
      value: dashboardScopedRetouches.value.filter((r) => Boolean(dateOnly(r.dateDepot))).length,
      tone: "teal"
    },
    { label: "Commandes en cours", value: dashboardScopedCommandes.value.filter((c) => c.statutCommande === "EN_COURS").length, tone: "blue" },
    { label: "Commandes pretes", value: dashboardScopedCommandes.value.filter((c) => c.statutCommande === "TERMINEE").length, tone: "green" },
    {
      label: "Commandes a solder",
      value: dashboardScopedCommandes.value.filter((c) => c.soldeRestant > 0 && c.statutCommande !== "ANNULEE").length,
      tone: "amber"
    },
    { label: "Retouches en cours", value: dashboardScopedRetouches.value.filter((r) => r.statutRetouche === "EN_COURS").length, tone: "teal" },
    { label: "Retouches pretes", value: dashboardScopedRetouches.value.filter((r) => r.statutRetouche === "TERMINEE").length, tone: "green" },
    { label: "Retouches a solder", value: dashboardScopedRetouches.value.filter((r) => r.soldeRestant > 0).length, tone: "amber" },
    { label: "Clients actifs", value: clients.value.filter((c) => c.actif !== false).length, tone: "slate" }
  ]);

  const dashboardCommandesCards = computed(() => [
    dashboardCards.value.find((card) => card.label.startsWith("Commandes creees")),
    dashboardCards.value.find((card) => card.label === "Commandes en cours"),
    dashboardCards.value.find((card) => card.label === "Commandes pretes"),
    dashboardCards.value.find((card) => card.label === "Commandes a solder")
  ].filter(Boolean));

  const dashboardRetouchesCards = computed(() => [
    dashboardCards.value.find((card) => card.label.startsWith("Retouches creees")),
    dashboardCards.value.find((card) => card.label === "Retouches en cours"),
    dashboardCards.value.find((card) => card.label === "Retouches pretes"),
    dashboardCards.value.find((card) => card.label === "Retouches a solder")
  ].filter(Boolean));

  const dashboardClientsActifs = computed(() => dashboardCards.value.find((card) => card.label === "Clients actifs") || null);

  const dashboardFollowUpCards = computed(() => [
    { label: "Clients a relancer", value: dashboardContactBoard.value.clientsARelancer.total, tone: "amber" },
    { label: "Commandes a signaler", value: dashboardContactBoard.value.commandesPretesNonSignalees.total, tone: "green" },
    { label: "Retouches a signaler", value: dashboardContactBoard.value.retouchesPretesNonSignalees.total, tone: "teal" },
    {
      label: "Total a traiter",
      value:
        dashboardContactBoard.value.clientsARelancer.total +
        dashboardContactBoard.value.commandesPretesNonSignalees.total +
        dashboardContactBoard.value.retouchesPretesNonSignalees.total,
      tone: "slate"
    }
  ]);

  const dashboardClientsToFollowUpMobileItems = computed(() =>
    dashboardContactBoard.value.clientsARelancer.items.map((item) => ({
      id: item.idClient,
      libelle: item.nomClient || item.telephone || item.idClient,
      description: formatDashboardClientFollowUpDescription(item)
    }))
  );

  const dashboardCommandesToNotifyMobileItems = computed(() =>
    dashboardContactBoard.value.commandesPretesNonSignalees.items.map((item) => ({
      id: item.idCommande,
      libelle: `${item.idCommande} - ${item.clientNom || item.idClient}`,
      description: formatDashboardPendingCommandeDescription(item)
    }))
  );

  const dashboardRetouchesToNotifyMobileItems = computed(() =>
    dashboardContactBoard.value.retouchesPretesNonSignalees.items.map((item) => ({
      id: item.idRetouche,
      libelle: `${item.idRetouche} - ${item.clientNom || item.idClient}`,
      description: formatDashboardPendingRetoucheDescription(item)
    }))
  );

  const recentWorkRows = computed(() => {
    const today = todayIso();
    const last7 = addDays(today, -7);
    const last30 = addDays(today, -30);

    const cmdRows = commandesView.value.map((c) => ({
      id: c.idCommande,
      clientNom: c.clientNom,
      type: "Commande",
      statut: c.statutCommande,
      montantTotal: c.montantTotal,
      avancePayee: c.montantPaye,
      dateRef: dateOnly(c.dateCreation || c.datePrevue || "")
    }));

    const retRows = retouches.value.map((r) => ({
      id: r.idRetouche,
      clientNom: r.clientNom || clientMap.value.get(r.idClient) || r.idClient,
      type: "Retouche",
      statut: r.statutRetouche,
      montantTotal: Number(r.montantTotal || 0),
      avancePayee: Number(r.montantPaye || 0),
      dateRef: dateOnly(r.dateDepot || r.datePrevue || "")
    }));

    const venteRows = ventes.value.map((v) => ({
      id: v.idVente,
      clientNom: "Client comptoir",
      type: "Vente",
      statut: v.statut,
      montantTotal: Number(v.total || 0),
      avancePayee: Number(v.beneficeTotal || 0),
      dateRef: dateOnly(v.date || "")
    }));

    const rows = [...cmdRows, ...retRows, ...venteRows];
    const filtered = rows.filter((row) => {
      if (!row.dateRef) return true;
      if (dashboardPeriod.value === "TODAY") return row.dateRef === today;
      if (dashboardPeriod.value === "LAST_7") return row.dateRef >= last7 && row.dateRef <= today;
      if (dashboardPeriod.value === "LAST_30") return row.dateRef >= last30 && row.dateRef <= today;
      return true;
    });

    return filtered
      .sort((a, b) => String(b.dateRef).localeCompare(String(a.dateRef)))
      .slice(0, 5);
  });

  const dashboardProductionRecentRows = computed(() => recentWorkRows.value.filter((item) => item.type !== "Vente"));

  const recentCaisseActivity = computed(() => {
    const ops = [...(caisseJour.value?.operations || [])].sort((a, b) => String(b.dateOperation).localeCompare(String(a.dateOperation)));
    return ops.slice(0, 4).map((op) => ({
      id: op.idOperation,
      libelle: op.motif || op.typeOperation,
      montant: op.typeOperation === "SORTIE" ? -Number(op.montant || 0) : Number(op.montant || 0)
    }));
  });

  return {
    dashboardScopedCommandes,
    dashboardScopedRetouches,
    dashboardCards,
    dashboardCommandesCards,
    dashboardRetouchesCards,
    dashboardClientsActifs,
    dashboardFollowUpCards,
    dashboardClientsToFollowUpMobileItems,
    dashboardCommandesToNotifyMobileItems,
    dashboardRetouchesToNotifyMobileItems,
    recentWorkRows,
    dashboardProductionRecentRows,
    recentCaisseActivity
  };
}
