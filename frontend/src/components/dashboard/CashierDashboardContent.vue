<script setup>
import { computed } from "vue";
import DashboardActivityMobileList from "./DashboardActivityMobileList.vue";

const props = defineProps({
  isMobileViewport: { type: Boolean, default: false },
  cashierDashboardCards: { type: Array, default: () => [] },
  cashierCollections: { type: Object, default: () => ({ readyToCash: [], commandes: [], retouches: [] }) },
  recentCaisseActivity: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  cashierAlerts: { type: Array, default: () => [] },
  openRoute: { type: Function, required: true },
  activeFilter: { type: String, default: "all" }
});

function card(label) {
  return props.cashierDashboardCards.find((item) => item?.label === label) || { label, value: "-", tone: "neutral" };
}

const cashStateCards = computed(() => [
  { ...card("Argent en caisse"), description: "Montant disponible dans la caisse affichee." },
  { ...card("Argent encaisse"), description: "Argent recu sur la journee affichee." },
  { ...card("Argent sorti"), description: "Depenses et sorties de la journee affichee." },
  { ...card("Travaux a encaisser"), description: "Commandes et retouches avec un solde restant." }
]);

const cashStatus = computed(() => {
  const closed = props.cashierAlerts.some((item) => item?.id === "cash-closed");
  return closed
    ? { title: "La caisse est fermee", description: "Ouvrez la caisse avant de recevoir un paiement.", tone: "danger" }
    : { title: "La caisse peut encaisser", description: "Les paiements peuvent etre enregistres normalement.", tone: "success" };
});

const cashSections = computed(() => [
  {
    id: "ready",
    title: "A encaisser maintenant",
    subtitle: "Clients dont le travail est pret et qui ont encore un solde.",
    items: props.cashierCollections.readyToCash,
    empty: "Aucun client pret a encaisser"
  },
  {
    id: "commandes",
    title: "Commandes avec solde",
    subtitle: "Commandes qui ont encore de l'argent a recevoir.",
    items: props.cashierCollections.commandes,
    empty: "Aucune commande avec solde"
  },
  {
    id: "retouches",
    title: "Retouches avec solde",
    subtitle: "Retouches qui ont encore de l'argent a recevoir.",
    items: props.cashierCollections.retouches,
    empty: "Aucune retouche avec solde"
  }
]);

function showCashierSection(section) {
  if (props.activeFilter === "all") return true;
  if (props.activeFilter === "caisse") return ["state"].includes(section);
  if (props.activeFilter === "encaissements") return ["cash"].includes(section);
  if (props.activeFilter === "soldes") return ["balance"].includes(section);
  if (props.activeFilter === "alertes") return ["warn"].includes(section);
  return true;
}
</script>

<template>
  <div class="cashier-cockpit" :class="{ 'cashier-cockpit--mobile': isMobileViewport }">
    <section v-if="showCashierSection('state')" class="cashier-section cashier-section--state" aria-labelledby="cashier-state-title">
      <div class="cashier-section-head">
        <div>
          <p class="cashier-overline">Caisse du jour</p>
          <h3 id="cashier-state-title">Etat de la caisse</h3>
        </div>
        <div class="cashier-actions cashier-actions--mobile-hidden">
          <button class="action-btn blue cashier-mobile-hidden-action" type="button" @click="openRoute('caisse')">Ouvrir la caisse</button>
          <button class="action-btn green cashier-mobile-hidden-action" type="button" @click="openRoute('facturation')">Facturation</button>
        </div>
      </div>

      <article class="cashier-status-card" :data-tone="cashStatus.tone">
        <strong>{{ cashStatus.title }}</strong>
        <p>{{ cashStatus.description }}</p>
      </article>

      <div class="cashier-metric-grid">
        <article v-for="item in cashStateCards" :key="item.label" class="cashier-metric-card" :data-tone="item.tone">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section v-if="showCashierSection('cash')" class="cashier-section cashier-section--cash" aria-labelledby="cashier-now-title">
      <div class="cashier-section-head">
        <div>
          <p class="cashier-overline">Encaissement</p>
          <h3 id="cashier-now-title">Clients a encaisser</h3>
        </div>
        <span class="cashier-pill">{{ cashierCollections.readyToCash.length }} client(s)</span>
      </div>
      <DashboardActivityMobileList
        :items="cashierCollections.readyToCash"
        title="A encaisser"
        empty-label="Aucun client a encaisser maintenant"
        tone="warning"
        badge-label="Solde"
      />
    </section>

    <section v-if="showCashierSection('balance')" class="cashier-section" aria-labelledby="cashier-balance-title">
      <div class="cashier-section-head">
        <div>
          <p class="cashier-overline">Soldes</p>
          <h3 id="cashier-balance-title">Argent encore a recevoir</h3>
        </div>
      </div>
      <div class="cashier-balance-grid">
        <article v-for="section in cashSections.slice(1)" :key="section.id" class="cashier-list-panel">
          <h4>{{ section.title }}</h4>
          <p>{{ section.subtitle }}</p>
          <DashboardActivityMobileList
            :items="section.items"
            :title="section.title"
            :empty-label="section.empty"
            tone="info"
          />
        </article>
      </div>
    </section>

    <section v-if="showCashierSection('control')" class="cashier-section" aria-labelledby="cashier-control-title">
      <div class="cashier-section-head">
        <div>
          <p class="cashier-overline">Controle</p>
          <h3 id="cashier-control-title">Dernieres operations</h3>
        </div>
      </div>
      <DashboardActivityMobileList
        :items="recentCaisseActivity"
        title="Operation caisse"
        empty-label="Aucune operation recente"
        tone="info"
        :value-formatter="formatCurrency"
      />
    </section>

    <section v-if="showCashierSection('warn')" class="cashier-section cashier-section--warn" aria-labelledby="cashier-warn-title">
      <div class="cashier-section-head">
        <div>
          <p class="cashier-overline">A verifier</p>
          <h3 id="cashier-warn-title">Ce qui peut bloquer la caisse</h3>
        </div>
      </div>
      <DashboardActivityMobileList
        :items="cashierAlerts"
        title="A verifier"
        empty-label="Rien a verifier pour le moment"
        tone="warning"
        badge-label="A verifier"
      />
    </section>
  </div>
