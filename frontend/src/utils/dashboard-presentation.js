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
    { label: "Argent en caisse", value: formatCurrency(financeMetrics.value.soldeCaisse), tone: "blue" },
    { label: "Argent entre", value: formatCurrency(financeMetrics.value.totalEncaissement), tone: "green" },
    { label: "Argent sorti", value: formatCurrency(financeMetrics.value.depensesJour), tone: "amber" },
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
    if (isCashierDashboard.value) return "Caisse du jour";
    if (isTailorDashboard.value) return "Atelier couture";
    return "Etat de l'atelier aujourd'hui";
  });

  const dashboardHeroSubtitle = computed(() => {
    if (isCashierDashboard.value) return "Voyez si la caisse peut encaisser, qui doit payer maintenant et ce qu'il faut verifier.";
    if (isTailorDashboard.value) return "Voyez quoi faire aujourd'hui, ce qui est en retard et ce qui est deja termine.";
    return "Voyez ce qui va bien, ce qui demande votre attention et l'argent disponible pour piloter l'atelier sans chercher.";
  });

  const dashboardHeroHighlights = computed(() => {
    if (isCashierDashboard.value) {
      return [
        { label: "Clients a encaisser", value: cashierCollections.value.readyToCash.length },
        { label: "Argent en caisse", value: formatCurrency(financeMetrics.value.soldeCaisse) },
        { label: "Travaux avec solde", value: (dashboardCommandesCards.value[3]?.value || 0) + (dashboardRetouchesCards.value[3]?.value || 0) }
      ];
    }
    if (isTailorDashboard.value) {
      return [
        { label: "A faire aujourd'hui", value: tailorCollections.value.dueTodayCount || 0 },
        { label: "En retard", value: tailorCollections.value.overdueCount || 0 },
        { label: "Termines", value: tailorCollections.value.readyCount || 0 }
      ];
    }
    return [
      { label: "Travaux en cours", value: (dashboardCommandesCards.value[1]?.value || 0) + (dashboardRetouchesCards.value[1]?.value || 0) },
      { label: "Argent en caisse", value: formatCurrency(financeMetrics.value.soldeCaisse) },
      { label: "Clients actifs", value: dashboardClientsActifs.value?.value || 0 }
    ];
  });

  const dashboardHeroTags = computed(() => {
    if (isCashierDashboard.value) return ["Caisse", "Encaisser", "Soldes", "Verifier"];
    if (isTailorDashboard.value) return ["Aujourd'hui", "Retards", "Termines", "Priorites"];
    return ["Argent", "Clients", "Travail", "Alertes"];
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
