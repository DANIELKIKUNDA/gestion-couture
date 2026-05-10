<script setup>
import { computed } from "vue";
import DashboardActivityMobileList from "./DashboardActivityMobileList.vue";
import DashboardRecentWorkMobileList from "./DashboardRecentWorkMobileList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

const props = defineProps({
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
  dashboardContactBoard: {
    type: Object,
    default: () => ({ clientsARelancer: { items: [] }, commandesPretesNonSignalees: { items: [] }, retouchesPretesNonSignalees: { items: [] } })
  },
  dashboardCommandesCards: { type: Array, default: () => [] },
  dashboardRetouchesCards: { type: Array, default: () => [] },
  dashboardArgentAttendu: { type: Number, default: 0 },
  formatCurrency: { type: Function, required: true },
  formatPercent: { type: Function, required: true },
  formatDashboardClientFollowUpDescription: { type: Function, required: true },
  formatDashboardPendingCommandeDescription: { type: Function, required: true },
  formatDashboardPendingRetoucheDescription: { type: Function, required: true },
  openNouvelleCommande: { type: Function, required: true },
  openNouvelleRetouche: { type: Function, required: true },
  iconPaths: { type: Object, default: () => ({}) },
  activeFilter: { type: String, default: "all" }
});

function cardValue(cards, label) {
  return Number(cards.find((card) => card?.label === label)?.value || 0);
}

const commandesEnCours = computed(() => cardValue(props.dashboardCommandesCards, "Commandes en cours"));
const commandesPretes = computed(() => cardValue(props.dashboardCommandesCards, "Commandes pretes"));
const commandesASolder = computed(() => cardValue(props.dashboardCommandesCards, "Commandes a solder"));
const retouchesEnCours = computed(() => cardValue(props.dashboardRetouchesCards, "Retouches en cours"));
const retouchesPretes = computed(() => cardValue(props.dashboardRetouchesCards, "Retouches pretes"));
const retouchesASolder = computed(() => cardValue(props.dashboardRetouchesCards, "Retouches a solder"));

const actionsAtraiter = computed(() => {
  const followUpTotal = props.dashboardFollowUpCards.find((card) => card?.label === "Total a traiter")?.value || 0;
  return Number(followUpTotal || 0) + props.alerts.length;
});

const netDuJour = computed(() => Number(props.financeMetrics.totalEncaissement || 0) - Number(props.financeMetrics.depensesJour || 0));

const decisionCards = computed(() => [
  {
    label: "Resultat du jour",
    value: props.formatCurrency(netDuJour.value),
    description: "Argent entre moins argent sorti.",
    tone: netDuJour.value < 0 ? "danger" : "success"
  },
  {
    label: "Argent en caisse",
    value: props.formatCurrency(props.financeMetrics.soldeCaisse),
    description: "Montant disponible dans la caisse affichee.",
    tone: "blue"
  },
  {
    label: "Argent encore attendu",
    value: props.formatCurrency(props.dashboardArgentAttendu),
    description: "Montant restant a encaisser sur les commandes et retouches.",
    tone: Number(props.dashboardArgentAttendu || 0) > 0 ? "warning" : "neutral"
  },
  {
    label: "A traiter",
    value: actionsAtraiter.value,
    description: "Relances, signalements et alertes actives.",
    tone: actionsAtraiter.value > 0 ? "warning" : "success"
  }
]);

const attentionItems = computed(() => {
  const rows = [];
  if (props.activeFilter !== "clients") {
    for (const alert of props.alerts) {
      rows.push({
        id: `alert-${alert.label}`,
        type: alert.type || "Alerte atelier",
        title: alert.title || alert.label,
        description: alert.description || "A verifier avant de terminer la journee.",
        tone: "danger"
      });
    }
  }
  if (props.activeFilter !== "alerts") {
    for (const item of props.dashboardClientsToFollowUpMobileItems) {
      rows.push({
        id: `client-${item.id}`,
        type: item.type || "Client a relancer",
        title: item.title || item.libelle,
        description: item.description,
        tone: "warning"
      });
    }
    for (const item of props.dashboardCommandesToNotifyMobileItems) {
      rows.push({
        id: `commande-${item.id}`,
        type: item.type || "Client a prevenir",
        title: item.title || item.libelle,
        description: item.description,
        tone: "blue"
      });
    }
    for (const item of props.dashboardRetouchesToNotifyMobileItems) {
      rows.push({
        id: `retouche-${item.id}`,
        type: item.type || "Client a prevenir",
        title: item.title || item.libelle,
        description: item.description,
        tone: "teal"
      });
    }
  }
  return rows.slice(0, 8);
});

