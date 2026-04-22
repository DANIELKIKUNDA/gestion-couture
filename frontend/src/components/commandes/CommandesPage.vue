<script setup>
import CommandeMobileList from "./CommandeMobileList.vue";
import MobileFilterBlock from "../mobile/MobileFilterBlock.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import MobileStateLoading from "../mobile/MobileStateLoading.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  canCreateCommande: { type: Boolean, default: false },
  commandeSection: { type: String, default: "liste" },
  commandesFilterSummary: { type: Array, default: () => [] },
  commandeMobileFiltersOpen: { type: Boolean, default: false },
  filters: { type: Object, required: true },
  statusOptions: { type: Array, default: () => [] },
  commandeClientQuery: { type: String, default: "" },
  commandeClientOptions: { type: Array, default: () => [] },
  periodOptions: { type: Array, default: () => [] },
  soldeOptions: { type: Array, default: () => [] },
  commandesFiltered: { type: Array, default: () => [] },
  commandesKpi: { type: Object, default: () => ({ total: 0, enCours: 0, livrees: 0, avecSolde: 0 }) },
  canAccessModule: { type: Function, required: true },
  commandesSoldeRestantCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: "" },
  commandesPaged: { type: Array, default: () => [] },
  selectedCommandeId: { type: String, default: "" },
  formatCurrency: { type: Function, required: true },
  formatDateShort: { type: Function, required: true },
  iconPaths: { type: Object, default: () => ({}) },
  commandesInfiniteEndReached: { type: Boolean, default: false },
  commandesLoadingMore: { type: Boolean, default: false },
  openRoute: { type: Function, required: true },
  canPayer: { type: Function, required: true },
  canLivrer: { type: Function, required: true },
  canTerminer: { type: Function, required: true },
  canAnnuler: { type: Function, required: true }
});

const emit = defineEmits([
  "update:commandeSection",
  "update:commandeMobileFiltersOpen",
  "update:commandeClientQuery",
  "open-nouvelle-commande",
  "reset-filters",
  "voir-commande",
  "paiement-commande",
  "livrer-commande",
  "terminer-commande",
  "annuler-commande"
]);

function setCommandeSection(value) {
  emit("update:commandeSection", value);
}

function setCommandeMobileFiltersOpen(value) {
  emit("update:commandeMobileFiltersOpen", value);
}

function updateCommandeClientQuery(event) {
  emit("update:commandeClientQuery", event?.target?.value || "");
}
</script>

