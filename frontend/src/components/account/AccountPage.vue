<script setup>
import { computed, reactive, ref, watch } from "vue";
import { PASSWORD_POLICY_HINTS } from "../../utils/password-policy.js";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  STARTUP_MODES,
  USER_THEMES,
  normalizeAccountPreferences
} from "../../utils/account-preferences.js";

const props = defineProps({
  profile: { type: Object, default: null },
  preferences: { type: Object, default: () => ({ ...DEFAULT_ACCOUNT_PREFERENCES }) },
  security: { type: Object, default: () => ({ activeSessions: [], activeSessionCount: 0 }) },
  loading: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
  success: { type: String, default: "" },
  networkIsOnline: { type: Boolean, default: true },
  homeRouteOptions: { type: Array, default: () => [] },
  formatDateTime: { type: Function, required: true }
});

const emit = defineEmits(["refresh", "save-profile", "save-preferences", "change-password", "revoke-sessions"]);
const activeTab = ref("profile");
const showProfilePassword = ref(false);
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const profileForm = reactive({
  nom: "",
  email: "",
  telephone: "",
  motDePasseActuel: ""
});
const preferenceForm = reactive({
  pageAccueil: DEFAULT_ACCOUNT_PREFERENCES.pageAccueil,
  modeDemarrage: DEFAULT_ACCOUNT_PREFERENCES.modeDemarrage,
  theme: DEFAULT_ACCOUNT_PREFERENCES.theme
});
const passwordForm = reactive({
  motDePasseActuel: "",
  nouveauMotDePasse: "",
  confirmation: ""
});

watch(
  () => props.profile,
  (profile) => {
    profileForm.nom = profile?.nom || "";
    profileForm.email = profile?.email || "";
    profileForm.telephone = profile?.telephone || "";
    profileForm.motDePasseActuel = "";
  },
  { immediate: true, deep: true }
);

watch(
  () => props.preferences,
  (preferences) => {
    const normalized = normalizeAccountPreferences(preferences);
    preferenceForm.pageAccueil = normalized.pageAccueil;
    preferenceForm.modeDemarrage = normalized.modeDemarrage;
    preferenceForm.theme = normalized.theme;
  },
  { immediate: true, deep: true }
);

watch(
  () => props.homeRouteOptions,
  (options) => {
    const rows = Array.isArray(options) ? options : [];
    if (rows.length === 0) return;
    if (!rows.some((option) => option?.id === preferenceForm.pageAccueil)) {
      preferenceForm.pageAccueil = rows[0].id;
    }
  },
  { immediate: true, deep: true }
);

const emailChanged = computed(
  () => String(profileForm.email || "").trim().toLowerCase() !== String(props.profile?.email || "").trim().toLowerCase()
);
const phoneChanged = computed(
  () => String(profileForm.telephone || "").trim() !== String(props.profile?.telephone || "").trim()
);
const loginIdentifierChanged = computed(() => emailChanged.value || phoneChanged.value);
const passwordMismatch = computed(
  () => Boolean(passwordForm.confirmation) && passwordForm.nouveauMotDePasse !== passwordForm.confirmation
);
const initials = computed(() => {
  const parts = String(props.profile?.nom || "Utilisateur")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
});

const startupModeOptions = [
  {
    id: STARTUP_MODES.HOME_PAGE,
    title: "Ouvrir ma page d'accueil",
    description: "AtelierPro ouvre toujours la page choisie ci-dessous lorsque votre role y a acces."
  },
  {
    id: STARTUP_MODES.LAST_PAGE,
    title: "Reprendre la derniere page",
    description: "AtelierPro reprend la derniere section utilisee sur cet appareil lorsqu'elle reste accessible."
  }
];

const themeOptions = [
  { id: USER_THEMES.SYSTEM, title: "Systeme", description: "Suit automatiquement Android ou Windows.", preview: "system" },
  { id: USER_THEMES.LIGHT, title: "Clair", description: "Interface claire en permanence.", preview: "light" },
  { id: USER_THEMES.DARK, title: "Sombre", description: "Interface sombre en permanence.", preview: "dark" }
];

