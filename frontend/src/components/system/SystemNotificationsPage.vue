<script setup>
import { computed, reactive } from "vue";

const props = defineProps({
  loading: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: "" },
  notifications: { type: Array, default: () => [] },
  contacts: { type: Array, default: () => [] },
  formatDateTime: { type: Function, required: true },
  buildPhoneHref: { type: Function, required: true },
  buildWhatsAppHref: { type: Function, required: true }
});

const emit = defineEmits(["refresh", "submit-notification"]);

const draft = reactive({
  portee: "GLOBAL",
  atelierId: "",
  titre: "",
  message: ""
});

const canSubmit = computed(
  () =>
    !props.submitting &&
    String(draft.titre || "").trim() &&
    String(draft.message || "").trim() &&
    (draft.portee === "GLOBAL" || String(draft.atelierId || "").trim())
);

function submit() {
  if (!canSubmit.value) return;
  emit("submit-notification", {
    portee: draft.portee,
    atelierId: draft.portee === "ATELIER" ? String(draft.atelierId || "").trim() : null,
    titre: String(draft.titre || "").trim(),
    message: String(draft.message || "").trim()
  });
}

function resetDraft() {
  draft.portee = "GLOBAL";
  draft.atelierId = "";
  draft.titre = "";
  draft.message = "";
}

defineExpose({ resetDraft });

const emptyContactsMessage = computed(() =>
  props.loading ? "Chargement des contacts ateliers..." : "Aucun contact atelier disponible."
);
const emptyNotificationsMessage = computed(() =>
  props.loading ? "Chargement des notifications..." : "Aucune notification envoyee pour le moment."
);

function safeBuildPhoneHref(value) {
  return typeof props.buildPhoneHref === "function" ? props.buildPhoneHref(value) : "";
}

function safeBuildWhatsAppHref(value) {
  return typeof props.buildWhatsAppHref === "function" ? props.buildWhatsAppHref(value) : "";
}

function buildWhatsAppFallbackHref(value) {
  const href = String(safeBuildWhatsAppHref(value) || "").trim();
  if (!href.toLowerCase().startsWith("whatsapp://")) return href;
  try {
    const url = new URL(href);
    const phone = String(url.searchParams.get("phone") || "").trim();
    const text = String(url.searchParams.get("text") || "").trim();
    if (!phone) return "";
    return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
  } catch {
    return "";
  }
}

function openWhatsAppLink(event, value) {
  const href = String(safeBuildWhatsAppHref(value) || "").trim();
  if (!href) return;
  const fallbackHref = String(buildWhatsAppFallbackHref(value) || "").trim();
  const isAppHref = href.toLowerCase().startsWith("whatsapp://");
  if (!isAppHref || !fallbackHref) return;

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
  <section class="dashboard system-admin-page">
    <article class="panel panel-header">
      <div>
        <h3>Notifications systeme</h3>
        <p class="helper">Informer tous les ateliers ou cibler un atelier precis sans sortir de l'espace systeme.</p>
      </div>
      <div class="row-actions">
        <button class="mini-btn" :disabled="loading" @click="emit('refresh')">
          {{ loading ? "Actualisation..." : "Actualiser" }}
        </button>
      </div>
    </article>

    <div class="system-notifications-layout">
      <article class="panel system-notification-compose">
        <div class="detail-panel-header">
          <h4>Nouvelle notification</h4>
          <span class="helper">Canal interne plateforme</span>
        </div>

        <label>Portee</label>
        <select v-model="draft.portee">
          <option value="GLOBAL">Tous les ateliers</option>
          <option value="ATELIER">Un atelier</option>
        </select>

        <template v-if="draft.portee === 'ATELIER'">
          <label>Atelier cible</label>
          <select v-model="draft.atelierId">
            <option value="">Selectionner un atelier</option>
            <option v-for="contact in contacts" :key="contact.idAtelier" :value="contact.idAtelier">
              {{ contact.nomAtelier }}
            </option>
          </select>
        </template>

        <label>Titre</label>
        <input v-model.trim="draft.titre" type="text" placeholder="Ex: Maintenance plateforme" />

        <label>Message</label>
        <textarea
          v-model.trim="draft.message"
          rows="5"
          placeholder="Saisissez le message qui sera visible par les ateliers."
        />

        <p v-if="error" class="auth-error">{{ error }}</p>

        <div class="row-actions">
          <button class="mini-btn" type="button" @click="resetDraft">Reinitialiser</button>
          <button class="action-btn blue" type="button" :disabled="!canSubmit" @click="submit">
            {{ submitting ? "Envoi..." : "Envoyer la notification" }}
          </button>
        </div>
      </article>

      <article class="panel system-notification-history">
        <div class="detail-panel-header">
          <h4>Notifications envoyees</h4>
          <span class="helper">{{ notifications.length }} notification(s)</span>
        </div>

        <div v-if="notifications.length === 0" class="helper">
          {{ emptyNotificationsMessage }}
        </div>

        <div v-else class="system-notification-list">
          <article v-for="item in notifications" :key="item.idNotification" class="system-notification-item">
            <div class="system-notification-item-head">
              <div>
                <strong>{{ item.titre }}</strong>
                <p class="helper">
                  {{ item.portee === "GLOBAL" ? "Tous les ateliers" : item.atelierNom || item.atelierId }}
                </p>
              </div>
              <span class="status-pill" :data-tone="item.portee === 'GLOBAL' ? 'blue' : 'ok'">
                {{ item.portee === "GLOBAL" ? "Globale" : "Atelier" }}
              </span>
            </div>
            <p>{{ item.message }}</p>
            <div class="system-notification-item-meta">
              <span>{{ item.creeParNom }}</span>
              <span>{{ formatDateTime(item.dateEnvoi || item.dateCreation) }}</span>
            </div>
          </article>
        </div>
      </article>
    </div>

    <article class="panel system-contacts-panel">
      <div class="detail-panel-header">
        <h4>Contacts ateliers</h4>
        <span class="helper">{{ contacts.length }} atelier(s)</span>
      </div>

      <div v-if="contacts.length === 0" class="helper">
        {{ emptyContactsMessage }}
      </div>

      <div v-else class="system-contacts-list">
        <article v-for="contact in contacts" :key="contact.idAtelier" class="system-contact-item">
          <div>
            <strong>{{ contact.nomAtelier }}</strong>
            <p class="helper">{{ contact.proprietaire?.nom || "Proprietaire non initialise" }}</p>
            <p class="helper">{{ contact.proprietaire?.email || "Email non renseigne" }}</p>
            <p class="helper">{{ contact.proprietaire?.telephone || "Telephone non renseigne" }}</p>
          </div>
          <div class="row-actions">
            <a v-if="safeBuildPhoneHref(contact.proprietaire?.telephone)" class="mini-btn blue" :href="safeBuildPhoneHref(contact.proprietaire?.telephone)">Appeler</a>
            <button v-else class="mini-btn blue" type="button" disabled>Appeler</button>
            <a
              v-if="safeBuildWhatsAppHref(contact.proprietaire?.telephone)"
              class="mini-btn whatsapp"
              :href="safeBuildWhatsAppHref(contact.proprietaire?.telephone)"
              target="_self"
              rel="noopener noreferrer"
              @click="openWhatsAppLink($event, contact.proprietaire?.telephone)"
            >
              WhatsApp
            </a>
            <button v-else class="mini-btn whatsapp" type="button" disabled>WhatsApp</button>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>
