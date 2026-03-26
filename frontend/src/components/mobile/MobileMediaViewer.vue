<script setup>
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
  }
});

const emit = defineEmits(["close", "prev", "next", "download"]);
</script>

<template>
  <div v-if="open" class="mobile-media-viewer" role="dialog" aria-modal="true" :aria-label="title">
    <div class="mobile-media-viewer__backdrop" @click.self="emit('close')">
      <section class="mobile-media-viewer__sheet">
        <header class="mobile-media-viewer__header">
          <div class="mobile-media-viewer__copy">
            <strong>{{ title }}</strong>
            <span v-if="subtitle">{{ subtitle }}</span>
          </div>
          <button type="button" class="mini-btn" @click="emit('close')">
            Fermer
          </button>
        </header>

        <div class="mobile-media-viewer__body">
          <div v-if="imageUrl" class="mobile-media-viewer__frame">
            <img :src="imageUrl" :alt="title" class="mobile-media-viewer__image" />
          </div>
          <div v-else class="mobile-media-viewer__empty">
            <strong>Image indisponible</strong>
            <p class="helper">Le visuel sera affiche des qu'il sera disponible.</p>
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

.mobile-media-viewer__copy strong {
  font-size: 15px;
  line-height: 1.2;
}

.mobile-media-viewer__copy span {
  color: rgba(228, 236, 248, 0.78);
  font-size: 12px;
  line-height: 1.35;
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
}

.mobile-media-viewer__image {
  max-width: 100%;
  max-height: min(72dvh, 880px);
  object-fit: contain;
  border-radius: 18px;
  background: #0f1725;
  box-shadow: 0 20px 42px rgba(0, 0, 0, 0.32);
}

.mobile-media-viewer__empty {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
  padding: 24px;
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
}
</style>
