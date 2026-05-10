<script setup>
import { computed, ref, watch } from "vue";
import CashierDashboardContent from "./CashierDashboardContent.vue";
import OwnerDashboardContent from "./OwnerDashboardContent.vue";
import TailorDashboardContent from "./TailorDashboardContent.vue";
import DateNavigator from "../DateNavigator.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";

const props = defineProps({
  dashboardRoleTone: { type: String, default: "owner" },
  isMobileViewport: { type: Boolean, default: false },
  isCashierDashboard: { type: Boolean, default: false },
  isTailorDashboard: { type: Boolean, default: false },
  canCreateCommande: { type: Boolean, default: false },
  canCreateRetouche: { type: Boolean, default: false },
  dashboardHeroEyebrow: { type: String, default: "" },
  dashboardHeroTitle: { type: String, default: "" },
  dashboardHeroSubtitle: { type: String, default: "" },
  dashboardHeroTags: { type: Array, default: () => [] },
  dashboardHeroHighlights: { type: Array, default: () => [] },
  dailyDecisionPills: { type: Array, default: () => [] },
  dashboardClientsActifs: { type: Object, default: null },
  selectedDate: { type: String, default: "" },
  dashboardPeriod: { type: String, default: "LAST_7" },
  dashboardPeriodOptions: { type: Array, default: () => [] },
  cashierDashboardCards: { type: Array, default: () => [] },
  cashierCollections: { type: Object, default: () => ({ readyToCash: [], commandes: [], retouches: [] }) },
  recentCaisseActivity: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  cashierAlerts: { type: Array, default: () => [] },
  tailorDashboardCards: { type: Array, default: () => [] },
  tailorCollections: { type: Object, default: () => ({ dueToday: [], overdue: [], ready: [] }) },
  dashboardProductionRecentRows: { type: Array, default: () => [] },
  dashboardPrimaryMobileCards: { type: Array, default: () => [] },
  dashboardFinanceMobileCards: { type: Array, default: () => [] },
  dashboardSalesMobileCards: { type: Array, default: () => [] },
  dashboardCommandesCards: { type: Array, default: () => [] },
  dashboardRetouchesCards: { type: Array, default: () => [] },
  dashboardArgentAttendu: { type: Number, default: 0 },
  recentWorkRows: { type: Array, default: () => [] },
  alerts: { type: Array, default: () => [] },
  canAccessContactFollowUpDashboard: { type: Boolean, default: false },
  dashboardFollowUpCards: { type: Array, default: () => [] },
  dashboardContactBoardLoading: { type: Boolean, default: false },
  dashboardContactBoardError: { type: String, default: "" },
  dashboardClientsToFollowUpMobileItems: { type: Array, default: () => [] },
  dashboardCommandesToNotifyMobileItems: { type: Array, default: () => [] },
  dashboardRetouchesToNotifyMobileItems: { type: Array, default: () => [] },
  financeMetrics: { type: Object, default: () => ({}) },
  dashboardSalesMetrics: { type: Object, default: () => ({}) },
  dashboardContactBoard: { type: Object, default: () => ({ clientsARelancer: { items: [] }, commandesPretesNonSignalees: { items: [] }, retouchesPretesNonSignalees: { items: [] } }) },
  formatDashboardClientFollowUpDescription: { type: Function, required: true },
  formatDashboardPendingCommandeDescription: { type: Function, required: true },
  formatDashboardPendingRetoucheDescription: { type: Function, required: true },
  openRoute: { type: Function, required: true },
  openNouvelleCommande: { type: Function, required: true },
  openNouvelleRetouche: { type: Function, required: true },
  canAccessRoute: { type: Function, required: true },
  formatPercent: { type: Function, required: true },
  iconPaths: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["update:dashboardPeriod", "update:selectedDate"]);

const activeDashboardFilter = ref("all");

const dashboardFilterOptions = computed(() => {
  if (props.isCashierDashboard) {
    return [
      { key: "all", label: "Tout" },
      { key: "caisse", label: "Caisse" },
      { key: "encaissements", label: "Encaisser" },
      { key: "soldes", label: "Soldes" },
      { key: "alertes", label: "Alertes" }
    ];
  }
  if (props.isTailorDashboard) {
    return [
      { key: "all", label: "Tout" },
      { key: "today", label: "Aujourd'hui" },
      { key: "late", label: "Retards" },
      { key: "ready", label: "Termines" },
      { key: "activity", label: "Activite" }
    ];
  }
  return [
    { key: "all", label: "Tout" },
    { key: "money", label: "Argent" },
    { key: "clients", label: "Clients" },
    { key: "work", label: "Travail" },
    { key: "stock", label: "Stock" },
    { key: "alerts", label: "Alertes" }
  ];
});

watch(
  () => props.dashboardRoleTone,
  () => {
    activeDashboardFilter.value = "all";
  }
);
</script>

<template>
  <section class="dashboard classic-dashboard" :class="`dashboard-role-${dashboardRoleTone}`">
    <MobilePageLayout :has-action="isMobileViewport && (isCashierDashboard || isTailorDashboard)">
      <article class="panel dashboard-filter dashboard-hero">
        <div class="dashboard-hero-copy">
          <p class="mobile-overline dashboard-hero-eyebrow">{{ dashboardHeroEyebrow }}</p>
          <h3>{{ dashboardHeroTitle }}</h3>
          <p class="helper dashboard-hero-subtitle">{{ dashboardHeroSubtitle }}</p>
          <div class="dashboard-view-filter" aria-label="Filtrer le tableau de bord">
            <button
              v-for="filter in dashboardFilterOptions"
              :key="filter.key"
              class="dashboard-view-filter__chip"
              :class="{ active: activeDashboardFilter === filter.key }"
              type="button"
              @click="activeDashboardFilter = filter.key"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>
        <div class="dashboard-hero-side">
          <div class="dashboard-hero-highlights">
            <article v-for="item in dashboardHeroHighlights" :key="item.label" class="dashboard-highlight-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
          <div class="row-actions dashboard-hero-controls">
            <DateNavigator
              v-if="selectedDate"
              :model-value="selectedDate"
              @update:model-value="emit('update:selectedDate', $event)"
            />
          </div>
        </div>
      </article>

      <div v-if="dailyDecisionPills.length > 0" class="decision-strip" aria-label="Resume decisionnel du jour">
        <article v-for="pill in dailyDecisionPills" :key="pill.label" class="decision-pill" :data-tone="pill.tone || 'neutral'">
          <span>{{ pill.label }}</span>
          <strong>{{ pill.value }}</strong>
        </article>
      </div>

      <CashierDashboardContent
        v-if="isCashierDashboard"
        :is-mobile-viewport="isMobileViewport"
        :cashier-dashboard-cards="cashierDashboardCards"
        :cashier-collections="cashierCollections"
        :recent-caisse-activity="recentCaisseActivity"
        :format-currency="formatCurrency"
        :cashier-alerts="cashierAlerts"
        :open-route="openRoute"
        :active-filter="activeDashboardFilter"
      />

      <TailorDashboardContent
        v-else-if="isTailorDashboard"
        :is-mobile-viewport="isMobileViewport"
        :tailor-dashboard-cards="tailorDashboardCards"
        :tailor-collections="tailorCollections"
        :dashboard-production-recent-rows="dashboardProductionRecentRows"
        :format-currency="formatCurrency"
        :open-route="openRoute"
        :active-filter="activeDashboardFilter"
      />

      <OwnerDashboardContent
        v-else
        :is-mobile-viewport="isMobileViewport"
        :dashboard-primary-mobile-cards="dashboardPrimaryMobileCards"
        :dashboard-finance-mobile-cards="dashboardFinanceMobileCards"
        :dashboard-sales-mobile-cards="dashboardSalesMobileCards"
        :recent-work-rows="recentWorkRows"
        :recent-caisse-activity="recentCaisseActivity"
        :alerts="alerts"
        :can-access-contact-follow-up-dashboard="canAccessContactFollowUpDashboard"
        :dashboard-follow-up-cards="dashboardFollowUpCards"
        :dashboard-contact-board-loading="dashboardContactBoardLoading"
        :dashboard-contact-board-error="dashboardContactBoardError"
        :dashboard-clients-to-follow-up-mobile-items="dashboardClientsToFollowUpMobileItems"
        :dashboard-commandes-to-notify-mobile-items="dashboardCommandesToNotifyMobileItems"
        :dashboard-retouches-to-notify-mobile-items="dashboardRetouchesToNotifyMobileItems"
        :finance-metrics="financeMetrics"
        :dashboard-sales-metrics="dashboardSalesMetrics"
        :dashboard-contact-board="dashboardContactBoard"
        :dashboard-commandes-cards="dashboardCommandesCards"
        :dashboard-retouches-cards="dashboardRetouchesCards"
        :dashboard-argent-attendu="dashboardArgentAttendu"
        :format-currency="formatCurrency"
        :format-percent="formatPercent"
        :format-dashboard-client-follow-up-description="formatDashboardClientFollowUpDescription"
        :format-dashboard-pending-commande-description="formatDashboardPendingCommandeDescription"
        :format-dashboard-pending-retouche-description="formatDashboardPendingRetoucheDescription"
        :open-nouvelle-commande="openNouvelleCommande"
        :open-nouvelle-retouche="openNouvelleRetouche"
        :icon-paths="iconPaths"
        :active-filter="activeDashboardFilter"
      />

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && isCashierDashboard"
          title="Action principale"
          subtitle="Accedez rapidement a la caisse du jour."
        >
          <button class="action-btn blue" @click="openRoute('caisse')">Ouvrir la caisse</button>
        </MobilePrimaryActionBar>
        <MobilePrimaryActionBar
          v-else-if="isMobileViewport && isTailorDashboard && canAccessRoute('commandes')"
          title="Action principale"
          subtitle="Consultez rapidement les commandes a traiter."
        >
          <button class="action-btn blue" @click="openRoute('commandes')">Voir commandes</button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>

<style scoped>
.decision-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 1px 4px;
  scrollbar-width: none;
}

