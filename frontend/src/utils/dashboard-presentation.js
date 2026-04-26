import { computed } from "vue";

export function useDashboardPresentation({
  currentRole,
  dashboardCommandesCards,
  dashboardRetouchesCards,
  financeMetrics,
  dashboardSalesMetrics,
  cashierCollections,
  tailorCollections,
  dashboardClientsActifs,
  formatCurrency,
  formatPercent
}) {
  const dashboardPrimaryMobileCards = computed(() => [
    dashboardCommandesCards.value[0],
    dashboardCommandesCards.value[1],
    dashboardRetouchesCards.value[0],
    dashboardRetouchesCards.value[1]
  ].filter(Boolean));

  const dashboardFinanceMobileCards = computed(() => [
    { label: "Solde caisse", value: formatCurrency(financeMetrics.value.soldeCaisse), tone: "blue" },
    { label: "Encaissement", value: formatCurrency(financeMetrics.value.totalEncaissement), tone: "green" },
    { label: "Depenses", value: formatCurrency(financeMetrics.value.depensesJour), tone: "amber" },
    { label: "Entrees atelier", value: formatCurrency(financeMetrics.value.acomptesEncaisses), tone: "slate" }
  ]);

  const dashboardSalesMobileCards = computed(() => [
    { label: "Ventes stock", value: dashboardSalesMetrics.value.nombreVentes, tone: "blue" },
    { label: "CA ventes", value: formatCurrency(dashboardSalesMetrics.value.chiffreAffaires), tone: "blue" },
    { label: "Benefice brut", value: formatCurrency(dashboardSalesMetrics.value.beneficeBrut), tone: "green" },
    { label: "Taux de marge", value: formatPercent(dashboardSalesMetrics.value.margeMoyenne), tone: "teal" }
  ]);

  const isCashierDashboard = computed(() => currentRole.value === "CAISSIER");
  const isTailorDashboard = computed(() => currentRole.value === "COUTURIER");

  const dashboardRoleTone = computed(() => {
    if (isCashierDashboard.value) return "cashier";
    if (isTailorDashboard.value) return "tailor";
    return "owner";
  });

  const dashboardHeroEyebrow = computed(() => {
    if (isCashierDashboard.value) return "Operations caisse";
    if (isTailorDashboard.value) return "Pilotage production";
    return "Vue globale";
  });

  const dashboardHeroTitle = computed(() => {
    if (isCashierDashboard.value) return "Cockpit caissier";
    if (isTailorDashboard.value) return "Cockpit couturier";
    return "Dashboard atelier";
  });

  const dashboardHeroSubtitle = computed(() => {
    if (isCashierDashboard.value) return "Encaissements, soldes et livraisons pretes dans un flux simple, rapide et sans distraction.";
    if (isTailorDashboard.value) return "Travaux du jour, retards et pieces pretes reunis dans une vue de production claire.";
    return "Suivez rapidement l'activite, la caisse et les alertes.";
  });

  const dashboardHeroHighlights = computed(() => {
    if (isCashierDashboard.value) {
      return [
        { label: "A encaisser maintenant", value: cashierCollections.value.readyToCash.length },
        { label: "Solde caisse", value: formatCurrency(financeMetrics.value.soldeCaisse) },
        { label: "Documents a solder", value: (dashboardCommandesCards.value[3]?.value || 0) + (dashboardRetouchesCards.value[3]?.value || 0) }
      ];
    }
    if (isTailorDashboard.value) {
      return [
        { label: "Travaux du jour", value: tailorCollections.value.dueTodayCount || 0 },
        { label: "En retard", value: tailorCollections.value.overdueCount || 0 },
        { label: "Prets", value: tailorCollections.value.readyCount || 0 }
      ];
    }
    return [
      { label: "Clients actifs", value: dashboardClientsActifs.value?.value || 0 },
      { label: "Commandes en cours", value: dashboardCommandesCards.value[1]?.value || 0 },
      { label: "Retouches en cours", value: dashboardRetouchesCards.value[1]?.value || 0 }
    ];
  });

  const dashboardHeroTags = computed(() => {
    if (isCashierDashboard.value) return ["Caisse", "Encaissement", "Soldes", "Livraison"];
    if (isTailorDashboard.value) return ["Production", "Echeances", "Priorites", "Habits"];
    return ["Atelier", "Vue globale", "Suivi", "Performance"];
  });

  return {
    dashboardPrimaryMobileCards,
    dashboardFinanceMobileCards,
    dashboardSalesMobileCards,
    isCashierDashboard,
    isTailorDashboard,
    dashboardRoleTone,
    dashboardHeroEyebrow,
    dashboardHeroTitle,
    dashboardHeroSubtitle,
    dashboardHeroHighlights,
    dashboardHeroTags
  };
}
