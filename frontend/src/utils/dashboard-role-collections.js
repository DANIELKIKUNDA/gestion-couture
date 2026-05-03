import { computed } from "vue";

function formatDashboardWorkDueDate(dateValue = "", formatDateShort) {
  if (!dateValue) return "Date non definie";
  return formatDateShort(`${dateValue}T00:00:00.000Z`);
}

function humanizeDashboardLabel(value, fallback = "ce travail") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (/[a-zàâçéèêëîïôûùüÿñæœ]/.test(text)) return text.toLowerCase();
  return text.replace(/_/g, " ").toLowerCase().trim() || fallback;
}

function dashboardClientName(value, fallback = "Ce client") {
  return String(value || "").trim() || fallback;
}

function buildDashboardPaymentDescription(item, typeLabel, formatCurrency, formatDateShort) {
  const parts = [];
  if (Number(item?.soldeRestant || 0) > 0) parts.push(`Encaisser ${formatCurrency(item.soldeRestant)}.`);
  if (item?.datePrevue) parts.push(`Prevu le ${formatDashboardWorkDueDate(item.datePrevue, formatDateShort)}.`);
  return parts.join(" ") || `${typeLabel} a verifier avant encaissement.`;
}

function buildDashboardProductionDescription(item, typeLabel, formatStatusLabel, formatDateShort) {
  const parts = [];
  if (item?.datePrevue) parts.push(`Prevu le ${formatDashboardWorkDueDate(item.datePrevue, formatDateShort)}.`);
  if (item?.priorite && item.priorite !== "NORMALE") parts.push(`Priorite ${String(item.priorite).replaceAll("_", " ").toLowerCase()}.`);
  parts.push(`Etat: ${formatStatusLabel(item?.statut || "-")}.`);
  return parts.join(" ");
}

function normalizeDashboardPriorite(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "TRES_URGENTE" || normalized === "URGENTE" || normalized === "NORMALE") return normalized;
  return "NORMALE";
}

function getDashboardPrioriteWeight(value = "") {
  switch (normalizeDashboardPriorite(value)) {
    case "TRES_URGENTE":
      return 3;
    case "URGENTE":
      return 2;
    default:
      return 1;
  }
}