.dashboard-view-filter {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.dashboard-view-filter__chip {
  min-height: 38px;
  border: 1px solid rgba(31, 90, 162, 0.14);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.9);
  color: #475467;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(31, 90, 162, 0.06);
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease;
}

.dashboard-view-filter__chip:hover {
  transform: translateY(-1px);
  border-color: rgba(31, 90, 162, 0.25);
}

.dashboard-view-filter__chip.active {
  border-color: rgba(31, 90, 162, 0.28);
  background: linear-gradient(180deg, #2366b5 0%, #174f94 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(31, 90, 162, 0.18);
}

.decision-strip::-webkit-scrollbar {
  display: none;
}

.decision-pill {
  flex: 1 0 160px;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  display: grid;
  gap: 4px;
}

.decision-pill span {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.decision-pill strong {
  color: #24364d;
  font-size: 1rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.decision-pill[data-tone="in"] strong {
  color: #17643d;
}

.decision-pill[data-tone="out"] strong {
  color: #b74235;
}

@media (max-width: 767px) {
  .decision-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow-x: visible;
  }

  .dashboard-view-filter {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 2px 1px 7px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .dashboard-view-filter::-webkit-scrollbar {
    display: none;
  }

  .dashboard-view-filter__chip {
    flex: 0 0 auto;
  }

  .decision-pill {
    flex: initial;
  }

  .decision-strip > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
    justify-items: center;
    text-align: center;
  }
}
</style>
