<script setup>
import DashboardActivityMobileList from "./DashboardActivityMobileList.vue";
import DashboardMetricCardGrid from "./DashboardMetricCardGrid.vue";
import DashboardRecentWorkMobileList from "./DashboardRecentWorkMobileList.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  tailorDashboardCards: { type: Array, default: () => [] },
  tailorCollections: { type: Object, default: () => ({ dueToday: [], overdue: [], ready: [] }) },
  dashboardProductionRecentRows: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  openRoute: { type: Function, required: true }
});
</script>

<template>
  <template v-if="isMobileViewport">
    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Vue production"
        subtitle="Les travaux en cours et les echeances les plus proches."
      />
      <DashboardMetricCardGrid :items="tailorDashboardCards" />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="A traiter aujourd'hui"
        subtitle="Travaux prevus sur la journee."
      />
      <DashboardActivityMobileList
        :items="tailorCollections.dueToday"
        title="Travail du jour"
        empty-label="Aucun travail prevu aujourd'hui"
        tone="info"
      />
    </article>

    <article class="panel alerts dashboard-focus-panel dashboard-focus-panel--warn">
      <MobileSectionHeader
        title="Travaux en retard"
        subtitle="Dossiers de production qui demandent une attention immediate."
      />
      <DashboardActivityMobileList
        :items="tailorCollections.overdue"
        title="Travail en retard"
        empty-label="Aucun travail en retard"
        tone="warning"
        badge-label="Urgent"
      />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Prets a remettre"
        subtitle="Travaux termines a pousser vers la livraison."
      />
      <DashboardActivityMobileList
        :items="tailorCollections.ready"
        title="Travail pret"
        empty-label="Aucun travail pret"
        tone="info"
        badge-label="Pret"
      />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Activite recente"
        subtitle="Les derniers mouvements utiles cote production."
      />
      <DashboardRecentWorkMobileList
        v-if="dashboardProductionRecentRows.length > 0"
        :items="dashboardProductionRecentRows"
        :format-currency="formatCurrency"
      />
      <MobileStateEmpty
        v-else
        title="Aucune activite recente"
        description="Aucune commande ou retouche recente sur la periode choisie."
      />
    </article>
  </template>

  <template v-else>
    <article class="panel dashboard-focus-panel">
      <h3>Vue production</h3>
      <DashboardMetricCardGrid :items="tailorDashboardCards" :columns="3" compact />
    </article>

    <div class="split-grid legacy-split">
      <article class="panel dashboard-focus-panel">
        <h3>A traiter aujourd'hui</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in tailorCollections.dueToday" :key="item.id">
            <div class="activity-copy">
              <strong>{{ item.libelle }}</strong>
              <small>{{ item.description }}</small>
            </div>
          </li>
          <li v-if="tailorCollections.dueToday.length === 0">
            <span>Aucun travail prevu aujourd'hui.</span>
          </li>
        </ul>
        <div class="quick-inline">
          <button class="action-btn blue" @click="openRoute('commandes')">Voir commandes</button>
          <button class="action-btn green" @click="openRoute('retouches')">Voir retouches</button>
        </div>
      </article>

      <div class="stack">
        <article class="panel alerts dashboard-focus-panel dashboard-focus-panel--warn">
          <h3>Travaux en retard</h3>
          <ul class="activity-list activity-list--stacked">
            <li v-for="item in tailorCollections.overdue" :key="item.id">
              <div class="activity-copy">
                <strong>{{ item.libelle }}</strong>
                <small>{{ item.description }}</small>
              </div>
            </li>
            <li v-if="tailorCollections.overdue.length === 0">
              <span>Aucun travail en retard.</span>
            </li>
          </ul>
        </article>

        <article class="panel dashboard-focus-panel">
          <h3>Prets a remettre</h3>
          <ul class="activity-list activity-list--stacked">
            <li v-for="item in tailorCollections.ready" :key="item.id">
              <div class="activity-copy">
                <strong>{{ item.libelle }}</strong>
                <small>{{ item.description }}</small>
              </div>
            </li>
            <li v-if="tailorCollections.ready.length === 0">
              <span>Aucun travail pret.</span>
            </li>
          </ul>
        </article>
      </div>
    </div>
  </template>
</template>
