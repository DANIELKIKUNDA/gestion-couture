<script setup>
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";
import VoiceButton from "../voice/VoiceButton.vue";

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

const emit = defineEmits(["voice-search"]);

function dossierStatusTone(statut) {
  const value = String(statut || "").trim().toUpperCase();
  if (value === "ACTIF") return "ok";
  if (value === "SOLDE") return "due";
  if (value === "CLOTURE") return "closed";
  return "neutral";
}

function dossierTypeTone(type) {
  const value = String(type || "").trim().toUpperCase();
  if (value === "INDIVIDUEL") return "blue";
  if (value === "FAMILLE") return "green";
  if (value === "GROUPE") return "violet";
  return "neutral";
}

function dossierKpiTone(key, dossier) {
  if (key === "commandes") return "blue";
  if (key === "retouches") return "violet";
  if (key === "total") return "blue";
  if (key === "paye") return "green";
  if (key === "reste") return Number(dossier?.soldeRestant || 0) > 0 ? "red" : "green";
  return "neutral";
}
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
              <button class="action-btn blue dossier-btn dossier-btn-primary" @click="openCreateDossierModal">Nouveau dossier</button>
            </template>
          </MobileSectionHeader>
        </article>

        <article class="panel stack-form mobile-search-filter-panel mobile-modern-filter-panel">
          <div class="mobile-search-shell">
            <span class="mobile-search-shell__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input v-model="dossierFilters.recherche" type="search" placeholder="Nom, telephone ou dossier" />
            <VoiceButton compact label="Rechercher" title="Recherche vocale" @result="emit('voice-search', $event)" />
          </div>
          <div class="mobile-filter-chip-row" aria-label="Statut du dossier">
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'ALL' }" type="button" @click="dossierFilters.statut = 'ALL'">Tous</button>
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'ACTIF' }" type="button" @click="dossierFilters.statut = 'ACTIF'">Actifs</button>
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'SOLDE' }" type="button" @click="dossierFilters.statut = 'SOLDE'">Soldes</button>
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'CLOTURE' }" type="button" @click="dossierFilters.statut = 'CLOTURE'">Clotures</button>
          </div>
          <div class="mobile-filter-chip-row mobile-filter-chip-row-secondary" aria-label="Type du dossier">
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'ALL' }" type="button" @click="dossierFilters.type = 'ALL'">Tous types</button>
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'INDIVIDUEL' }" type="button" @click="dossierFilters.type = 'INDIVIDUEL'">Individuel</button>
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'FAMILLE' }" type="button" @click="dossierFilters.type = 'FAMILLE'">Famille</button>
            <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'GROUPE' }" type="button" @click="dossierFilters.type = 'GROUPE'">Groupe</button>
          </div>
          <div class="row-between dossier-filter-summary mobile-search-filter-summary">
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
              <div class="dossier-badge-stack">
                <span class="status-pill" :data-tone="dossierTypeTone(dossier.typeDossier)">{{ dossier.typeDossier }}</span>
                <span class="status-pill" :data-tone="dossierStatusTone(dossier.statutDossier)">{{ dossier.statutDossier }}</span>
              </div>
            </div>
            <div class="dossier-card-signal" :data-tone="dossierPrimarySignal(dossier).tone">
              <strong>{{ dossierPrimarySignal(dossier).label }}</strong>
              <span>{{ dossierPrimarySignal(dossier).detail }}</span>
            </div>
            <p class="helper dossier-card-summary">{{ dossierSummaryLine(dossier) }}</p>
            <div class="mobile-kpi-grid dossier-kpis">
              <div class="mobile-kpi dossier-mobile-kpi-card" :data-tone="dossierKpiTone('commandes', dossier)">
                <span>Commandes</span>
                <strong>{{ dossier.totalCommandes }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card" :data-tone="dossierKpiTone('retouches', dossier)">
                <span>Retouches</span>
                <strong>{{ dossier.totalRetouches }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card" :data-tone="dossierKpiTone('total', dossier)">
                <span>Total</span>
                <strong class="dossier-value-blue">{{ formatCurrency(dossier.totalMontant) }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card" :data-tone="dossierKpiTone('paye', dossier)">
                <span>Total paye</span>
                <strong class="dossier-value-green">{{ formatCurrency(dossier.totalPaye) }}</strong>
              </div>
              <div class="mobile-kpi dossier-mobile-kpi-card" :data-tone="dossierKpiTone('reste', dossier)">
                <span>Reste</span>
                <strong class="dossier-value-red">{{ formatCurrency(dossier.soldeRestant) }}</strong>
              </div>
            </div>
            <div class="row-between dossier-card-footer">
              <p class="helper">Activite : {{ formatDossierLastActivity(dossier) }}</p>
              <span class="mini-btn gray dossier-btn dossier-btn-view">Ouvrir</span>
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
              <button class="action-btn blue dossier-btn dossier-btn-primary" @click="openCreateDossierModal">Nouveau dossier</button>
            </template>
          </MobileSectionHeader>
        </article>

        <article class="panel stack-form mobile-search-filter-panel mobile-modern-filter-panel dossier-desktop-filter-panel">
          <div class="mobile-search-shell dossier-desktop-search-shell">
            <span class="mobile-search-shell__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input v-model="dossierFilters.recherche" type="search" placeholder="Rechercher un responsable, un telephone ou un dossier" />
            <VoiceButton compact label="Rechercher" title="Recherche vocale" @result="emit('voice-search', $event)" />
          </div>
          <div class="dossier-desktop-filter-rows">
            <div class="mobile-filter-chip-row" aria-label="Statut du dossier">
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'ALL' }" type="button" @click="dossierFilters.statut = 'ALL'">Tous</button>
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'ACTIF' }" type="button" @click="dossierFilters.statut = 'ACTIF'">Actifs</button>
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'SOLDE' }" type="button" @click="dossierFilters.statut = 'SOLDE'">Soldes</button>
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.statut === 'CLOTURE' }" type="button" @click="dossierFilters.statut = 'CLOTURE'">Clotures</button>
            </div>
            <div class="mobile-filter-chip-row mobile-filter-chip-row-secondary" aria-label="Type du dossier">
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'ALL' }" type="button" @click="dossierFilters.type = 'ALL'">Tous types</button>
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'INDIVIDUEL' }" type="button" @click="dossierFilters.type = 'INDIVIDUEL'">Individuel</button>
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'FAMILLE' }" type="button" @click="dossierFilters.type = 'FAMILLE'">Famille</button>
              <button class="mobile-filter-chip" :class="{ active: dossierFilters.type === 'GROUPE' }" type="button" @click="dossierFilters.type = 'GROUPE'">Groupe</button>
            </div>
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
                <span class="status-pill" :data-tone="dossierTypeTone(dossier.typeDossier)">{{ dossier.typeDossier }}</span>
                <span class="status-pill" :data-tone="dossierStatusTone(dossier.statutDossier)">{{ dossier.statutDossier }}</span>
              </div>
            </div>
            <div class="dossier-card-signal" :data-tone="dossierPrimarySignal(dossier).tone">
              <strong>{{ dossierPrimarySignal(dossier).label }}</strong>
              <span>{{ dossierPrimarySignal(dossier).detail }}</span>
            </div>
            <p class="helper dossier-card-summary">{{ dossierSummaryLine(dossier) }}</p>
            <div class="dossier-workspace-kpi-grid dossier-kpis-desktop">
              <article class="dossier-kpi-card" :data-tone="dossierKpiTone('commandes', dossier)">
                <span>Commandes</span>
                <strong>{{ dossier.totalCommandes }}</strong>
              </article>
              <article class="dossier-kpi-card" :data-tone="dossierKpiTone('retouches', dossier)">
                <span>Retouches</span>
                <strong>{{ dossier.totalRetouches }}</strong>
              </article>
              <article class="dossier-kpi-card" :data-tone="dossierKpiTone('total', dossier)">
                <span>Total</span>
                <strong class="dossier-value-blue">{{ formatCurrency(dossier.totalMontant) }}</strong>
              </article>
              <article class="dossier-kpi-card" :data-tone="dossierKpiTone('paye', dossier)">
                <span>Total paye</span>
                <strong class="dossier-value-green">{{ formatCurrency(dossier.totalPaye) }}</strong>
              </article>
              <article class="dossier-kpi-card" :data-tone="dossierKpiTone('reste', dossier)">
                <span>Reste</span>
                <strong class="dossier-value-red">{{ formatCurrency(dossier.soldeRestant) }}</strong>
              </article>
            </div>
            <div class="row-between dossier-card-footer">
              <p class="helper">Activite : {{ formatDossierLastActivity(dossier) }}</p>
              <button class="mini-btn dossier-btn dossier-btn-view" @click.stop="openDossierDetail(dossier.idDossier)">Ouvrir</button>
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
