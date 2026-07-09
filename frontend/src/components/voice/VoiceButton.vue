<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { createSpeechRecognizer, getVoiceCapabilities } from "../../services/voice-service.js";

const props = defineProps({
  label: { type: String, default: "Parler" },
  title: { type: String, default: "Commande vocale" },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  tone: { type: String, default: "blue" },
  lang: { type: String, default: "fr-FR" }
});

const emit = defineEmits(["result", "partial", "error", "unsupported"]);

const listening = ref(false);
const transcript = ref("");
const errorMessage = ref("");
let recognition = null;

const capabilities = computed(() => getVoiceCapabilities());
const available = computed(() => capabilities.value.available && !props.disabled);

function cleanupRecognition() {
  if (!recognition) return;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  recognition = null;
}

async function stopListening() {
  if (!recognition) return;
  try {
    await recognition.stop();
  } catch {
    cleanupRecognition();
    listening.value = false;
  }
}

async function startListening() {
  errorMessage.value = "";
  transcript.value = "";

  if (!capabilities.value.available) {
    emit("unsupported", capabilities.value);
    return;
  }

  cleanupRecognition();
  recognition = createSpeechRecognizer({ lang: props.lang, interimResults: true });
  if (!recognition) {
    emit("unsupported", capabilities.value);
    return;
  }

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const value = event.results[index]?.[0]?.transcript || "";
      if (event.results[index].isFinal) finalText += value;
      else interim += value;
    }
    transcript.value = (finalText || interim).trim();
    if (interim) emit("partial", interim.trim());
    if (finalText.trim()) emit("result", finalText.trim());
  };

  recognition.onerror = (event) => {
    const code = event?.error || "unknown";
    errorMessage.value = code === "not-allowed" ? "Micro refuse" : "Voix indisponible";
    emit("error", { code, message: errorMessage.value });
  };

  recognition.onend = () => {
    listening.value = false;
    cleanupRecognition();
  };

  try {
    await recognition.start();
    listening.value = true;
  } catch (error) {
    listening.value = false;
    errorMessage.value = "Voix indisponible";
    emit("error", { code: "start-failed", message: errorMessage.value, error });
    cleanupRecognition();
  }
}

function toggleVoice() {
  if (listening.value) {
    void stopListening();
    return;
  }
  void startListening();
}

onBeforeUnmount(() => {
  void stopListening();
  cleanupRecognition();
});
</script>

<template>
  <button
    type="button"
    class="voice-button"
    :class="[`voice-button--${tone}`, { 'voice-button--listening': listening, 'voice-button--compact': compact }]"
    :disabled="disabled || !capabilities.available"
    :title="available ? title : 'Voix indisponible sur cet appareil'"
    @click="toggleVoice"
  >
    <span class="voice-button__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <path d="M12 19v3" />
      </svg>
    </span>
    <span v-if="!compact" class="voice-button__label">{{ listening ? "J'écoute..." : label }}</span>
  </button>
</template>

<style scoped>
.voice-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid rgba(22, 50, 77, 0.12);
  border-radius: 12px;
  background: #ffffff;
  color: #16324d;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(22, 47, 78, 0.1);
}

.voice-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.voice-button--compact {
  width: 40px;
  min-height: 40px;
  padding: 0;
  border-radius: 999px;
}

.voice-button--blue {
  background: #eef6ff;
  color: #0d4f8b;
}

.voice-button--gold {
  background: #fff7e8;
  color: #8a5a00;
}

.voice-button--listening {
  background: #0b1b3f;
  color: #ffffff;
  animation: voice-pulse 1s ease-in-out infinite;
}

.voice-button__icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
}

.voice-button__icon svg {
  width: 18px;
  height: 18px;
}

.voice-button__label {
  white-space: nowrap;
}

@keyframes voice-pulse {
  0%,
  100% {
    box-shadow: 0 10px 24px rgba(22, 47, 78, 0.1);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(11, 27, 63, 0.14), 0 14px 30px rgba(22, 47, 78, 0.16);
  }
}
</style>
