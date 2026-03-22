<script setup>
import MobileEntityCard from "../mobile/MobileEntityCard.vue";

defineProps({
  items: {
    type: Array,
    default: () => []
  },
  valueFormatter: {
    type: Function,
    default: (value) => (value == null ? "" : String(value))
  },
  title: {
    type: String,
    default: ""
  },
  emptyLabel: {
    type: String,
    default: "Aucune activite."
  },
  tone: {
    type: String,
    default: "info"
  },
  badgeLabel: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <div class="dashboard-activity-mobile-list">
    <MobileEntityCard
      v-for="(item, index) in items"
      :key="item.id || item.label || index"
      eyebrow="Activite"
      :title="item.libelle || item.label || title"
      :subtitle="item.montant != null ? valueFormatter(item.montant) : (item.description || '')"
      :tone="tone"
    >
      <template v-if="badgeLabel" #badge>
        <span class="status-pill" :data-tone="tone === 'warning' ? 'due' : 'blue'">
          {{ badgeLabel }}
        </span>
      </template>
    </MobileEntityCard>

    <MobileEntityCard
      v-if="items.length === 0"
      eyebrow="Activite"
      :title="emptyLabel"
      subtitle="Aucune donnee recente a afficher."
      tone="default"
    />
  </div>
</template>

<style scoped>
.dashboard-activity-mobile-list {
  display: grid;
  gap: 12px;
}
</style>
