<script setup>
import MobileFilterBlock from "../mobile/MobileFilterBlock.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import MobileStateLoading from "../mobile/MobileStateLoading.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";
import RetoucheMobileList from "./RetoucheMobileList.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  canCreateRetouche: { type: Boolean, default: false },
  retoucheSection: { type: String, default: "liste" },
  retoucheFilterSummary: { type: Array, default: () => [] },
  retoucheMobileFiltersOpen: { type: Boolean, default: false },
  retoucheFilters: { type: Object, required: true },
  retoucheStatusOptions: { type: Array, default: () => [] },
  retoucheClientQuery: { type: String, default: "" },
  retoucheClientOptions: { type: Array, default: () => [] },
  periodOptions: { type: Array, default: () => [] },
  soldeOptions: { type: Array, default: () => [] },
  retouchesFiltered: { type: Array, default: () => [] },
  retouchesKpi: { type: Object, default: () => ({ total: 0, enCours: 0, livrees: 0, avecSolde: 0 }) },
  canAccessModule: { type: Function, required: true },
  openRoute: { type: Function, required: true },
  retouchesSoldeRestantCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: "" },
  retouchesPaged: { type: Array, default: () => [] },
  selectedRetoucheId: { type: String, default: "" },
  formatCurrency: { type: Function, required: true },
  formatDateShort: { type: Function, required: true },
  iconPaths: { type: Object, default: () => ({}) },
  canPayerRetouche: { type: Function, required: true },
  canLivrerRetouche: { type: Function, required: true },
  canTerminerRetouche: { type: Function, required: true },
  canAnnulerRetouche: { type: Function, required: true },
  retouchesLoadingMore: { type: Boolean, default: false },
  retouchesInfiniteEndReached: { type: Boolean, default: false },
  setRetoucheInfiniteSentinel: { type: Function, default: null }
});

const emit = defineEmits([
  "update:retoucheSection",
  "update:retoucheMobileFiltersOpen",
  "update:retoucheClientQuery",
  "open-nouvelle-retouche",
  "reset-filters",
  "voir-retouche",
  "paiement-retouche",
  "livrer-retouche",
  "terminer-retouche",
  "annuler-retouche"
]);

function setRetoucheSection(value) {
  emit("update:retoucheSection", value);
}

function setRetoucheMobileFiltersOpen(value) {
  emit("update:retoucheMobileFiltersOpen", value);
}

function updateRetoucheClientQuery(event) {
  emit("update:retoucheClientQuery", event?.target?.value || "");
}
</script>

