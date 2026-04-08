<script setup>
import { computed, ref, watch } from "vue";

function formatActivityAction(value) {
  const key = String(value || "").trim().toUpperCase();
  const labels = {
    SYSTEM_ATELIER_CREATED: "Atelier cree",
    SYSTEM_ATELIER_ACTIVATED: "Atelier reactive",
    SYSTEM_ATELIER_DEACTIVATED: "Atelier desactive",
    SYSTEM_USER_REACTIVATED: "Utilisateur reactive",
    SYSTEM_USER_PROMOTED_TO_OWNER: "Promotion en proprietaire",
    SYSTEM_OWNER_DEMOTED: "Retrogradation proprietaire",
    SYSTEM_OWNER_CREATED: "Proprietaire cree",
    CREER_COMMANDE: "Commande creee",
    TERMINER_COMMANDE: "Commande terminee",
    PAYER_COMMANDE: "Paiement commande",
    LIVRER_COMMANDE: "Commande livree",
    ANNULER_COMMANDE: "Commande annulee",
    CREER_RETOUCHE: "Retouche creee",
    TERMINER_RETOUCHE: "Retouche terminee",
    PAYER_RETOUCHE: "Paiement retouche",
    LIVRER_RETOUCHE: "Retouche livree",
    ANNULER_RETOUCHE: "Retouche annulee",
    OUVRIR_CAISSE: "Caisse ouverte",
    CLOTURER_CAISSE: "Caisse cloturee"
  };
  if (labels[key]) return labels[key];
  return key ? key.replace(/_/g, " ").toLowerCase() : "Activite";
}

function formatActivityEntity(value) {
  const key = String(value || "").trim().toUpperCase();
  const labels = {
    COMMANDE: "Commande",
    RETOUCHE: "Retouche",
    CAISSE_JOUR: "Caisse",
    "SYSTEM/ATELIERS": "Administration systeme",
    "SYSTEM/ATELIERS/UTILISATEURS/ROLE": "Recuperation atelier",
    "SYSTEM/ATELIERS/UTILISATEURS/REACTIVATION": "Recuperation atelier",
    "SYSTEM/ATELIERS/PROPRIETAIRES": "Recuperation atelier"
  };
  return labels[key] || String(value || "Activite");
}

function activityActor(row) {
  return row?.utilisateurNom || row?.payload?.utilisateurNom || row?.utilisateurEmail || row?.utilisateurId || "Systeme";
}

function healthSignalLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "warning") return "Attention";
  if (key === "ok") return "Stable";
  return "A surveiller";
}

function recoveryUsers(detail, predicate) {
  const users = Array.isArray(detail?.utilisateurs) ? detail.utilisateurs : [];
  return users.filter((user) => (typeof predicate === "function" ? predicate(user) : true));
}

const props = defineProps({
  selectedAtelierId: { type: String, default: "" },
  detail: { type: Object, default: null },
  detailLoading: { type: Boolean, default: false },
  detailError: { type: String, default: "" },
  actionId: { type: String, default: "" },
  ownerActionKey: { type: String, default: "" },
  ownerActionError: { type: String, default: "" },
  recoveryActionKey: { type: String, default: "" },
  recoveryActionError: { type: String, default: "" },
  formatDateTime: { type: Function, required: true },
  buildPhoneHref: { type: Function, required: true },
  buildWhatsAppHref: { type: Function, required: true }
});

const emit = defineEmits([
  "back",
  "refresh",
  "toggle-activation",
  "toggle-owner-activation",
  "update-owner-contact",
  "reset-owner-password",
  "revoke-owner-sessions",
  "promote-user-to-owner",
  "reactivate-user",
  "create-owner",
  "demote-owner"
]);

const recoveryExpanded = ref(false);
const activityExpanded = ref(false);

const detailUsers = computed(() => (Array.isArray(props.detail?.utilisateurs) ? props.detail.utilisateurs : []));
const recoveryOwnersCount = computed(() => recoveryUsers(props.detail, (user) => user.roleId === "PROPRIETAIRE").length);
const recoveryInactiveUsersCount = computed(() =>
  recoveryUsers(props.detail, (user) => user.actif !== true || user.etatCompte !== "ACTIVE").length
);
const recentActivity = computed(() => (Array.isArray(props.detail?.recentActivity) ? props.detail.recentActivity : []));
const hiddenRecentActivityCount = computed(() => Math.max(0, recentActivity.value.length - 5));
const visibleRecentActivity = computed(() => (activityExpanded.value ? recentActivity.value : recentActivity.value.slice(0, 5)));

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

