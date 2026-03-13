<script setup>
import { computed } from "vue";

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  search: { type: String, default: "" },
  statusFilter: { type: String, default: "ALL" },
  sortOption: { type: String, default: "createdAt_desc" },
  stats: {
    type: Object,
    default: () => ({ total: 0, actifs: 0, inactifs: 0, utilisateurs: 0 })
  },
  ateliers: { type: Array, default: () => [] },
  filteredCount: { type: Number, default: 0 },
  actionId: { type: String, default: "" },
  selectedAtelierId: { type: String, default: "" },
  page: { type: Number, default: 1 },
  pages: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  formatDateTime: { type: Function, required: true }
});

const emit = defineEmits([
  "refresh",
  "open-create",
  "toggle-activation",
  "open-detail",
  "update-search",
  "update-status-filter",
  "update-sort-option",
  "update-page-size",
  "prev-page",
  "next-page"
]);

const emptyMessage = computed(() => {
  if (props.loading) return "Chargement des ateliers...";
  if (String(props.search || "").trim() || props.statusFilter !== "ALL") return "Aucun atelier ne correspond aux filtres.";
  return "Aucun atelier n'a encore ete provisionne.";
});

function updateSearch(value) {
  emit("update-search", value);
}

function updateStatusFilter(value) {
  emit("update-status-filter", value);
}

function updateSortOption(value) {
  emit("update-sort-option", value);
}

function updatePageSize(value) {
  emit("update-page-size", Number(value));
}

const pageSummary = computed(() => {
  if (props.filteredCount <= 0 || props.ateliers.length === 0) {
    return "Affichage 0-0";
  }
  const start = (props.page - 1) * props.pageSize + 1;
  const end = Math.min(start + props.ateliers.length - 1, props.filteredCount);
  return `Affichage ${start}-${end}`;
});
</script>

