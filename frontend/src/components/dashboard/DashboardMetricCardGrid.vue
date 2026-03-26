<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Number,
    default: 2
  },
  compact: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div
    class="dashboard-metric-card-grid"
    :class="{ 'dashboard-metric-card-grid--compact': compact }"
    :style="{ '--dashboard-metric-columns': Math.max(1, Number(columns) || 2) }"
  >
    <article
      v-for="item in items"
      :key="item.label"
      class="dashboard-metric-card-grid__card"
      :data-tone="item.tone || 'blue'"
    >
      <p>{{ item.label }}</p>
      <strong>{{ item.value }}</strong>
    </article>
  </div>
</template>

<style scoped>
.dashboard-metric-card-grid {
  display: grid;
  grid-template-columns: repeat(var(--dashboard-metric-columns, 2), minmax(0, 1fr));
  gap: 12px;
}

.dashboard-metric-card-grid__card {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid #d9e4ef;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbfe 100%);
  box-shadow: 0 12px 28px rgba(22, 47, 78, 0.08);
}

.dashboard-metric-card-grid__card p {
  margin: 0;
  color: #46617f;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.dashboard-metric-card-grid__card strong {
  font-size: 28px;
  line-height: 1;
  color: #214f82;
}

.dashboard-metric-card-grid__card[data-tone="green"] strong {
  color: #237246;
}

.dashboard-metric-card-grid__card[data-tone="teal"] strong {
  color: #177878;
}

.dashboard-metric-card-grid__card[data-tone="amber"] strong {
  color: #9f5c1f;
}

.dashboard-metric-card-grid__card[data-tone="slate"] strong {
  color: #2f4f74;
}

.dashboard-metric-card-grid--compact .dashboard-metric-card-grid__card {
  gap: 4px;
  padding: 12px;
  border-radius: 14px;
  box-shadow: 0 10px 24px rgba(22, 47, 78, 0.07);
}

.dashboard-metric-card-grid--compact .dashboard-metric-card-grid__card p {
  font-size: 11px;
}

.dashboard-metric-card-grid--compact .dashboard-metric-card-grid__card strong {
  font-size: 22px;
}

@media (max-width: 1260px) {
  .dashboard-metric-card-grid--compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
