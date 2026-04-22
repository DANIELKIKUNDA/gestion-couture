<script setup>
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  dossierFilters: { type: Object, required: true },
  dossiersFiltered: { type: Array, default: () => [] },
  dossiersPaged: { type: Array, default: () => [] },
  dossierEmptyStateTitle: { type: String, default: "" },
  dossierEmptyStateDescription: { type: String, default: "" },
  formatCurrency: { type: Function, required: true },
  formatDossierLastActivity: { type: Function, required: true },
  dossierPrimarySignal: { type: Function, required: true },
  dossierSummaryLine: { type: Function, required: true },
  openCreateDossierModal: { type: Function, required: true },
  resetDossierFilters: { type: Function, required: true },
  openDossierDetail: { type: Function, required: true },
  dossierInfiniteSentinelRef: { type: Function, required: true }
});
</script>

<template>
  <section class="commandes-page">
    <ResponsiveDataContainer :mobile="isMobileViewport">
      <template #mobile>
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Dossiers"
            title="Centre des operations atelier"
            subtitle="Familles, groupes et operations mixtes commandes + retouches."
          >
            <template #actions>
              <button class="action-btn blue" @click="openCreateDossierModal">Nouveau dossier</button>
            </template>
          </MobileSectionHeader>
        </article>

        <article class="panel stack-form">
          <input v-model="dossierFilters.recherche" type="search" placeholder="Rechercher un responsable, un telephone ou un dossier" />
          <div class="grid-2 dossier-filter-grid">
            <select v-model="dossierFilters.type">
              <option value="ALL">Tous les types</option>
              <option value="INDIVIDUEL">Individuel</option>
              <option value="FAMILLE">Famille</option>
              <option value="GROUPE">Groupe</option>
            </select>
            <select v-model="dossierFilters.statut">
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="SOLDE">Solde</option>
              <option value="CLOTURE">Cloture</option>
            </select>
          </div>
          <div class="row-between dossier-filter-summary">
            <p class="helper">{{ dossiersFiltered.length }} dossier(s) visible(s)</p>
            <button class="mini-btn" type="button" @click="resetDossierFilters">Reinitialiser</button>
          </div>
        </article>

        <div v-if="dossiersPaged.length > 0" class="stack-list">
          <article v-for="dossier in dossiersPaged" :key="dossier.idDossier" class="panel dossier-card" @click="openDossierDetail(dossier.idDossier)">
            <div class="row-between">
              <div>
                <p class="mobile-overline">{{ dossier.typeDossier }}</p>
                <h3>{{ dossier.responsable.nomComplet || dossier.idDossier }}</h3>
                <p class="helper">{{ dossier.responsable.telephone || "Sans telephone" }}</p>
              </div>
              <span class="status-chip">{{ dossier.statutDossier }}</span>
            </div>
            <div class="dossier-card-signal" :data-tone="dossierPrimarySignal(dossier).tone">
              <strong>{{ dossierPrimarySignal(dossier).label }}</strong>
              <span>{{ dossierPrimarySignal(dossier).detail }}</span>
            </div>
            <p class="helper dossier-card-summary">{{ dossierSummaryLine(dossier) }}</p>
            <div class="mobile-kpi-grid dossier-kpis">
              <div class="mobile-kpi dossier-mobile-kpi-card">
                <span>Commandes</span>
                <strong>{{ dossier.totalCommandes }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card">
                <span>Retouches</span>
                <strong>{{ dossier.totalRetouches }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card">
                <span>Total</span>
                <strong class="dossier-value-blue">{{ formatCurrency(dossier.totalMontant) }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card">
                <span>Total paye</span>
                <strong class="dossier-value-green">{{ formatCurrency(dossier.totalPaye) }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card">
                <span>Reste</span>
                <strong class="dossier-value-red">{{ formatCurrency(dossier.soldeRestant) }}</strong>
              </div>
            </div>
            <div class="row-between dossier-card-footer">
              <p class="helper">Activite : {{ formatDossierLastActivity(dossier) }}</p>
              <span class="mini-btn gray">Ouvrir</span>
            </div>
          </article>
        </div>
        <div v-if="dossiersPaged.length > 0 && dossiersPaged.length < dossiersFiltered.length" :ref="dossierInfiniteSentinelRef" class="dossier-infinite-sentinel">
          <span class="helper">Chargement des dossiers suivants...</span>
        </div>
        <article v-else-if="dossiersFiltered.length === 0" class="panel empty-state">
          <h3>{{ dossierEmptyStateTitle }}</h3>
          <p>{{ dossierEmptyStateDescription }}</p>
        </article>
      </template>

      <template #desktop>
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Dossiers"
            title="Centre des operations atelier"
            subtitle="Le dossier devient le point d'entree principal pour les familles, groupes et clients individuels."
          >
            <template #actions>
              <button class="action-btn blue" @click="openCreateDossierModal">Nouveau dossier</button>
            </template>
          </MobileSectionHeader>
        </article>

        <article class="panel">
          <div class="grid-3 dossier-filter-grid">
            <input v-model="dossierFilters.recherche" type="search" placeholder="Rechercher un responsable, un telephone ou un dossier" />
            <select v-model="dossierFilters.type">
              <option value="ALL">Tous les types</option>
              <option value="INDIVIDUEL">Individuel</option>
              <option value="FAMILLE">Famille</option>
              <option value="GROUPE">GROUPE</option>
            </select>
            <select v-model="dossierFilters.statut">
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="SOLDE">Solde</option>
              <option value="CLOTURE">Cloture</option>
            </select>
          </div>
          <div class="row-between dossier-filter-summary">
            <p class="helper">{{ dossiersFiltered.length }} dossier(s) visible(s)</p>
            <button class="mini-btn" type="button" @click="resetDossierFilters">Reinitialiser</button>
          </div>
        </article>

        <div v-if="dossiersPaged.length > 0" class="dossier-grid dossier-grid-desktop">
          <article v-for="dossier in dossiersPaged" :key="dossier.idDossier" class="panel dossier-card dossier-card-desktop" @click="openDossierDetail(dossier.idDossier)">
            <div class="row-between">
              <div>
                <p class="mobile-overline">{{ dossier.typeDossier }}</p>
                <h3>{{ dossier.responsable.nomComplet || dossier.idDossier }}</h3>
                <p class="helper">{{ dossier.responsable.telephone || "Sans telephone" }}</p>
              </div>
              <div class="dossier-badge-stack">
                <span class="status-pill" data-tone="ok">{{ dossier.typeDossier }}</span>
                <span class="status-chip">{{ dossier.statutDossier }}</span>
              </div>
            </div>
            <div class="dossier-card-signal" :data-tone="dossierPrimarySignal(dossier).tone">
              <strong>{{ dossierPrimarySignal(dossier).label }}</strong>
              <span>{{ dossierPrimarySignal(dossier).detail }}</span>
            </div>
            <p class="helper dossier-card-summary">{{ dossierSummaryLine(dossier) }}</p>
            <div class="dossier-workspace-kpi-grid dossier-kpis-desktop">
              <article class="dossier-kpi-card">
                <span>Commandes</span>
                <strong>{{ dossier.totalCommandes }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Retouches</span>
                <strong>{{ dossier.totalRetouches }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Total</span>
                <strong class="dossier-value-blue">{{ formatCurrency(dossier.totalMontant) }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Total paye</span>
                <strong class="dossier-value-green">{{ formatCurrency(dossier.totalPaye) }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Reste</span>
                <strong class="dossier-value-red">{{ formatCurrency(dossier.soldeRestant) }}</strong>
              </article>
            </div>
            <div class="row-between dossier-card-footer">
              <p class="helper">Activite : {{ formatDossierLastActivity(dossier) }}</p>
              <button class="mini-btn" @click.stop="openDossierDetail(dossier.idDossier)">Ouvrir</button>
            </div>
          </article>
        </div>
        <div v-if="dossiersPaged.length > 0 && dossiersPaged.length < dossiersFiltered.length" :ref="dossierInfiniteSentinelRef" class="dossier-infinite-sentinel">
          <span class="helper">Chargement des dossiers suivants...</span>
        </div>
        <article v-else-if="dossiersFiltered.length === 0" class="panel empty-state">
          <h3>{{ dossierEmptyStateTitle }}</h3>
          <p>{{ dossierEmptyStateDescription }}</p>
        </article>
      </template>
    </ResponsiveDataContainer>
  </section>
</template>
