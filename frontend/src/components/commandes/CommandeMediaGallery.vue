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

const galleryInputRef = ref(null);
const cameraInputRef = ref(null);
const cameraVideoRef = ref(null);
const cameraCanvasRef = ref(null);
const prefersMobileCapture = ref(false);
const cameraModalOpen = ref(false);
const cameraLoading = ref(false);
const cameraError = ref("");
const activeMenuMediaId = ref("");
const noteModal = reactive({
  open: false,
  mode: "upload",
  title: "",
  submitLabel: "",
  sourceType: "UPLOAD",
  file: null,
  media: null,
  note: ""
});

let mobileCaptureMediaQuery = null;
let mobileCaptureListener = null;
let cameraStream = null;

const SUPPORTED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const canAddMore = computed(() => props.items.length < 3);
const photoCountLabel = computed(() => `${props.items.length} / 3`);
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

function resetInput(target) {
  if (target?.value) target.value = "";
}

function closeMenu() {
  activeMenuMediaId.value = "";
}

function toggleMenu(item) {
  const nextId = String(item?.idMedia || "");
  activeMenuMediaId.value = activeMenuMediaId.value === nextId ? "" : nextId;
}

function truncateNote(value = "") {
  return String(value || "").trim();
}

function openNoteModalForUpload(file, sourceType = "UPLOAD") {
  noteModal.open = true;
  noteModal.mode = "upload";
  noteModal.title = "Ajouter une note";
  noteModal.submitLabel = "Ajouter la photo";
  noteModal.sourceType = sourceType;
  noteModal.file = file;
  noteModal.media = null;
  noteModal.note = "";
  closeMenu();
}

function openNoteModalForEdition(item) {
  noteModal.open = true;
  noteModal.mode = "edit";
  noteModal.title = "Modifier la note";
  noteModal.submitLabel = "Enregistrer";
  noteModal.sourceType = "UPLOAD";
  noteModal.file = null;
  noteModal.media = item;
  noteModal.note = String(item?.note || "");
  closeMenu();
}

function resetNoteModal() {
  noteModal.open = false;
  noteModal.mode = "upload";
  noteModal.title = "";
  noteModal.submitLabel = "";
  noteModal.sourceType = "UPLOAD";
  noteModal.file = null;
  noteModal.media = null;
  noteModal.note = "";
}

function submitNoteModal() {
  const note = String(noteModal.note || "");
  if (noteModal.mode === "upload" && noteModal.file) {
    emit("upload", {
      file: noteModal.file,
      note,
      sourceType: noteModal.sourceType || "UPLOAD"
    });
  } else if (noteModal.mode === "edit" && noteModal.media) {
    emit("save-note", {
      media: noteModal.media,
      note
    });
  }
  resetNoteModal();
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
  if (typeof document === "undefined") {
    const mimeType = String(file.type || "").trim().toLowerCase();
    if (!mimeType || SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType)) return file;
    throw new Error("Format photo non supporte par cet appareil.");
  }
  try {
    const image = await blobToImageElement(file);
    const canvas = document.createElement("canvas");
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    const maxDimension = 1600;
    const scale = sourceWidth > 0 && sourceHeight > 0 ? Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight)) : 1;
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
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
        0.88
      );
    });
    return new File([convertedBlob], buildNormalizedCameraFileName(file?.name), { type: "image/jpeg" });
  } catch (err) {
    const mimeType = String(file.type || "").trim().toLowerCase();
    if (SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType)) return file;
    throw err;
  }
}

function triggerGalleryUpload() {
  if (!canAddMore.value) return;
  galleryInputRef.value?.click();
}

function stopCameraStream() {
  if (cameraStream) {
    for (const track of cameraStream.getTracks()) track.stop();
  }
  cameraStream = null;
  if (cameraVideoRef.value) cameraVideoRef.value.srcObject = null;
}

function closeCameraCapture() {
  cameraModalOpen.value = false;
  cameraLoading.value = false;
  cameraError.value = "";
  stopCameraStream();
}

async function startDedicatedCamera() {
  if (!canAddMore.value) return;
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
    openNoteModalForUpload(normalizedFile, sourceType);
  } catch (err) {
    cameraError.value = String(err?.message || "Impossible de preparer la photo de la camera.");
  } finally {
    resetInput(event?.target);
  }
}

async function captureCameraFrame() {
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
    async (blob) => {
      if (!blob) {
        cameraError.value = "La photo n'a pas pu etre capturee.";
        return;
      }
      try {
        const capturedFile =
          typeof File === "function"
            ? new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })
            : blob;
        const normalizedFile = await normalizeCameraUploadFile(capturedFile);
        closeCameraCapture();
        openNoteModalForUpload(normalizedFile, "CAMERA");
      } catch (err) {
        cameraError.value = String(err?.message || "Impossible de preparer la photo de la camera.");
      }
    },
    "image/jpeg",
    0.92
  );
}

