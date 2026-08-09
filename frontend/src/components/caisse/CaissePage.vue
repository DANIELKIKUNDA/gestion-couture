<script setup>
import { computed, ref } from "vue";
import CaisseOperationMobileList from "./CaisseOperationMobileList.vue";
import CaisseOverviewCards from "./CaisseOverviewCards.vue";
import DateNavigator from "../DateNavigator.vue";
import MobileFloatingCreateButton from "../mobile/MobileFloatingCreateButton.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

const props = defineProps({
  isMobileViewport: { type: Boolean, default: false },
  caisseOuverte: { type: Boolean, default: false },
  canOpenCaisse: { type: Boolean, default: false },
  canRecordCaisseManualEntry: { type: Boolean, default: false },
  canRecordCaisseExpense: { type: Boolean, default: false },
  canCloseCaisse: { type: Boolean, default: false },
  canConfigureInitialAllocation: { type: Boolean, default: false },
  caisseJour: { type: Object, default: null },
  caisseLoadState: { type: String, default: "IDLE" },
  caisseLoadError: { type: String, default: "" },
  selectedDate: { type: String, default: "" },
  caisseStatus: { type: String, default: "" },
  iconPaths: { type: Object, default: () => ({}) },
  networkIsOnline: { type: Boolean, default: true },
  caisseTotals: { type: Object, default: () => ({}) },
  dailyDecisionPills: { type: Array, default: () => [] },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  formatCaisseOuvertePar: { type: Function, required: true },
  formatCaisseClotureePar: { type: Function, required: true },
  caisseOperations: { type: Array, default: () => [] },
  caisseOperationsPaged: { type: Array, default: () => [] },
  caisseQuickFilter: { type: String, default: "ALL" },
  caisseSourceLabel: { type: Function, required: true },
  caisseSourceTone: { type: Function, required: true },
  depenseTypeLabel: { type: Function, required: true },
  caisseOperationsLoadingMore: { type: Boolean, default: false },
  caisseOperationsInfiniteEndReached: { type: Boolean, default: false },
  caisseInfiniteSentinelRef: { type: Function, required: true }
});

const emit = defineEmits(["ouvrir-caisse", "entree-manuelle-caisse", "depense-caisse", "cloturer-caisse", "configure-initial-allocation", "update:selectedDate", "update:caisseQuickFilter"]);
const movementSheetOpen = ref(false);
const requiresInitialAllocation = computed(
  () =>
    props.caisseJour &&
    props.caisseTotals?.soldesDonneesPresentes === true &&
    props.caisseTotals?.allocationConfigured !== true &&
    props.caisseTotals?.soldesAvantReference !== true
);
const hasBalanceConsistencyAlert = computed(
  () => props.caisseJour && props.caisseTotals?.soldesDisponibles === true && props.caisseTotals?.soldesCoherentsAvecCaisse === false
);
const soldesUnavailableLabel = computed(() => {
  if (props.caisseTotals?.soldesAvantReference === true) {
    return props.caisseTotals?.dateReferenceSoldes
      ? `Disponibles depuis ${props.caisseTotals.dateReferenceSoldes}`
      : "Indisponibles avant la date de reference";
  }
  if (props.caisseTotals?.soldesDonneesPresentes === true && props.caisseTotals?.allocationConfigured !== true) {
    return "Repartition initiale a definir";
  }
  return "Synchronisation...";
});

const quickFilterOptions = [
  { value: "ALL", label: "Tous" },
  { value: "ATELIER", label: "Atelier" },
  { value: "STOCK", label: "Stock" },
  { value: "ENTREES", label: "Entrees" },
  { value: "SORTIES", label: "Sorties" },
  { value: "MANUEL", label: "Manuel" },
  { value: "DEPENSES", label: "Depenses" }
];

function operationAmountTone(op) {
  return String(op?.typeOperation || "").trim() === "SORTIE" ? "out" : "in";
}

function signedOperationAmount(op) {
  const amount = props.formatCurrency(op?.montant);
  return operationAmountTone(op) === "out" ? `-${amount}` : `+${amount}`;
}

