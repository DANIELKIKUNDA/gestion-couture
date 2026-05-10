import { computed } from "vue";

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function humanizeDashboardLabel(value, fallback = "ce travail") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (/[a-zàâçéèêëîïôûùüÿñæœ]/.test(text)) return text;
  return text.replace(/_/g, " ").toLowerCase().trim() || fallback;
}

function dashboardPerson(value, fallback = "Ce client") {
  return String(value || "").trim() || fallback;
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
    { label: "Commandes en cours", value: commandesView.value.filter((c) => c.statutCommande === "EN_COURS").length, tone: "blue" },
    { label: "Commandes pretes", value: commandesView.value.filter((c) => c.statutCommande === "TERMINEE").length, tone: "green" },
    {
      label: "Commandes a solder",
      value: commandesView.value.filter((c) => c.soldeRestant > 0 && c.statutCommande !== "ANNULEE").length,
      tone: "amber"
    },
    { label: "Retouches en cours", value: retouchesView.value.filter((r) => r.statutRetouche === "EN_COURS").length, tone: "teal" },
    { label: "Retouches pretes", value: retouchesView.value.filter((r) => r.statutRetouche === "TERMINEE").length, tone: "green" },
    { label: "Retouches a solder", value: retouchesView.value.filter((r) => r.soldeRestant > 0 && r.statutRetouche !== "ANNULEE").length, tone: "amber" },
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

  const dashboardArgentAttendu = computed(() => {
    const commandesRestantes = commandesView.value
      .filter((commande) => commande.statutCommande !== "ANNULEE")
      .reduce((sum, commande) => sum + Math.max(0, Number(commande.soldeRestant || 0)), 0);
    const retouchesRestantes = retouchesView.value
      .filter((retouche) => retouche.statutRetouche !== "ANNULEE")
      .reduce((sum, retouche) => sum + Math.max(0, Number(retouche.soldeRestant || 0)), 0);
    return commandesRestantes + retouchesRestantes;
  });

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
      type: "Client a relancer",
      title: `${dashboardPerson(item.nomClient || item.telephone || item.idClient)} n'a pas ete contacte recemment.`,
      description: formatDashboardClientFollowUpDescription(item)
    }))
  );

  const dashboardCommandesToNotifyMobileItems = computed(() =>
    dashboardContactBoard.value.commandesPretesNonSignalees.items.map((item) => ({
      id: item.idCommande,
      libelle: `${item.idCommande} - ${item.clientNom || item.idClient}`,
      type: Number(item.soldeRestant || 0) > 0 ? "Prevenir et encaisser" : "Client a prevenir",
      title: `${dashboardPerson(item.clientNom || item.idClient)} peut venir recuperer ${humanizeDashboardLabel(item.typeHabit, "sa commande")}.`,
      description: formatDashboardPendingCommandeDescription(item)
    }))
  );

  const dashboardRetouchesToNotifyMobileItems = computed(() =>
    dashboardContactBoard.value.retouchesPretesNonSignalees.items.map((item) => ({
      id: item.idRetouche,
      libelle: `${item.idRetouche} - ${item.clientNom || item.idClient}`,
      type: Number(item.soldeRestant || 0) > 0 ? "Prevenir et encaisser" : "Client a prevenir",
      title: `${dashboardPerson(item.clientNom || item.idClient)} peut venir recuperer ${humanizeDashboardLabel(item.typeRetouche || item.typeHabit, "sa retouche")}.`,
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
      clientNom: String(v.acheteurNom || "").trim() || "Acheteur non renseigne",
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
    const venteById = new Map(ventes.value.map((vente) => [String(vente.idVente || "").trim(), vente]));
    return ops.slice(0, 5).map((op) => ({
      id: op.idOperation,
      libelle: formatCaisseActivityLabel(op, venteById),
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
    dashboardArgentAttendu,
    dashboardFollowUpCards,
    dashboardClientsToFollowUpMobileItems,
    dashboardCommandesToNotifyMobileItems,
    dashboardRetouchesToNotifyMobileItems,
    recentWorkRows,
    dashboardProductionRecentRows,
    recentCaisseActivity
  };
}

function formatCaisseActivityLabel(op, venteById) {
  const motif = String(op?.motif || "").trim();
  if (motif === "VENTE_STOCK") {
    const vente = venteById.get(String(op?.referenceMetier || "").trim());
    const acheteur = String(vente?.acheteurNom || "").trim();
    return acheteur ? `Vente - ${acheteur}` : "Vente stock";
  }
  return motif || op?.typeOperation || "Operation caisse";
}
