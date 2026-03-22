<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: ""
  },
  title: {
    type: String,
    default: ""
  },
  subtitle: {
    type: String,
    default: ""
  },
  align: {
    type: String,
    default: "start"
  }
});
</script>

<template>
  <div class="mobile-section-header" :class="`mobile-section-header--${align}`">
    <div class="mobile-section-header__copy">
      <p v-if="eyebrow" class="mobile-section-header__eyebrow">{{ eyebrow }}</p>
      <h3 v-if="title" class="mobile-section-header__title">{{ title }}</h3>
      <p v-if="subtitle" class="mobile-section-header__subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="$slots.actions" class="mobile-section-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.mobile-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.mobile-section-header__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.mobile-section-header__eyebrow {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: #6d86a0;
}

.mobile-section-header__title {
  margin: 0;
  font-size: 20px;
  line-height: 1.15;
  color: #16324d;
}

.mobile-section-header__subtitle {
  margin: 0;
  color: #5a7391;
  font-size: 13px;
  line-height: 1.45;
}

.mobile-section-header__actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.mobile-section-header--center {
  text-align: center;
  flex-direction: column;
  align-items: center;
}

.mobile-section-header--center .mobile-section-header__actions {
  width: 100%;
  justify-content: center;
}

@media (max-width: 767px) {
  .mobile-section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .mobile-section-header__actions {
    width: 100%;
  }
}
</style>
