<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  caisse: {
    type: Object,
    default: null
  },
  status: {
    type: String,
    default: "INCONNUE"
  },
  totals: {
    type: Object,
    default: () => ({})
  },
  formatCurrency: {
    type: Function,
    required: true
  },
  formatDateTime: {
    type: Function,
    required: true
  },
  formatOpenedBy: {
    type: Function,
    required: true
  },
  formatClosedBy: {
    type: Function,
    required: true
  }
});

function statusTone() {
  return props.status === "OUVERTE" ? "success" : "warning";
}

function statusItems() {
  return [
    {
      key: "ouverture",
      label: "Solde d'ouverture",
      value: props.formatCurrency(props.caisse?.soldeOuverture),
      emphasis: true,
      tone: "info"
    },
    {
      key: "courant",
      label: "Solde courant",
      value: props.formatCurrency(props.caisse?.soldeCourant),
      emphasis: true,
      tone: props.status === "OUVERTE" ? "success" : "warning"
    },
    {
      key: "ouvertePar",
      label: "Ouverte par",
      value: props.formatOpenedBy(props.caisse)
    },
    {
      key: "dateOuverture",
      label: "Date d'ouverture",
      value: props.formatDateTime(props.caisse?.dateOuverture)
    }
  ];
}

function financeItems() {
  return [
    {
      key: "entrees",
      label: "Total entrees",
      value: props.formatCurrency(props.totals?.totalEntrees),
      emphasis: true,
      tone: "success"
    },
    {
      key: "sorties",
      label: "Total sorties",
      value: props.formatCurrency(props.totals?.totalSorties),
      emphasis: true,
      tone: "warning"
    },
    {
      key: "solde",
      label: "Solde",
      value: props.formatCurrency(props.caisse?.soldeCourant),
      emphasis: true,
      tone: props.status === "OUVERTE" ? "success" : "warning"
    }
  ];
}

function resultItems() {
  return [
    {
      key: "sortiesQuotidiennes",
      label: "Depenses quotidiennes",
      value: props.formatCurrency(props.totals?.totalSortiesQuotidiennes)
    },
    {
      key: "resultat",
      label: "Resultat journalier",
      value: props.formatCurrency(props.totals?.resultatJournalier),
      emphasis: true,
      tone: "info"
    },
    {
      key: "clotureePar",
      label: "Cloturee par",
      value: props.formatClosedBy(props.caisse)
    },
    {
      key: "dateCloture",
      label: "Date de cloture",
      value: props.formatDateTime(props.caisse?.dateCloture)
    }
  ];
}
</script>

<template>
  <div class="caisse-overview-cards">
    <MobileEntityCard
      eyebrow="Statut de la caisse"
      title="Caisse du jour"
      subtitle="Vision rapide de l'etat actuel"
      :tone="statusTone()"
    >
      <template #badge>
        <span class="status-pill" :data-status="status">
          {{ status }}
        </span>
      </template>

      <template #meta>
        <MobileMetaList :items="statusItems()" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Resume financier"
      title="Flux et solde"
      subtitle="Entrees, sorties et solde courant"
      tone="default"
    >
      <template #meta>
        <MobileMetaList :items="financeItems()" />
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      eyebrow="Resultat du jour"
      title="Synthese journaliere"
      subtitle="Lecture rapide de la journee comptable"
      tone="info"
    >
      <template #meta>
        <MobileMetaList :items="resultItems()" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.caisse-overview-cards {
  display: grid;
  gap: 12px;
}
</style>