function submitProfile() {
  emit("save-profile", {
    nom: String(profileForm.nom || "").trim(),
    email: String(profileForm.email || "").trim().toLowerCase(),
    telephone: String(profileForm.telephone || "").trim(),
    motDePasseActuel: loginIdentifierChanged.value ? profileForm.motDePasseActuel : ""
  });
}

function submitPreferences() {
  emit("save-preferences", {
    pageAccueil: preferenceForm.pageAccueil,
    modeDemarrage: preferenceForm.modeDemarrage,
    restaurerDernierePage: preferenceForm.modeDemarrage === STARTUP_MODES.LAST_PAGE,
    theme: preferenceForm.theme
  });
}

function submitPassword() {
  if (passwordMismatch.value || !passwordForm.confirmation) return;
  emit("change-password", {
    motDePasseActuel: passwordForm.motDePasseActuel,
    nouveauMotDePasse: passwordForm.nouveauMotDePasse
  });
}

function clearPasswordForm() {
  passwordForm.motDePasseActuel = "";
  passwordForm.nouveauMotDePasse = "";
  passwordForm.confirmation = "";
}

watch(
  () => props.success,
  (message) => {
    if (/mot de passe modifie/i.test(String(message || ""))) clearPasswordForm();
  }
);

defineExpose({ clearPasswordForm });
</script>

