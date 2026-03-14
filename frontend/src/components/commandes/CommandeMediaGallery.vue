<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ""
  },
  uploading: {
    type: Boolean,
    default: false
  },
  actionId: {
    type: String,
    default: ""
  }
});

const emit = defineEmits([
  "upload",
  "open",
  "remove",
  "set-primary",
  "move",
  "save-note"
]);

const uploadNote = ref("");
const galleryInputRef = ref(null);
const cameraInputRef = ref(null);
const noteDrafts = reactive({});
const prefersMobileCapture = ref(false);
let mobileCaptureMediaQuery = null;
let mobileCaptureListener = null;

const canAddMore = computed(() => props.items.length < 3);

function detectMobileCapturePreference() {
  if (typeof window === "undefined") return false;
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 768px)").matches;
  return coarsePointer || narrowViewport;
}

watch(
  () => props.items,
  (rows) => {
    for (const row of rows || []) {
      noteDrafts[row.idMedia] = row.note || "";
    }
  },
  { immediate: true, deep: true }
);

function resetInput(target) {
  if (target?.value) target.value = "";
}

function triggerGalleryUpload() {
  galleryInputRef.value?.click();
}

function triggerCameraUpload() {
  cameraInputRef.value?.click();
}

function onPickFile(event, sourceType = "UPLOAD") {
  const file = event?.target?.files?.[0];
  if (!file) return;
  emit("upload", {
    file,
    note: uploadNote.value,
    sourceType
  });
  uploadNote.value = "";
  resetInput(event?.target);
}

function hasNoteChange(item) {
  return String(noteDrafts[item.idMedia] || "") !== String(item.note || "");
}

function saveNote(item) {
  emit("save-note", {
    media: item,
    note: String(noteDrafts[item.idMedia] || "")
  });
}

onMounted(() => {
  prefersMobileCapture.value = detectMobileCapturePreference();
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  mobileCaptureMediaQuery = window.matchMedia("(pointer: coarse)");
  mobileCaptureListener = () => {
    prefersMobileCapture.value = detectMobileCapturePreference();
  };
  if (typeof mobileCaptureMediaQuery.addEventListener === "function") {
    mobileCaptureMediaQuery.addEventListener("change", mobileCaptureListener);
  } else if (typeof mobileCaptureMediaQuery.addListener === "function") {
    mobileCaptureMediaQuery.addListener(mobileCaptureListener);
  }
  window.addEventListener("resize", mobileCaptureListener);
});

onUnmounted(() => {
  if (typeof window !== "undefined" && mobileCaptureListener) {
    window.removeEventListener("resize", mobileCaptureListener);
  }
  if (mobileCaptureMediaQuery && mobileCaptureListener) {
    if (typeof mobileCaptureMediaQuery.removeEventListener === "function") {
      mobileCaptureMediaQuery.removeEventListener("change", mobileCaptureListener);
    } else if (typeof mobileCaptureMediaQuery.removeListener === "function") {
      mobileCaptureMediaQuery.removeListener(mobileCaptureListener);
    }
  }
  mobileCaptureMediaQuery = null;
  mobileCaptureListener = null;
});
</script>

<template>
  <article class="panel commande-media-panel">
    <div class="panel-header commande-media-header">
      <div>
        <h4>References modele</h4>
        <p class="helper">Jusqu'a 3 photos par commande. Compression et miniature automatiques.</p>
      </div>
      <span class="helper">{{ items.length }} / 3 photo(s)</span>
    </div>

    <div class="commande-media-upload">
      <label class="form-row">
        <span>Note pour la prochaine photo</span>
        <input v-model="uploadNote" type="text" maxlength="500" placeholder="Ex: refaire le col, manches plus longues" />
      </label>
      <div class="row-actions">
        <button class="mini-btn" :disabled="!canAddMore || uploading" @click="triggerGalleryUpload">
          {{ prefersMobileCapture ? "Ajouter depuis galerie" : "Ajouter une photo" }}
        </button>
        <button v-if="prefersMobileCapture" class="mini-btn" :disabled="!canAddMore || uploading" @click="triggerCameraUpload">Prendre une photo</button>
        <span class="helper" v-if="uploading">Upload en cours...</span>
      </div>
      <input
        ref="galleryInputRef"
        class="commande-media-input-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        @change="onPickFile($event, 'UPLOAD')"
      />
      <input
        ref="cameraInputRef"
        class="commande-media-input-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        @change="onPickFile($event, 'CAMERA')"
      />
    </div>

    <div v-if="error" class="helper commande-media-error">{{ error }}</div>
    <div v-if="loading" class="helper">Chargement des references...</div>

    <div v-else-if="items.length === 0" class="commande-media-empty">
      <strong>Aucune photo pour cette commande.</strong>
      <p class="helper">Tu peux joindre jusqu'a 3 references de modele sans modifier la commande elle-meme.</p>
    </div>

    <div v-else class="commande-media-grid">
      <article v-for="item in items" :key="item.idMedia" class="commande-media-card">
        <button class="commande-media-thumb" :disabled="!item.thumbnailBlobUrl" @click="emit('open', item)">
          <img v-if="item.thumbnailBlobUrl" :src="item.thumbnailBlobUrl" :alt="item.nomFichierOriginal || 'Reference commande'" />
          <span v-else class="helper">Miniature indisponible</span>
        </button>

        <div class="commande-media-meta">
          <div class="commande-media-line">
            <strong>Photo {{ item.position }}</strong>
            <span class="status-pill" v-if="item.isPrimary" data-tone="ok">Principale</span>
          </div>
          <div class="commande-media-line helper">
            <span>{{ item.largeur || "-" }} x {{ item.hauteur || "-" }}</span>
            <span>{{ Math.max(1, Math.round((item.tailleOriginaleBytes || 0) / 1024)) }} KB</span>
          </div>
          <label class="form-row">
            <span>Note</span>
            <input v-model="noteDrafts[item.idMedia]" type="text" maxlength="500" placeholder="Reference, detail, consigne..." />
          </label>
          <div class="row-actions commande-media-actions">
            <button class="mini-btn" @click="emit('open', item)">Ouvrir</button>
            <button class="mini-btn" :disabled="item.isPrimary || actionId === item.idMedia" @click="emit('set-primary', item)">Principale</button>
            <button class="mini-btn" :disabled="item.position <= 1 || actionId === item.idMedia" @click="emit('move', { media: item, direction: -1 })">
              Monter
            </button>
            <button class="mini-btn" :disabled="item.position >= items.length || actionId === item.idMedia" @click="emit('move', { media: item, direction: 1 })">
              Descendre
            </button>
            <button class="mini-btn" :disabled="!hasNoteChange(item) || actionId === item.idMedia" @click="saveNote(item)">Sauver note</button>
            <button class="mini-btn" :disabled="actionId === item.idMedia" @click="emit('remove', item)">Supprimer</button>
          </div>
        </div>
      </article>
    </div>
  </article>
</template>
