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
        <span class="global-toast-host__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span class="global-toast-host__message">{{ message }}</span>
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
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 12px 14px;
  border: 1px solid rgba(198, 174, 134, 0.28);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(16, 25, 54, 0.96) 0%, rgba(8, 18, 48, 0.97) 100%);
  color: #fffdf8;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: left;
  box-shadow: 0 18px 42px rgba(8, 18, 48, 0.24);
  backdrop-filter: blur(14px);
}

.global-toast-host__icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #102a43;
  background: linear-gradient(180deg, #f8dfaa 0%, #c69b55 100%);
  box-shadow: 0 8px 18px rgba(198, 155, 85, 0.24);
}

.global-toast-host__icon svg {
  width: 15px;
  height: 15px;
}

.global-toast-host__message {
  min-width: 0;
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
