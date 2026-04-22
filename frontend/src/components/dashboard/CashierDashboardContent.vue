<script setup>
import DashboardActivityMobileList from "./DashboardActivityMobileList.vue";
import DashboardMetricCardGrid from "./DashboardMetricCardGrid.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  cashierDashboardCards: { type: Array, default: () => [] },
  cashierCollections: { type: Object, default: () => ({ readyToCash: [], commandes: [], retouches: [] }) },
  recentCaisseActivity: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  cashierAlerts: { type: Array, default: () => [] },
  openRoute: { type: Function, required: true }
});
</script>

<template>
  <template v-if="isMobileViewport">
    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Vue caisse"
        subtitle="Les encaissements et soldes a traiter en priorite."
      />
      <DashboardMetricCardGrid :items="cashierDashboardCards" />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Prets a encaisser"
        subtitle="Documents termines avec solde restant."
      />
      <DashboardActivityMobileList
        :items="cashierCollections.readyToCash"
        title="Pret a encaisser"
        empty-label="Aucun document pret a encaisser"
        tone="warning"
        badge-label="Solde"
      />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Commandes avec solde"
        subtitle="Les commandes qui attendent encore un paiement."
      />
      <DashboardActivityMobileList
        :items="cashierCollections.commandes"
        title="Commande"
        empty-label="Aucune commande avec solde"
        tone="info"
      />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Retouches avec solde"
        subtitle="Les retouches a solder ou finaliser."
      />
      <DashboardActivityMobileList
        :items="cashierCollections.retouches"
        title="Retouche"
        empty-label="Aucune retouche avec solde"
        tone="info"
      />
    </article>

    <article class="panel dashboard-focus-panel">
      <MobileSectionHeader
        title="Activite caisse recente"
        subtitle="Les dernieres operations de caisse enregistrees."
      />
      <DashboardActivityMobileList
        :items="recentCaisseActivity"
        title="Activite caisse"
        empty-label="Aucune operation recente"
        tone="info"
        :value-formatter="formatCurrency"
      />
    </article>

    <article class="panel alerts dashboard-focus-panel dashboard-focus-panel--warn">
      <MobileSectionHeader
        title="Points d'attention"
        subtitle="Ce qui peut bloquer l'encaissement ou la livraison."
      />
      <DashboardActivityMobileList
        :items="cashierAlerts"
        title="Alerte caisse"
        empty-label="Aucune alerte de caisse"
        tone="warning"
        badge-label="Alerte"
      />
    </article>
  </template>

  <template v-else>
    <article class="panel">
      <h3>Vue caisse</h3>
      <DashboardMetricCardGrid :items="cashierDashboardCards" :columns="3" compact />
    </article>

    <div class="split-grid legacy-split">
      <article class="panel dashboard-focus-panel">
        <h3>Documents prets a encaisser</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in cashierCollections.readyToCash" :key="item.id">
            <div class="activity-copy">
              <strong>{{ item.libelle }}</strong>
              <small>{{ item.description }}</small>
            </div>
          </li>
          <li v-if="cashierCollections.readyToCash.length === 0">
            <span>Aucun document pret a encaisser.</span>
          </li>
        </ul>
        <div class="quick-inline">
          <button class="action-btn blue" @click="openRoute('caisse')">Ouvrir la caisse</button>
          <button class="action-btn green" @click="openRoute('facturation')">Voir facturation</button>
        </div>
      </article>

      <div class="stack">
        <article class="panel dashboard-focus-panel">
          <h3>Activite caisse recente</h3>
          <ul class="activity-list">
            <li v-for="item in recentCaisseActivity" :key="item.id">
              <span>{{ item.libelle }}</span>
              <strong>{{ formatCurrency(item.montant) }}</strong>
            </li>
            <li v-if="recentCaisseActivity.length === 0">
              <span>Aucune operation recente.</span>
            </li>
          </ul>
        </article>

        <article class="panel alerts dashboard-focus-panel dashboard-focus-panel--warn">
          <h3>Points d'attention</h3>
          <ul class="activity-list activity-list--stacked">
            <li v-for="item in cashierAlerts" :key="item.id">
              <div class="activity-copy">
                <strong>{{ item.libelle }}</strong>
                <small>{{ item.description }}</small>
              </div>
            </li>
            <li v-if="cashierAlerts.length === 0">
              <span>Aucune alerte de caisse.</span>
            </li>
          </ul>
        </article>
      </div>
    </div>

    <div class="split-grid legacy-split">
      <article class="panel dashboard-focus-panel">
        <h3>Commandes avec solde</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in cashierCollections.commandes" :key="item.id">
            <div class="activity-copy">
              <strong>{{ item.libelle }}</strong>
              <small>{{ item.description }}</small>
            </div>
          </li>
          <li v-if="cashierCollections.commandes.length === 0">
            <span>Aucune commande avec solde.</span>
          </li>
        </ul>
      </article>

      <article class="panel dashboard-focus-panel">
        <h3>Retouches avec solde</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in cashierCollections.retouches" :key="item.id">
            <div class="activity-copy">
              <strong>{{ item.libelle }}</strong>
              <small>{{ item.description }}</small>
            </div>
          </li>
          <li v-if="cashierCollections.retouches.length === 0">
            <span>Aucune retouche avec solde.</span>
          </li>
        </ul>
      </article>
    </div>
  </template>
</template>