watch(
  () => props.detail?.idAtelier,
  () => {
    recoveryExpanded.value = false;
    activityExpanded.value = false;
  }
);

watch(
  () => props.recoveryActionError,
  (value) => {
    if (value) recoveryExpanded.value = true;
  }
);

watch(
  () => props.recoveryActionKey,
  (value) => {
    if (value) recoveryExpanded.value = true;
  }
);
</script>

<template>
  <section class="commande-detail">
    <article class="panel panel-header detail-header">
      <div>
        <h3>Detail atelier</h3>
        <p class="helper">{{ detail?.idAtelier || selectedAtelierId || "-" }}</p>
      </div>
      <div class="row-actions">
        <button class="mini-btn" @click="emit('back')">Retour</button>
        <button class="mini-btn" :disabled="detailLoading || !selectedAtelierId" @click="emit('refresh')">
          {{ detailLoading ? "Chargement..." : "Actualiser" }}
        </button>
        <button
          v-if="detail"
          class="mini-btn"
          :disabled="actionId === detail.idAtelier"
          @click="emit('toggle-activation', detail)"
        >
          {{
            actionId === detail.idAtelier
              ? "Traitement..."
              : detail.actif
                ? "Desactiver"
                : "Reactiver"
          }}
        </button>
      </div>
    </article>

    <article class="panel system-atelier-detail">
      <p v-if="detailLoading" class="helper">Chargement du detail atelier...</p>
      <p v-else-if="detailError" class="auth-error">{{ detailError }}</p>
      <p v-else-if="!detail" class="helper">Aucun detail atelier disponible.</p>

      <template v-else>
        <div class="system-atelier-detail-grid">
          <div>
            <span class="helper">Nom</span>
            <strong>{{ detail.nom }}</strong>
          </div>
          <div>
            <span class="helper">Statut</span>
            <strong>{{ detail.actif ? "Actif" : "Inactif" }}</strong>
          </div>
          <div>
            <span class="helper">Slug</span>
            <strong>{{ detail.slug }}</strong>
          </div>
          <div>
            <span class="helper">Date creation</span>
            <strong>{{ formatDateTime(detail.createdAt) }}</strong>
          </div>
          <div>
            <span class="helper">Derniere mise a jour</span>
            <strong>{{ formatDateTime(detail.updatedAt) }}</strong>
          </div>
          <div>
            <span class="helper">Proprietaire</span>
            <strong>{{ detail.proprietaire?.nom || "Non initialise" }}</strong>
            <span class="helper" v-if="detail.proprietaire?.email">{{ detail.proprietaire.email }}</span>
            <span class="helper" v-if="detail.proprietaire?.etatCompte">Compte {{ detail.proprietaire.etatCompte }}</span>
          </div>
          <div>
            <span class="helper">Utilisateurs total</span>
            <strong>{{ detail.stats?.totalUtilisateurs ?? 0 }}</strong>
          </div>
          <div>
            <span class="helper">Utilisateurs actifs</span>
            <strong>{{ detail.stats?.utilisateursActifs ?? 0 }}</strong>
          </div>
          <div>
            <span class="helper">Utilisateurs inactifs</span>
            <strong>{{ detail.stats?.utilisateursInactifs ?? 0 }}</strong>
          </div>
        </div>

        <div v-if="detail.health" class="system-atelier-health" :data-signal="detail.health.signal || 'idle'">
          <div class="system-atelier-health-head">
            <h4>Sante atelier</h4>
            <span class="status-pill" :data-tone="detail.health.signal === 'warning' ? 'due' : 'ok'">
              {{ healthSignalLabel(detail.health.signal) }}
            </span>
          </div>
          <p class="helper">{{ detail.health.message || "Aucun indicateur de sante disponible." }}</p>
          <div class="system-atelier-health-grid">
            <div>
              <span class="helper">Dernier evenement</span>
              <strong>{{ detail.health.lastEventAt ? formatDateTime(detail.health.lastEventAt) : "Aucun" }}</strong>
            </div>
            <div>
              <span class="helper">Evenements 7 jours</span>
              <strong>{{ detail.health.eventsLast7Days ?? 0 }}</strong>
            </div>
            <div>
              <span class="helper">Evenements 30 jours</span>
              <strong>{{ detail.health.eventsLast30Days ?? 0 }}</strong>
            </div>
          </div>
        </div>

        <div v-if="detail.proprietaire" class="system-owner-admin">
          <div class="system-owner-admin-head">
            <div>
              <h4>Administration proprietaire</h4>
              <p class="helper">{{ detail.proprietaire.nom || "Proprietaire" }} <span v-if="detail.proprietaire.email">/ {{ detail.proprietaire.email }}</span></p>
            </div>
            <span class="status-pill" :data-tone="detail.proprietaire.actif ? 'ok' : 'due'">
              {{ detail.proprietaire.actif ? "Compte actif" : "Compte inactif" }}
            </span>
          </div>

          <div class="system-owner-admin-grid">
            <div>
              <span class="helper">Etat du compte</span>
              <strong>{{ detail.proprietaire.etatCompte || "ACTIVE" }}</strong>
            </div>
            <div>
              <span class="helper">Telephone</span>
              <strong>{{ detail.proprietaire.telephone || "Non renseigne" }}</strong>
            </div>
            <div>
              <span class="helper">Sessions actives</span>
              <strong>{{ detail.proprietaire.sessions?.totalActives ?? 0 }}</strong>
            </div>
            <div>
              <span class="helper">Derniere session connue</span>
              <strong>{{ detail.proprietaire.sessions?.lastSessionAt ? formatDateTime(detail.proprietaire.sessions.lastSessionAt) : "Aucune" }}</strong>
            </div>
          </div>

          <div class="row-actions">
            <button class="mini-btn" :disabled="ownerActionKey === 'contact'" @click="emit('update-owner-contact')">
              {{ ownerActionKey === "contact" ? "Traitement..." : "Modifier le telephone" }}
            </button>
            <a v-if="safeBuildPhoneHref(detail.proprietaire.telephone)" class="mini-btn blue" :href="safeBuildPhoneHref(detail.proprietaire.telephone)">Appeler</a>
            <button v-else class="mini-btn blue" type="button" disabled>Appeler</button>
            <a
              v-if="safeBuildWhatsAppHref(detail.proprietaire.telephone)"
              class="mini-btn whatsapp"
              :href="safeBuildWhatsAppHref(detail.proprietaire.telephone)"
              target="_self"
              rel="noopener noreferrer"
              @click="openWhatsAppLink($event, detail.proprietaire.telephone)"
            >
              WhatsApp
            </a>
            <button v-else class="mini-btn whatsapp" type="button" disabled>WhatsApp</button>
            <button class="mini-btn" :disabled="ownerActionKey === 'activation'" @click="emit('toggle-owner-activation')">
              {{
                ownerActionKey === "activation"
                  ? "Traitement..."
                  : detail.proprietaire.actif
                    ? "Desactiver le proprietaire"
                    : "Reactiver le proprietaire"
              }}
            </button>
            <button class="mini-btn" :disabled="ownerActionKey === 'password'" @click="emit('reset-owner-password')">
              {{ ownerActionKey === "password" ? "Traitement..." : "Reinitialiser le mot de passe" }}
            </button>
            <button class="mini-btn" :disabled="ownerActionKey === 'sessions'" @click="emit('revoke-owner-sessions')">
              {{ ownerActionKey === "sessions" ? "Traitement..." : "Couper les sessions" }}
            </button>
          </div>

          <p v-if="ownerActionError" class="auth-error">{{ ownerActionError }}</p>

          <div v-if="Array.isArray(detail.proprietaire.sessions?.recentSessions)" class="system-owner-sessions">
            <div class="detail-panel-header">
              <h4>Sessions recentes</h4>
              <span class="helper">{{ detail.proprietaire.sessions?.recentSessions?.length || 0 }} session(s)</span>
            </div>
            <div v-if="detail.proprietaire.sessions.recentSessions.length === 0" class="helper">
              Aucune session active connue pour ce proprietaire.
            </div>
            <div v-else class="system-owner-session-list">
              <article
                v-for="(session, index) in detail.proprietaire.sessions.recentSessions"
                :key="`${session.createdAt || 'session'}-${index}`"
                class="system-owner-session-item"
              >
                <div>
                  <span class="helper">Ouverture</span>
                  <strong>{{ session.createdAt ? formatDateTime(session.createdAt) : "Inconnue" }}</strong>
                </div>
                <div>
                  <span class="helper">Expiration</span>
                  <strong>{{ session.expiresAt ? formatDateTime(session.expiresAt) : "Inconnue" }}</strong>
                </div>
              </article>
            </div>
          </div>
        </div>

        <div class="system-recovery-admin">
          <div class="system-owner-admin-head">
            <div>
              <h4>Recuperation atelier</h4>
              <p class="helper">Secours minimal pour reprendre la main sur l'atelier sans quitter ce detail.</p>
            </div>
            <div class="row-actions">
              <span class="status-pill" data-tone="ok">Manager systeme</span>
              <button class="mini-btn" @click="recoveryExpanded = !recoveryExpanded">
                {{ recoveryExpanded ? "Masquer" : "Afficher" }}
              </button>
            </div>
          </div>

          <div class="system-owner-admin-grid">
            <div>
              <span class="helper">Utilisateurs atelier</span>
              <strong>{{ detailUsers.length }}</strong>
            </div>
            <div>
              <span class="helper">Proprietaires</span>
              <strong>{{ recoveryOwnersCount }}</strong>
            </div>
            <div>
              <span class="helper">Utilisateurs inactifs</span>
              <strong>{{ recoveryInactiveUsersCount }}</strong>
            </div>
          </div>

          <p v-if="!recoveryExpanded" class="helper">Bloc replie par defaut pour garder la page d'intervention plus compacte.</p>

          <p v-if="recoveryActionError" class="auth-error">{{ recoveryActionError }}</p>

          <template v-if="recoveryExpanded">
            <div class="row-actions">
              <button class="mini-btn" :disabled="recoveryActionKey === 'promote'" @click="emit('promote-user-to-owner')">
                {{ recoveryActionKey === "promote" ? "Traitement..." : "Promouvoir en proprietaire" }}
              </button>
              <button class="mini-btn" :disabled="recoveryActionKey === 'reactivate'" @click="emit('reactivate-user')">
                {{ recoveryActionKey === "reactivate" ? "Traitement..." : "Reactiver un utilisateur" }}
              </button>
              <button class="mini-btn" :disabled="recoveryActionKey === 'create-owner'" @click="emit('create-owner')">
                {{ recoveryActionKey === "create-owner" ? "Traitement..." : "Creer un proprietaire" }}
              </button>
              <button class="mini-btn" :disabled="recoveryActionKey === 'demote'" @click="emit('demote-owner')">
                {{ recoveryActionKey === "demote" ? "Traitement..." : "Retrograder un proprietaire" }}
              </button>
            </div>

            <div class="system-recovery-users">
            <div class="detail-panel-header">
              <h4>Utilisateurs atelier</h4>
              <span class="helper">{{ detailUsers.length }} compte(s)</span>
            </div>
            <div v-if="detailUsers.length === 0" class="helper">Aucun utilisateur rattache a cet atelier.</div>
            <div v-else class="system-recovery-user-list">
              <article v-for="user in detailUsers" :key="user.id" class="system-recovery-user-item" :title="user.email || ''">
                <div class="system-recovery-user-name">
                  <strong>{{ user.nom || "Utilisateur" }}</strong>
                </div>
                <div>
                  <span class="helper">Role</span>
                  <strong>{{ user.roleId || "-" }}</strong>
                </div>
                <div>
                  <span class="helper">Statut</span>
                  <strong>{{ user.actif ? user.etatCompte || "ACTIVE" : "DISABLED" }}</strong>
                </div>
              </article>
            </div>
            </div>
          </template>
        </div>

        <div v-if="Array.isArray(detail.recentActivity)" class="system-atelier-activity">
          <div class="detail-panel-header">
            <h4>Activite recente</h4>
            <span class="helper">{{ detail.recentActivity.length }} evenement(s)</span>
          </div>
          <div v-if="recentActivity.length === 0" class="helper">Aucune activite recente pour cet atelier.</div>
          <div v-else class="system-activity-list">
            <article v-for="row in visibleRecentActivity" :key="row.idEvenement" class="system-activity-item">
              <div class="system-activity-main">
                <strong>{{ formatActivityAction(row.action) }}</strong>
                <span class="helper">
                  {{ formatActivityEntity(row.entite) }}
                  <span v-if="row.entiteId"> / {{ row.entiteId }}</span>
                </span>
              </div>
              <div class="system-activity-meta">
                <span>{{ activityActor(row) }}</span>
                <span>{{ formatDateTime(row.dateEvenement) }}</span>
              </div>
            </article>
            <div v-if="hiddenRecentActivityCount > 0" class="row-actions">
              <button class="mini-btn" @click="activityExpanded = !activityExpanded">
                {{
                  activityExpanded
                    ? "Afficher moins"
                    : `Voir ${hiddenRecentActivityCount} evenement(s) de plus`
                }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </article>
  </section>
</template>
