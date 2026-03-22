<script setup>
defineProps({
  title: {
    type: String,
    default: ""
  },
  subtitle: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <div class="mobile-primary-action-bar">
    <div v-if="title || subtitle" class="mobile-primary-action-bar__copy">
      <strong v-if="title">{{ title }}</strong>
      <span v-if="subtitle">{{ subtitle }}</span>
    </div>

    <div class="mobile-primary-action-bar__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.mobile-primary-action-bar {
  position: sticky;
  bottom: calc(var(--mobile-bottom-offset) + 8px);
  z-index: 7;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(219, 228, 238, 0.95);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 34px rgba(22, 47, 78, 0.14);
  backdrop-filter: blur(14px);
}

.mobile-primary-action-bar__copy {
  display: grid;
  gap: 2px;
}

.mobile-primary-action-bar__copy strong {
  color: #16324d;
  font-size: 14px;
}

.mobile-primary-action-bar__copy span {
  color: #5a7391;
  font-size: 12px;
  line-height: 1.35;
}

.mobile-primary-action-bar__actions {
  display: grid;
  gap: 8px;
}

@media (min-width: 768px) {
  .mobile-primary-action-bar {
    display: none;
  }
}
</style>
