<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  subtitle: {
    type: String,
    default: ""
  },
  closeLabel: {
    type: String,
    default: "Fermer"
  }
});

const emit = defineEmits(["close"]);
</script>

<template>
  <div v-if="open" class="mobile-fullscreen-dialog" role="dialog" aria-modal="true">
    <div class="mobile-fullscreen-dialog__backdrop" @click="emit('close')" />
    <div class="mobile-fullscreen-dialog__panel">
      <header class="mobile-fullscreen-dialog__header">
        <div class="mobile-fullscreen-dialog__copy">
          <strong v-if="title">{{ title }}</strong>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
        <button type="button" class="mobile-fullscreen-dialog__close" :aria-label="closeLabel" @click="emit('close')">
          ×
        </button>
      </header>

      <div class="mobile-fullscreen-dialog__body">
        <slot />
      </div>

      <footer v-if="$slots.actions" class="mobile-fullscreen-dialog__actions">
        <slot name="actions" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mobile-fullscreen-dialog {
  position: fixed;
  inset: 0;
  z-index: 60;
}

.mobile-fullscreen-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 22, 39, 0.52);
}

.mobile-fullscreen-dialog__panel {
  position: relative;
  margin: 0 auto;
  width: min(720px, 100%);
  height: 100%;
  max-height: 100%;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: #fff;
}

.mobile-fullscreen-dialog__header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid #e6edf5;
}

.mobile-fullscreen-dialog__copy {
  display: grid;
  gap: 4px;
}

.mobile-fullscreen-dialog__copy strong {
  color: #17324d;
  font-size: 18px;
}

.mobile-fullscreen-dialog__copy p {
  margin: 0;
  color: #5a7391;
  font-size: 13px;
  line-height: 1.45;
}

.mobile-fullscreen-dialog__close {
  border: none;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #35597e;
}

.mobile-fullscreen-dialog__body {
  overflow-y: auto;
  padding: 16px;
}

.mobile-fullscreen-dialog__actions {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e6edf5;
  background: rgba(255, 255, 255, 0.96);
}

@media (min-width: 768px) {
  .mobile-fullscreen-dialog {
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .mobile-fullscreen-dialog__panel {
    height: auto;
    max-height: calc(100vh - 48px);
    border-radius: 22px;
    overflow: hidden;
    box-shadow: 0 24px 54px rgba(15, 28, 44, 0.22);
  }
}
</style>
