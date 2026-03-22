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

function metaItemsFor(line) {
  return [
    {
      key: "quantite",
      label: "Quantite",
      value: line?.quantite ?? "-"
    },
    {
      key: "prix",
      label: "Prix",
      value: props.formatCurrency(line?.prix)
    },
    {
      key: "montant",
      label: "Montant",
      value: props.formatCurrency(line?.montant),
      emphasis: true,
      tone: "info"
    }
  ];
}
</script>

<template>
  <div class="facture-detail-lines-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune ligne"
      description="Cette facture ne contient encore aucune ligne."
    />
    <template v-else>
      <MobileEntityCard
        v-for="(line, index) in items"
        :key="`facture-line-${index}`"
        eyebrow="Ligne"
        :title="line.description || 'Description non renseignee'"
        subtitle="Lecture seule"
        tone="default"
      >
        <template #meta>
          <MobileMetaList :items="metaItemsFor(line)" />
        </template>
      </MobileEntityCard>
    </template>
  </div>
</template>

<style scoped>
.facture-detail-lines-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
