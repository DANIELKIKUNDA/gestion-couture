<script setup>
import { computed } from "vue";

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  overview: {
    type: Object,
    default: () => ({
      summary: {
        nouveaux7J: 0,
        nouveaux30J: 0,
        ateliersActifsAvecActivite7J: 0,
        sansProprietaire: 0,
        proprietairesInactifs: 0,
        sansUtilisateur: 0
      },
      alerts: [],
      recentAteliers: []
    })
  },
  formatDateTime: { type: Function, required: true }
});

const spotlightCards = computed(() => [
  {
    label: "Nouveaux 7 jours",
    value: Number(props.overview?.summary?.nouveaux7J || 0),
    tone: "blue"
  },
  {
    label: "Actifs avec activite 7 jours",
    value: Number(props.overview?.summary?.ateliersActifsAvecActivite7J || 0),
    tone: "green"
  },
  {
    label: "Sans proprietaire",
    value: Number(props.overview?.summary?.sansProprietaire || 0),
    tone: "amber"
  },
  {
    label: "Proprietaires inactifs",
    value: Number(props.overview?.summary?.proprietairesInactifs || 0),
    tone: "slate"
  }
]);

function alertTone(value) {
  return String(value || "").trim().toLowerCase() === "warning" ? "due" : "blue";
}
</script>

<template>
  <div class="system-overview-stack">
    <article class="panel">
      <div class="panel-header">
        <div>
          <h3>Vue globale systeme</h3>
          <p class="helper">Signaux consolides pour piloter les ateliers sans ouvrir chaque fiche.</p>
        </div>
        <span class="helper">{{ loading ? "Actualisation..." : "Lecture seule" }}</span>
      </div>

      <p v-if="error" class="auth-error">{{ error }}</p>

      <div class="kpi-grid legacy-kpi-grid system-overview-grid">
        <article v-for="card in spotlightCards" :key="card.label" class="kpi-card legacy-kpi" :data-tone="card.tone">
          <div class="kpi-head"><span>{{ card.label }}</span></div>
          <strong>{{ card.value }}</strong>
        </article>
      </div>

      <div class="system-overview-summary-line">
        <span class="helper">Nouveaux 30 jours: <strong>{{ Number(overview?.summary?.nouveaux30J || 0) }}</strong></span>
        <span class="helper">Sans utilisateur: <strong>{{ Number(overview?.summary?.sansUtilisateur || 0) }}</strong></span>
      </div>
    </article>

    <div class="system-overview-columns">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h3>Alertes prioritaires</h3>
            <p class="helper">Les points qui demandent une verification rapide.</p>
          </div>
          <span class="helper">{{ Array.isArray(overview?.alerts) ? overview.alerts.length : 0 }} alerte(s)</span>
        </div>

        <div v-if="!overview?.alerts?.length" class="helper">Aucune alerte prioritaire pour le moment.</div>
        <div v-else class="system-alert-list">
          <article v-for="alert in overview.alerts" :key="`${alert.code}-${alert.atelierId}`" class="system-alert-item">
            <span class="status-pill" :data-tone="alertTone(alert.severity)">
              {{ alert.severity === "warning" ? "Attention" : "Info" }}
            </span>
            <div class="system-alert-body">
              <strong>{{ alert.title }}</strong>
              <p class="helper">{{ alert.description }}</p>
              <span class="helper">{{ alert.atelierNom }} <span v-if="alert.atelierId">/ {{ alert.atelierId }}</span></span>
            </div>
          </article>
        </div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <h3>Ateliers recents</h3>
            <p class="helper">Provisioning et premiers signaux sur les dernieres creations.</p>
          </div>
          <span class="helper">{{ Array.isArray(overview?.recentAteliers) ? overview.recentAteliers.length : 0 }} atelier(s)</span>
        </div>

        <div v-if="!overview?.recentAteliers?.length" class="helper">Aucun atelier recent a afficher.</div>
        <div v-else class="system-recent-list">
          <article v-for="atelier in overview.recentAteliers" :key="atelier.idAtelier" class="system-recent-item">
            <div class="system-recent-head">
              <div>
                <strong>{{ atelier.nom }}</strong>
                <p class="helper">{{ atelier.slug }}</p>
              </div>
              <span class="status-pill" :data-tone="atelier.actif ? 'ok' : 'due'">
                {{ atelier.actif ? "Actif" : "Inactif" }}
              </span>
            </div>
            <div class="system-recent-meta">
              <span class="helper">Cree le {{ formatDateTime(atelier.createdAt) }}</span>
              <span class="helper">Utilisateurs: {{ atelier.nombreUtilisateurs || 0 }}</span>
              <span class="helper">Activite 7 jours: {{ atelier.eventsLast7Days || 0 }}</span>
              <span class="helper">
                Dernier evenement:
                {{ atelier.lastEventAt ? formatDateTime(atelier.lastEventAt) : "Aucun" }}
              </span>
              <span class="helper">
                Proprietaire:
                {{ atelier.proprietaire?.nom || "Non initialise" }}
              </span>
            </div>
          </article>
        </div>
      </article>
    </div>
  </div>
</template>