</template>

<style scoped>
.cashier-cockpit {
  display: grid;
  gap: 14px;
}

.cashier-section {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid #d9e4ef;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 16px 36px rgba(22, 47, 78, 0.08);
  min-width: 0;
}

.cashier-section--state {
  background:
    radial-gradient(circle at top right, rgba(31, 102, 71, 0.09), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #f6fbf8 100%);
}

.cashier-section--cash {
  border-color: #ead8c8;
  background:
    radial-gradient(circle at top right, rgba(159, 92, 31, 0.08), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #fffaf5 100%);
}

.cashier-section--warn {
  border-color: #ecd0cb;
  background: linear-gradient(180deg, #ffffff 0%, #fff8f7 100%);
}

.cashier-section-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.cashier-section-head h3 {
  margin: 0;
  color: #153553;
  font-size: clamp(21px, 2.2vw, 28px);
  line-height: 1.1;
}

.cashier-overline {
  margin: 0 0 4px;
  color: #607b98;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cashier-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cashier-status-card,
.cashier-metric-card,
.cashier-list-panel {
  border: 1px solid #dce7f2;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 28px rgba(22, 47, 78, 0.07);
}

.cashier-status-card {
  display: grid;
  gap: 5px;
  padding: 15px;
}

.cashier-status-card strong {
  color: #237246;
  font-size: 20px;
}

.cashier-status-card[data-tone="danger"] strong {
  color: #b74235;
}

.cashier-status-card p,
.cashier-metric-card p,
.cashier-list-panel p {
  margin: 0;
  color: #5b728d;
  line-height: 1.45;
}

.cashier-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.cashier-metric-card {
  display: grid;
  gap: 8px;
  padding: 15px;
}

.cashier-metric-card span {
  color: #607b98;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.cashier-metric-card strong {
  color: #1c4f82;
  font-size: clamp(24px, 2.5vw, 34px);
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.cashier-metric-card[data-tone="green"] strong {
  color: #237246;
}

.cashier-metric-card[data-tone="amber"] strong {
  color: #9f5c1f;
}

.cashier-balance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.cashier-list-panel {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.cashier-list-panel h4 {
  margin: 0;
  color: #24466f;
  font-size: 17px;
}

.cashier-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid #ead1b9;
  border-radius: 999px;
  background: #fff8ef;
  color: #9f5c1f;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

@media (max-width: 1260px) {
  .cashier-metric-grid,
  .cashier-balance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .cashier-section {
    padding: 14px;
    border-radius: 16px;
  }

  .cashier-section-head,
  .cashier-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .cashier-metric-grid,
  .cashier-balance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cashier-metric-grid > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
    justify-items: center;
    text-align: center;
  }

  .cashier-balance-grid {
    grid-template-columns: 1fr;
  }

  .cashier-actions .action-btn {
    width: 100%;
  }

  .cashier-actions--mobile-hidden {
    display: none;
  }

  .cashier-mobile-hidden-action {
    display: none;
  }
}
</style>
