<script setup>
defineProps({
  title: {
    type: String,
    default: "Aucune donnee"
  },
  description: {
    type: String,
    default: ""
  }
});
</script>

<template>
  <div class="mobile-state-card mobile-state-card--empty" role="status" aria-live="polite">
    <div class="mobile-state-card__icon" aria-hidden="true">+</div>
    <strong>{{ title }}</strong>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.actions" class="mobile-state-card__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.mobile-state-card {
  display: grid;
  gap: 8px;
  padding: 18px 16px;
  border: 1px dashed #cdd9e6;
  border-radius: 18px;
  background: #fbfdff;
  text-align: center;
  justify-items: center;
}

.mobile-state-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #eef4fb;
  color: #3a5f86;
  font-weight: 700;
}

.mobile-state-card strong {
  color: #17324d;
  font-size: 15px;
}

.mobile-state-card p {
  margin: 0;
  color: #5a7391;
  font-size: 13px;
  line-height: 1.45;
}

.mobile-state-card__actions {
  width: 100%;
  display: grid;
  gap: 8px;
}
</style>
