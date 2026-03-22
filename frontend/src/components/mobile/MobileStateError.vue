<script setup>
defineProps({
  title: {
    type: String,
    default: "Impossible d'afficher cette section"
  },
  description: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <div class="mobile-state-error" role="alert">
    <div class="mobile-state-error__icon" aria-hidden="true">!</div>
    <div class="mobile-state-error__copy">
      <strong>{{ title }}</strong>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="mobile-state-error__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.mobile-state-error {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid #ebc9c3;
  border-radius: 18px;
  background: #fff7f5;
}

.mobile-state-error__icon {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(168, 52, 39, 0.12);
  color: #8c2f24;
  font-weight: 700;
}

.mobile-state-error__copy {
  display: grid;
  gap: 4px;
}

.mobile-state-error__copy strong {
  color: #7a2a21;
}

.mobile-state-error__copy p {
  margin: 0;
  color: #8d4b42;
  font-size: 13px;
  line-height: 1.45;
}

.mobile-state-error__actions {
  display: grid;
  gap: 8px;
}
</style>
