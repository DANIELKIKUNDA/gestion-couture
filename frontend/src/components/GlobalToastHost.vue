<script setup>
import { computed } from "vue";

const props = defineProps({
  message: {
    type: String,
    default: ""
  },
  offsetForOfflineBanner: {
    type: Boolean,
    default: false
  }
});

const isVisible = computed(() => Boolean(String(props.message || "").trim()));
</script>

<template>
  <transition name="global-toast-host-fade">
    <div
      v-if="isVisible"
      class="global-toast-host"
      :class="{ 'global-toast-host--with-banner': offsetForOfflineBanner }"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="global-toast-host__pill">
        {{ message }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.global-toast-host {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 14px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1090;
  width: min(calc(100vw - 24px), 520px);
  pointer-events: none;
}

.global-toast-host--with-banner {
  top: calc(env(safe-area-inset-top) + 58px);
}

.global-toast-host__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 46px;
  padding: 12px 16px;
  border: 1px solid rgba(153, 228, 186, 0.9);
  border-radius: 16px;
  background: rgba(47, 130, 84, 0.96);
  color: #f8fffb;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  box-shadow: 0 16px 36px rgba(17, 44, 26, 0.2);
  backdrop-filter: blur(12px);
}

.global-toast-host-fade-enter-active,
.global-toast-host-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.global-toast-host-fade-enter-from,
.global-toast-host-fade-leave-to {
  opacity: 0;
}

.global-toast-host-fade-enter-from .global-toast-host__pill,
.global-toast-host-fade-leave-to .global-toast-host__pill {
  transform: translateY(-6px);
}

@media (min-width: 768px) {
  .global-toast-host {
    top: 18px;
    left: auto;
    right: 20px;
    transform: none;
    width: min(420px, calc(100vw - 40px));
  }

  .global-toast-host--with-banner {
    top: 60px;
  }
}
</style>
