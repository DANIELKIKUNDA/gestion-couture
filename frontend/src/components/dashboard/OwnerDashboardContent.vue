<script setup>
import DashboardActivityMobileList from "./DashboardActivityMobileList.vue";
import DashboardMetricCardGrid from "./DashboardMetricCardGrid.vue";
import DashboardRecentWorkMobileList from "./DashboardRecentWorkMobileList.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  dashboardPrimaryMobileCards: { type: Array, default: () => [] },
  dashboardFinanceMobileCards: { type: Array, default: () => [] },
  dashboardSalesMobileCards: { type: Array, default: () => [] },
  recentWorkRows: { type: Array, default: () => [] },
  recentCaisseActivity: { type: Array, default: () => [] },
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
  dashboardCommandesCards: { type: Array, default: () => [] },
  dashboardRetouchesCards: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  formatPercent: { type: Function, required: true },
  formatDashboardClientFollowUpDescription: { type: Function, required: true },
  formatDashboardPendingCommandeDescription: { type: Function, required: true },
  formatDashboardPendingRetoucheDescription: { type: Function, required: true },
  openNouvelleCommande: { type: Function, required: true },
  openNouvelleRetouche: { type: Function, required: true },
  iconPaths: { type: Object, default: () => ({}) }
});
</script>

