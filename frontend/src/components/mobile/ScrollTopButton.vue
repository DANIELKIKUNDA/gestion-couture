<script setup>
defineProps({
  label: {
    type: String,
    default: "Revenir en haut"
  },
  direction: {
    type: String,
    default: "up"
  },
  align: {
    type: String,
    default: "right"
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  ariaLabel: {
    type: String,
    default: ""
  }
});

defineEmits(["click"]);
</script>

<template>
  <button
    type="button"
    class="scroll-top-button"
    :class="[
      direction === 'down' ? 'scroll-top-button--down' : 'scroll-top-button--up',
      align === 'center' ? 'scroll-top-button--center' : 'scroll-top-button--right',
      iconOnly ? 'scroll-top-button--icon-only' : ''
    ]"
    :aria-label="ariaLabel || label"
    @click="$emit('click')"
  >
    <svg class="scroll-top-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <template v-if="direction === 'down'">
        <path d="M12 5v14" />
        <path d="m5 12 7 7 7-7" />
      </template>
      <template v-else>
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </template>
    </svg>
    <span v-if="!iconOnly">{{ label }}</span>
  </button>
</template>

<style scoped>
.scroll-top-button {
  position: fixed;
  bottom: calc(var(--mobile-bottom-offset) + 12px);
  z-index: 36;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.scroll-top-button--right {
  right: 12px;
}

.scroll-top-button--center {
  left: 50%;
  transform: translateX(-50%);
}

.scroll-top-button--icon-only {
  width: 46px;
  height: 46px;
  min-height: 46px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 12px 28px rgba(19, 52, 88, 0.14);
}

.scroll-top-button--down {
  border-color: rgba(198, 211, 225, 0.9);
  color: #23527f;
}

.scroll-top-button__icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}

@keyframes scroll-top-button-in {
  from {
    opacity: 0;
    scale: 0.94;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@media (min-width: 768px) {
  .scroll-top-button {
    display: none;
  }
}
</style>
