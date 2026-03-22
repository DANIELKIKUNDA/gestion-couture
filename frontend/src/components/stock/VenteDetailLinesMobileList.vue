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
      label: "Prix unitaire",
      value: props.formatCurrency(line?.prixUnitaire),
      emphasis: true,
      tone: "info"
    }
  ];
}
</script>

<template>
  <div class="vente-detail-lines-mobile-list">
    <MobileStateEmpty
      v-if="items.length === 0"
      title="Aucune ligne"
      description="Cette vente ne contient encore aucune ligne."
    />
    <template v-else>
      <MobileEntityCard
        v-for="line in items"
        :key="line.idLigne"
        eyebrow="Article"
        :title="line.libelleArticle || line.idArticle || 'Article non renseigne'"
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
.vente-detail-lines-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