function onSetPrimary(item) {
  closeMenu();
  emit("set-primary", item);
}

function onRemove(item) {
  closeMenu();
  emit("remove", item);
}

function onOpen(item) {
  closeMenu();
  emit("open", item);
}

function handleGlobalPointer(event) {
  if (!activeMenuMediaId.value) return;
  const target = event?.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".commande-media-menu")) return;
  closeMenu();
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
  document.addEventListener("pointerdown", handleGlobalPointer);
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
  document.removeEventListener("pointerdown", handleGlobalPointer);
  mobileCaptureMediaQuery = null;
  mobileCaptureListener = null;
});

watch(
  () => props.items,
  () => {
    if (props.items.length < 3) return;
    if (activeMenuMediaId.value && !props.items.some((item) => String(item?.idMedia || "") === activeMenuMediaId.value)) {
      closeMenu();
    }
  },
  { deep: true }
);
</script>

<template>
  <article class="panel commande-media-panel">
    <header class="commande-media-topbar">
      <div class="commande-media-heading">
        <h4>Photos de reference</h4>
        <p class="helper">Associe jusqu'a 3 visuels a cet habit.</p>
      </div>
      <span class="commande-media-counter">{{ photoCountLabel }}</span>
    </header>

    <section class="commande-media-toolbar">
      <button
        class="commande-media-add-btn blue"
        type="button"
        :disabled="!canAddMore || uploading"
        @click="triggerCameraUpload"
      >
        <span class="commande-media-add-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.1-1.5A2 2 0 0 1 11.2 4h1.6a2 2 0 0 1 1.6.5L15.5 6h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
            <circle cx="12" cy="12.5" r="3.2" />
          </svg>
        </span>
        <span>Camera</span>
      </button>
      <button
        class="commande-media-add-btn gray"
        type="button"
        :disabled="!canAddMore || uploading"
        @click="triggerGalleryUpload"
      >
        <span class="commande-media-add-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
            <path d="M7.5 14l2.6-2.6a1 1 0 0 1 1.4 0L16.5 16" />
            <path d="M13.5 13l1.1-1.1a1 1 0 0 1 1.4 0l2.5 2.5" />
            <circle cx="9" cy="9" r="1.2" />
          </svg>
        </span>
        <span>Galerie</span>
      </button>
    </section>

    <p v-if="uploading" class="helper commande-media-status">Ajout de la photo en cours...</p>
    <p v-else-if="!canAddMore" class="helper commande-media-status">Limite atteinte (3 photos maximum).</p>
    <p v-if="error" class="helper commande-media-error">{{ error }}</p>

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

    <div v-if="loading && items.length === 0" class="commande-media-empty">
      <strong>Chargement des photos...</strong>
      <p class="helper">Preparation des references visuelles de cet habit.</p>
    </div>

    <div v-else-if="items.length === 0" class="commande-media-empty">
      <strong>Aucune photo pour cet habit.</strong>
      <p class="helper">Ajoute une photo depuis la camera ou la galerie pour memoriser le modele.</p>
    </div>

    <div v-else class="commande-media-grid">
      <article
        v-for="item in items"
        :key="item.idMedia"
        class="commande-media-card"
        :class="{ 'is-primary': item.isPrimary }"
      >
        <div class="commande-media-thumb-wrap">
          <button class="commande-media-thumb" :disabled="!item.thumbnailBlobUrl" type="button" @click="onOpen(item)">
            <img v-if="item.thumbnailBlobUrl" :src="item.thumbnailBlobUrl" :alt="item.nomFichierOriginal || 'Reference commande'" />
            <span v-else class="helper">Miniature indisponible</span>
          </button>
          <span v-if="item.isPrimary" class="commande-media-badge">Principale</span>
        </div>

        <p class="commande-media-note" :class="{ 'is-empty': !truncateNote(item.note) }">
          {{ truncateNote(item.note) || "Aucune note" }}
        </p>

        <div class="commande-media-actions">
          <button class="mini-btn gray" type="button" @click="onOpen(item)">Voir</button>
          <div class="commande-media-menu-wrap">
            <button
              class="mini-btn commande-media-menu-trigger"
              type="button"
              :aria-expanded="activeMenuMediaId === item.idMedia ? 'true' : 'false'"
              @click.stop="toggleMenu(item)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </button>
            <div v-if="activeMenuMediaId === item.idMedia" class="commande-media-menu">
              <button class="commande-media-menu-item" type="button" @click="openNoteModalForEdition(item)">Modifier note</button>
              <button
                class="commande-media-menu-item"
                type="button"
                :disabled="item.isPrimary || actionId === item.idMedia"
                @click="onSetPrimary(item)"
              >
                Definir principale
              </button>
              <button
                class="commande-media-menu-item is-danger"
                type="button"
                :disabled="actionId === item.idMedia"
                @click="onRemove(item)"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </article>

  <div v-if="noteModal.open" class="modal-backdrop commande-media-note-backdrop" @click.self="resetNoteModal">
    <div class="modal-card commande-media-note-modal">
      <header class="modal-header">
        <div>
          <h3>{{ noteModal.title }}</h3>
          <p class="helper">La note est optionnelle mais utile pour memoriser les details du modele.</p>
        </div>
      </header>
      <section class="modal-body commande-media-note-body">
        <label class="form-row">
          <span>Note</span>
          <textarea
            v-model="noteModal.note"
            rows="4"
            maxlength="500"
            placeholder="Ex: col plus ferme, manche a reprendre, tissu a reproduire..."
          ></textarea>
        </label>
        <div class="modal-actions commande-media-note-actions">
          <button class="mini-btn" type="button" @click="resetNoteModal">Annuler</button>
          <button class="action-btn blue" type="button" :disabled="uploading" @click="submitNoteModal">
            {{ noteModal.submitLabel }}
          </button>
        </div>
      </section>
    </div>
  </div>

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
.commande-media-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.commande-media-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.commande-media-heading {
  display: grid;
  gap: 4px;
}

