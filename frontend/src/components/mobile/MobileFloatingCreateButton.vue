<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  ariaLabel: {
    type: String,
    default: ""
  },
  tone: {
    type: String,
    default: "blue"
  }
});

defineEmits(["click"]);
</script>

<template>
  <button
    type="button"
    class="mobile-floating-create"
    :class="`mobile-floating-create--${tone}`"
    :aria-label="ariaLabel || label"
    @click="$emit('click')"
  >
    <span class="mobile-floating-create__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </span>
    <span class="mobile-floating-create__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.mobile-floating-create {
  position: fixed;
  top: 52%;
  right: max(12px, env(safe-area-inset-right));
  z-index: 35;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  max-width: min(54vw, 190px);
  padding: 9px 13px 9px 10px;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 999px;
  color: #ffffff;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  box-shadow: 0 18px 42px rgba(13, 35, 68, 0.24);
  backdrop-filter: blur(16px);
  cursor: pointer;
  transform: translateY(-50%);
  animation: mobile-floating-create-in 0.2s ease;
}

.mobile-floating-create--blue {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0) 38%),
    linear-gradient(180deg, #174d8f 0%, #0b224b 100%);
}

.mobile-floating-create__icon {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}

.mobile-floating-create__icon svg {
  width: 17px;
  height: 17px;
}

.mobile-floating-create__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes mobile-floating-create-in {
  from {
    opacity: 0;
    transform: translate(8px, -50%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(0, -50%) scale(1);
  }
}

@media (min-width: 768px) {
  .mobile-floating-create {
    display: none;
  }
}

@media (max-width: 380px) {
  .mobile-floating-create {
    max-width: 50vw;
    padding-right: 11px;
  }
}
</style>