<template>
  <section class="account-page">
    <article class="account-hero">
      <div class="account-avatar" aria-hidden="true">{{ initials }}</div>
      <div class="account-hero-copy">
        <p class="account-eyebrow">ESPACE PERSONNEL</p>
        <h3>{{ profile?.nom || "Mon compte" }}</h3>
        <p>{{ profile?.email || "Compte utilisateur AtelierPro" }}</p>
        <div class="account-badges">
          <span class="status-pill" data-tone="info">{{ profile?.roleId || "UTILISATEUR" }}</span>
          <span class="status-pill" :data-tone="profile?.actif === false ? 'due' : 'ok'">
            {{ profile?.actif === false ? "INACTIF" : "ACTIF" }}
          </span>
        </div>
      </div>
      <button class="mini-btn" type="button" :disabled="loading" @click="emit('refresh')">
        {{ loading ? "Actualisation..." : "Actualiser" }}
      </button>
    </article>

    <div class="account-tabs" role="tablist" aria-label="Sections du compte">
      <button role="tab" type="button" :aria-selected="activeTab === 'profile'" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">Profil</button>
      <button role="tab" type="button" :aria-selected="activeTab === 'security'" :class="{ active: activeTab === 'security' }" @click="activeTab = 'security'">Securite</button>
      <button role="tab" type="button" :aria-selected="activeTab === 'preferences'" :class="{ active: activeTab === 'preferences' }" @click="activeTab = 'preferences'">Preferences</button>
    </div>

    <p v-if="!networkIsOnline" class="account-offline-note" role="status">Mode hors ligne : consultation disponible, modifications du compte suspendues jusqu'au retour de la connexion.</p>
    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <p v-if="success" class="account-success" role="status">{{ success }}</p>

    <div v-if="loading && !profile" class="panel account-loading">
      <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
      <span>Chargement du compte...</span>
    </div>

    <template v-else>
      <div v-if="activeTab === 'profile'" class="account-grid">
        <article class="panel account-card">
          <div class="account-card-head">
            <div>
              <p class="account-eyebrow">IDENTITE</p>
              <h4>Informations personnelles</h4>
            </div>
            <span class="status-pill" data-tone="info">Personnel</span>
          </div>
          <form class="account-form" @submit.prevent="submitProfile">
            <label>
              <span>Nom complet</span>
              <input v-model="profileForm.nom" type="text" autocomplete="name" maxlength="120" required />
            </label>
            <label>
              <span>Telephone</span>
              <input v-model="profileForm.telephone" type="tel" autocomplete="tel" maxlength="40" placeholder="Ex. +243..." />
            </label>
            <label>
              <span>Adresse email</span>
              <input v-model="profileForm.email" type="email" autocomplete="email" required />
              <small>L'email peut servir a la connexion et a la recuperation du compte.</small>
            </label>
            <label v-if="loginIdentifierChanged">
              <span>Mot de passe actuel</span>
              <div class="auth-password-field">
                <input
                  v-model="profileForm.motDePasseActuel"
                  :type="showProfilePassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                />
                <button type="button" class="auth-password-toggle" @click="showProfilePassword = !showProfilePassword">
                  {{ showProfilePassword ? "Masquer" : "Voir" }}
                </button>
              </div>
              <small>Obligatoire pour proteger un changement d'email ou de telephone de connexion.</small>
            </label>
            <button class="action-btn blue" type="submit" :disabled="saving || !networkIsOnline">
              {{ saving ? "Enregistrement..." : "Enregistrer mon profil" }}
            </button>
          </form>
        </article>

        <article class="panel account-card account-readonly-card">
          <div class="account-card-head">
            <div>
              <p class="account-eyebrow">RATTACHEMENT</p>
              <h4>Informations protegees</h4>
            </div>
          </div>
          <dl class="account-facts">
            <div><dt>Role</dt><dd>{{ profile?.roleId || "-" }}</dd></div>
            <div><dt>Atelier</dt><dd>{{ profile?.atelierId || "-" }}</dd></div>
            <div><dt>Etat du compte</dt><dd>{{ profile?.etatCompte || "-" }}</dd></div>
          </dl>
          <p class="helper">Le role, les permissions, l'atelier et l'activation du compte restent sous controle administratif.</p>
        </article>
      </div>

      <div v-else-if="activeTab === 'security'" class="account-grid">
        <article class="panel account-card">
          <div class="account-card-head">
            <div>
              <p class="account-eyebrow">MOT DE PASSE</p>
              <h4>Changer mon mot de passe</h4>
            </div>
            <span class="status-pill" data-tone="ok">Protege</span>
          </div>
          <form class="account-form" @submit.prevent="submitPassword">
            <label>
              <span>Mot de passe actuel</span>
              <div class="auth-password-field">
                <input v-model="passwordForm.motDePasseActuel" :type="showCurrentPassword ? 'text' : 'password'" autocomplete="current-password" required />
                <button type="button" class="auth-password-toggle" @click="showCurrentPassword = !showCurrentPassword">{{ showCurrentPassword ? "Masquer" : "Voir" }}</button>
              </div>
            </label>
            <label>
              <span>Nouveau mot de passe</span>
              <div class="auth-password-field">
                <input v-model="passwordForm.nouveauMotDePasse" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" required />
                <button type="button" class="auth-password-toggle" @click="showNewPassword = !showNewPassword">{{ showNewPassword ? "Masquer" : "Voir" }}</button>
              </div>
            </label>
            <label>
              <span>Confirmer le nouveau mot de passe</span>
              <div class="auth-password-field">
                <input v-model="passwordForm.confirmation" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" required />
                <button type="button" class="auth-password-toggle" @click="showConfirmPassword = !showConfirmPassword">{{ showConfirmPassword ? "Masquer" : "Voir" }}</button>
              </div>
              <small v-if="passwordMismatch" class="account-field-error">Les deux nouveaux mots de passe ne correspondent pas.</small>
            </label>
            <ul class="account-password-hints">
              <li v-for="hint in PASSWORD_POLICY_HINTS" :key="hint">{{ hint }}</li>
            </ul>
            <button class="action-btn blue" type="submit" :disabled="saving || passwordMismatch || !networkIsOnline">
              {{ saving ? "Traitement..." : "Modifier le mot de passe" }}
            </button>
          </form>
        </article>

        <article class="panel account-card">
          <div class="account-card-head">
            <div>
              <p class="account-eyebrow">SESSIONS</p>
              <h4>Sessions actives</h4>
            </div>
            <span class="status-pill" data-tone="info">{{ security?.activeSessionCount || 0 }} active(s)</span>
          </div>
          <div v-if="!security?.activeSessions?.length" class="helper">Aucune autre session active connue.</div>
          <div v-else class="account-session-list">
            <article v-for="(session, index) in security.activeSessions" :key="`${session.createdAt || 'session'}-${index}`" class="account-session-row">
              <div>
                <strong>{{ session.current ? "Session actuelle" : "Session active" }}</strong>
                <small>Ouverte {{ session.createdAt ? formatDateTime(session.createdAt) : "a une date inconnue" }}</small>
              </div>
              <span v-if="session.current" class="status-pill" data-tone="ok">Cet appareil</span>
            </article>
          </div>
          <button class="mini-btn red" type="button" :disabled="saving || !networkIsOnline || Number(security?.activeSessionCount || 0) <= 1" @click="emit('revoke-sessions')">
            Deconnecter les autres sessions
          </button>
          <p class="helper">Votre session actuelle est conservee. Utilisez cette action si vous avez utilise AtelierPro sur un autre appareil.</p>
        </article>
      </div>

      <div v-else class="account-grid">
        <article class="panel account-card">
          <div class="account-card-head">
            <div>
              <p class="account-eyebrow">DEMARRAGE</p>
              <h4>Navigation personnelle</h4>
            </div>
          </div>
          <form class="account-form" @submit.prevent="submitPreferences">
            <fieldset class="account-choice-group">
              <legend>Au demarrage d'AtelierPro</legend>
              <label
                v-for="option in startupModeOptions"
                :key="option.id"
                class="account-choice-card"
                :class="{ selected: preferenceForm.modeDemarrage === option.id }"
              >
                <input v-model="preferenceForm.modeDemarrage" type="radio" name="startup-mode" :value="option.id" />
                <span>
                  <strong>{{ option.title }}</strong>
                  <small>{{ option.description }}</small>
                </span>
              </label>
            </fieldset>

            <label class="account-home-select" :class="{ muted: preferenceForm.modeDemarrage !== STARTUP_MODES.HOME_PAGE }">
              <span>Page d'accueil</span>
              <select v-model="preferenceForm.pageAccueil" :disabled="preferenceForm.modeDemarrage !== STARTUP_MODES.HOME_PAGE">
                <option v-for="option in homeRouteOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
              <small v-if="preferenceForm.modeDemarrage === STARTUP_MODES.HOME_PAGE">Cette page sera ouverte a chaque connexion si votre role y a acces.</small>
              <small v-else>Cette page reste votre solution de repli si la derniere page n'est plus accessible.</small>
            </label>

            <fieldset class="account-choice-group account-theme-group">
              <legend>Apparence</legend>
              <div class="account-theme-options">
                <label
                  v-for="option in themeOptions"
                  :key="option.id"
                  class="account-theme-card"
                  :class="{ selected: preferenceForm.theme === option.id }"
                >
                  <input v-model="preferenceForm.theme" type="radio" name="theme" :value="option.id" />
                  <span class="account-theme-preview" :data-preview="option.preview" aria-hidden="true">
                    <span></span><span></span><span></span>
                  </span>
                  <span class="account-theme-copy">
                    <strong>{{ option.title }}</strong>
                    <small>{{ option.description }}</small>
                  </span>
                </label>
              </div>
            </fieldset>

            <button class="action-btn blue" type="submit" :disabled="saving || !networkIsOnline">
              {{ saving ? "Enregistrement..." : "Enregistrer mes preferences" }}
            </button>
          </form>
        </article>

        <article class="panel account-card account-guidance-card">
          <p class="account-eyebrow">PRINCIPE</p>
          <h4>Vos preferences restent personnelles</h4>
          <p>Ces choix ne modifient ni les parametres de l'atelier, ni les droits des autres utilisateurs.</p>
          <div class="account-guidance-points">
            <span>✓ Roles et permissions proteges</span>
            <span>✓ Preferences rattachees a votre compte</span>
            <span>✓ Navigation adaptee a vos acces</span>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.account-page {
  display: grid;
  gap: 16px;
  padding-bottom: 28px;
}

