<script setup>
import { PASSWORD_POLICY_HINTS } from "../../utils/password-policy.js";

defineProps({
  open: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: "" },
  nomAtelier: { type: String, default: "" },
  slug: { type: String, default: "" },
  proprietaireNom: { type: String, default: "" },
  proprietaireEmail: { type: String, default: "" },
  proprietaireMotDePasse: { type: String, default: "" }
});

const emit = defineEmits([
  "close",
  "submit",
  "update-nom-atelier",
  "update-slug",
  "update-proprietaire-nom",
  "update-proprietaire-email",
  "update-proprietaire-mot-de-passe"
]);

function emitField(eventName, value) {
  emit(eventName, value);
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card modal-card-sm">
      <header class="modal-header">
        <div>
          <h3>Creer un atelier</h3>
          <p class="helper">Provisioning tenant + proprietaire initial</p>
        </div>
      </header>

      <section class="modal-body stack-form">
        <label for="system-atelier-nom">Nom de l'atelier</label>
        <input
          id="system-atelier-nom"
          :value="nomAtelier"
          type="text"
          autocomplete="organization"
          @input="emitField('update-nom-atelier', $event.target.value)"
        />

        <label for="system-atelier-slug">Slug</label>
        <input
          id="system-atelier-slug"
          :value="slug"
          type="text"
          autocomplete="off"
          @input="emitField('update-slug', $event.target.value)"
        />
        <p class="helper">Genere automatiquement a partir du nom, puis modifiable avant creation.</p>

        <label for="system-owner-name">Nom du proprietaire</label>
        <input
          id="system-owner-name"
          :value="proprietaireNom"
          type="text"
          autocomplete="name"
          @input="emitField('update-proprietaire-nom', $event.target.value)"
        />

        <label for="system-owner-email">Email du proprietaire</label>
        <input
          id="system-owner-email"
          :value="proprietaireEmail"
          type="email"
          autocomplete="email"
          @input="emitField('update-proprietaire-email', $event.target.value)"
        />

        <label for="system-owner-password">Mot de passe initial</label>
        <input
          id="system-owner-password"
          :value="proprietaireMotDePasse"
          type="password"
          autocomplete="new-password"
          @input="emitField('update-proprietaire-mot-de-passe', $event.target.value)"
        />
        <ul class="password-policy-hints">
          <li v-for="hint in PASSWORD_POLICY_HINTS" :key="hint">{{ hint }}</li>
        </ul>

        <p v-if="error" class="auth-error">{{ error }}</p>
      </section>

      <div class="modal-actions">
        <button class="mini-btn" @click="emit('close')">Annuler</button>
        <button class="action-btn blue" :disabled="submitting" @click="emit('submit')">
          {{ submitting ? "Creation..." : "Creer l'atelier" }}
        </button>
      </div>
    </div>
  </div>
</template>
