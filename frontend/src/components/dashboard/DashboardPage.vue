<script setup>
import CashierDashboardContent from "./CashierDashboardContent.vue";
import OwnerDashboardContent from "./OwnerDashboardContent.vue";
import TailorDashboardContent from "./TailorDashboardContent.vue";
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
  dashboardClientsActifs: { type: Object, default: null },
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

const emit = defineEmits(["update:dashboardPeriod"]);

function updateDashboardPeriod(event) {
  emit("update:dashboardPeriod", event?.target?.value || "LAST_7");
}
</script>

<template>
  <section class="dashboard classic-dashboard" :class="`dashboard-role-${dashboardRoleTone}`">
    <MobilePageLayout :has-action="isMobileViewport && (isCashierDashboard || isTailorDashboard || canCreateCommande || canCreateRetouche)">
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
            <p v-if="dashboardClientsActifs && !isCashierDashboard && !isTailorDashboard" class="helper"><strong>Clients actifs:</strong> {{ dashboardClientsActifs.value }}</p>
            <select :value="dashboardPeriod" @change="updateDashboardPeriod">
              <option v-for="option in dashboardPeriodOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </article>

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
        <MobilePrimaryActionBar
          v-else-if="isMobileViewport && canCreateCommande"
          title="Action principale"
          subtitle="Commencez rapidement une nouvelle commande."
        >
          <button class="action-btn blue" @click="openNouvelleCommande">Nouvelle commande</button>
        </MobilePrimaryActionBar>
        <MobilePrimaryActionBar
          v-else-if="isMobileViewport && canCreateRetouche"
          title="Action principale"
          subtitle="Commencez rapidement une nouvelle retouche."
        >
          <button class="action-btn green" @click="openNouvelleRetouche">Nouvelle retouche</button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