const attentionTitle = computed(() => {
  if (props.activeFilter === "clients") return "Clients a suivre";
  if (props.activeFilter === "alerts") return "Alertes atelier";
  return "A ne pas oublier";
});

const attentionEmptyState = computed(() => {
  if (props.activeFilter === "clients") {
    return {
      title: "Aucun client a relancer",
      description: "Aucun client a prevenir ou a relancer pour la date affichee."
    };
  }
  if (props.activeFilter === "alerts") {
    return {
      title: "Aucune alerte",
      description: "Aucune alerte active pour la date affichee."
    };
  }
  return {
    title: "Rien d'urgent pour le moment",
    description: "Aucune relance, aucun signalement et aucune alerte active pour la date affichee."
  };
});

const moneyCards = computed(() => [
  { label: "Argent entre", value: props.formatCurrency(props.financeMetrics.totalEncaissement), tone: "success" },
  { label: "Argent sorti", value: props.formatCurrency(props.financeMetrics.depensesJour), tone: "danger" },
  { label: "Resultat du jour", value: props.formatCurrency(netDuJour.value), tone: netDuJour.value < 0 ? "danger" : "success" },
  { label: "Argent en caisse", value: props.formatCurrency(props.financeMetrics.soldeCaisse), tone: "blue" },
  { label: "Entrees atelier", value: props.formatCurrency(props.financeMetrics.acomptesEncaisses), tone: "neutral" }
]);

const workCards = computed(() => [
  { label: "Commandes en cours", value: commandesEnCours.value, tone: "blue" },
  { label: "Commandes pretes", value: commandesPretes.value, tone: "success" },
  { label: "Commandes a solder", value: commandesASolder.value, tone: "warning" },
  { label: "Retouches en cours", value: retouchesEnCours.value, tone: "teal" },
  { label: "Retouches pretes", value: retouchesPretes.value, tone: "success" },
  { label: "Retouches a solder", value: retouchesASolder.value, tone: "warning" }
]);

const stockCards = computed(() => [
  { label: "Ventes realisees", value: props.dashboardSalesMetrics.nombreVentes || 0, tone: "blue" },
  { label: "Chiffre d'affaires", value: props.formatCurrency(props.dashboardSalesMetrics.chiffreAffaires), tone: "blue" },
  { label: "Benefice estime", value: props.formatCurrency(props.dashboardSalesMetrics.beneficeBrut), tone: "success" },
  { label: "Marge moyenne", value: props.formatPercent(props.dashboardSalesMetrics.margeMoyenne), tone: "teal" }
]);

function showOwnerSection(section) {
  if (props.activeFilter === "all") return true;
  if (props.activeFilter === "money") return ["money"].includes(section);
  if (props.activeFilter === "clients") return ["attention"].includes(section);
  if (props.activeFilter === "work") return ["work"].includes(section);
  if (props.activeFilter === "stock") return ["stock"].includes(section);
  if (props.activeFilter === "alerts") return ["attention"].includes(section);
  return true;
}
</script>

