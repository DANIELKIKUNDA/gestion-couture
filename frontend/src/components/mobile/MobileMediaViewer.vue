<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String,
    default: ""
  },
  title: {
    type: String,
    default: "Photo"
  },
  subtitle: {
    type: String,
    default: ""
  },
  canPrev: {
    type: Boolean,
    default: false
  },
  canNext: {
    type: Boolean,
    default: false
  },
  canDownload: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close", "prev", "next", "download"]);

const zoomed = ref(false);
const touchStartX = ref(0);
const touchStartY = ref(0);
const lastTapAt = ref(0);

function toggleZoom() {
  if (!props.imageUrl) return;
  zoomed.value = !zoomed.value;
}

function onTouchStart(event) {
  const touch = event?.changedTouches?.[0];
  if (!touch) return;
  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
}

function onTouchEnd(event) {
  const touch = event?.changedTouches?.[0];
  if (!touch) return;

  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const now = Date.now();

  if (absX < 12 && absY < 12) {
    if (now - lastTapAt.value < 280) {
      toggleZoom();
      lastTapAt.value = 0;
      return;
    }
    lastTapAt.value = now;
    return;
  }

  lastTapAt.value = 0;
  if (zoomed.value) return;
  if (absX < 56 || absY > 42) return;
  if (deltaX < 0 && props.canNext) {
    emit("next");
    return;
  }
  if (deltaX > 0 && props.canPrev) {
    emit("prev");
  }
}

watch(
  () => [props.open, props.imageUrl],
  () => {
    zoomed.value = false;
  }
);
</script>

<template>
  <div v-if="open" class="mobile-media-viewer" role="dialog" aria-modal="true" :aria-label="title">
    <div class="mobile-media-viewer__backdrop" @click.self="emit('close')">
      <section class="mobile-media-viewer__sheet">
        <header class="mobile-media-viewer__header">
          <div class="mobile-media-viewer__copy">
            <div class="mobile-media-viewer__eyebrow">Galerie photo</div>
            <strong>{{ title }}</strong>
            <span v-if="subtitle">{{ subtitle }}</span>
          </div>
          <div class="mobile-media-viewer__header-actions">
            <button type="button" class="mini-btn" :disabled="!imageUrl" @click="toggleZoom">
              {{ zoomed ? "Ajuster" : "Zoom" }}
            </button>
            <button type="button" class="mini-btn" @click="emit('close')">
              Fermer
            </button>
          </div>
        </header>

        <div class="mobile-media-viewer__body">
          <div
            v-if="imageUrl"
            class="mobile-media-viewer__frame"
            :class="{ 'is-zoomed': zoomed }"
            @touchstart.passive="onTouchStart"
            @touchend.passive="onTouchEnd"
          >
            <img :src="imageUrl" :alt="title" class="mobile-media-viewer__image" @click="toggleZoom" />
            <div class="mobile-media-viewer__hint">
              {{ zoomed ? "Touchez deux fois pour revenir" : "Glissez pour naviguer ou touchez deux fois pour zoomer" }}
            </div>
          </div>
          <div v-else-if="loading" class="mobile-media-viewer__loading">
            <div class="mobile-media-viewer__skeleton"></div>
            <strong>Preparation de la photo...</strong>
            <p class="helper">L'image s'affichera automatiquement des qu'elle sera prete.</p>
          </div>
          <div v-else class="mobile-media-viewer__empty">
            <strong>Image indisponible</strong>
            <p class="helper">Impossible d'afficher cette photo pour le moment.</p>
          </div>
        </div>

        <footer class="mobile-media-viewer__actions">
          <button type="button" class="mini-btn" :disabled="!canPrev" @click="emit('prev')">
            Precedent
          </button>
          <button type="button" class="mini-btn" :disabled="!canDownload" @click="emit('download')">
            Enregistrer
          </button>
          <button type="button" class="mini-btn" :disabled="!canNext" @click="emit('next')">
            Suivant
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.mobile-media-viewer {
  position: fixed;
  inset: 0;
  z-index: 1085;
}

.mobile-media-viewer__backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  align-items: stretch;
  background: rgba(9, 16, 28, 0.86);
}

.mobile-media-viewer__sheet {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: rgba(6, 12, 22, 0.96);
  color: #f3f7ff;
}

.mobile-media-viewer__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  padding: calc(env(safe-area-inset-top) + 14px) 14px 12px;
}

.mobile-media-viewer__copy {
  display: grid;
  gap: 4px;
}

.mobile-media-viewer__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(161, 196, 240, 0.84);
}

.mobile-media-viewer__copy strong {
  font-size: 15px;
  line-height: 1.2;
}

.mobile-media-viewer__copy span {
  color: rgba(228, 236, 248, 0.78);
  font-size: 12px;
  line-height: 1.35;
}

.mobile-media-viewer__header-actions {
  display: flex;
  gap: 8px;
}

.mobile-media-viewer__body {
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 12px;
}

.mobile-media-viewer__frame {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  gap: 12px;
}

.mobile-media-viewer__frame.is-zoomed {
  overflow: auto;
  align-items: start;
  justify-items: start;
}

.mobile-media-viewer__image {
  max-width: 100%;
  max-height: min(72dvh, 880px);
  object-fit: contain;
  border-radius: 18px;
  background: #0f1725;
  box-shadow: 0 20px 42px rgba(0, 0, 0, 0.32);
}

.mobile-media-viewer__frame.is-zoomed .mobile-media-viewer__image {
  max-width: none;
  max-height: none;
  width: auto;
  height: auto;
  min-width: 140%;
}

.mobile-media-viewer__hint {
  font-size: 12px;
  color: rgba(228, 236, 248, 0.72);
}

.mobile-media-viewer__loading,
.mobile-media-viewer__empty {
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  padding: 24px;
}

.mobile-media-viewer__skeleton {
  width: min(84vw, 320px);
  aspect-ratio: 1 / 1;
  border-radius: 20px;
  background: linear-gradient(90deg, rgba(73, 92, 118, 0.42) 0%, rgba(118, 140, 170, 0.66) 50%, rgba(73, 92, 118, 0.42) 100%);
  background-size: 200% 100%;
  animation: mobile-media-viewer-shimmer 1.4s ease-in-out infinite;
}

.mobile-media-viewer__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 14px calc(env(safe-area-inset-bottom) + 12px);
}

.mobile-media-viewer__actions .mini-btn {
  width: 100%;
}

@keyframes mobile-media-viewer-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (min-width: 768px) {
  .mobile-media-viewer__backdrop {
    padding: 24px;
    align-items: center;
    justify-items: center;
  }

  .mobile-media-viewer__sheet {
    width: min(960px, 100%);
    min-height: min(92vh, 840px);
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid rgba(161, 181, 206, 0.18);
  }

  .mobile-media-viewer__header {
    padding-top: 14px;
  }

  .mobile-media-viewer__image {
    max-height: min(68vh, 760px);
  }

  .mobile-media-viewer__frame.is-zoomed .mobile-media-viewer__image {
    min-width: 125%;
  }
}
</style>
