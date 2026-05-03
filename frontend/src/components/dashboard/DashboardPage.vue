<script setup>
import CashierDashboardContent from "./CashierDashboardContent.vue";
import OwnerDashboardContent from "./OwnerDashboardContent.vue";
import TailorDashboardContent from "./TailorDashboardContent.vue";
import DateNavigator from "../DateNavigator.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";

defineProps({
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
</script>

<template>
  <section class="dashboard classic-dashboard" :class="`dashboard-role-${dashboardRoleTone}`">
    <MobilePageLayout :has-action="isMobileViewport && (isCashierDashboard || isTailorDashboard)">
      <article class="panel dashboard-filter dashboard-hero">
        <div class="dashboard-hero-copy">
          <p class="mobile-overline dashboard-hero-eyebrow">{{ dashboardHeroEyebrow }}</p>
          <h3>{{ dashboardHeroTitle }}</h3>
          <p class="helper dashboard-hero-subtitle">{{ dashboardHeroSubtitle }}</p>
          <div class="dashboard-hero-tags">
            <span v-for="tag in dashboardHeroTags" :key="tag" class="dashboard-hero-tag">{{ tag }}</span>
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
      />

      <TailorDashboardContent
        v-else-if="isTailorDashboard"
        :is-mobile-viewport="isMobileViewport"
        :tailor-dashboard-cards="tailorDashboardCards"
        :tailor-collections="tailorCollections"
        :dashboard-production-recent-rows="dashboardProductionRecentRows"
        :format-currency="formatCurrency"
        :open-route="openRoute"
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
</style>