<template>
  <div class="owner-cockpit" :class="{ 'owner-cockpit--mobile': isMobileViewport }">
    <section v-if="showOwnerSection('decision')" class="owner-section owner-section--decision" aria-labelledby="owner-decision-title">
      <div class="owner-section-head">
        <div>
          <p class="owner-overline">Resume proprietaire</p>
          <h3 id="owner-decision-title">Ce qu'il faut savoir maintenant</h3>
        </div>
        <div class="owner-actions">
          <button class="action-btn blue" type="button" @click="openNouvelleCommande">Nouvelle commande</button>
          <button class="action-btn green" type="button" @click="openNouvelleRetouche">Nouvelle retouche</button>
        </div>
      </div>
      <div class="owner-decision-grid">
        <article v-for="card in decisionCards" :key="card.label" class="owner-decision-card" :data-tone="card.tone">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <p>{{ card.description }}</p>
        </article>
      </div>
    </section>

    <section v-if="showOwnerSection('attention')" class="owner-section owner-section--attention" aria-labelledby="owner-attention-title">
      <div class="owner-section-head">
        <div>
          <p class="owner-overline">Priorites</p>
          <h3 id="owner-attention-title">{{ attentionTitle }}</h3>
        </div>
        <span class="owner-count-pill" :data-tone="attentionItems.length > 0 ? 'warning' : 'success'">{{ attentionItems.length }} message(s)</span>
      </div>

      <div v-if="dashboardContactBoardLoading" class="owner-empty-line">Chargement du suivi client...</div>
      <div v-else-if="dashboardContactBoardError" class="owner-empty-line">{{ dashboardContactBoardError }}</div>
      <div v-else-if="attentionItems.length > 0" class="owner-attention-list">
        <article v-for="item in attentionItems" :key="item.id" class="owner-attention-item" :data-tone="item.tone">
          <span>{{ item.type }}</span>
          <strong>{{ item.title }}</strong>
          <p>{{ item.description }}</p>
        </article>
      </div>
      <MobileStateEmpty
        v-else
        :title="attentionEmptyState.title"
        :description="attentionEmptyState.description"
      />
    </section>

    <section v-if="showOwnerSection('money')" class="owner-section" aria-labelledby="owner-money-title">
      <div class="owner-section-head">
        <div>
          <p class="owner-overline">Argent</p>
          <h3 id="owner-money-title">Argent de l'atelier</h3>
        </div>
      </div>
      <div class="owner-money-grid">
        <article v-for="card in moneyCards" :key="card.label" class="owner-metric-card" :data-tone="card.tone">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </div>
    </section>

    <section v-if="showOwnerSection('work')" class="owner-section" aria-labelledby="owner-work-title">
      <div class="owner-section-head">
        <div>
          <p class="owner-overline">Production</p>
          <h3 id="owner-work-title">Travail en cours</h3>
        </div>
      </div>
      <div class="owner-work-grid">
        <article v-for="card in workCards" :key="card.label" class="owner-metric-card owner-metric-card--compact" :data-tone="card.tone">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </div>
    </section>

    <section v-if="showOwnerSection('activity')" class="owner-section owner-section--activity" aria-labelledby="owner-activity-title">
      <div class="owner-section-head">
        <div>
          <p class="owner-overline">Activite</p>
          <h3 id="owner-activity-title">Ce qui vient de se passer</h3>
          <p class="owner-section-note">Les 5 dernieres activites atelier et les 5 dernieres operations de caisse.</p>
        </div>
      </div>
      <div class="owner-activity-grid">
        <div>
          <h4>Atelier</h4>
          <DashboardRecentWorkMobileList
            v-if="recentWorkRows.length > 0"
            :items="recentWorkRows"
            :format-currency="formatCurrency"
          />
          <MobileStateEmpty
            v-else
            title="Aucune activite recente"
            description="Aucune commande, retouche ou vente recente pour la date affichee."
          />
        </div>
        <div>
          <h4>Caisse</h4>
          <DashboardActivityMobileList
            :items="recentCaisseActivity"
            title="Activite caisse"
            empty-label="Aucune operation recente"
            tone="info"
            :value-formatter="formatCurrency"
          />
        </div>
      </div>
    </section>

    <section v-if="showOwnerSection('stock')" class="owner-section owner-section--stock" aria-labelledby="owner-stock-title">
      <div class="owner-section-head">
        <div>
          <p class="owner-overline">Stock</p>
          <h3 id="owner-stock-title">Ventes stock</h3>
        </div>
      </div>
      <div class="owner-work-grid owner-work-grid--stock">
        <article v-for="card in stockCards" :key="card.label" class="owner-metric-card owner-metric-card--compact" :data-tone="card.tone">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.owner-cockpit {
  display: grid;
  gap: 14px;
}

.owner-section {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #d9e4ef;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 16px 36px rgba(22, 47, 78, 0.08);
  min-width: 0;
}

.owner-section--decision {
  border-color: #cfe0f3;
  background:
    radial-gradient(circle at top right, rgba(37, 90, 151, 0.09), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%);
}

.owner-section--attention {
  border-color: #ead8c8;
  background:
    radial-gradient(circle at top right, rgba(159, 92, 31, 0.08), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
}

.owner-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
}

