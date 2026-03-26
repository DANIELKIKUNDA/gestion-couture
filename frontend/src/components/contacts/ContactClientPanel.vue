<script setup>
const props = defineProps({
  title: {
    type: String,
    default: "Contacter le client"
  },
  subtitle: {
    type: String,
    default: "Appelez, ouvrez WhatsApp ou copiez un message pret a envoyer."
  },
  telephone: {
    type: String,
    default: ""
  },
  callHref: {
    type: String,
    default: ""
  },
  whatsappHref: {
    type: String,
    default: ""
  },
  whatsappFallbackHref: {
    type: String,
    default: ""
  },
  whatsappTarget: {
    type: String,
    default: "_self"
  },
  templates: {
    type: Array,
    default: () => []
  },
  selectedTemplateKey: {
    type: String,
    default: ""
  },
  messagePreview: {
    type: String,
    default: ""
  },
  lastContactSummary: {
    type: String,
    default: ""
  },
  lastContactNote: {
    type: String,
    default: ""
  },
  followUpStatus: {
    type: String,
    default: "A_RELANCER"
  },
  followUpNote: {
    type: String,
    default: ""
  },
  statusOptions: {
    type: Array,
    default: () => []
  },
  trackingLoading: {
    type: Boolean,
    default: false
  },
  trackingSaving: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "update:selectedTemplateKey",
  "update:followUpStatus",
  "update:followUpNote",
  "call",
  "whatsapp",
  "copy-number",
  "copy-message",
  "save-follow-up"
]);

function handleCallClick() {
  emit("call");
}

function handleWhatsAppClick() {
  emit("whatsapp");
  const appHref = String(props.whatsappHref || "").trim().toLowerCase();
  const fallbackHref = String(props.whatsappFallbackHref || "").trim();
  if (!fallbackHref || !appHref.startsWith("whatsapp://")) return;

  const clearFallback = () => {
    window.clearTimeout(fallbackTimer);
    document.removeEventListener("visibilitychange", clearFallback);
  };
  const fallbackTimer = window.setTimeout(() => {
    document.removeEventListener("visibilitychange", clearFallback);
    if (document.visibilityState !== "hidden") {
      window.location.href = fallbackHref;
    }
  }, 900);
  document.addEventListener("visibilitychange", clearFallback);
}
</script>

<template>
  <article class="panel contact-client-panel">
    <div class="panel-header contact-client-panel__header">
      <div>
        <h4>{{ title }}</h4>
        <p class="helper">{{ subtitle }}</p>
      </div>
      <span class="status-pill" :data-tone="telephone ? 'ok' : 'slate'">
        {{ telephone || "Numero indisponible" }}
      </span>
    </div>

    <div class="contact-client-panel__body">
      <label v-if="templates.length > 0" class="form-row">
        <span>Message pret</span>
        <select
          :value="selectedTemplateKey"
          :disabled="disabled"
          @change="emit('update:selectedTemplateKey', $event.target.value)"
        >
          <option value="">Choisir un message</option>
          <option v-for="template in templates" :key="template.key" :value="template.key">
            {{ template.label }}
          </option>
        </select>
      </label>

      <label v-if="messagePreview" class="form-row">
        <span>Apercu</span>
        <textarea :value="messagePreview" rows="4" readonly />
      </label>

      <div class="row-actions contact-client-panel__actions">
        <a
          v-if="callHref && !disabled"
          class="mini-btn contact-client-panel__link"
          :href="callHref"
          @click="handleCallClick"
        >
          Appeler
        </a>
        <button v-else class="mini-btn" type="button" :disabled="true">
          Appeler
        </button>
        <a
          v-if="whatsappHref && !disabled"
          class="mini-btn contact-client-panel__link"
          :href="whatsappHref"
          :target="whatsappTarget"
          rel="noopener noreferrer"
          @click="handleWhatsAppClick"
        >
          WhatsApp
        </a>
        <button v-else class="mini-btn" type="button" :disabled="true">
          WhatsApp
        </button>
        <button class="mini-btn" type="button" :disabled="disabled || !telephone" @click="emit('copy-number')">
          Copier numero
        </button>
        <button class="mini-btn" type="button" :disabled="disabled || !messagePreview" @click="emit('copy-message')">
          Copier message
        </button>
      </div>

      <div class="contact-client-panel__tracking">
        <div class="contact-client-panel__history">
          <strong>Dernier suivi</strong>
          <span class="helper" v-if="trackingLoading">Chargement du suivi...</span>
          <template v-else>
            <span class="helper">{{ lastContactSummary || "Aucun suivi enregistre pour ce client." }}</span>
            <span v-if="lastContactNote" class="helper">Note : {{ lastContactNote }}</span>
          </template>
        </div>

        <label v-if="statusOptions.length > 0" class="form-row">
          <span>Statut de relance</span>
          <select
            :value="followUpStatus"
            :disabled="disabled || trackingSaving"
            @change="emit('update:followUpStatus', $event.target.value)"
          >
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="form-row">
          <span>Note de suivi</span>
          <textarea
            :value="followUpNote"
            rows="3"
            :disabled="disabled || trackingSaving"
            placeholder="Ex: client rappelle demain, passe samedi, demande un delai..."
            @input="emit('update:followUpNote', $event.target.value)"
          />
        </label>

        <div class="row-actions">
          <button class="action-btn blue" type="button" :disabled="disabled || trackingSaving" @click="emit('save-follow-up')">
            {{ trackingSaving ? "Enregistrement..." : "Enregistrer suivi" }}
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.contact-client-panel {
  display: grid;
  gap: 12px;
}

.contact-client-panel__header {
  gap: 12px;
}

.contact-client-panel__body {
  display: grid;
  gap: 10px;
}

.contact-client-panel__actions {
  gap: 8px;
}

.contact-client-panel__link {
  text-decoration: none;
}

.contact-client-panel__tracking {
  display: grid;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.contact-client-panel__history {
  display: grid;
  gap: 4px;
}

@media (max-width: 767px) {
  .contact-client-panel__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .contact-client-panel__actions .mini-btn {
    width: 100%;
  }
}
</style>
