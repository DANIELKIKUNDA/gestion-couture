<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  formatCurrency: {
    type: Function,
    required: true
  },
  formatWeekday: {
    type: Function,
    required: true
  }
});

function dateLabel(value) {
  return value ? String(value).slice(0, 10) : "-";
}

function titleFor(row) {
  return props.formatWeekday(row?.jour_semaine) || "Jour non renseigne";
}

function subtitleFor(row) {
  const ouverture = row?.heure_ouverture || "-";
  const cloture = row?.heure_cloture || "-";
  return `Ouverture ${ouverture} - Cloture ${cloture}`;
}

function metaItemsFor(row) {
  return [
    {
      key: "date-ouverture",
      label: "Date ouv.",
      value: dateLabel(row?.date_ouverture)
    },
    {
      key: "date-cloture",
      label: "Date clot.",
      value: dateLabel(row?.date_cloture)
    },
    {
      key: "solde-ouverture",
      label: "Solde ouv.",
      value: props.formatCurrency(row?.solde_ouverture)
    },
    {
      key: "entrees",
      label: "Entrees",
      value: props.formatCurrency(row?.total_entrees)
    },
    {
      key: "sorties",
      label: "Sorties",
      value: props.formatCurrency(row?.total_sorties)
    },
    {
      key: "resultat",
      label: "Resultat",
      value: props.formatCurrency(row?.resultat_journalier)
    },
    {
      key: "restant",
      label: "Solde rest.",
      value: props.formatCurrency(row?.solde_journalier_restant)
    },
    {
      key: "cloture",
      label: "Solde clot.",
      value: props.formatCurrency(row?.solde_cloture),
      emphasis: true,
      tone: "info"
    },
    {
      key: "operations",
      label: "Nb operations",
      value: row?.nombre_operations ?? "-"
    }
  ];
}
</script>

<template>
  <div class="audit-caisse-daily-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune caisse cloturee"
      description="Aucun bilan journalier n'est disponible pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.id_caisse_jour"
        eyebrow="Caisse cloturee"
        :title="titleFor(row)"
        :subtitle="subtitleFor(row)"
        tone="info"
      >
        <template #meta>
          <MobileMetaList :items="metaItemsFor(row)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.audit-caisse-daily-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
