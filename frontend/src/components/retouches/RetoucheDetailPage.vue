<script setup>
import RetoucheDetailEventMobileList from "./RetoucheDetailEventMobileList.vue";
import RetoucheDetailPaymentMobileList from "./RetoucheDetailPaymentMobileList.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import MobileStateLoading from "../mobile/MobileStateLoading.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  retoucheDetailPrimaryAction: { type: Object, default: null },
  detailRetouche: { type: Object, default: null },
  detailRetoucheError: { type: String, default: "" },
  detailRetoucheLoading: { type: Boolean, default: false },
  detailRetouchePaiementsLoading: { type: Boolean, default: false },
  canEmitRetoucheDetailFacture: { type: Boolean, default: false },
  detailRetoucheFacture: { type: Object, default: null },
  canPayerRetoucheDetail: { type: Boolean, default: false },
  canLivrerRetoucheDetail: { type: Boolean, default: false },
  canTerminerRetoucheDetail: { type: Boolean, default: false },
  canAnnulerRetoucheDetail: { type: Boolean, default: false },
  detailRetoucheView: { type: Object, default: () => ({}) },
  detailRetoucheItemCards: { type: Array, default: () => [] },
  detailRetoucheSoldeRestant: { type: Number, default: 0 },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  humanizeContactLabel: { type: Function, required: true },
  detailRetoucheContactProfile: { type: Object, default: null },
  detailRetoucheContactMessagePreview: { type: String, default: "" },
  buildPhoneDialHref: { type: Function, required: true },
  buildPreferredWhatsAppHref: { type: Function, required: true },
  copyTextToClipboard: { type: Function, required: true },
  detailRetoucheHistoryPanels: { type: Object, required: true },
  detailRetouchePaiementsPaged: { type: Array, default: () => [] },
  detailRetouchePaiements: { type: Array, default: () => [] },
  detailRetouchePaiementsLoadingMore: { type: Boolean, default: false },
  detailRetouchePaiementsInfiniteEndReached: { type: Boolean, default: false },
  detailRetouchePaiementsInfiniteSentinelRef: { type: Function, required: true },
  detailRetoucheEventsPaged: { type: Array, default: () => [] },
  detailRetoucheEvents: { type: Array, default: () => [] },
  detailRetoucheEventsLoading: { type: Boolean, default: false },
  detailRetoucheEventsLoadingMore: { type: Boolean, default: false },
  detailRetoucheEventsInfiniteEndReached: { type: Boolean, default: false },
  detailRetoucheEventsInfiniteSentinelRef: { type: Function, required: true },
  openRoute: { type: Function, required: true },
  onEmettreFactureRetoucheDetail: { type: Function, required: true },
  onVoirFactureParOrigine: { type: Function, required: true },
  onImprimerFactureParOrigine: { type: Function, required: true },
  onPaiementRetoucheDetail: { type: Function, required: true },
  onLivrerRetoucheDetail: { type: Function, required: true },
  onTerminerRetoucheDetail: { type: Function, required: true },
  onAnnulerRetoucheDetail: { type: Function, required: true },
  onPaiementRetoucheDetailItem: { type: Function, required: true },
  openRetoucheItemEditModal: { type: Function, required: true },
  updateRetoucheItemStatus: { type: Function, required: true },
  openClientConsultationFromDetail: { type: Function, required: true }
});
</script>