.owner-section-head h3 {
  margin: 0;
  color: #153553;
  font-size: clamp(21px, 2.2vw, 28px);
  line-height: 1.1;
  letter-spacing: 0;
}

.owner-overline {
  margin: 0 0 4px;
  color: #607b98;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.owner-section-note {
  margin: 6px 0 0;
  color: #5b728d;
  font-size: 13px;
  line-height: 1.4;
}

.owner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.owner-decision-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.owner-decision-card,
.owner-metric-card,
.owner-attention-item {
  min-width: 0;
  border: 1px solid #dce7f2;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 28px rgba(22, 47, 78, 0.07);
}

.owner-decision-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 16px;
}

.owner-decision-card span,
.owner-metric-card span,
.owner-attention-item span {
  color: #607b98;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.owner-decision-card strong {
  color: #1c4f82;
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.owner-decision-card p,
.owner-attention-item p {
  margin: 0;
  color: #5b728d;
  font-size: 13px;
  line-height: 1.45;
}

.owner-decision-card[data-tone="success"] strong,
.owner-metric-card[data-tone="success"] strong {
  color: #237246;
}

.owner-decision-card[data-tone="danger"] strong,
.owner-metric-card[data-tone="danger"] strong {
  color: #b74235;
}

.owner-decision-card[data-tone="warning"] strong,
.owner-metric-card[data-tone="warning"] strong {
  color: #9f5c1f;
}

.owner-decision-card[data-tone="neutral"] strong,
.owner-metric-card[data-tone="neutral"] strong {
  color: #2f4f74;
}

.owner-count-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid #d8e4ef;
  border-radius: 999px;
  background: #fff;
  color: #44627f;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.owner-count-pill[data-tone="warning"] {
  border-color: #ead1b9;
  color: #9f5c1f;
  background: #fff8ef;
}

.owner-count-pill[data-tone="success"] {
  border-color: #cfe5d8;
  color: #237246;
  background: #f5fbf7;
}

.owner-attention-list {
  display: grid;
  gap: 10px;
}

.owner-attention-item {
  display: grid;
  grid-template-columns: minmax(120px, 0.22fr) minmax(180px, 0.34fr) minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 13px 14px;
  border-radius: 14px;
}

.owner-attention-item strong {
  color: #183957;
  font-size: 15px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.owner-attention-item[data-tone="danger"] {
  border-color: #f0c7c2;
  background: #fff8f7;
}

.owner-attention-item[data-tone="warning"] {
  border-color: #ead1b9;
  background: #fff9f2;
}

.owner-attention-item[data-tone="teal"] {
  border-color: #cde7e3;
  background: #f7fffd;
}

.owner-money-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.owner-work-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.owner-work-grid--stock {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.owner-metric-card {
  display: grid;
  gap: 8px;
  padding: 15px;
  border-radius: 15px;
}

.owner-metric-card strong {
  color: #1c4f82;
  font-size: clamp(22px, 2.5vw, 32px);
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.owner-metric-card--compact strong {
  font-size: clamp(24px, 2.4vw, 34px);
}

.owner-activity-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 14px;
}

.owner-activity-grid h4 {
  margin: 0 0 10px;
  color: #24466f;
  font-size: 17px;
}

.owner-empty-line {
  padding: 12px 14px;
  border: 1px dashed #d4e1ee;
  border-radius: 14px;
  color: #5b728d;
  background: rgba(255, 255, 255, 0.75);
}

@media (max-width: 1260px) {
  .owner-decision-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .owner-money-grid,
  .owner-work-grid,
  .owner-work-grid--stock {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .owner-activity-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .owner-cockpit {
    gap: 12px;
  }

  .owner-section {
    padding: 14px;
    border-radius: 16px;
  }

  .owner-section-head,
  .owner-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .owner-actions {
    display: none;
  }

  .owner-actions .action-btn {
    width: 100%;
  }

  .owner-decision-grid,
  .owner-money-grid,
  .owner-work-grid,
  .owner-work-grid--stock {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .owner-decision-grid > :last-child:nth-child(odd),
  .owner-money-grid > :last-child:nth-child(odd),
  .owner-work-grid > :last-child:nth-child(odd),
  .owner-work-grid--stock > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
    justify-items: center;
    text-align: center;
  }

  .owner-attention-item {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}
</style>
