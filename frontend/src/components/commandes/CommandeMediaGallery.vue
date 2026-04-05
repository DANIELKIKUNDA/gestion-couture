<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";

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
const cameraVideoRef = ref(null);
const cameraCanvasRef = ref(null);
const noteDrafts = reactive({});
const activeNoteMediaId = ref("");
const prefersMobileCapture = ref(false);
const cameraModalOpen = ref(false);
const cameraLoading = ref(false);
const cameraError = ref("");
let mobileCaptureMediaQuery = null;
let mobileCaptureListener = null;
let cameraStream = null;
const SUPPORTED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const canAddMore = computed(() => props.items.length < 3);
const galleryButtonLabel = computed(() => (prefersMobileCapture.value ? "Choisir dans la galerie" : "Ajouter une photo"));
const galleryHelperText = computed(() =>
  prefersMobileCapture.value ? "Importe une image deja enregistree sur le telephone. Le choix final depend du navigateur Android." : ""
);
const primaryPhoto = computed(() => props.items.find((item) => item?.isPrimary) || props.items[0] || null);
const canUseDedicatedCamera = computed(
  () =>
    prefersMobileCapture.value &&
    typeof navigator !== "undefined" &&
    navigator?.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
);

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

function buildNormalizedCameraFileName(originalName = "") {
  const rawName = String(originalName || "").trim();
  const fallbackBase = `camera-${Date.now()}`;
  if (!rawName) return `${fallbackBase}.jpg`;
  const sanitized = rawName.replace(/\.[^/.]+$/, "").trim() || fallbackBase;
  return `${sanitized}.jpg`;
}

function blobToImageElement(blob) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof Image === "undefined" || !(blob instanceof Blob)) {
      reject(new Error("Conversion image indisponible."));
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de preparer l'image de la camera."));
    };
    image.src = objectUrl;
  });
}

async function normalizeCameraUploadFile(file) {
  if (!(file instanceof Blob)) {
    throw new Error("Photo invalide pour l'envoi.");
  }
  const mimeType = String(file.type || "").trim().toLowerCase();
  if (!mimeType || SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType)) {
    return file;
  }
  if (typeof document === "undefined") {
    throw new Error("Format photo non supporte par cet appareil.");
  }
  const image = await blobToImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = Number(image.naturalWidth || image.width || 0);
  canvas.height = Number(image.naturalHeight || image.height || 0);
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) {
    throw new Error("Impossible de convertir la photo de la camera.");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const convertedBlob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("La photo n'a pas pu etre convertie."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
  return new File([convertedBlob], buildNormalizedCameraFileName(file?.name), { type: "image/jpeg" });
}

function emitUploadPayload(file, sourceType = "UPLOAD") {
  if (!file) return;
  emit("upload", {
    file,
    note: uploadNote.value,
    sourceType
  });
  uploadNote.value = "";
}

function triggerGalleryUpload() {
  galleryInputRef.value?.click();
}

function stopCameraStream() {
  if (cameraStream) {
    for (const track of cameraStream.getTracks()) {
      track.stop();
    }
  }
  cameraStream = null;
  if (cameraVideoRef.value) {
    cameraVideoRef.value.srcObject = null;
  }
}

function closeCameraCapture() {
  cameraModalOpen.value = false;
  cameraLoading.value = false;
  cameraError.value = "";
  stopCameraStream();
}

async function startDedicatedCamera() {
  if (!canUseDedicatedCamera.value) {
    cameraInputRef.value?.click();
    return;
  }

  cameraModalOpen.value = true;
  cameraLoading.value = true;
  cameraError.value = "";
  stopCameraStream();

  try {
    await nextTick();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1600 },
        height: { ideal: 1200 }
      }
    });
    cameraStream = stream;
    if (cameraVideoRef.value) {
      cameraVideoRef.value.srcObject = stream;
      await cameraVideoRef.value.play();
    }
  } catch (err) {
    const message = String(err?.message || "").trim();
    cameraError.value = message || "Impossible d'acceder a la camera sur cet appareil.";
    stopCameraStream();
  } finally {
    cameraLoading.value = false;
  }
}

function triggerCameraUpload() {
  void startDedicatedCamera();
}

async function fallbackToNativeCamera() {
  closeCameraCapture();
  await nextTick();
  cameraInputRef.value?.click();
}

async function onPickFile(event, sourceType = "UPLOAD") {
  const file = event?.target?.files?.[0];
  if (!file) return;
  try {
    const normalizedFile = sourceType === "CAMERA" ? await normalizeCameraUploadFile(file) : file;
    emitUploadPayload(normalizedFile, sourceType);
  } catch (err) {
    cameraError.value = String(err?.message || "Impossible de preparer la photo de la camera.");
  } finally {
    resetInput(event?.target);
  }
}