<template>
  <section class="commande-detail">
    <MobilePageLayout :has-action="isMobileViewport && !!retoucheDetailPrimaryAction">
      <template #header>
        <article class="panel panel-header detail-header">
          <MobileSectionHeader
            eyebrow="Retouche"
            title="Detail retouche"
            :subtitle="detailRetouche ? `ID: ${detailRetouche.idRetouche}` : 'Suivez la retouche, ses paiements et son historique.'"
          />
          <div class="row-actions">
            <button class="mini-btn" @click="openRoute('retouches')">Retour</button>
            <button
              v-show="!isMobileViewport && canEmitRetoucheDetailFacture"
              class="action-btn blue"
              @click="onEmettreFactureRetoucheDetail"
              :disabled="detailRetoucheLoading"
            >
              Emettre facture
            </button>
            <button class="mini-btn" v-show="!!detailRetoucheFacture" @click="onVoirFactureParOrigine('RETOUCHE', detailRetouche.idRetouche)">
              Voir facture
            </button>
            <button class="mini-btn" v-show="!!detailRetoucheFacture" @click="onImprimerFactureParOrigine('RETOUCHE', detailRetouche.idRetouche)">
              {{ isMobileViewport ? "Telecharger facture" : "Imprimer facture" }}
            </button>
            <button
              v-show="!isMobileViewport && canPayerRetoucheDetail"
              class="action-btn green"
              @click="onPaiementRetoucheDetail"
              :disabled="detailRetoucheLoading || detailRetouchePaiementsLoading"
            >
              Payer
            </button>
            <button v-show="!isMobileViewport && canLivrerRetoucheDetail" class="action-btn blue" @click="onLivrerRetoucheDetail" :disabled="detailRetoucheLoading">
              Marquer comme livré
            </button>
            <button v-show="!isMobileViewport && canTerminerRetoucheDetail" class="action-btn blue" @click="onTerminerRetoucheDetail" :disabled="detailRetoucheLoading">
              Marquer comme terminé
            </button>
            <button :class="isMobileViewport ? 'mini-btn' : 'action-btn red'" v-show="canAnnulerRetoucheDetail" @click="onAnnulerRetoucheDetail" :disabled="detailRetoucheLoading">
              Annuler
            </button>
          </div>
        </article>
      </template>

      <ResponsiveDataContainer v-show="!detailRetouche && !!detailRetoucheError" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateError title="Detail retouche" :description="detailRetoucheError" />
        </template>
        <template #desktop>
          <article class="panel error-panel">
            <strong>Detail retouche</strong>
            <p>{{ detailRetoucheError }}</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <ResponsiveDataContainer v-show="!detailRetouche && detailRetoucheLoading && !detailRetoucheError" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateLoading title="Chargement de la retouche" description="Preparation des informations detaillees..." />
        </template>
        <template #desktop>
          <article class="panel">
            <p>Chargement de la retouche...</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <div v-show="!!detailRetouche">
        <article class="panel detail-summary-shell">
          <div class="detail-summary-columns">
            <section class="detail-summary-column">
              <div class="detail-summary-heading">
                <p class="mobile-overline">Identite</p>
                <h4>Retouche</h4>
              </div>
              <div class="detail-summary-list">
                <p><strong>Client : </strong>{{ detailRetoucheView.clientNom || detailRetoucheView.idClient || "-" }}</p>
                <p><strong>Description : </strong>{{ detailRetoucheView.descriptionRetouche || "-" }}</p>
                <p><strong>Statut : </strong><span class="status-pill" :data-status="detailRetoucheView.statutRetouche || ''">{{ detailRetoucheView.statutRetouche || "-" }}</span></p>
                <p><strong>Facture : </strong>{{ detailRetoucheFacture ? detailRetoucheFacture.numeroFacture : "Non emise" }}</p>
                <p><strong>Date depot : </strong>{{ detailRetoucheView.dateDepot || "-" }}</p>
                <p><strong>Date prevue : </strong>{{ detailRetoucheView.datePrevue || "-" }}</p>
              </div>
            </section>
            <section class="detail-summary-column">
              <div class="detail-summary-heading">
                <p class="mobile-overline">Retouches</p>
                <h4>Retouches de la fiche</h4>
              </div>
              <div class="detail-summary-list">
                <p><strong>Nombre d'interventions : </strong>{{ detailRetoucheItemCards.length }}</p>
                <ol class="detail-numbered-list">
                  <li v-for="item in detailRetoucheItemCards" :key="`ret-summary-${item.id}`">{{ item.title }}</li>
                </ol>
              </div>
            </section>
            <section class="detail-summary-column">
              <div class="detail-summary-heading">
                <p class="mobile-overline">Finance</p>
                <h4>Resume financier</h4>
              </div>
              <div class="detail-finance-list">
                <p class="detail-finance-row"><span>Total : </span><strong class="detail-finance-value blue">{{ formatCurrency(detailRetoucheView.montantTotal) }}</strong></p>
                <p class="detail-finance-row"><span>Paye : </span><strong class="detail-finance-value green">{{ formatCurrency(detailRetoucheView.montantPaye) }}</strong></p>
                <p class="detail-finance-row"><span>Reste : </span><strong class="detail-finance-value red">{{ formatCurrency(detailRetoucheSoldeRestant) }}</strong></p>
              </div>
            </section>
          </div>
        </article>

        <article class="panel order-lines-panel detail-items-shell" v-show="detailRetoucheItemCards.length > 0">
          <div class="order-lines-head">
            <div>
              <p class="mobile-overline">Retouches</p>
              <h4>Interventions de la retouche</h4>
            </div>
            <span class="status-chip">{{ detailRetoucheItemCards.length }} intervention(s)</span>
          </div>
          <div class="order-lines-list detail-items-list">
            <article v-for="item in detailRetoucheItemCards" :key="`ret-item-card-${item.id}`" class="order-line-card detail-item-card">
              <div class="order-line-card-head">
                <div>
                  <p class="detail-item-index">Intervention {{ item.index }}</p>
                  <strong class="detail-item-title">{{ item.title }}</strong>
                </div>
                <span class="status-pill" :data-status="item.statut || ''">{{ item.statut || "-" }}</span>
              </div>
              <div class="detail-item-metrics">
                <p><strong>Montant : </strong><span class="detail-inline-value blue">{{ formatCurrency(item.prix) }}</span></p>
                <p><strong>Reste : </strong><span class="detail-inline-value red">{{ formatCurrency(item.reste) }}</span></p>
                <p><strong>Type : </strong>{{ humanizeContactLabel(item.typeHabit) || item.typeHabit || "-" }}</p>
              </div>
              <div class="detail-item-measures">
                <strong>Mesures</strong>
                <ul v-show="item.mesuresLines.length > 0" class="client-insight-list detail-measures-list">
                  <li v-for="(line, idx) in item.mesuresLines" :key="`ret-item-line-${item.id}-${idx}`">{{ line }}</li>
                </ul>
                <p v-show="item.mesuresLines.length === 0" class="helper">Aucune mesure renseignee.</p>
              </div>
              <div class="row-actions detail-item-actions">
                <button v-show="item.canPay" class="mini-btn green" :disabled="detailRetoucheLoading || detailRetouchePaiementsLoading" @click="onPaiementRetoucheDetailItem(item)">Payer</button>
                <button v-show="item.canEdit" class="mini-btn" :disabled="detailRetoucheLoading" @click="openRetoucheItemEditModal(item)">Modifier</button>
                <button class="mini-btn blue" v-show="item.canAdvanceStatus" :disabled="detailRetoucheLoading || !item.canAdvanceStatus" @click="updateRetoucheItemStatus(item.id)">
                  {{ item.statusActionLabel }}
                </button>
              </div>
            </article>
          </div>
        </article>

        <article class="panel detail-lite-contact">
          <div class="detail-summary-heading">
            <p class="mobile-overline">Client</p>
            <h4>Telephone</h4>
          </div>
          <div class="detail-lite-contact-grid">
            <p><strong>Telephone : </strong>{{ detailRetoucheContactProfile?.telephone || "-" }}</p>
            <div class="row-actions detail-item-actions">
              <a class="mini-btn blue" :href="buildPhoneDialHref(detailRetoucheContactProfile?.telephone)">Appeler</a>
              <a
                class="mini-btn whatsapp"
                :href="buildPreferredWhatsAppHref(detailRetoucheContactProfile?.telephone, detailRetoucheContactMessagePreview)"
                :target="isMobileViewport ? '_self' : '_blank'"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <button class="mini-btn" @click="copyTextToClipboard(detailRetoucheContactProfile?.telephone, 'Numero copie.')">Copier numero</button>
              <button class="mini-btn" @click="openClientConsultationFromDetail(detailRetoucheView.idClient)">Voir fiche client</button>
            </div>
          </div>
        </article>

        <article class="panel detail-history-panel">
          <div class="panel-header detail-panel-header">
            <h4>Historique des paiements</h4>
            <button class="mini-btn detail-collapsible-toggle" @click="detailRetoucheHistoryPanels.paiements = !detailRetoucheHistoryPanels.paiements">
              {{ detailRetoucheHistoryPanels.paiements ? "Replier" : "Afficher" }}
            </button>
          </div>
          <div v-show="detailRetoucheHistoryPanels.paiements" class="stack">
            <div v-show="isMobileViewport">
              <RetoucheDetailPaymentMobileList
                :items="detailRetouchePaiementsPaged"
                :loading="detailRetouchePaiementsLoading"
                :format-currency="formatCurrency"
                :format-date-time="formatDateTime"
              />
            </div>
            <div v-show="!isMobileViewport">
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Montant</th>
                    <th>Mode</th>
                    <th>Statut</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="paiement in detailRetouchePaiementsPaged" :key="paiement.idOperation">
                    <td data-label="Date">{{ formatDateTime(paiement.dateOperation || paiement.dateJour) }}</td>
                    <td data-label="Montant">{{ formatCurrency(paiement.montant) }}</td>
                    <td data-label="Mode">{{ paiement.modePaiement || "-" }}</td>
                    <td data-label="Statut">{{ paiement.statutOperation || "-" }}</td>
                    <td data-label="Reference">{{ paiement.motif || paiement.referenceMetier || "-" }}</td>
                  </tr>
                  <tr v-if="!detailRetouchePaiementsLoading && detailRetouchePaiements.length === 0">
                    <td colspan="5">Aucun paiement enregistre.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              v-if="detailRetouchePaiementsPaged.length > 0 && detailRetouchePaiementsPaged.length < detailRetouchePaiements.length"
              :ref="detailRetouchePaiementsInfiniteSentinelRef"
              class="dossier-infinite-sentinel infinite-list-status"
            >
              <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
              <span class="helper">{{ detailRetouchePaiementsLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
            </div>
            <div v-else-if="detailRetouchePaiementsInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
              <span class="helper">Aucun autre paiement</span>
            </div>
          </div>
        </article>

        <article class="panel detail-history-panel">
          <div class="panel-header detail-panel-header">
            <h4>Historique des evenements</h4>
            <button class="mini-btn detail-collapsible-toggle" @click="detailRetoucheHistoryPanels.evenements = !detailRetoucheHistoryPanels.evenements">
              {{ detailRetoucheHistoryPanels.evenements ? "Replier" : "Afficher" }}
            </button>
          </div>
          <div v-show="detailRetoucheHistoryPanels.evenements" class="stack">
            <div v-show="isMobileViewport">
              <RetoucheDetailEventMobileList
                :items="detailRetoucheEventsPaged"
                :loading="detailRetoucheEventsLoading"
                :format-date-time="formatDateTime"
              />
            </div>
            <div v-show="!isMobileViewport">
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Evenement</th>
                    <th>Etat precedent</th>
                    <th>Nouvel etat</th>
                    <th>Utilisateur</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="event in detailRetoucheEventsPaged" :key="event.idEvent">
                    <td data-label="Date">{{ formatDateTime(event.dateEvent) }}</td>
                    <td data-label="Evenement">{{ event.typeEventLabel }}</td>
                    <td data-label="Etat precedent"><span class="status-pill" :data-status="event.ancienStatut || ''">{{ event.ancienStatutLabel }}</span></td>
                    <td data-label="Nouvel etat"><span class="status-pill" :data-status="event.nouveauStatut || ''">{{ event.nouveauStatutLabel }}</span></td>
                    <td data-label="Utilisateur">{{ event.utilisateurNom }}</td>
                    <td data-label="Role">{{ event.role }}</td>
                  </tr>
                  <tr v-if="!detailRetoucheEventsLoading && detailRetoucheEvents.length === 0">
                    <td colspan="6">Aucun evenement enregistre.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              v-if="detailRetoucheEventsPaged.length > 0 && detailRetoucheEventsPaged.length < detailRetoucheEvents.length"
              :ref="detailRetoucheEventsInfiniteSentinelRef"
              class="dossier-infinite-sentinel infinite-list-status"
            >
              <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
              <span class="helper">{{ detailRetoucheEventsLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
            </div>
            <div v-else-if="detailRetoucheEventsInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
              <span class="helper">Aucun autre evenement</span>
            </div>
          </div>
        </article>
      </div>

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && retoucheDetailPrimaryAction"
          title="Action principale"
          :subtitle="retoucheDetailPrimaryAction.subtitle"
        >
          <button
            :class="`action-btn ${retoucheDetailPrimaryAction.tone}`"
            :disabled="detailRetoucheLoading || detailRetouchePaiementsLoading"
            @click="retoucheDetailPrimaryAction.handler"
          >
            {{ retoucheDetailPrimaryAction.label }}
          </button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
