<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  }
});
</script>

<template>
  <dl class="mobile-meta-list">
    <template v-for="(item, index) in items" :key="item.key || item.label || index">
      <div class="mobile-meta-list__row" :class="{ 'mobile-meta-list__row--emphasis': !!item.emphasis }">
        <dt class="mobile-meta-list__label">{{ item.label }}</dt>
        <dd class="mobile-meta-list__value" :class="item.tone ? `mobile-meta-list__value--${item.tone}` : ''">
          {{ item.value ?? "-" }}
        </dd>
      </div>
    </template>
  </dl>
</template>

<style scoped>
.mobile-meta-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.mobile-meta-list__row {
  display: grid;
  grid-template-columns: minmax(96px, 42%) 1fr;
  gap: 10px;
  align-items: start;
}

.mobile-meta-list__label {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #6d86a0;
}

.mobile-meta-list__value {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: #17324d;
  word-break: break-word;
}

.mobile-meta-list__row--emphasis .mobile-meta-list__value {
  font-weight: 700;
}

.mobile-meta-list__value--success {
  color: #1f6d3d;
}

.mobile-meta-list__value--warning {
  color: #8a4f1a;
}

.mobile-meta-list__value--info {
  color: #235b93;
}
</style>