<template>
  <section class="dashboard system-admin-page">
    <article class="panel panel-header">
      <div>
        <h3>Ateliers</h3>
        <p class="helper">Creation, activation et supervision des tenants actifs.</p>
      </div>
      <div class="row-actions">
        <button class="mini-btn" @click="emit('refresh')" :disabled="loading">
          {{ loading ? "Actualisation..." : "Actualiser la liste" }}
        </button>
        <button class="action-btn blue" @click="emit('open-create')">Creer un atelier</button>
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

    <article class="panel">
      <div class="panel-header system-ateliers-toolbar">
        <div>
          <h3>Registre multi-tenant</h3>
          <p class="helper">Recherche par nom, slug, identifiant ou proprietaire.</p>
        </div>
        <div class="system-ateliers-toolbar-actions">
          <input
            :value="search"
            class="system-ateliers-search"
            type="search"
            placeholder="Rechercher un atelier"
            @input="updateSearch($event.target.value)"
          />
          <select :value="statusFilter" @change="updateStatusFilter($event.target.value)">
            <option value="ALL">Tous statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="INACTIVE">Inactifs</option>
          </select>
          <select :value="sortOption" @change="updateSortOption($event.target.value)">
            <option value="createdAt_desc">Plus recents</option>
            <option value="createdAt_asc">Plus anciens</option>
            <option value="nom_asc">Nom A-Z</option>
            <option value="nom_desc">Nom Z-A</option>
            <option value="slug_asc">Slug A-Z</option>
            <option value="slug_desc">Slug Z-A</option>
            <option value="utilisateurs_desc">Utilisateurs decroissant</option>
            <option value="utilisateurs_asc">Utilisateurs croissant</option>
          </select>
        </div>
      </div>

      <p v-if="loading" class="helper system-ateliers-state">Synchronisation du registre en cours...</p>
      <p v-if="error" class="auth-error">{{ error }}</p>

      <div class="table-scroll-x system-ateliers-table-wrap">
        <table class="data-table system-ateliers-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Slug</th>
              <th>Statut</th>
              <th>Proprietaire</th>
              <th>Utilisateurs</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="atelier in ateliers" :key="atelier.idAtelier" :class="{ selected: selectedAtelierId === atelier.idAtelier }">
              <td>
                <strong>{{ atelier.nom }}</strong>
                <div class="helper">{{ atelier.idAtelier }}</div>
              </td>
              <td><code>{{ atelier.slug }}</code></td>
              <td>
                <span class="status-pill" :data-tone="atelier.actif ? 'ok' : 'due'">
                  {{ atelier.actif ? "Actif" : "Inactif" }}
                </span>
              </td>
              <td>
                <template v-if="atelier.proprietaire">
                  <div>{{ atelier.proprietaire.nom || "Proprietaire" }}</div>
                  <small class="helper">{{ atelier.proprietaire.email }}</small>
                </template>
                <span v-else class="helper">Non initialise</span>
              </td>
              <td>{{ atelier.nombreUtilisateurs }}</td>
              <td>{{ formatDateTime(atelier.createdAt) }}</td>
              <td class="row-actions">
                <button
                  class="mini-btn"
                  :disabled="actionId === atelier.idAtelier"
                  @click="emit('toggle-activation', atelier)"
                >
                  {{
                    actionId === atelier.idAtelier
                      ? "Traitement..."
                      : atelier.actif
                        ? "Desactiver"
                        : "Reactiver"
                  }}
                </button>
                <button class="mini-btn" @click="emit('open-detail', atelier)">Voir detail</button>
              </td>
            </tr>
            <tr v-if="filteredCount === 0">
              <td colspan="7">{{ emptyMessage }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="system-ateliers-cards">
        <article
          v-for="atelier in ateliers"
          :key="`${atelier.idAtelier}-card`"
          class="panel system-atelier-card"
          :class="{ selected: selectedAtelierId === atelier.idAtelier }"
        >
          <div class="system-atelier-card-head">
            <div>
              <h4>{{ atelier.nom }}</h4>
              <p class="helper">{{ atelier.idAtelier }}</p>
            </div>
            <span class="status-pill" :data-tone="atelier.actif ? 'ok' : 'due'">
              {{ atelier.actif ? "Actif" : "Inactif" }}
            </span>
          </div>
          <div class="system-atelier-card-grid">
            <div>
              <span class="helper">Slug</span>
              <strong>{{ atelier.slug }}</strong>
            </div>
            <div>
              <span class="helper">Utilisateurs</span>
              <strong>{{ atelier.nombreUtilisateurs }}</strong>
            </div>
            <div>
              <span class="helper">Proprietaire</span>
              <strong>{{ atelier.proprietaire?.nom || "Non initialise" }}</strong>
              <span class="helper" v-if="atelier.proprietaire?.email">{{ atelier.proprietaire.email }}</span>
            </div>
            <div>
              <span class="helper">Date</span>
              <strong>{{ formatDateTime(atelier.createdAt) }}</strong>
            </div>
          </div>
          <div class="row-actions">
            <button
              class="mini-btn"
              :disabled="actionId === atelier.idAtelier"
              @click="emit('toggle-activation', atelier)"
            >
              {{
                actionId === atelier.idAtelier
                  ? "Traitement..."
                  : atelier.actif
                    ? "Desactiver"
                    : "Reactiver"
              }}
            </button>
            <button class="mini-btn" @click="emit('open-detail', atelier)">Voir detail</button>
          </div>
        </article>
        <article v-if="filteredCount === 0" class="panel system-ateliers-empty">
          <p class="helper">{{ emptyMessage }}</p>
        </article>
      </div>

      <div class="panel-footer table-pagination">
        <select :value="pageSize" @change="updatePageSize($event.target.value)">
          <option :value="10">10 / page</option>
          <option :value="20">20 / page</option>
          <option :value="50">50 / page</option>
        </select>
        <button class="mini-btn" :disabled="loading || page <= 1" @click="emit('prev-page')">Precedent</button>
        <span>Page {{ page }} / {{ pages }} | {{ pageSummary }} sur {{ filteredCount }} atelier(s)</span>
        <button class="mini-btn" :disabled="loading || page >= pages" @click="emit('next-page')">Suivant</button>
      </div>
    </article>
  </section>
</template>