function operationQuickLabel(op) {
  return `[${props.caisseSourceLabel(op?.sourceFlux)}][${op?.activite || "ATELIER"}]`;
}

function isCaisseChecking() {
  return ["LOADING", "VERIFYING", "REFRESHING"].includes(String(props.caisseLoadState || "").trim().toUpperCase());
}

function caisseUnavailableTitle() {
  const state = String(props.caisseLoadState || "").trim().toUpperCase();
  if (isCaisseChecking()) return "Verification de la caisse";
  if (state === "NOT_FOUND") return "Aucune caisse pour cette date";
  return "Caisse indisponible";
}

function caisseUnavailableDescription() {
  const state = String(props.caisseLoadState || "").trim().toUpperCase();
  if (isCaisseChecking()) return "Nous verifions la caisse avec le serveur. Les donnees vont apparaitre automatiquement.";
  if (!props.networkIsOnline) return "Aucune caisse disponible hors ligne.";
  if (state === "NOT_FOUND") return "La verification est terminee et aucune caisse n'existe pour cette date.";
  return props.caisseLoadError || "Aucune caisse du jour n'a ete chargee.";
}

function openMovementSheet() {
  movementSheetOpen.value = true;
}

function closeMovementSheet() {
  movementSheetOpen.value = false;
}

function chooseManualEntry() {
  closeMovementSheet();
  emit("entree-manuelle-caisse");
}

function chooseExpense() {
  closeMovementSheet();
  emit("depense-caisse");
}
</script>