export function useDashboardRoleCollections({
  commandesView,
  retouches,
  clientMap,
  financeMetrics,
  dashboardCommandesCards,
  dashboardRetouchesCards,
  caisseOuverte,
  formatCurrency,
  formatDateShort,
  formatStatusLabel,
  todayIso
}) {
  const cashierDashboardCards = computed(() => [
    { label: "Argent en caisse", value: formatCurrency(financeMetrics.value.soldeCaisse), tone: "blue" },
    { label: "Argent encaisse", value: formatCurrency(financeMetrics.value.totalEncaissement), tone: "green" },
    { label: "Argent sorti", value: formatCurrency(financeMetrics.value.depensesJour), tone: "amber" },
    { label: "Travaux a encaisser", value: (dashboardCommandesCards.value[3]?.value || 0) + (dashboardRetouchesCards.value[3]?.value || 0), tone: "amber" }
  ]);

  const cashierCollections = computed(() => {
    const commandes = commandesView.value
      .filter((item) => Number(item.soldeRestant || 0) > 0 && item.statutCommande !== "ANNULEE")
      .sort((a, b) => String(a.datePrevue || "9999-12-31").localeCompare(String(b.datePrevue || "9999-12-31")));
    const retouchesRows = retouches.value
      .filter((item) => Number(item.soldeRestant || 0) > 0 && item.statutRetouche !== "ANNULEE")
      .sort((a, b) => String(a.datePrevue || "9999-12-31").localeCompare(String(b.datePrevue || "9999-12-31")));
    const readyToCash = [
      ...commandes
        .filter((item) => item.statutCommande === "TERMINEE")
        .map((item) => ({
          id: `commande-${item.idCommande}`,
          libelle: `${dashboardClientName(item.clientNom)} vient recuperer ${humanizeDashboardLabel(item.typeHabit, "sa commande")}.`,
          description: buildDashboardPaymentDescription(item, "Commande", formatCurrency, formatDateShort)
        })),
      ...retouchesRows
        .filter((item) => item.statutRetouche === "TERMINEE")
        .map((item) => ({
          id: `retouche-${item.idRetouche}`,
          libelle: `${dashboardClientName(item.clientNom || clientMap.value.get(item.idClient) || item.idClient)} vient recuperer ${humanizeDashboardLabel(item.typeRetouche || item.typeHabit, "sa retouche")}.`,
          description: buildDashboardPaymentDescription(item, "Retouche", formatCurrency, formatDateShort)
        }))
    ].slice(0, 6);

    return {
      commandes: commandes.slice(0, 6).map((item) => ({
        id: item.idCommande,
        libelle: `${dashboardClientName(item.clientNom)} doit encore payer pour ${humanizeDashboardLabel(item.typeHabit, "sa commande")}.`,
        description: buildDashboardPaymentDescription(item, "Commande", formatCurrency, formatDateShort)
      })),
      retouches: retouchesRows.slice(0, 6).map((item) => ({
        id: item.idRetouche,
        libelle: `${dashboardClientName(item.clientNom || clientMap.value.get(item.idClient) || item.idClient)} doit encore payer pour ${humanizeDashboardLabel(item.typeRetouche || item.typeHabit, "sa retouche")}.`,
        description: buildDashboardPaymentDescription(item, "Retouche", formatCurrency, formatDateShort)
      })),
      readyToCash
    };
  });

  const cashierAlerts = computed(() => {
    const items = [];
    if (!caisseOuverte.value) items.push({ id: "cash-closed", libelle: "La caisse est fermee.", description: "Ouvrez la caisse avant de recevoir un paiement." });
    if ((dashboardCommandesCards.value[3]?.value || 0) > 0) {
      items.push({ id: "commandes-due", libelle: `${dashboardCommandesCards.value[3].value} commande(s) ont encore un solde.`, description: "Verifiez les clients qui doivent encore payer." });
    }
    if ((dashboardRetouchesCards.value[3]?.value || 0) > 0) {
      items.push({ id: "retouches-due", libelle: `${dashboardRetouchesCards.value[3].value} retouche(s) ont encore un solde.`, description: "Verifiez les retouches a encaisser." });
    }
    return items;
  });

  const tailorDashboardCards = computed(() => {
    const today = todayIso();
    const productionRows = [
      ...commandesView.value
        .filter((item) => item.statutCommande !== "LIVREE" && item.statutCommande !== "ANNULEE")
        .map((item) => ({ type: "Commande", statut: item.statutCommande, datePrevue: item.datePrevue, priorite: item.priorite })),
      ...retouches.value
        .filter((item) => item.statutRetouche !== "LIVREE" && item.statutRetouche !== "ANNULEE")
        .map((item) => ({ type: "Retouche", statut: item.statutRetouche, datePrevue: item.datePrevue, priorite: item.priorite }))
    ];
    const dueToday = productionRows.filter((item) => item.datePrevue === today).length;
    const overdue = productionRows.filter((item) => item.datePrevue && item.datePrevue < today).length;

    return [
      { label: "Commandes en cours", value: dashboardCommandesCards.value[1]?.value || 0, tone: "blue" },
      { label: "Retouches en cours", value: dashboardRetouchesCards.value[1]?.value || 0, tone: "teal" },
      { label: "A faire aujourd'hui", value: dueToday, tone: "amber" },
      { label: "En retard", value: overdue, tone: "amber" },
      { label: "Termines", value: productionRows.filter((item) => item.statut === "TERMINEE").length, tone: "green" }
    ];
  });

  const tailorCollections = computed(() => {
    const today = todayIso();
    const workRows = [
      ...commandesView.value
        .filter((item) => item.statutCommande !== "LIVREE" && item.statutCommande !== "ANNULEE")
        .map((item) => ({
          id: `commande-${item.idCommande}`,
          ref: item.idCommande,
          type: "Commande",
          clientNom: item.clientNom,
          statut: item.statutCommande,
          datePrevue: item.datePrevue,
          priorite: item.priorite,
          workLabel: humanizeDashboardLabel(item.typeHabit, "sa commande")
        })),
      ...retouches.value
        .filter((item) => item.statutRetouche !== "LIVREE" && item.statutRetouche !== "ANNULEE")
        .map((item) => ({
          id: `retouche-${item.idRetouche}`,
          ref: item.idRetouche,
          type: "Retouche",
          clientNom: item.clientNom || clientMap.value.get(item.idClient) || item.idClient,
          statut: item.statutRetouche,
          datePrevue: item.datePrevue,
          priorite: item.priorite,
          workLabel: humanizeDashboardLabel(item.typeRetouche || item.typeHabit, "sa retouche")
        }))
    ].sort((a, b) => {
      const priorityDelta = getDashboardPrioriteWeight(b.priorite) - getDashboardPrioriteWeight(a.priorite);
      if (priorityDelta !== 0) return priorityDelta;
      return String(a.datePrevue || "9999-12-31").localeCompare(String(b.datePrevue || "9999-12-31"));
    });

    return {
      dueTodayCount: workRows.filter((item) => item.datePrevue === today).length,
      overdueCount: workRows.filter((item) => item.datePrevue && item.datePrevue < today).length,
      readyCount: workRows.filter((item) => item.statut === "TERMINEE").length,
      dueToday: workRows
        .filter((item) => item.datePrevue === today)
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          libelle: `Faire ${item.workLabel} de ${dashboardClientName(item.clientNom)}.`,
          description: buildDashboardProductionDescription(item, item.type, formatStatusLabel, formatDateShort)
        })),
      overdue: workRows
        .filter((item) => item.datePrevue && item.datePrevue < today)
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          libelle: `${item.workLabel} de ${dashboardClientName(item.clientNom)} est en retard.`,
          description: buildDashboardProductionDescription(item, item.type, formatStatusLabel, formatDateShort)
        })),
      ready: workRows
        .filter((item) => item.statut === "TERMINEE")
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          libelle: `${item.workLabel} de ${dashboardClientName(item.clientNom)} est termine.`,
          description: buildDashboardProductionDescription(item, item.type, formatStatusLabel, formatDateShort)
        }))
    };
  });

  return {
    cashierDashboardCards,
    cashierCollections,
    cashierAlerts,
    tailorDashboardCards,
    tailorCollections
  };
}
