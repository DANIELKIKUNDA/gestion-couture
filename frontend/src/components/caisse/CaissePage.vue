<script setup>
import CaisseOperationMobileList from "./CaisseOperationMobileList.vue";
import CaisseOverviewCards from "./CaisseOverviewCards.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "../mobile/MobileStateEmpty.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  caisseOuverte: { type: Boolean, default: false },
  canOpenCaisse: { type: Boolean, default: false },
  canRecordCaisseExpense: { type: Boolean, default: false },
  canCloseCaisse: { type: Boolean, default: false },
  caisseJour: { type: Object, default: null },
  caisseStatus: { type: String, default: "" },
  iconPaths: { type: Object, default: () => ({}) },
  networkIsOnline: { type: Boolean, default: true },
  caisseTotals: { type: Object, default: () => ({}) },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  formatCaisseOuvertePar: { type: Function, required: true },
  formatCaisseClotureePar: { type: Function, required: true },
  caisseOperations: { type: Array, default: () => [] },
  caisseOperationsPaged: { type: Array, default: () => [] },
  depenseTypeLabel: { type: Function, required: true },
  caisseOperationsLoadingMore: { type: Boolean, default: false },
  caisseOperationsInfiniteEndReached: { type: Boolean, default: false }
});

const emit = defineEmits(["ouvrir-caisse", "depense-caisse", "cloturer-caisse"]);
</script>

<template>
  <section class="commande-detail">
    <MobilePageLayout :has-action="isMobileViewport && ((!caisseOuverte && canOpenCaisse) || (caisseOuverte && canRecordCaisseExpense) || (caisseOuverte && !canRecordCaisseExpense && canCloseCaisse))">
      <article class="panel panel-header detail-header" :class="{ 'caisse-header-closed': !caisseOuverte }">
        <div>
          <h3>Caisse du jour</h3>
          <p v-if="caisseJour" class="helper">ID: {{ caisseJour.idCaisseJour }} · Date: {{ caisseJour.date }}</p>
        </div>
        <div class="row-actions">
          <span class="status-pill" :data-status="caisseStatus">
            <svg v-if="!caisseOuverte" class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.lock" :key="`lock-${i}`" :d="path" />
            </svg>
            {{ caisseStatus }}
          </span>
          <button v-if="!isMobileViewport && !caisseOuverte && canOpenCaisse" class="action-btn green" @click="emit('ouvrir-caisse')">Ouvrir la caisse</button>
          <button v-if="!isMobileViewport && caisseOuverte && canRecordCaisseExpense" class="action-btn amber" @click="emit('depense-caisse')">Enregistrer depense</button>
          <button v-if="!isMobileViewport && caisseOuverte && canCloseCaisse" class="action-btn red" @click="emit('cloturer-caisse')">Cloturer la caisse</button>
          <button v-if="isMobileViewport && caisseOuverte && canCloseCaisse" class="mini-btn" @click="emit('cloturer-caisse')">Cloturer</button>
        </div>
      </article>

      <article v-if="caisseJour && !caisseOuverte" class="panel caisse-locked">
        <strong>Caisse cloturee</strong>
        <p>Aucune ecriture n'est autorisee apres cloture.</p>
      </article>

      <ResponsiveDataContainer v-if="!caisseJour" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateError
            title="Caisse indisponible"
            :description="networkIsOnline ? `Aucune caisse du jour n'a ete chargee.` : 'Aucune caisse disponible hors ligne.'"
          />
        </template>
        <template #desktop>
          <article class="panel error-panel">
            <strong>Caisse</strong>
            <p>{{ networkIsOnline ? "Aucune caisse du jour n'a ete chargee." : "Aucune caisse disponible hors ligne." }}</p>
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
                title="Historique des operations"
                :subtitle="`${caisseOperations.length} operation(s) enregistree(s)`"
              />

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
                :depense-type-label="depenseTypeLabel"
              />

              <div
                v-if="caisseOperationsPaged.length > 0 && caisseOperationsPaged.length < caisseOperations.length"
                ref="caisseInfiniteSentinel"
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
                <p class="caisse-row"><strong>Solde courant:</strong> <span class="caisse-value">{{ formatCurrency(caisseJour.soldeCourant) }}</span></p>
                <p class="caisse-row"><strong>Ouverte par:</strong> <span class="caisse-value">{{ formatCaisseOuvertePar(caisseJour) }}</span></p>
                <p class="caisse-row"><strong>Date d'ouverture:</strong> <span class="caisse-value">{{ formatDateTime(caisseJour.dateOuverture) }}</span></p>
                <p class="caisse-row"><strong>Cloturee par:</strong> <span class="caisse-value">{{ formatCaisseClotureePar(caisseJour) }}</span></p>
                <p class="caisse-row"><strong>Date de cloture:</strong> <span class="caisse-value">{{ formatDateTime(caisseJour.dateCloture) }}</span></p>
              </div>
              <div class="caisse-summary-col">
                <h4>Resume financier</h4>
                <p class="caisse-row"><strong>Total entrees:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalEntrees) }}</span></p>
                <p class="caisse-row"><strong>Total sorties:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalSorties) }}</span></p>
                <p class="caisse-row"><strong>Solde:</strong> <span class="caisse-value">{{ formatCurrency(caisseJour.soldeCourant) }}</span></p>
              </div>
              <div class="caisse-summary-col">
                <h4>Resultat du jour</h4>
                <p class="caisse-row"><strong>Entrees du jour:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalEntrees) }}</span></p>
                <p class="caisse-row"><strong>Depenses quotidiennes:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.totalSortiesQuotidiennes) }}</span></p>
                <p class="caisse-row"><strong>Resultat journalier:</strong> <span class="caisse-value">{{ formatCurrency(caisseTotals.resultatJournalier) }}</span></p>
              </div>
            </article>

            <article class="panel">
              <div class="panel-header detail-panel-header">
                <h4>Historique des operations</h4>
                <span class="helper">Lecture seule</span>
              </div>
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Montant</th>
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
                    <td data-label="Type">{{ op.typeOperation }}</td>
                    <td data-label="Montant">{{ formatCurrency(op.montant) }}</td>
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
                    <td colspan="10">Aucune operation enregistree.</td>
                  </tr>
                </tbody>
              </table>
              <div
                v-if="caisseOperationsPaged.length > 0 && caisseOperationsPaged.length < caisseOperations.length"
                ref="caisseInfiniteSentinel"
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

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && !caisseOuverte && canOpenCaisse"
          title="Action principale"
          subtitle="Ouvrez la caisse du jour pour autoriser les ecritures."
        >
          <button class="action-btn green" @click="emit('ouvrir-caisse')">Ouvrir la caisse</button>
        </MobilePrimaryActionBar>

        <MobilePrimaryActionBar
          v-else-if="isMobileViewport && caisseOuverte && canRecordCaisseExpense"
          title="Action principale"
          subtitle="Enregistrez rapidement une depense sur la caisse ouverte."
        >
          <button class="action-btn amber" @click="emit('depense-caisse')">Enregistrer depense</button>
        </MobilePrimaryActionBar>

        <MobilePrimaryActionBar
          v-else-if="isMobileViewport && caisseOuverte && !canRecordCaisseExpense && canCloseCaisse"
          title="Action principale"
          subtitle="Cloturez la caisse lorsque les operations sont terminees."
        >
          <button class="action-btn red" @click="emit('cloturer-caisse')">Cloturer la caisse</button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