<template>
  <section class="commande-detail">
    <MobilePageLayout :has-action="isMobileViewport && ((!caisseOuverte && canOpenCaisse) || (caisseOuverte && !canRecordCaisseExpense && !canRecordCaisseManualEntry && canCloseCaisse))">
      <article class="panel panel-header detail-header" :class="{ 'caisse-header-closed': !caisseOuverte }">
        <div>
          <h3>Caisse du jour</h3>
          <p v-if="caisseJour" class="helper">ID: {{ caisseJour.idCaisseJour }} - Date: {{ caisseJour.date }}</p>
          <p v-else-if="selectedDate" class="helper">{{ caisseUnavailableDescription() }}</p>
        </div>
        <div class="row-actions">
          <DateNavigator
            v-if="selectedDate"
            :model-value="selectedDate"
            @update:model-value="emit('update:selectedDate', $event)"
          />
          <span class="status-pill" :data-status="caisseStatus">
            <svg v-if="!caisseOuverte" class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.lock" :key="`lock-${i}`" :d="path" />
            </svg>
            {{ caisseStatus }}
          </span>
          <button v-if="!isMobileViewport && !caisseOuverte && canOpenCaisse" class="action-btn green" @click="emit('ouvrir-caisse')">Ouvrir la caisse</button>
          <button v-if="!isMobileViewport && caisseOuverte && canRecordCaisseManualEntry" class="action-btn blue" @click="emit('entree-manuelle-caisse')">+ Ajouter une entree</button>
          <button v-if="!isMobileViewport && caisseOuverte && canRecordCaisseExpense" class="action-btn amber" @click="emit('depense-caisse')">Enregistrer depense</button>
          <button v-if="!isMobileViewport && caisseOuverte && canCloseCaisse" class="action-btn red" @click="emit('cloturer-caisse')">Cloturer la caisse</button>
          <button v-if="isMobileViewport && caisseOuverte && canCloseCaisse" class="mini-btn red" @click="emit('cloturer-caisse')">Cloturer</button>
        </div>
      </article>

      <article v-if="caisseJour && !caisseOuverte" class="panel caisse-locked">
        <strong>Caisse cloturee</strong>
        <p>Aucune ecriture n'est autorisee apres cloture.</p>
      </article>

      <div v-if="caisseJour && dailyDecisionPills.length > 0" class="caisse-decision-strip" aria-label="Resume decisionnel du jour">
        <article v-for="pill in dailyDecisionPills" :key="pill.label" class="caisse-decision-pill" :data-tone="pill.tone || 'neutral'">
          <span>{{ pill.label }}</span>
          <strong>{{ pill.value }}</strong>
        </article>
      </div>

      <article v-if="requiresInitialAllocation" class="panel caisse-allocation-warning" role="status">
        <div>
          <strong>Repartition initiale de la caisse a definir</strong>
          <p>Le solde d'ouverture de reference du {{ caisseTotals.dateReferenceSoldes || caisseJour.date }} ({{ formatCurrency(caisseTotals.soldeOuvertureInitial) }}) n'est pas encore attribue entre Atelier et Stock. Aucun historique anterieur n'est devine : cette repartition devient le point de depart des soldes cumulatifs.</p>
          <p v-if="!canConfigureInitialAllocation" class="helper">Pour securiser l'historique, la premiere repartition se configure depuis la caisse du jour par le proprietaire.</p>
        </div>
        <button
          v-if="canConfigureInitialAllocation"
          class="action-btn blue"
          type="button"
          @click="emit('configure-initial-allocation')"
        >
          Repartir le solde initial
        </button>
      </article>

      <article v-if="hasBalanceConsistencyAlert" class="panel caisse-consistency-warning" role="alert">
        <div>
          <strong>Ecart de coherence detecte dans la caisse</strong>
          <p>Le total reconstruit des soldes Atelier/Stock differe du solde global de {{ formatCurrency(Math.abs(Number(caisseTotals.ecartSoldeGlobal || 0))) }}. Aucune valeur n'est masquee : verifiez l'historique ou la repartition initiale avant toute correction de donnees.</p>
        </div>
      </article>

      <article v-if="caisseJour && caisseTotals.soldesAvantReference" class="panel caisse-reference-info" role="status">
        <strong>Soldes Atelier / Stock non reconstruits pour cette date</strong>
        <p>La repartition fiable commence le {{ caisseTotals.dateReferenceSoldes }}. Les jours anterieurs restent consultables sans leur attribuer artificiellement un solde Atelier ou Stock.</p>
      </article>

      <ResponsiveDataContainer v-if="!caisseJour" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateError
            :title="caisseUnavailableTitle()"
            :description="caisseUnavailableDescription()"
          />
        </template>
        <template #desktop>
          <article class="panel error-panel">
            <strong>{{ caisseUnavailableTitle() }}</strong>
            <p>{{ caisseUnavailableDescription() }}</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <template v-else>
        <ResponsiveDataContainer :mobile="isMobileViewport">
          <template #mobile>
            <CaisseOverviewCards
              :caisse="caisseJour"
              :status="caisseStatus"
              :totals="caisseTotals"
              :format-currency="formatCurrency"
              :format-date-time="formatDateTime"
              :format-opened-by="formatCaisseOuvertePar"
              :format-closed-by="formatCaisseClotureePar"
            />

            <article class="panel">
              <MobileSectionHeader
                title="Repartition des encaissements"
                subtitle="Repartition des entrees de la caisse par source."
              />
              <div class="caisse-source-cards">
                <article class="caisse-source-card" data-tone="blue">
                  <span>Commandes</span>
                  <strong>{{ formatCurrency(caisseTotals.totalCommandes) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="amber">
                  <span>Retouches</span>
                  <strong>{{ formatCurrency(caisseTotals.totalRetouches) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="teal">
                  <span>Ventes</span>
                  <strong>{{ formatCurrency(caisseTotals.totalVentes) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="violet">
                  <span>Entrees manuelles</span>
                  <strong>{{ formatCurrency(caisseTotals.totalEntreesManuelles) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="green">
                  <span>Total encaissements</span>
                  <strong>{{ formatCurrency(caisseTotals.totalEncaissements) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="red">
                  <span>Depenses caisse</span>
                  <strong>{{ formatCurrency(caisseTotals.totalDepenses) }}</strong>
                </article>
              </div>
            </article>

            <article class="panel">
              <MobileSectionHeader
                title="Historique des operations"
                :subtitle="`${caisseOperations.length} operation(s) enregistree(s)`"
              />
              <div class="caisse-quick-filters" aria-label="Filtres rapides caisse">
                <button
                  v-for="option in quickFilterOptions"
                  :key="`mobile-${option.value}`"
                  type="button"
                  class="caisse-filter-chip"
                  :class="{ active: caisseQuickFilter === option.value }"
                  @click="emit('update:caisseQuickFilter', option.value)"
                >
                  {{ option.label }}
                </button>
              </div>

              <MobileStateEmpty
                v-if="caisseOperations.length === 0"
                title="Aucune operation"
                description="Aucune operation n'est enregistree pour cette caisse."
              />

              <CaisseOperationMobileList
                v-else
                :items="caisseOperationsPaged"
                :format-currency="formatCurrency"
                :format-date-time="formatDateTime"
                :source-label="caisseSourceLabel"
                :source-tone="caisseSourceTone"
                :depense-type-label="depenseTypeLabel"
              />

              <div
                v-if="caisseOperationsPaged.length > 0 && caisseOperationsPaged.length < caisseOperations.length"
                :ref="caisseInfiniteSentinelRef"
                class="dossier-infinite-sentinel infinite-list-status"
              >
                <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
                <span class="helper">{{ caisseOperationsLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
              </div>
              <div v-else-if="caisseOperationsInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
                <span class="helper">Aucune autre operation</span>
              </div>
            </article>
          </template>

          <template #desktop>
            <article class="panel caisse-summary-grid">
              <div class="caisse-summary-col">
                <h4>Statut de la caisse</h4>
                <p class="caisse-row"><strong>Etat:</strong> <span class="caisse-value">{{ caisseStatus }}</span></p>
                <p class="caisse-row"><strong>Solde d'ouverture:</strong> <span class="caisse-value">{{ formatCurrency(caisseJour.soldeOuverture) }}</span></p>
                <p class="caisse-row"><strong>Solde global courant:</strong> <span class="caisse-value">{{ formatCurrency(caisseJour.soldeCourant) }}</span></p>
                <p class="caisse-row"><strong>Ouverte par:</strong> <span class="caisse-value">{{ formatCaisseOuvertePar(caisseJour) }}</span></p>
                <p class="caisse-row"><strong>Date d'ouverture:</strong> <span class="caisse-value">{{ formatDateTime(caisseJour.dateOuverture) }}</span></p>
              </div>
              <div class="caisse-summary-col">
                <h4>Soldes par activite</h4>
                <p class="caisse-row"><strong>Solde Atelier:</strong> <span class="caisse-value">{{ caisseTotals.soldesDisponibles ? formatCurrency(caisseTotals.soldeAtelier) : soldesUnavailableLabel }}</span></p>
                <p class="caisse-row"><strong>Solde Stock:</strong> <span class="caisse-value">{{ caisseTotals.soldesDisponibles ? formatCurrency(caisseTotals.soldeStock) : soldesUnavailableLabel }}</span></p>
                <p v-if="Math.abs(Number(caisseTotals.soldeNonReparti || 0)) > 0.005" class="caisse-row"><strong>Initial non reparti:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.soldeNonReparti) }}</span></p>
                <p class="helper">Ces soldes sont cumulatifs et representent l'argent encore disponible par activite.</p>
                <button
                  v-if="canConfigureInitialAllocation && caisseTotals.soldesDisponibles"
                  class="mini-btn"
                  type="button"
                  @click="emit('configure-initial-allocation')"
                >
                  {{ caisseTotals.allocationConfigured ? "Ajuster la repartition initiale" : "Repartir le solde initial" }}
                </button>
              </div>
              <div class="caisse-summary-col">
                <h4>Resultat du jour</h4>
                <p class="caisse-row"><strong>Total entrees:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalEntrees) }}</span></p>
                <p class="caisse-row"><strong>Depenses quotidiennes:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalSortiesQuotidiennes) }}</span></p>
                <p class="caisse-row"><strong>Depenses exceptionnelles:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalSortiesExceptionnelles) }}</span></p>
                <p class="caisse-row"><strong>Total depenses:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalSorties) }}</span></p>
                <p class="caisse-row"><strong>Resultat du jour:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.resultatJournalier) }}</span></p>
              </div>
            </article>

            <article class="panel caisse-source-panel">
              <div class="panel-header detail-panel-header caisse-source-panel-header">
                <div>
                  <h4>Repartition des encaissements</h4>
                  <p class="helper">Repartition des entrees de la caisse par source, sans melanger les flux automatiques et manuels.</p>
                </div>
                <span class="status-pill" data-tone="info">Vue financiere</span>
              </div>
              <div class="caisse-source-cards caisse-source-cards-desktop">
                <article class="caisse-source-card" data-tone="blue">
                  <span>Commandes</span>
                  <strong>{{ formatCurrency(caisseTotals.totalCommandes) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="amber">
                  <span>Retouches</span>
                  <strong>{{ formatCurrency(caisseTotals.totalRetouches) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="teal">
                  <span>Ventes</span>
                  <strong>{{ formatCurrency(caisseTotals.totalVentes) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="violet">
                  <span>Entrees manuelles</span>
                  <strong>{{ formatCurrency(caisseTotals.totalEntreesManuelles) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="green">
                  <span>Total encaissements</span>
                  <strong>{{ formatCurrency(caisseTotals.totalEncaissements) }}</strong>
                </article>
                <article class="caisse-source-card" data-tone="red">
                  <span>Depenses caisse</span>
                  <strong>{{ formatCurrency(caisseTotals.totalDepenses) }}</strong>
                </article>
              </div>
            </article>

            <article class="panel caisse-history-panel">
              <div class="panel-header detail-panel-header caisse-history-header">
                <h4>Historique des operations</h4>
                <span class="helper">{{ caisseOperations.length }} operation(s)</span>
              </div>
              <div class="caisse-quick-filters" aria-label="Filtres rapides caisse">
                <button
                  v-for="option in quickFilterOptions"
                  :key="`desktop-${option.value}`"
                  type="button"
                  class="caisse-filter-chip"
                  :class="{ active: caisseQuickFilter === option.value }"
                  @click="emit('update:caisseQuickFilter', option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
              <div class="table-scroll-x caisse-history-table-wrap">
                <table class="data-table mobile-stack-table caisse-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Journal</th>
                      <th>Type</th>
                      <th>Montant</th>
                      <th>Source</th>
                      <th>Activite</th>
                      <th>Type depense</th>
                      <th>Mode</th>
                      <th>Motif</th>
                      <th>Justification</th>
                      <th>Reference</th>
                      <th>Utilisateur</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="op in caisseOperationsPaged" :key="op.idOperation">
                      <td data-label="Date">{{ formatDateTime(op.dateOperation) }}</td>
                      <td data-label="Journal">
                        <div class="caisse-journal-line">
                          <span class="caisse-journal-code">{{ operationQuickLabel(op) }}</span>
                          <strong :data-tone="operationAmountTone(op)">{{ signedOperationAmount(op) }}</strong>
                        </div>
                      </td>
                      <td data-label="Type">{{ op.typeOperation }}</td>
                      <td data-label="Montant">
                        <strong class="caisse-signed-amount" :data-tone="operationAmountTone(op)">
                          {{ signedOperationAmount(op) }}
                        </strong>
                      </td>
                      <td data-label="Source">
                        <span class="status-pill" :data-tone="caisseSourceTone(op.sourceFlux)">
                          {{ caisseSourceLabel(op.sourceFlux) }}
                        </span>
                      </td>
                      <td data-label="Activite">
                        <span class="status-pill" data-tone="info">{{ op.activite || "ATELIER" }}</span>
                      </td>
                      <td data-label="Type depense">
                        <span v-if="op.typeOperation === 'SORTIE'" class="status-pill" :data-tone="op.typeDepense === 'EXCEPTIONNELLE' ? 'amber' : 'blue'">
                          {{ depenseTypeLabel(op.typeDepense) }}
                        </span>
                        <span v-else>-</span>
                      </td>
                      <td data-label="Mode">{{ op.modePaiement || "-" }}</td>
                      <td data-label="Motif">{{ op.motif || "-" }}</td>
                      <td data-label="Justification">{{ op.justification || "-" }}</td>
                      <td data-label="Reference">{{ op.referenceMetier || "-" }}</td>
                      <td data-label="Utilisateur">{{ op.effectuePar || "-" }}</td>
                      <td data-label="Statut">{{ op.statutOperation || "-" }}</td>
                    </tr>
                    <tr v-if="caisseOperations.length === 0">
                      <td colspan="13">Aucune operation enregistree.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                v-if="caisseOperationsPaged.length > 0 && caisseOperationsPaged.length < caisseOperations.length"
                :ref="caisseInfiniteSentinelRef"
                class="dossier-infinite-sentinel infinite-list-status"
              >
                <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
                <span class="helper">{{ caisseOperationsLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
              </div>
              <div v-else-if="caisseOperationsInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
                <span class="helper">Aucune autre operation</span>
              </div>
            </article>
          </template>
        </ResponsiveDataContainer>
      </template>

      <MobileFloatingCreateButton
        v-if="isMobileViewport && caisseOuverte && (canRecordCaisseManualEntry || canRecordCaisseExpense)"
        label="Operation"
        aria-label="Ajouter une operation de caisse"
        @click="openMovementSheet"
      />

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && !caisseOuverte && canOpenCaisse"
          title="Action principale"
          subtitle="Ouvrez la caisse du jour pour autoriser les ecritures."
        >
          <button class="action-btn green" @click="emit('ouvrir-caisse')">Ouvrir la caisse</button>
        </MobilePrimaryActionBar>

        <MobilePrimaryActionBar
          v-else-if="isMobileViewport && caisseOuverte && !canRecordCaisseExpense && !canRecordCaisseManualEntry && canCloseCaisse"
          title="Action principale"
          subtitle="Cloturez la caisse lorsque les operations sont terminees."
        >
          <button class="action-btn red" @click="emit('cloturer-caisse')">Cloturer la caisse</button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>

    <div v-if="movementSheetOpen" class="modal-backdrop caisse-movement-backdrop" @click.self="closeMovementSheet">
      <div class="modal-card modal-card-sm caisse-movement-sheet">
        <header class="modal-header">
          <div>
            <p class="mobile-overline">Caisse</p>
            <h3>Nouvelle operation</h3>
            <p class="helper">Choisissez si l'argent entre ou sort de la caisse.</p>
          </div>
          <button class="mini-btn" type="button" @click="closeMovementSheet">Fermer</button>
        </header>
        <section class="modal-body caisse-movement-body">
          <button
            v-if="canRecordCaisseManualEntry"
            type="button"
            class="caisse-movement-choice"
            data-tone="in"
            @click="chooseManualEntry"
          >
            <span class="caisse-movement-choice__icon">+</span>
            <span>
              <strong>Ajouter une entree</strong>
              <small>Argent ajoute a la caisse hors commande, retouche ou vente.</small>
            </span>
          </button>
          <button
            v-if="canRecordCaisseExpense"
            type="button"
            class="caisse-movement-choice"
            data-tone="out"
            @click="chooseExpense"
          >
            <span class="caisse-movement-choice__icon">-</span>
            <span>
              <strong>Enregistrer une depense</strong>
              <small>Argent sorti pour l'atelier, le stock ou une charge exceptionnelle.</small>
            </span>
          </button>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.caisse-journal-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.caisse-history-panel {
  min-width: 0;
  overflow: hidden;
}

.caisse-history-header,
.caisse-history-table-wrap {
  max-width: 100%;
}

.caisse-history-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.caisse-history-table {
  min-width: 1120px;
}

.caisse-journal-code {
  color: #24364d;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.caisse-journal-line strong,
.caisse-signed-amount {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.caisse-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.caisse-mobile-actions .action-btn {
  width: 100%;
  min-height: 44px;
  justify-content: center;
  text-align: center;
}

.caisse-mobile-actions__close {
  grid-column: 1 / -1;
}

.caisse-movement-backdrop {
  z-index: 70;
}

.caisse-movement-sheet {
  border-color: rgba(198, 212, 229, 0.9);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(247, 250, 254, 0.99) 100%);
}

.caisse-movement-body {
  gap: 10px;
}

.caisse-movement-choice {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 14px;
  border: 1px solid rgba(203, 215, 229, 0.92);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.96) 100%);
  color: #17314f;
  font: inherit;
  text-align: left;
  box-shadow: 0 12px 30px rgba(18, 44, 76, 0.08);
  cursor: pointer;
}

.caisse-movement-choice[data-tone="in"] {
  border-color: rgba(36, 126, 76, 0.24);
  background:
    radial-gradient(circle at top right, rgba(47, 153, 82, 0.1), transparent 38%),
    linear-gradient(180deg, #ffffff 0%, #f2fbf5 100%);
}

.caisse-movement-choice[data-tone="out"] {
  border-color: rgba(190, 67, 54, 0.24);
  background:
    radial-gradient(circle at top right, rgba(190, 67, 54, 0.1), transparent 38%),
    linear-gradient(180deg, #ffffff 0%, #fff6f5 100%);
}

.caisse-movement-choice__icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #ffffff;
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

.caisse-movement-choice[data-tone="in"] .caisse-movement-choice__icon {
  background: linear-gradient(180deg, #2f9952, #1f6f3d);
}

.caisse-movement-choice[data-tone="out"] .caisse-movement-choice__icon {
  background: linear-gradient(180deg, #c24f44, #9f3028);
}

.caisse-movement-choice strong,
.caisse-movement-choice small {
  display: block;
}

.caisse-movement-choice strong {
  font-size: 15px;
  color: #15314f;
}

.caisse-movement-choice small {
  margin-top: 4px;
  color: #5f7590;
  font-size: 12px;
  line-height: 1.35;
}

@media (max-width: 380px) {
  .caisse-mobile-actions {
    grid-template-columns: 1fr;
  }

  .caisse-mobile-actions__close {
    grid-column: auto;
  }
}

.caisse-journal-line strong[data-tone="in"],
.caisse-signed-amount[data-tone="in"] {
  color: #17643d;
}

.caisse-journal-line strong[data-tone="out"],
.caisse-signed-amount[data-tone="out"] {
  color: #b74235;
}

.caisse-quick-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 10px 0 14px;
}

.caisse-filter-chip {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #fff;
  color: #334155;
  border-radius: 999px;
  min-height: 32px;
  padding: 0 12px;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.caisse-filter-chip:hover,
.caisse-filter-chip.active {
  border-color: rgba(37, 99, 235, 0.45);
  background: #eef5ff;
  color: #255a97;
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.1);
}

.caisse-decision-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px 1px 4px;
  scrollbar-width: none;
}

.caisse-decision-strip::-webkit-scrollbar {
  display: none;
}

.caisse-decision-pill {
  flex: 1 0 158px;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  display: grid;
  gap: 4px;
}

.caisse-decision-pill span {
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.caisse-decision-pill strong {
  color: #24364d;
  font-size: 1rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.caisse-decision-pill[data-tone="in"] strong {
  color: #17643d;
}

.caisse-decision-pill[data-tone="out"] strong {
  color: #b74235;
}

@media (max-width: 767px) {
  .caisse-decision-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow-x: visible;
  }

  .caisse-decision-pill {
    flex: initial;
  }

  .caisse-decision-strip > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
    justify-items: center;
    text-align: center;
  }
}

.caisse-consistency-warning {
  display: grid;
  gap: 5px;
  border-color: #efb8b8;
  background: #fff6f6;
}
.caisse-consistency-warning strong { color: #9a2f2f; }
.caisse-consistency-warning p { margin: 0; color: #754545; line-height: 1.5; }
.caisse-reference-info { border-color: #bfd2e8; background: #f5f9fe; }
.caisse-reference-info strong { color: #234f7f; }
.caisse-reference-info p { margin: 5px 0 0; color: #526a83; line-height: 1.5; }

.caisse-allocation-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-color: rgba(217, 143, 35, 0.34);
  background: linear-gradient(145deg, #fffdf7 0%, #fff7e8 100%);
}

.caisse-allocation-warning > div { display: grid; gap: 5px; }
.caisse-allocation-warning strong { color: #7a4b08; }
.caisse-allocation-warning p { margin: 0; color: #765d37; line-height: 1.5; }
.caisse-allocation-warning .action-btn { flex: 0 0 auto; }

@media (max-width: 767px) {
  .caisse-allocation-warning { align-items: stretch; flex-direction: column; }
  .caisse-allocation-warning .action-btn { width: 100%; justify-content: center; }
}
</style>