function captureCameraFrame() {
  const video = cameraVideoRef.value;
  const canvas = cameraCanvasRef.value;
  if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
    cameraError.value = "Impossible de capturer la photo pour le moment.";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    cameraError.value = "Le navigateur ne permet pas de preparer la capture.";
    return;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        cameraError.value = "La photo n'a pas pu etre capturee.";
        return;
      }
      const capturedFile =
        typeof File === "function"
          ? new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })
          : blob;
      emitUploadPayload(capturedFile, "CAMERA");
      closeCameraCapture();
    },
    "image/jpeg",
    0.92
  );
}

function hasNoteChange(item) {
  return String(noteDrafts[item.idMedia] || "") !== String(item.note || "");
}

function isEditingNote(item) {
  return activeNoteMediaId.value === item?.idMedia;
}

function startNoteEditing(item) {
  activeNoteMediaId.value = item?.idMedia || "";
}

function finishNoteEditing(item) {
  window.setTimeout(() => {
    if (activeNoteMediaId.value !== (item?.idMedia || "")) return;
    if (hasNoteChange(item)) return;
    activeNoteMediaId.value = "";
  }, 120);
}

function saveNote(item) {
  emit("save-note", {
    media: item,
    note: String(noteDrafts[item.idMedia] || "")
  });
  if (activeNoteMediaId.value === item?.idMedia) {
    activeNoteMediaId.value = "";
  }
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
  closeCameraCapture();
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
        <p class="helper">Ajoute jusqu'a 3 photos de reference et retrouve-les rapidement par habit.</p>
      </div>
      <div class="commande-media-header-summary">
        <span class="helper">{{ items.length }} / 3 photo(s)</span>
        <span v-if="primaryPhoto" class="status-pill" data-tone="ok">Photo principale</span>
      </div>
    </div>

    <div class="commande-media-upload">
      <label class="form-row">
        <span>Note pour la prochaine photo</span>
        <input v-model="uploadNote" type="text" maxlength="500" placeholder="Ex: refaire le col, manches plus longues" />
      </label>
      <div class="row-actions">
        <button
          class="mini-btn blue"
          :disabled="!canAddMore || uploading"
          type="button"
          aria-label="Choisir une image depuis la galerie"
          @click="triggerGalleryUpload"
        >
          {{ galleryButtonLabel }}
        </button>
        <button v-if="prefersMobileCapture" class="mini-btn" :disabled="!canAddMore || uploading" type="button" @click="triggerCameraUpload">
          Prendre une photo
        </button>
        <span class="helper" v-if="uploading">Ajout de la photo en cours...</span>
      </div>
      <p v-if="galleryHelperText" class="helper commande-media-picker-helper">{{ galleryHelperText }}</p>
      <input
        ref="galleryInputRef"
        class="commande-media-input-hidden"
        type="file"
        accept="image/*"
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
    <div v-if="loading && items.length === 0" class="helper">Chargement des references...</div>

    <div v-else-if="items.length === 0" class="commande-media-empty">
      <strong>Aucune photo pour cette commande.</strong>
      <p class="helper">Tu peux joindre jusqu'a 3 references de modele sans modifier la commande elle-meme.</p>
    </div>

    <div v-else class="commande-media-grid">
      <article v-for="item in items" :key="item.idMedia" class="commande-media-card" :class="{ 'is-primary': item.isPrimary }">
        <button class="commande-media-thumb" :disabled="!item.thumbnailBlobUrl" @click="emit('open', item)">
          <img v-if="item.thumbnailBlobUrl" :src="item.thumbnailBlobUrl" :alt="item.nomFichierOriginal || 'Reference commande'" />
          <span v-else class="helper">Miniature indisponible</span>
        </button>

        <div class="commande-media-meta">
          <div class="commande-media-line commande-media-line-top">
            <div class="commande-media-copy">
              <span v-if="item.isPrimary" class="commande-media-kicker">Photo de reference</span>
              <strong>Photo {{ item.position }}</strong>
              <span class="helper">{{ item.nomFichierOriginal || "Reference atelier" }}</span>
            </div>
            <span class="status-pill" v-if="item.isPrimary" data-tone="ok">Principale</span>
          </div>
          <div class="commande-media-line helper">
            <span>{{ item.largeur || "-" }} x {{ item.hauteur || "-" }}</span>
            <span>{{ Math.max(1, Math.round((item.tailleOriginaleBytes || 0) / 1024)) }} KB</span>
          </div>
          <label class="form-row">
            <span>Note</span>
            <input
              v-model="noteDrafts[item.idMedia]"
              type="text"
              maxlength="500"
              placeholder="Reference, detail, consigne..."
              @focus="startNoteEditing(item)"
              @blur="finishNoteEditing(item)"
            />
          </label>
          <div class="row-actions commande-media-actions commande-media-actions-primary">
            <button class="mini-btn gray" @click="emit('open', item)">Voir</button>
            <button
              v-if="!prefersMobileCapture"
              class="mini-btn green"
              :disabled="item.isPrimary || actionId === item.idMedia"
              @click="emit('set-primary', item)"
            >
              Principale
            </button>
          </div>
          <div class="row-actions commande-media-actions commande-media-actions-secondary">
            <button
              v-if="!prefersMobileCapture"
              class="mini-btn"
              :disabled="!hasNoteChange(item) || actionId === item.idMedia"
              @click="saveNote(item)"
            >
              Enregistrer note
            </button>
            <button
              v-if="!prefersMobileCapture"
              class="mini-btn"
              :disabled="item.position <= 1 || actionId === item.idMedia"
              @click="emit('move', { media: item, direction: -1 })"
            >
              Monter
            </button>
            <button
              v-if="!prefersMobileCapture"
              class="mini-btn"
              :disabled="item.position >= items.length || actionId === item.idMedia"
              @click="emit('move', { media: item, direction: 1 })"
            >
              Descendre
            </button>
            <button class="mini-btn red" :disabled="actionId === item.idMedia" @click="emit('remove', item)">Supprimer</button>
          </div>
        </div>
      </article>
    </div>
    <div v-if="loading && items.length > 0" class="helper commande-media-loading-inline">Mise a jour des references...</div>
  </article>

  <div v-if="cameraModalOpen" class="modal-backdrop commande-camera-backdrop" @click.self="closeCameraCapture">
    <div class="modal-card commande-camera-modal">
      <header class="modal-header">
        <div>
          <h3>Prendre une photo</h3>
          <p class="helper">Cadre bien le modele avant de capturer l'image.</p>
        </div>
      </header>
      <section class="modal-body commande-camera-body">
        <div class="commande-camera-preview">
          <video
            v-show="!cameraError"
            ref="cameraVideoRef"
            class="commande-camera-video"
            autoplay
            playsinline
            muted
          ></video>
          <div v-if="cameraLoading" class="commande-camera-state helper">Ouverture de la camera...</div>
          <div v-else-if="cameraError" class="commande-camera-state">
            <strong>Camera indisponible</strong>
            <p class="helper">{{ cameraError }}</p>
          </div>
        </div>
        <canvas ref="cameraCanvasRef" class="commande-camera-canvas" aria-hidden="true"></canvas>
        <div class="modal-actions commande-camera-actions">
          <button class="mini-btn" type="button" @click="closeCameraCapture">Annuler</button>
          <button
            v-if="cameraError"
            class="mini-btn"
            type="button"
            :disabled="!canAddMore || uploading"
            @click="fallbackToNativeCamera"
          >
            Ouvrir le selecteur natif
          </button>
          <button
            v-else
            class="action-btn blue"
            type="button"
            :disabled="cameraLoading || !canAddMore || uploading"
            @click="captureCameraFrame"
          >
            Capturer la photo
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.commande-media-header-summary {
  display: grid;
  justify-items: end;
  gap: 8px;
}

.commande-media-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #237246;
}

