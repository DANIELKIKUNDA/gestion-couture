<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";
import MobileMetaList from "../mobile/MobileMetaList.vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  articleLabel: {
    type: Function,
    required: true
  },
  lineTotal: {
    type: Function,
    required: true
  },
  formatCurrency: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["remove"]);

function metaItemsFor(ligne) {
  return [
    {
      key: "quantite",
      label: "Quantite",
      value: ligne?.quantite ?? 0,
      emphasis: true,
      tone: "info"
    },
    {
      key: "total",
      label: "Total",
      value: props.formatCurrency(props.lineTotal(ligne)),
      emphasis: true,
      tone: "success"
    }
  ];
}
</script>

<template>
  <div class="vente-draft-mobile-list">
    <MobileEntityCard
      v-for="(ligne, index) in items"
      :key="`${ligne.idArticle}-${index}`"
      eyebrow="Panier"
      :title="articleLabel(ligne.idArticle)"
      subtitle="Ligne prete a encaisser"
      tone="info"
    >
      <template #meta>
        <MobileMetaList :items="metaItemsFor(ligne)" />
      </template>

      <template #footer>
        <button type="button" class="mini-btn vente-draft-mobile-list__action" @click="emit('remove', index)">
          Retirer
        </button>
      </template>
    </MobileEntityCard>
  </div>
</template>

<style scoped>
.vente-draft-mobile-list {
  display: grid;
  gap: 12px;
}

.vente-draft-mobile-list__action {
  width: 100%;
}
</style>
