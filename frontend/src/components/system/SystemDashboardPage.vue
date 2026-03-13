<script setup>
import SystemOverviewPanel from "./SystemOverviewPanel.vue";

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  overview: {
    type: Object,
    default: () => ({
      summary: {},
      alerts: [],
      recentAteliers: []
    })
  },
  stats: {
    type: Object,
    default: () => ({ total: 0, actifs: 0, inactifs: 0, utilisateurs: 0 })
  },
  formatDateTime: { type: Function, required: true }
});

const emit = defineEmits(["refresh"]);
</script>

<template>
  <section class="dashboard system-admin-page">
    <article class="panel panel-header">
      <div>
        <h3>Vue globale</h3>
        <p class="helper">Pilotage systeme, alertes prioritaires et derniers ateliers provisionnes.</p>
      </div>
      <div class="row-actions">
        <button class="mini-btn" @click="emit('refresh')" :disabled="loading">
          {{ loading ? "Actualisation..." : "Actualiser la vue" }}
        </button>
      </div>
    </article>

    <div class="kpi-grid legacy-kpi-grid">
      <article class="kpi-card legacy-kpi" data-tone="blue">
        <div class="kpi-head"><span>Ateliers</span></div>
        <strong>{{ stats.total }}</strong>
      </article>
      <article class="kpi-card legacy-kpi" data-tone="green">
        <div class="kpi-head"><span>Actifs</span></div>
        <strong>{{ stats.actifs }}</strong>
      </article>
      <article class="kpi-card legacy-kpi" data-tone="amber">
        <div class="kpi-head"><span>Inactifs</span></div>
        <strong>{{ stats.inactifs }}</strong>
      </article>
      <article class="kpi-card legacy-kpi" data-tone="teal">
        <div class="kpi-head"><span>Utilisateurs</span></div>
        <strong>{{ stats.utilisateurs }}</strong>
      </article>
    </div>

    <SystemOverviewPanel
      :loading="loading"
      :error="error"
      :overview="overview"
      :format-date-time="formatDateTime"
    />
  </section>
</template>
