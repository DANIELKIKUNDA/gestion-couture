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

    <MobileEntityCard
      eyebrow="Synthese client"
      title="Vision rapide"
      subtitle="Les indicateurs les plus utiles sur mobile"
      tone="default"
    >
      <template #meta>
        <MobileMetaList :items="syntheseMetaItems()" />
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.client-consultation-overview-cards {
  display: grid;
  gap: 12px;
}
</style>
