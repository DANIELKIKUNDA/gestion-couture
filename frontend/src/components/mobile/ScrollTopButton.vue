<script setup>
defineProps({
  label: {
    type: String,
    default: "Revenir en haut"
  }
});

defineEmits(["click"]);
</script>

<template>
  <button type="button" class="scroll-top-button" @click="$emit('click')">
    <svg class="scroll-top-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.scroll-top-button {
  position: fixed;
  right: 12px;
  bottom: calc(var(--mobile-bottom-offset) + 12px);
  z-index: 36;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid rgba(194, 212, 230, 0.82);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #1a4c7d;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 10px 26px rgba(19, 52, 88, 0.12);
  backdrop-filter: blur(14px);
  cursor: pointer;
  animation: scroll-top-button-in 0.2s ease;
}

.scroll-top-button__icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}

@keyframes scroll-top-button-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 768px) {
  .scroll-top-button {
    display: none;
  }
}
</style>