.commande-media-heading h4 {
  margin: 0;
  font-size: 16px;
}

.commande-media-heading .helper {
  margin: 0;
  line-height: 1.35;
}

.commande-media-counter {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #edf3fb;
  color: #33506f;
  font-size: 12px;
  font-weight: 700;
}

.commande-media-toolbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.commande-media-add-btn {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.commande-media-add-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
}

.commande-media-add-icon svg {
  width: 100%;
  height: 100%;
}

.commande-media-status,
.commande-media-error {
  margin: 0;
}

.commande-media-error {
  color: #8d2f25;
}

.commande-media-input-hidden {
  display: none;
}

.commande-media-empty {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px dashed #d5e1ee;
  border-radius: 16px;
  background: #fbfdff;
}

.commande-media-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.commande-media-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #dbe6f2;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(27, 66, 110, 0.08);
}

.commande-media-card.is-primary {
  border-color: rgba(35, 114, 70, 0.3);
  box-shadow: 0 10px 24px rgba(35, 114, 70, 0.12);
}

.commande-media-thumb-wrap {
  position: relative;
}

.commande-media-thumb {
  width: 100%;
  border: 1px solid #dbe6f2;
  border-radius: 14px;
  background: #f5f9ff;
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  cursor: pointer;
}

.commande-media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.commande-media-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(35, 114, 70, 0.92);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.commande-media-note {
  min-height: 34px;
  margin: 0;
  color: #243649;
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.commande-media-note.is-empty {
  color: #7e90a4;
}

.commande-media-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.commande-media-menu-wrap {
  position: relative;
}

.commande-media-menu-trigger {
  min-width: 38px;
  width: 38px;
  padding-inline: 0;
}

.commande-media-menu-trigger svg {
  width: 18px;
  height: 18px;
}

.commande-media-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 4;
  display: grid;
  min-width: 180px;
  padding: 6px;
  border: 1px solid #dbe6f2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 34px rgba(16, 24, 40, 0.18);
}

.commande-media-menu-item {
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  color: #233649;
  font: inherit;
}

.commande-media-menu-item:hover,
.commande-media-menu-item:focus-visible {
  background: #f4f8fd;
}

.commande-media-menu-item:disabled {
  opacity: 0.45;
}

.commande-media-menu-item.is-danger {
  color: #aa3125;
}

.commande-media-note-backdrop,
.commande-camera-backdrop {
  padding: 0;
  align-items: end;
}

.commande-media-note-modal,
.commande-camera-modal {
  width: 100%;
  max-width: none;
  border-radius: 18px 18px 0 0;
}

.commande-media-note-body,
.commande-camera-body {
  gap: 14px;
}

.commande-media-note-actions,
.commande-camera-actions {
  justify-content: space-between;
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
}

.commande-camera-state {
  display: grid;
  gap: 8px;
  text-align: center;
  padding: 22px;
  color: #fff;
}

.commande-camera-state strong {
  font-size: 16px;
}

.commande-camera-canvas {
  display: none;
}

@media (min-width: 960px) {
  .commande-media-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .commande-media-note-modal,
  .commande-camera-modal {
    max-width: 520px;
    margin-inline: auto;
    border-radius: 20px;
  }

  .commande-media-note-backdrop,
  .commande-camera-backdrop {
    align-items: center;
    padding: 24px;
  }
}

@media (max-width: 480px) {
  .commande-media-panel {
    padding: 12px;
  }

  .commande-media-toolbar {
    gap: 8px;
  }

  .commande-media-add-btn {
    min-height: 40px;
    font-size: 13px;
  }

  .commande-media-card {
    padding: 9px;
  }

  .commande-media-menu {
    min-width: 164px;
  }
}
</style>