.account-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border-radius: 26px;
  border: 1px solid rgba(195, 209, 226, 0.9);
  background:
    radial-gradient(circle at top right, rgba(31, 90, 162, 0.12), transparent 36%),
    linear-gradient(145deg, #ffffff 0%, #f3f7fc 100%);
  box-shadow: 0 18px 46px rgba(18, 44, 76, 0.1);
}

.account-avatar {
  width: 64px;
  height: 64px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #244d7f, #17375e);
  color: white;
  font-size: 1.2rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  box-shadow: 0 10px 24px rgba(31, 90, 162, 0.22);
}

.account-hero-copy { min-width: 0; }
.account-hero-copy h3 { margin: 2px 0 4px; font-size: 1.55rem; }
.account-hero-copy > p:not(.account-eyebrow) { color: var(--muted); overflow-wrap: anywhere; }
.account-eyebrow { color: var(--blue); font-size: 0.72rem; font-weight: 900; letter-spacing: 0.12em; }
.account-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

.account-tabs {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--stroke);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  overflow-x: auto;
}
.account-tabs button {
  border: 0;
  border-radius: 10px;
  padding: 9px 14px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}
.account-tabs button.active { background: #244d7f; color: white; box-shadow: 0 6px 16px rgba(31, 90, 162, 0.18); }

.account-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 16px; align-items: start; }
.account-card { display: grid; gap: 18px; }
.account-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.account-card-head h4 { margin-top: 3px; font-size: 1.08rem; }
.account-form { display: grid; gap: 14px; }
.account-form label { display: grid; gap: 7px; font-weight: 800; color: var(--text); }
.account-form input,
.account-form select {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--stroke);
  border-radius: 12px;
  padding: 10px 12px;
  background: white;
  color: var(--text);
  font: inherit;
}
.account-form small,
.account-session-row small { color: var(--muted); font-weight: 500; line-height: 1.45; }
.account-form .action-btn { width: fit-content; min-width: 190px; justify-content: center; }
.account-facts { display: grid; gap: 10px; }
.account-facts div { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(205, 213, 225, 0.72); }
.account-facts dt { color: var(--muted); }
.account-facts dd { font-weight: 900; text-align: right; overflow-wrap: anywhere; }
.account-session-list { display: grid; gap: 8px; }
.account-session-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px; border-radius: 14px; border: 1px solid rgba(205, 213, 225, 0.8); background: #f8fafc; }
.account-session-row > div { display: grid; gap: 3px; }
.account-password-hints { padding-left: 18px; color: var(--muted); font-size: 0.86rem; line-height: 1.55; }
.account-field-error { color: #a63f34 !important; }
.account-success { padding: 11px 14px; border-radius: 12px; background: #edf8f0; color: #256f3f; border: 1px solid rgba(47, 153, 82, 0.22); font-weight: 800; }
.account-offline-note { margin: 0; padding: 11px 14px; border-radius: 12px; background: #fff8e8; color: #7a5b16; border: 1px solid rgba(202, 148, 35, 0.26); font-weight: 750; line-height: 1.45; }
.account-loading { display: flex; align-items: center; gap: 10px; }
.account-choice-group { display: grid; gap: 9px; padding: 0; border: 0; min-width: 0; }
.account-choice-group legend { margin-bottom: 8px; color: var(--text); font-weight: 900; }
.account-choice-card {
  grid-template-columns: auto minmax(0, 1fr) !important;
  align-items: start;
  padding: 13px;
  border: 1px solid var(--stroke);
  border-radius: 14px;
  background: var(--surface-soft, #f8fafc);
  cursor: pointer;
  transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.account-choice-card:hover { border-color: rgba(31, 90, 162, .45); }
.account-choice-card.selected { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(31, 90, 162, .1); }
.account-choice-card input { width: 18px; min-height: 18px; margin-top: 2px; accent-color: var(--blue); }
.account-choice-card > span { display: grid; gap: 3px; }
.account-home-select.muted { opacity: .72; }
.account-theme-group { margin-top: 3px; }
.account-theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.account-theme-card {
  display: grid !important;
  grid-template-columns: auto 1fr;
  gap: 9px !important;
  align-items: start;
  padding: 11px;
  border: 1px solid var(--stroke);
  border-radius: 14px;
  background: var(--surface-soft, #f8fafc);
  cursor: pointer;
}
.account-theme-card.selected { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(31, 90, 162, .1); }
.account-theme-card > input { width: 17px; min-height: 17px; margin-top: 3px; accent-color: var(--blue); }
.account-theme-preview {
  grid-column: 1 / -1;
  height: 68px;
  display: grid;
  grid-template-columns: 28% 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 5px;
  padding: 8px;
  border-radius: 11px;
  border: 1px solid rgba(110, 126, 147, .22);
  overflow: hidden;
}
.account-theme-preview > span:first-child { grid-row: 1 / -1; border-radius: 6px; }
.account-theme-preview > span:nth-child(2),
.account-theme-preview > span:nth-child(3) { border-radius: 6px; }
.account-theme-preview[data-preview="light"] { background: #eef2f7; }
.account-theme-preview[data-preview="light"] > span:first-child { background: #294b72; }
.account-theme-preview[data-preview="light"] > span:not(:first-child) { background: #ffffff; }
.account-theme-preview[data-preview="dark"] { background: #111827; }
.account-theme-preview[data-preview="dark"] > span:first-child { background: #1f3554; }
.account-theme-preview[data-preview="dark"] > span:not(:first-child) { background: #273449; }
.account-theme-preview[data-preview="system"] { background: linear-gradient(90deg, #eef2f7 0 50%, #111827 50% 100%); }
.account-theme-preview[data-preview="system"] > span:first-child { background: linear-gradient(90deg, #294b72 0 50%, #1f3554 50% 100%); }
.account-theme-preview[data-preview="system"] > span:not(:first-child) { background: linear-gradient(90deg, #ffffff 0 50%, #273449 50% 100%); }
.account-theme-copy { grid-column: 1 / -1; display: grid; gap: 3px; }
.account-guidance-card { background: linear-gradient(145deg, #17375e 0%, #244d7f 100%); color: white; border: 0; }
.account-guidance-card .account-eyebrow { color: #c9dcf5; }
.account-guidance-card p:not(.account-eyebrow) { color: rgba(255,255,255,.82); line-height: 1.55; }
.account-guidance-points { display: grid; gap: 9px; color: rgba(255,255,255,.92); font-weight: 700; }

@media (max-width: 900px) {
  .account-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .account-page { gap: 12px; }
  .account-hero { grid-template-columns: auto 1fr; padding: 16px; border-radius: 20px; }
  .account-hero > .mini-btn { grid-column: 1 / -1; width: 100%; }
  .account-avatar { width: 52px; height: 52px; border-radius: 18px; }
  .account-tabs { width: 100%; }
  .account-tabs button { flex: 1 0 auto; }
  .account-form .action-btn { width: 100%; }
  .account-theme-options { grid-template-columns: 1fr; }
  .account-theme-card { grid-template-columns: auto 84px minmax(0, 1fr); align-items: center; }
  .account-theme-preview { grid-column: auto; width: 84px; height: 52px; }
  .account-theme-copy { grid-column: auto; }
}
</style>
