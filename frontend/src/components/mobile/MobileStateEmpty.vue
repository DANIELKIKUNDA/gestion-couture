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
    <div class="mobile-state-card__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7.5 7.3 4h9.4L20 7.5v9.8a2.7 2.7 0 0 1-2.7 2.7H6.7A2.7 2.7 0 0 1 4 17.3Z" />
        <path d="M4.4 8h15.2" />
        <path d="M9 13h6" />
      </svg>
    </div>
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
  gap: 10px;
  padding: 22px 18px;
  border: 1px solid rgba(31, 90, 162, 0.12);
  border-radius: 20px;
  background:
    radial-gradient(circle at top, rgba(31, 90, 162, 0.08), transparent 42%),
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  text-align: center;
  justify-items: center;
  box-shadow: 0 14px 34px rgba(31, 90, 162, 0.08);
}

.mobile-state-card__icon {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #eef6ff 0%, #e2effd 100%);
  color: #1f5aa2;
  box-shadow: inset 0 0 0 1px rgba(31, 90, 162, 0.12);
}

.mobile-state-card__icon svg {
  width: 22px;
  height: 22px;
}

.mobile-state-card strong {
  color: #102a43;
  font-size: 16px;
  line-height: 1.25;
}

.mobile-state-card p {
  margin: 0;
  max-width: 300px;
  color: #5d718a;
  font-size: 13px;
  line-height: 1.45;
}

.mobile-state-card__actions {
  width: 100%;
  display: grid;
  gap: 8px;
}
</style>
