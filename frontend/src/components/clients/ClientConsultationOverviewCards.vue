<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  client: {
    type: Object,
    default: null
  },
  synthese: {
    type: Object,
    default: null
  },
  formatDate: {
    type: Function,
    required: true
  },
  formatCurrency: {
    type: Function,
    required: true
  }
});

function statutTone(client) {
  if (client?.statutVisuel === "Client fidele") return "ok";
  if (client?.statutVisuel === "Client regulier") return "blue";
  return "slate";
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clientMetaItems() {
  return [
    {
      key: "contact",
      label: "Contact",
      value: props.client?.telephone || "-"
    },
    {
      key: "premier",
      label: "Premier passage",
      value: props.formatDate(props.client?.datePremierPassage)
    },
    {
      key: "dernier",
      label: "Dernier passage",
      value: props.formatDate(props.client?.dateDernierPassage || props.synthese?.dateDerniereActivite)
    }
  ];
}

function syntheseMetaItems() {
  return [
    {
      key: "commandes",
      label: "Commandes",
      value: props.synthese?.totalCommandes ?? 0,
      emphasis: true,
      tone: "info"
    },
    {
      key: "retouches",
      label: "Retouches",
      value: props.synthese?.totalRetouches ?? 0,
      emphasis: true,
      tone: "info"
    },
    {
      key: "activite",
      label: "Derniere activite",
      value: props.formatDate(props.synthese?.dateDerniereActivite)
    },
    {
      key: "depense",
      label: "Total depense",
      value: props.formatCurrency(props.synthese?.montantTotalDepense),
      emphasis: true,
      tone: "warning"
    }
  ];
}

function syntheseCards() {
  return [
    {
      key: "commandes",
      label: "Commandes",
      value: safeNumber(props.synthese?.totalCommandes),
      detail: "Commandes creees pour ce client",
      tone: "blue"
    },
    {
      key: "retouches",
      label: "Retouches",
      value: safeNumber(props.synthese?.totalRetouches),
      detail: "Retouches confiees a l'atelier",
      tone: "violet"
    },
    {
      key: "activite",
      label: "Derniere activite",
      value: props.formatDate(props.synthese?.dateDerniereActivite),
      detail: "Dernier passage connu",
      tone: "slate"
    },
    {
      key: "depense",
      label: "Total depense",
      value: props.formatCurrency(props.synthese?.montantTotalDepense),
      detail: "Montant total deja facture",
      tone: "green"
    }
  ];
}
</script>

<template>
  <div class="client-consultation-overview-cards">
    <MobileEntityCard
      :title="client?.nomComplet || 'Client non renseigne'"
      eyebrow="Identite client"
      subtitle="Memoire atelier du client"
      tone="info"
    >
      <template #badge>
        <span class="status-pill" :data-tone="statutTone(client)">
          {{ client?.statutVisuel || "Client occasionnel" }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="clientMetaItems()" />
      </template>
    </MobileEntityCard>

    <article class="client-synthesis-card">
      <div class="client-synthesis-card__head">
        <div>
          <p class="client-synthesis-card__eyebrow">Synthese client</p>
          <h4>Vision rapide</h4>
          <p>Les donnees utiles pour comprendre le client sans chercher.</p>
        </div>
      </div>

      <div class="client-synthesis-grid">
        <article
          v-for="item in syntheseCards()"
          :key="item.key"
          class="client-synthesis-kpi"
          :data-tone="item.tone"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.detail }}</small>
        </article>
      </div>
    </article>
  </div>
</template>

<style scoped>
.client-consultation-overview-cards {
  display: grid;
  gap: 12px;
}

.client-synthesis-card {
  display: grid;
  gap: 14px;
  border: 1px solid #dbe4ee;
  border-radius: 18px;
  padding: 14px;
  background:
    radial-gradient(circle at top right, rgba(31, 90, 162, 0.08), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: 0 12px 30px rgba(22, 47, 78, 0.08);
}

.client-synthesis-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.client-synthesis-card__eyebrow {
  margin: 0 0 4px;
  color: #6d86a0;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.client-synthesis-card h4 {
  margin: 0;
  color: #16324d;
  font-size: 18px;
  line-height: 1.18;
}

.client-synthesis-card p {
  margin: 4px 0 0;
  color: #5a7391;
  font-size: 13px;
  line-height: 1.4;
}

.client-synthesis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.client-synthesis-kpi {
  min-width: 0;
  min-height: 118px;
  display: grid;
  align-content: space-between;
  gap: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 13px;
  background: rgba(255, 255, 255, 0.9);
}

.client-synthesis-kpi span,
.client-synthesis-kpi small,
.client-synthesis-kpi strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.client-synthesis-kpi span {
  color: #667085;
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.client-synthesis-kpi strong {
  color: #101828;
  font-size: 1.35rem;
  line-height: 1.12;
  font-variant-numeric: tabular-nums;
}

.client-synthesis-kpi small {
  color: #667085;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.35;
}

.client-synthesis-kpi[data-tone="blue"] {
  border-color: rgba(31, 90, 162, 0.16);
  background: linear-gradient(180deg, #f7fbff 0%, #eaf3ff 100%);
}

.client-synthesis-kpi[data-tone="violet"] {
  border-color: rgba(123, 92, 190, 0.18);
  background: linear-gradient(180deg, #fbf8ff 0%, #f3edff 100%);
}

.client-synthesis-kpi[data-tone="green"] {
  border-color: rgba(12, 166, 120, 0.18);
  background: linear-gradient(180deg, #f5fff9 0%, #ecfdf3 100%);
}

.client-synthesis-kpi[data-tone="slate"] {
  border-color: rgba(62, 95, 136, 0.14);
  background: linear-gradient(180deg, #f8fbff 0%, #eef3f8 100%);
}

@media (min-width: 860px) {
  .client-consultation-overview-cards {
    grid-template-columns: minmax(280px, 0.78fr) minmax(0, 1.22fr);
    align-items: stretch;
  }

  .client-synthesis-card {
    padding: 16px;
  }

  .client-synthesis-kpi strong {
    font-size: 1.55rem;
  }
}

@media (max-width: 420px) {
  .client-synthesis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