<template>
  <section class="commandes-page">
    <MobilePageLayout :has-action="isMobileViewport && canCreateCommande && commandeSection === 'liste'">
      <template #header>
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Activite atelier"
            title="Page centrale des commandes"
            subtitle="Suivi rapide des commandes, delais et soldes en attente."
          >
            <template #actions>
              <button v-if="canCreateCommande && !isMobileViewport" class="action-btn blue" @click="emit('open-nouvelle-commande')">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path v-for="(path, i) in iconPaths.plus" :key="`new-cmd-${i}`" :d="path" />
                </svg>
                Nouvelle commande
              </button>
            </template>
          </MobileSectionHeader>
        </article>
      </template>

      <template #context>
        <article class="panel">
          <div class="segmented">
            <button class="mini-btn" :class="{ active: commandeSection === 'liste' }" @click="setCommandeSection('liste')">Liste</button>
            <button class="mini-btn" :class="{ active: commandeSection === 'indicateurs' }" @click="setCommandeSection('indicateurs')">Indicateurs</button>
            <button class="mini-btn" :class="{ active: commandeSection === 'actions' }" @click="setCommandeSection('actions')">Actions rapides</button>
          </div>
        </article>

        <MobileFilterBlock
          v-if="isMobileViewport && commandeSection === 'liste'"
          title="Filtres commandes"
          :summary="commandesFilterSummary"
          :open="commandeMobileFiltersOpen"
          @toggle="setCommandeMobileFiltersOpen(!commandeMobileFiltersOpen)"
        >
          <div class="filters compact">
            <select v-model="filters.statut">
              <option v-for="status in statusOptions" :key="status" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <div class="commande-client-picker">
              <input :value="commandeClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" @input="updateCommandeClientQuery" />
              <select v-model="filters.client">
                <option value="ALL">Tous clients</option>
                <option v-if="commandeClientOptions.length === 0" value="">Aucun resultat</option>
                <option v-for="client in commandeClientOptions" :key="client.idClient" :value="client.idClient">
                  {{ `${client.nom} ${client.prenom}`.trim() }}
                </option>
              </select>
            </div>
            <select v-model="filters.periode">
              <option v-for="period in periodOptions" :key="period.value" :value="period.value">
                {{ period.label }}
              </option>
            </select>
            <select v-model="filters.soldeRestant">
              <option v-for="option in soldeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <input v-model="filters.recherche" type="text" placeholder="Recherche client / id / statut" />
          </div>
          <div class="panel-footer">
            <button class="mini-btn" @click="emit('reset-filters')">Reinitialiser filtres</button>
          </div>
          <p v-if="commandeClientQuery.trim() || filters.recherche.trim()" class="helper">
            Recherche active - {{ commandesFiltered.length }} resultat(s)
          </p>
        </MobileFilterBlock>

        <article v-else-if="commandeSection === 'liste'" class="panel">
          <h3>Filtres commandes</h3>
          <div class="filters compact">
            <select v-model="filters.statut">
              <option v-for="status in statusOptions" :key="status" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <div class="commande-client-picker">
              <input :value="commandeClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" @input="updateCommandeClientQuery" />
              <select v-model="filters.client">
                <option value="ALL">Tous clients</option>
                <option v-if="commandeClientOptions.length === 0" value="">Aucun resultat</option>
                <option v-for="client in commandeClientOptions" :key="client.idClient" :value="client.idClient">
                  {{ `${client.nom} ${client.prenom}`.trim() }}
                </option>
              </select>
            </div>
            <select v-model="filters.periode">
              <option v-for="period in periodOptions" :key="period.value" :value="period.value">
                {{ period.label }}
              </option>
            </select>
            <select v-model="filters.soldeRestant">
              <option v-for="option in soldeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <input v-model="filters.recherche" type="text" placeholder="Recherche client / id / statut" />
          </div>
          <div class="panel-footer">
            <button class="mini-btn" @click="emit('reset-filters')">Reinitialiser filtres</button>
          </div>
          <p v-if="commandeClientQuery.trim() || filters.recherche.trim()" class="helper">
            Recherche active - {{ commandesFiltered.length }} resultat(s)
          </p>
        </article>
      </template>

      <article v-show="commandeSection === 'indicateurs'" class="panel">
        <MobileSectionHeader title="Indicateurs commandes" subtitle="Vue rapide sur le volume, l'avancement et les soldes." />
        <div class="kpi-grid legacy-kpi-grid">
          <div class="kpi-card legacy-kpi" data-tone="blue">
            <div class="kpi-head"><span>Total</span></div>
            <strong>{{ commandesKpi.total }}</strong>
          </div>
          <div class="kpi-card legacy-kpi" data-tone="teal">
            <div class="kpi-head"><span>En cours</span></div>
            <strong>{{ commandesKpi.enCours }}</strong>
          </div>
          <div class="kpi-card legacy-kpi" data-tone="green">
            <div class="kpi-head"><span>Livrees</span></div>
            <strong>{{ commandesKpi.livrees }}</strong>
          </div>
          <div class="kpi-card legacy-kpi" data-tone="amber">
            <div class="kpi-head"><span>Solde restant</span></div>
            <strong>{{ commandesKpi.avecSolde }}</strong>
          </div>
        </div>
      </article>

      <article v-show="commandeSection === 'actions'" class="panel">
        <MobileSectionHeader title="Actions rapides" subtitle="Raccourcis utiles pour poursuivre le flux sans changer de contexte." />
        <div class="quick-actions">
          <button v-if="canCreateCommande" class="action-btn blue" @click="emit('open-nouvelle-commande')">Nouvelle commande</button>
          <button class="action-btn gray" @click="setCommandeSection('liste')">Voir la liste</button>
          <button v-if="canAccessModule('clientsMesures')" class="action-btn gray" @click="openRoute('clientsMesures')">Consulter client</button>
        </div>
      </article>

      <article v-show="commandeSection === 'liste'" class="panel">
        <MobileSectionHeader
          title="Tableau des commandes"
          subtitle="Vue detaillee de la file active avant l'integration des cards mobiles."
        >
          <template #actions>
            <span class="status-pill" data-tone="due">
              {{ commandesSoldeRestantCount }} avec solde restant
            </span>
          </template>
        </MobileSectionHeader>

        <ResponsiveDataContainer :mobile="isMobileViewport" v-slot="{ isMobile }">
          <MobileStateLoading
            v-if="isMobile && loading"
            title="Chargement des commandes"
            description="La liste se met a jour."
            :blocks="3"
          />

          <MobileStateError
            v-else-if="isMobile && errorMessage"
            title="Impossible d'afficher les commandes"
            :description="errorMessage"
          />

          <MobileStateEmpty
            v-else-if="isMobile && commandesFiltered.length === 0"
            title="Aucune commande"
            description="Aucune commande ne correspond aux filtres actuels."
          >
            <template #actions>
              <button v-if="canCreateCommande" class="action-btn blue" @click="emit('open-nouvelle-commande')">Nouvelle commande</button>
            </template>
          </MobileStateEmpty>

          <CommandeMobileList
            v-else-if="isMobile"
            :items="commandesPaged"
            :selected-id="selectedCommandeId"
            :format-currency="formatCurrency"
            :format-date="formatDateShort"
            @view="emit('voir-commande', $event)"
          />

          <div v-else class="table-scroll-x">
            <table class="data-table mobile-stack-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Description</th>
                  <th>Statut</th>
                  <th>Etat solde</th>
                  <th>Total</th>
                  <th>Paye</th>
                  <th>Solde</th>
                  <th>Date prevue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="commande in commandesPaged"
                  :key="commande.idCommande"
                  :class="[`status-row-${commande.statutCommande}`, { selected: selectedCommandeId === commande.idCommande }]"
                >
                  <td data-label="ID">{{ commande.idCommande }}</td>
                  <td data-label="Client">{{ commande.clientNom }}</td>
                  <td data-label="Description">{{ commande.descriptionCommande }}</td>
                  <td data-label="Statut">
                    <span class="status-pill" :data-status="commande.statutCommande">{{ commande.statutCommande }}</span>
                  </td>
                  <td data-label="Etat solde">
                    <span class="status-pill" :data-tone="commande.soldeRestant === 0 ? 'ok' : 'due'">
                      {{ commande.soldeRestant === 0 ? "Solde OK" : "Solde restant" }}
                    </span>
                  </td>
                  <td data-label="Total">{{ formatCurrency(commande.montantTotal) }}</td>
                  <td data-label="Paye">{{ formatCurrency(commande.montantPaye) }}</td>
                  <td data-label="Solde">{{ formatCurrency(commande.soldeRestant) }}</td>
                  <td data-label="Date prevue">{{ commande.datePrevue || "-" }}</td>
                  <td class="row-actions">
                    <button class="mini-btn" @click="emit('voir-commande', commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.eye" :key="`see-${commande.idCommande}-${i}`" :d="path" />
                      </svg>
                      Voir
                    </button>
                    <button v-if="canPayer(commande)" class="mini-btn green" @click="emit('paiement-commande', commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.cash" :key="`cash-${commande.idCommande}-${i}`" :d="path" />
                      </svg>
                      Paiement
                    </button>
                    <button v-if="canLivrer(commande)" class="mini-btn blue" @click="emit('livrer-commande', commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.check" :key="`liv-${commande.idCommande}-${i}`" :d="path" />
                      </svg>
                      Marquer comme livré
                    </button>
                    <button v-if="canTerminer(commande)" class="mini-btn blue" @click="emit('terminer-commande', commande)">
                      Marquer comme terminé
                    </button>
                    <button v-if="canAnnuler(commande)" class="mini-btn red" @click="emit('annuler-commande', commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M21 3L3 21" />
                      </svg>
                      Annuler
                    </button>
                  </td>
                </tr>
                <tr v-if="!isMobile && commandesFiltered.length === 0">
                  <td colspan="10">Aucune commande ne correspond aux filtres actuels.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ResponsiveDataContainer>
        <div
          v-if="commandesPaged.length > 0 && commandesPaged.length < commandesFiltered.length"
          ref="commandeInfiniteSentinel"
          class="dossier-infinite-sentinel infinite-list-status"
        >
          <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
          <span class="helper">{{ commandesLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
        </div>
        <div v-else-if="commandesInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
          <span class="helper">Aucune autre commande</span>
        </div>
      </article>

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && canCreateCommande && commandeSection === 'liste'"
          title="Action principale"
          subtitle="Creer rapidement une nouvelle commande."
        >
          <button class="action-btn blue" @click="emit('open-nouvelle-commande')">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.plus" :key="`new-cmd-mobile-${i}`" :d="path" />
            </svg>
            Nouvelle commande
          </button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