<template>
  <template v-if="isMobileViewport">
    <article class="panel">
      <MobileSectionHeader
        title="Indicateurs cles"
        subtitle="Les indicateurs prioritaires pour piloter la journee."
      />
      <DashboardMetricCardGrid :items="dashboardPrimaryMobileCards" />
    </article>

    <article class="panel">
      <MobileSectionHeader
        title="Caisse et encaissements"
        subtitle="Lecture rapide de la situation financiere."
      />
      <DashboardMetricCardGrid :items="dashboardFinanceMobileCards" />
    </article>

    <article class="panel">
      <MobileSectionHeader
        title="Ventes stock"
        subtitle="Performance recente des ventes atelier."
      />
      <DashboardMetricCardGrid :items="dashboardSalesMobileCards" />
    </article>

    <article class="panel">
      <MobileSectionHeader
        title="Activite recente"
        subtitle="Les derniers mouvements les plus utiles."
      />
      <DashboardRecentWorkMobileList
        v-if="recentWorkRows.length > 0"
        :items="recentWorkRows"
        :format-currency="formatCurrency"
      />
      <MobileStateEmpty
        v-else
        title="Aucune activite recente"
        description="Aucune commande, retouche ou vente recente sur la periode choisie."
      />
    </article>

    <article class="panel">
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

    <article class="panel alerts">
      <MobileSectionHeader
        title="Alertes"
        subtitle="Points d'attention a traiter rapidement."
      />
      <DashboardActivityMobileList
        :items="alerts"
        title="Alertes"
        empty-label="Aucune alerte active"
        tone="warning"
        badge-label="Alerte"
      />
    </article>

    <article v-if="canAccessContactFollowUpDashboard" class="panel">
      <MobileSectionHeader
        title="Suivi client"
        subtitle="Relances et notifications a traiter rapidement."
      />
      <DashboardMetricCardGrid :items="dashboardFollowUpCards" />
      <p v-if="dashboardContactBoardLoading" class="helper">Chargement du suivi client...</p>
      <p v-else-if="dashboardContactBoardError" class="helper">{{ dashboardContactBoardError }}</p>
    </article>

    <article v-if="canAccessContactFollowUpDashboard" class="panel">
      <MobileSectionHeader
        title="Clients a relancer"
        subtitle="Clients avec relance encore ouverte."
      />
      <DashboardActivityMobileList
        :items="dashboardClientsToFollowUpMobileItems"
        title="Relance client"
        empty-label="Aucun client a relancer"
        tone="warning"
        badge-label="Relance"
      />
    </article>

    <article v-if="canAccessContactFollowUpDashboard" class="panel">
      <MobileSectionHeader
        title="Commandes pretes a signaler"
        subtitle="Commandes terminees sans suivi client enregistre."
      />
      <DashboardActivityMobileList
        :items="dashboardCommandesToNotifyMobileItems"
        title="Commande prete"
        empty-label="Aucune commande en attente de signalement"
        tone="info"
        badge-label="Commande"
      />
    </article>

    <article v-if="canAccessContactFollowUpDashboard" class="panel">
      <MobileSectionHeader
        title="Retouches pretes a signaler"
        subtitle="Retouches terminees sans suivi client enregistre."
      />
      <DashboardActivityMobileList
        :items="dashboardRetouchesToNotifyMobileItems"
        title="Retouche prete"
        empty-label="Aucune retouche en attente de signalement"
        tone="info"
        badge-label="Retouche"
      />
    </article>
  </template>

  <template v-else>
    <div class="kpi-grid legacy-kpi-grid">
      <article v-for="card in dashboardCommandesCards" :key="card.label" class="kpi-card legacy-kpi" :data-tone="card.tone">
        <div class="kpi-head"><span>{{ card.label }}</span></div>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <div class="kpi-grid legacy-kpi-grid">
      <article v-for="card in dashboardRetouchesCards" :key="card.label" class="kpi-card legacy-kpi" :data-tone="card.tone">
        <div class="kpi-head"><span>{{ card.label }}</span></div>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <article class="panel finance-band">
      <div class="money-item">
        <p>Solde Caisse</p>
        <strong>{{ formatCurrency(financeMetrics.soldeCaisse) }}</strong>
      </div>
      <div class="money-item green">
        <p>Total Encaissement</p>
        <strong>{{ formatCurrency(financeMetrics.totalEncaissement) }}</strong>
      </div>
      <div class="money-item red">
        <p>Depenses du Jour</p>
        <strong>{{ formatCurrency(financeMetrics.depensesJour) }}</strong>
      </div>
      <div class="money-item red">
        <p>Entrees commande</p>
        <strong>{{ formatCurrency(financeMetrics.acomptesEncaisses) }}</strong>
      </div>
    </article>

    <article class="panel finance-band">
      <div class="money-item">
        <p>Ventes stock</p>
        <strong>{{ dashboardSalesMetrics.nombreVentes }}</strong>
      </div>
      <div class="money-item blue">
        <p>CA ventes stock</p>
        <strong>{{ formatCurrency(dashboardSalesMetrics.chiffreAffaires) }}</strong>
      </div>
      <div class="money-item green">
        <p>Benefice brut</p>
        <strong>{{ formatCurrency(dashboardSalesMetrics.beneficeBrut) }}</strong>
      </div>
      <div class="money-item teal">
        <p>Taux de marge</p>
        <strong>{{ formatPercent(dashboardSalesMetrics.margeMoyenne) }}</strong>
      </div>
    </article>

    <div class="split-grid legacy-split">
      <article class="panel">
        <h3>Dernieres Commandes</h3>
        <table class="data-table mobile-stack-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Montant</th>
              <th>Avance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in recentWorkRows" :key="row.id">
              <td data-label="Client">{{ row.clientNom }}</td>
              <td data-label="Type">{{ row.type }}</td>
              <td data-label="Statut">{{ row.statut }}</td>
              <td data-label="Montant">{{ formatCurrency(row.montantTotal) }}</td>
              <td data-label="Avance">{{ formatCurrency(row.avancePayee) }}</td>
            </tr>
            <tr v-if="recentWorkRows.length === 0">
              <td colspan="5">Aucune activite recente.</td>
            </tr>
          </tbody>
        </table>
        <div class="quick-inline">
          <button class="action-btn blue" @click="openNouvelleCommande">Nouvelle Commande</button>
          <button class="action-btn green" @click="openNouvelleRetouche">Nouvelle Retouche</button>
        </div>
      </article>

      <div class="stack">
        <article class="panel">
          <h3>Activite Caisse Recente</h3>
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

        <article class="panel alerts">
          <h3>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.alert" :key="`alert-${i}`" :d="path" />
            </svg>
            Alertes
          </h3>
          <ul class="activity-list">
            <li v-for="alert in alerts" :key="alert.label">
              <span class="status-pill" :data-tone="alert.tone">Alerte</span>
              <span>{{ alert.label }}</span>
            </li>
            <li v-if="alerts.length === 0">
              <span>Aucune alerte active.</span>
            </li>
          </ul>
        </article>
      </div>
    </div>

    <article v-if="canAccessContactFollowUpDashboard" class="panel">
      <h3>Suivi client</h3>
      <DashboardMetricCardGrid :items="dashboardFollowUpCards" :columns="4" compact />
      <p v-if="dashboardContactBoardLoading" class="helper">Chargement du suivi client...</p>
      <p v-else-if="dashboardContactBoardError" class="helper">{{ dashboardContactBoardError }}</p>
    </article>

    <div v-if="canAccessContactFollowUpDashboard" class="stack">
      <article class="panel">
        <h3>Clients a relancer</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in dashboardContactBoard.clientsARelancer.items" :key="item.idClient">
            <div class="activity-copy">
              <strong>{{ item.nomClient || item.telephone || item.idClient }}</strong>
              <small>{{ formatDashboardClientFollowUpDescription(item) }}</small>
            </div>
          </li>
          <li v-if="dashboardContactBoard.clientsARelancer.items.length === 0">
            <span>Aucun client a relancer.</span>
          </li>
        </ul>
      </article>

      <article class="panel">
        <h3>Commandes pretes a signaler</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in dashboardContactBoard.commandesPretesNonSignalees.items" :key="item.idCommande">
            <div class="activity-copy">
              <strong>{{ `${item.idCommande} - ${item.clientNom || item.idClient}` }}</strong>
              <small>{{ formatDashboardPendingCommandeDescription(item) }}</small>
            </div>
          </li>
          <li v-if="dashboardContactBoard.commandesPretesNonSignalees.items.length === 0">
            <span>Aucune commande en attente de signalement.</span>
          </li>
        </ul>
      </article>

      <article class="panel">
        <h3>Retouches pretes a signaler</h3>
        <ul class="activity-list activity-list--stacked">
          <li v-for="item in dashboardContactBoard.retouchesPretesNonSignalees.items" :key="item.idRetouche">
            <div class="activity-copy">
              <strong>{{ `${item.idRetouche} - ${item.clientNom || item.idClient}` }}</strong>
              <small>{{ formatDashboardPendingRetoucheDescription(item) }}</small>
            </div>
          </li>
          <li v-if="dashboardContactBoard.retouchesPretesNonSignalees.items.length === 0">
            <span>Aucune retouche en attente de signalement.</span>
          </li>
        </ul>
      </article>
    </div>
  </template>
</template>
