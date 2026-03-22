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
  }
});

function metaItemsFor(row) {
  return [
    {
      key: "periode",
      label: "Periode",
      value: `${row?.date_debut || "-"} -> ${row?.date_fin || "-"}`
    },
    {
      key: "solde-debut",
      label: "Solde debut",
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
      key: "solde-fin",
      label: "Solde fin",
      value: props.formatCurrency(row?.solde_cloture),
      emphasis: true,
      tone: "info"
    },
    {
      key: "jours",
      label: "Jours clotures",
      value: row?.nombre_jours || 0
    },
    {
      key: "operations",
      label: "Operations",
      value: row?.nombre_operations || 0
    }
  ];
}
</script>

<template>
  <div class="audit-annual-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucun bilan annuel"
      description="Aucun bilan annuel n'est disponible pour le moment."
    />
    <template v-else>
      <MobileEntityCard
        v-for="row in items"
        :key="row.id_bilan"
        eyebrow="Consolidation annuelle"
        :title="`Annee ${row?.annee || '-'}`"
        subtitle="Vue consolidee des bilans annuels de caisse."
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
.audit-annual-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