.commande-media-picker-helper {
  margin: 0;
}

.commande-media-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.commande-media-copy strong,
.commande-media-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commande-media-line-top {
  align-items: start;
}

.commande-media-actions-primary,
.commande-media-actions-secondary {
  justify-content: flex-start;
}

.commande-media-actions-secondary {
  padding-top: 2px;
}

.commande-media-card.is-primary {
  border-color: rgba(35, 114, 70, 0.28);
  box-shadow: 0 14px 30px rgba(35, 114, 70, 0.12);
}

.commande-media-card.is-primary .commande-media-thumb {
  border-color: rgba(35, 114, 70, 0.28);
  box-shadow: 0 0 0 3px rgba(35, 114, 70, 0.08);
}

.commande-camera-backdrop {
  padding: 0;
  align-items: end;
}

.commande-camera-modal {
  width: 100%;
  max-width: none;
  max-height: 100vh;
  min-height: 100vh;
  border-radius: 18px 18px 0 0;
}

.commande-camera-body {
  gap: 14px;
}

.commande-camera-preview {
  position: relative;
  min-height: 320px;
  border-radius: 18px;
  overflow: hidden;
  background: #09111d;
  display: grid;
  place-items: center;
}

.commande-camera-video {
  width: 100%;
  height: min(70vh, 520px);
  object-fit: cover;
  display: block;
  background: #09111d;
}

.commande-camera-state {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
  padding: 24px;
  color: #eef5ff;
}

.commande-camera-state strong {
  font-size: 16px;
}

.commande-camera-canvas {
  display: none;
}

.commande-camera-actions {
  margin-top: 0;
}

@media (min-width: 768px) {
  .commande-camera-backdrop {
    padding: 16px;
    align-items: center;
  }

  .commande-camera-modal {
    width: min(760px, 100%);
    max-width: 760px;
    min-height: auto;
    max-height: calc(100vh - 32px);
    border-radius: 18px;
  }

  .commande-camera-video {
    height: min(62vh, 520px);
  }
}
</style>