<template>
  <section class="commandes-page">
    <MobilePageLayout :has-action="isMobileViewport && canCreateRetouche && retoucheSection === 'liste'">
      <template #header>
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Activite atelier"
            title="Page centrale des retouches"
            subtitle="Suivi rapide des retouches, delais et soldes en attente."
          >
            <template #actions>
              <button v-if="canCreateRetouche && !isMobileViewport" class="action-btn blue" @click="emit('open-nouvelle-retouche')">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path v-for="(path, i) in iconPaths.plus" :key="`new-ret-${i}`" :d="path" />
                </svg>
                Nouvelle retouche
              </button>
            </template>
          </MobileSectionHeader>
        </article>
      </template>

      <template #context>
        <article class="panel">
          <div class="segmented">
            <button class="mini-btn" :class="{ active: retoucheSection === 'liste' }" @click="setRetoucheSection('liste')">Liste</button>
            <button class="mini-btn" :class="{ active: retoucheSection === 'kpi' }" @click="setRetoucheSection('kpi')">Indicateurs</button>
            <button class="mini-btn" :class="{ active: retoucheSection === 'actions' }" @click="setRetoucheSection('actions')">Actions rapides</button>
          </div>
        </article>

        <MobileFilterBlock
          v-if="isMobileViewport && retoucheSection === 'liste'"
          title="Filtres retouches"
          :summary="retoucheFilterSummary"
          :open="retoucheMobileFiltersOpen"
          @toggle="setRetoucheMobileFiltersOpen(!retoucheMobileFiltersOpen)"
        >
          <div class="filters compact">
            <select v-model="retoucheFilters.statut">
              <option v-for="status in retoucheStatusOptions" :key="status" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <div class="retouche-client-picker">
              <input :value="retoucheClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" @input="updateRetoucheClientQuery" />
              <select v-model="retoucheFilters.client">
                <option value="ALL">Tous clients</option>
                <option v-if="retoucheClientOptions.length === 0" value="">Aucun resultat</option>
                <option v-for="client in retoucheClientOptions" :key="client.idClient" :value="client.idClient">
                  {{ `${client.nom} ${client.prenom}`.trim() }}
                </option>
              </select>
            </div>
            <select v-model="retoucheFilters.periode">
              <option v-for="period in periodOptions" :key="period.value" :value="period.value">
                {{ period.label }}
              </option>
            </select>
            <select v-model="retoucheFilters.soldeRestant">
              <option v-for="option in soldeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <input v-model="retoucheFilters.recherche" type="text" placeholder="Recherche client / id / statut" />
          </div>
          <div class="panel-footer">
            <button class="mini-btn" @click="emit('reset-filters')">Reinitialiser filtres</button>
          </div>
          <p v-if="retoucheClientQuery.trim() || retoucheFilters.recherche.trim()" class="helper">
            Recherche active - {{ retouchesFiltered.length }} resultat(s)
          </p>
        </MobileFilterBlock>

        <article v-else-if="retoucheSection === 'liste'" class="panel">
          <h3>Filtres retouches</h3>
          <div class="filters compact">
            <select v-model="retoucheFilters.statut">
              <option v-for="status in retoucheStatusOptions" :key="status" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <div class="retouche-client-picker">
              <input :value="retoucheClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" @input="updateRetoucheClientQuery" />
              <select v-model="retoucheFilters.client">
                <option value="ALL">Tous clients</option>
                <option v-if="retoucheClientOptions.length === 0" value="">Aucun resultat</option>
                <option v-for="client in retoucheClientOptions" :key="client.idClient" :value="client.idClient">
                  {{ `${client.nom} ${client.prenom}`.trim() }}
                </option>
              </select>
            </div>
            <select v-model="retoucheFilters.periode">
              <option v-for="period in periodOptions" :key="period.value" :value="period.value">
                {{ period.label }}
              </option>
            </select>
            <select v-model="retoucheFilters.soldeRestant">
              <option v-for="option in soldeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <input v-model="retoucheFilters.recherche" type="text" placeholder="Recherche client / id / statut" />
          </div>
          <div class="panel-footer">
            <button class="mini-btn" @click="emit('reset-filters')">Reinitialiser filtres</button>
          </div>
          <p v-if="retoucheClientQuery.trim() || retoucheFilters.recherche.trim()" class="helper">
            Recherche active - {{ retouchesFiltered.length }} resultat(s)
          </p>
        </article>
      </template>

      <article v-show="retoucheSection === 'kpi'" class="panel">
        <MobileSectionHeader title="Indicateurs retouches" subtitle="Vue rapide sur le volume, l'avancement et les soldes." />
        <div class="kpi-grid legacy-kpi-grid">
          <div class="kpi-card legacy-kpi" data-tone="teal">
            <div class="kpi-head"><span>Total</span></div>
            <strong>{{ retouchesKpi.total }}</strong>
          </div>
          <div class="kpi-card legacy-kpi" data-tone="blue">
            <div class="kpi-head"><span>En cours</span></div>
            <strong>{{ retouchesKpi.enCours }}</strong>
          </div>
          <div class="kpi-card legacy-kpi" data-tone="green">
            <div class="kpi-head"><span>Livrees</span></div>
            <strong>{{ retouchesKpi.livrees }}</strong>
          </div>
          <div class="kpi-card legacy-kpi" data-tone="amber">
            <div class="kpi-head"><span>Solde restant</span></div>
            <strong>{{ retouchesKpi.avecSolde }}</strong>
          </div>
        </div>
      </article>

      <article v-show="retoucheSection === 'actions'" class="panel">
        <MobileSectionHeader title="Actions rapides" subtitle="Raccourcis utiles pour poursuivre le flux sans changer de contexte." />
        <div class="quick-actions">
          <button v-if="canCreateRetouche" class="action-btn blue" @click="emit('open-nouvelle-retouche')">Nouvelle retouche</button>
          <button class="action-btn gray" @click="setRetoucheSection('liste')">Voir la liste</button>
          <button v-if="canAccessModule('clientsMesures')" class="action-btn gray" @click="openRoute('clientsMesures')">Consulter client</button>
        </div>
      </article>

      <article v-show="retoucheSection === 'liste'" class="panel">
        <MobileSectionHeader
          title="Tableau des retouches"
          subtitle="Vue detaillee de la file active avant l'integration des actions secondaires en detail."
        >
          <template #actions>
            <span class="status-pill" data-tone="due">
              {{ retouchesSoldeRestantCount }} avec solde restant
            </span>
          </template>
        </MobileSectionHeader>

        <ResponsiveDataContainer :mobile="isMobileViewport" v-slot="{ isMobile }">
          <MobileStateLoading
            v-if="isMobile && loading"
            title="Chargement des retouches"
            description="La liste se met a jour."
            :blocks="3"
          />

          <MobileStateError
            v-else-if="isMobile && errorMessage"
            title="Impossible d'afficher les retouches"
            :description="errorMessage"
          />

          <MobileStateEmpty
            v-else-if="isMobile && retouchesFiltered.length === 0"
            title="Aucune retouche"
            description="Aucune retouche ne correspond aux filtres actuels."
          >
            <template #actions>
              <button v-if="canCreateRetouche" class="action-btn blue" @click="emit('open-nouvelle-retouche')">Nouvelle retouche</button>
            </template>
          </MobileStateEmpty>

          <RetoucheMobileList
            v-else-if="isMobile"
            :items="retouchesPaged"
            :selected-id="selectedRetoucheId"
            :format-currency="formatCurrency"
            :format-date="formatDateShort"
            @view="emit('voir-retouche', $event)"
          />

          <div v-else class="table-scroll-x">
            <table class="data-table mobile-stack-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Statut</th>
                  <th>Etat solde</th>
                  <th>Total</th>
                  <th>Paye</th>
                  <th>Solde</th>
                  <th>Date depot</th>
                  <th>Date prevue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="retouche in retouchesPaged"
                  :key="retouche.idRetouche"
                  :class="[`status-row-${retouche.statutRetouche}`, { selected: selectedRetoucheId === retouche.idRetouche }]"
                >
                  <td data-label="ID">{{ retouche.idRetouche }}</td>
                  <td data-label="Client">{{ retouche.clientNom }}</td>
                  <td data-label="Type">{{ retouche.typeRetouche || "-" }}</td>
                  <td data-label="Description">{{ retouche.descriptionRetouche }}</td>
                  <td data-label="Statut">
                    <span class="status-pill" :data-status="retouche.statutRetouche">{{ retouche.statutRetouche }}</span>
                  </td>
                  <td data-label="Etat solde">
                    <span class="status-pill" :data-tone="retouche.soldeRestant === 0 ? 'ok' : 'due'">
                      {{ retouche.soldeRestant === 0 ? "Solde OK" : "Solde restant" }}
                    </span>
                  </td>
                  <td data-label="Total">{{ formatCurrency(retouche.montantTotal) }}</td>
                  <td data-label="Paye">{{ formatCurrency(retouche.montantPaye) }}</td>
                  <td data-label="Solde">{{ formatCurrency(retouche.soldeRestant) }}</td>
                  <td data-label="Date depot">{{ retouche.dateDepot || "-" }}</td>
                  <td data-label="Date prevue">{{ retouche.datePrevue || "-" }}</td>
                  <td class="row-actions">
                    <button class="mini-btn" @click="emit('voir-retouche', retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.eye" :key="`see-ret-${retouche.idRetouche}-${i}`" :d="path" />
                      </svg>
                      Voir
                    </button>
                    <button class="mini-btn green" v-if="canPayerRetouche(retouche)" @click="emit('paiement-retouche', retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.cash" :key="`cash-ret-${retouche.idRetouche}-${i}`" :d="path" />
                      </svg>
                      Paiement
                    </button>
                    <button class="mini-btn blue" v-if="canLivrerRetouche(retouche)" @click="emit('livrer-retouche', retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.check" :key="`liv-ret-${retouche.idRetouche}-${i}`" :d="path" />
                      </svg>
                      Marquer comme livre
                    </button>
                    <button class="mini-btn blue" v-if="canTerminerRetouche(retouche)" @click="emit('terminer-retouche', retouche)">
                      Marquer comme termine
                    </button>
                    <button class="mini-btn red" v-if="canAnnulerRetouche(retouche)" @click="emit('annuler-retouche', retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M21 3L3 21" />
                      </svg>
                      Annuler
                    </button>
                  </td>
                </tr>
                <tr v-if="!isMobile && retouchesFiltered.length === 0">
                  <td colspan="12">Aucune retouche ne correspond aux filtres actuels.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ResponsiveDataContainer>
        <div
          v-if="retouchesPaged.length > 0 && retouchesPaged.length < retouchesFiltered.length"
          :ref="setRetoucheInfiniteSentinel"
          class="dossier-infinite-sentinel infinite-list-status"
        >
          <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
          <span class="helper">{{ retouchesLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
        </div>
        <div v-else-if="retouchesInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
          <span class="helper">Aucune autre retouche</span>
        </div>
      </article>

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && canCreateRetouche && retoucheSection === 'liste'"
          title="Action principale"
          subtitle="Creer rapidement une nouvelle retouche."
        >
          <button class="action-btn blue" @click="emit('open-nouvelle-retouche')">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.plus" :key="`new-ret-mobile-${i}`" :d="path" />
            </svg>
            Nouvelle retouche
          </button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
