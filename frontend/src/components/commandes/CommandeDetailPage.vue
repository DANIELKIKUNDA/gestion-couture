<script setup>
import CommandeDetailEventMobileList from "./CommandeDetailEventMobileList.vue";
import CommandeDetailPaymentMobileList from "./CommandeDetailPaymentMobileList.vue";
import CommandeMediaGallery from "./CommandeMediaGallery.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import MobileStateLoading from "../mobile/MobileStateLoading.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  commandeDetailPrimaryAction: { type: Object, default: null },
  detailCommande: { type: Object, default: null },
  detailError: { type: String, default: "" },
  detailLoading: { type: Boolean, default: false },
  detailPaiementsLoading: { type: Boolean, default: false },
  canEmitCommandeDetailFacture: { type: Boolean, default: false },
  detailCommandeFacture: { type: Object, default: null },
  canPayerDetail: { type: Boolean, default: false },
  canLivrerDetail: { type: Boolean, default: false },
  canTerminerDetail: { type: Boolean, default: false },
  canAnnulerDetail: { type: Boolean, default: false },
  detailCommandeView: { type: Object, default: () => ({}) },
  detailCommandeItemCards: { type: Array, default: () => [] },
  detailSoldeRestant: { type: Number, default: 0 },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  humanizeContactLabel: { type: Function, required: true },
  detailCommandeContactProfile: { type: Object, default: null },
  detailCommandeContactMessagePreview: { type: String, default: "" },
  buildPhoneDialHref: { type: Function, required: true },
  buildPreferredWhatsAppHref: { type: Function, required: true },
  copyTextToClipboard: { type: Function, required: true },
  detailCommandeHistoryPanels: { type: Object, required: true },
  detailPaiementsPaged: { type: Array, default: () => [] },
  detailPaiements: { type: Array, default: () => [] },
  detailPaiementsLoadingMore: { type: Boolean, default: false },
  detailPaiementsInfiniteEndReached: { type: Boolean, default: false },
  detailPaiementsInfiniteSentinelRef: { type: Function, required: true },
  detailCommandeEventsPaged: { type: Array, default: () => [] },
  detailCommandeEvents: { type: Array, default: () => [] },
  detailCommandeEventsLoading: { type: Boolean, default: false },
  detailCommandeEventsLoadingMore: { type: Boolean, default: false },
  detailCommandeEventsInfiniteEndReached: { type: Boolean, default: false },
  detailCommandeEventsInfiniteSentinelRef: { type: Function, required: true },
  commandeItemPhotoDialog: { type: Object, required: true },
  commandeItemPhotoDialogItems: { type: Array, default: () => [] },
  detailCommandeMediaLoading: { type: Boolean, default: false },
  detailCommandeMediaError: { type: String, default: "" },
  detailCommandeMediaUploading: { type: Boolean, default: false },
  detailCommandeMediaActionId: { type: String, default: "" },
  openRoute: { type: Function, required: true },
  onEmettreFactureCommandeDetail: { type: Function, required: true },
  onVoirFactureParOrigine: { type: Function, required: true },
  onImprimerFactureParOrigine: { type: Function, required: true },
  onPaiementDetail: { type: Function, required: true },
  onLivrerDetail: { type: Function, required: true },
  onTerminerDetail: { type: Function, required: true },
  onAnnulerDetail: { type: Function, required: true },
  onPaiementDetailItem: { type: Function, required: true },
  openCommandeItemEditModal: { type: Function, required: true },
  updateCommandeItemStatus: { type: Function, required: true },
  openCommandeItemPhotoDialog: { type: Function, required: true },
  openClientConsultationFromDetail: { type: Function, required: true },
  closeCommandeItemPhotoDialog: { type: Function, required: true },
  uploadCommandeMediaForCurrentItem: { type: Function, required: true },
  openCommandeMedia: { type: Function, required: true },
  deleteCommandeMedia: { type: Function, required: true },
  setCommandeMediaPrimary: { type: Function, required: true },
  moveCommandeMedia: { type: Function, required: true },
  saveCommandeMediaNote: { type: Function, required: true }
});
</script>

<template>
  <section class="commande-detail">
    <MobilePageLayout :has-action="isMobileViewport && !!commandeDetailPrimaryAction">
      <template #header>
        <article class="panel panel-header detail-header">
          <MobileSectionHeader
            eyebrow="Commande"
            title="Detail commande"
            :subtitle="detailCommande ? `ID: ${detailCommande.idCommande}` : 'Suivez la commande, ses paiements et son historique.'"
          />
          <div class="row-actions">
            <button class="mini-btn" @click="openRoute('commandes')">Retour</button>
            <button
              v-show="!isMobileViewport && canEmitCommandeDetailFacture"
              class="action-btn blue"
              @click="onEmettreFactureCommandeDetail"
              :disabled="detailLoading"
            >
              Emettre facture
            </button>
            <button class="mini-btn" v-show="!!detailCommandeFacture" @click="onVoirFactureParOrigine('COMMANDE', detailCommande.idCommande)">
              Voir facture
            </button>
            <button class="mini-btn" v-show="!!detailCommandeFacture" @click="onImprimerFactureParOrigine('COMMANDE', detailCommande.idCommande)">
              {{ isMobileViewport ? "Telecharger facture" : "Imprimer facture" }}
            </button>
            <button v-show="!isMobileViewport && canPayerDetail" class="action-btn green" @click="onPaiementDetail" :disabled="detailLoading || detailPaiementsLoading">
              Payer
            </button>
            <button v-show="!isMobileViewport && canLivrerDetail" class="action-btn blue" @click="onLivrerDetail" :disabled="detailLoading">
              Marquer comme livré
            </button>
            <button v-show="!isMobileViewport && canTerminerDetail" class="action-btn blue" @click="onTerminerDetail" :disabled="detailLoading">
              Marquer comme terminé
            </button>
            <button :class="isMobileViewport ? 'mini-btn' : 'action-btn red'" v-show="canAnnulerDetail" @click="onAnnulerDetail" :disabled="detailLoading">
              Annuler
            </button>
          </div>
        </article>
      </template>

      <ResponsiveDataContainer v-show="!detailCommande && !!detailError" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateError title="Detail commande" :description="detailError" />
        </template>
        <template #desktop>
          <article class="panel error-panel">
            <strong>Detail commande</strong>
            <p>{{ detailError }}</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <ResponsiveDataContainer v-show="!detailCommande && detailLoading && !detailError" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateLoading title="Chargement de la commande" description="Preparation des informations detaillees..." />
        </template>
        <template #desktop>
          <article class="panel">
            <p>Chargement de la commande...</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <div v-show="!!detailCommande">
        <article class="panel detail-summary-shell">
          <div class="detail-summary-columns">
            <section class="detail-summary-column">
              <div class="detail-summary-heading">
                <p class="mobile-overline">Identite</p>
                <h4>Commande</h4>
              </div>
              <div class="detail-summary-list">
                <p><strong>Client : </strong>{{ detailCommandeView.clientNom || detailCommandeView.idClient || "-" }}</p>
                <p><strong>Description : </strong>{{ detailCommandeView.descriptionCommande || "-" }}</p>
                <p><strong>Statut : </strong><span class="status-pill" :data-status="detailCommandeView.statutCommande || ''">{{ detailCommandeView.statutCommande || "-" }}</span></p>
                <p><strong>Facture : </strong>{{ detailCommandeFacture ? detailCommandeFacture.numeroFacture : "Non emise" }}</p>
                <p><strong>Date creation : </strong>{{ detailCommandeView.dateCreation || "-" }}</p>
                <p><strong>Date prevue : </strong>{{ detailCommandeView.datePrevue || "-" }}</p>
              </div>
            </section>
            <section class="detail-summary-column">
              <div class="detail-summary-heading">
                <p class="mobile-overline">Habits</p>
                <h4>Habits de la commande</h4>
              </div>
              <div class="detail-summary-list">
                <p><strong>Nombre d'habits : </strong>{{ detailCommandeItemCards.length }}</p>
                <ol class="detail-numbered-list">
                  <li v-for="item in detailCommandeItemCards" :key="`cmd-summary-${item.id}`">{{ item.title }}</li>
                </ol>
              </div>
            </section>
            <section class="detail-summary-column">
              <div class="detail-summary-heading">
                <p class="mobile-overline">Finance</p>
                <h4>Resume financier</h4>
              </div>
              <div class="detail-finance-list">
                <p class="detail-finance-row"><span>Total : </span><strong class="detail-finance-value blue">{{ formatCurrency(detailCommandeView.montantTotal) }}</strong></p>
                <p class="detail-finance-row"><span>Paye : </span><strong class="detail-finance-value green">{{ formatCurrency(detailCommandeView.montantPaye) }}</strong></p>
                <p class="detail-finance-row"><span>Reste : </span><strong class="detail-finance-value red">{{ formatCurrency(detailSoldeRestant) }}</strong></p>
              </div>
            </section>
          </div>
        </article>

        <article class="panel order-lines-panel detail-items-shell" v-show="detailCommandeItemCards.length > 0">
          <div class="order-lines-head">
            <div>
              <p class="mobile-overline">Habits</p>
              <h4>Habits de la commande</h4>
            </div>
            <span class="status-chip">{{ detailCommandeItemCards.length }} habit(s)</span>
          </div>
          <div class="order-lines-list detail-items-list">
            <article v-for="item in detailCommandeItemCards" :key="`cmd-item-card-${item.id}`" class="order-line-card detail-item-card">
              <div class="order-line-card-head">
                <div>
                  <p class="detail-item-index">Habit {{ item.index }}</p>
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
                  <li v-for="(line, idx) in item.mesuresLines" :key="`cmd-item-line-${item.id}-${idx}`">{{ line }}</li>
                </ul>
                <p v-show="item.mesuresLines.length === 0" class="helper">Aucune mesure renseignee.</p>
              </div>
              <div class="row-actions detail-item-actions">
                <button v-show="item.canPay" class="mini-btn green" :disabled="detailLoading || detailPaiementsLoading" @click="onPaiementDetailItem(item)">Payer</button>
                <button v-show="item.canEdit" class="mini-btn" :disabled="detailLoading" @click="openCommandeItemEditModal(item)">Modifier</button>
                <button class="mini-btn blue" v-show="item.canAdvanceStatus" :disabled="detailLoading || !item.canAdvanceStatus" @click="updateCommandeItemStatus(item.id)">
                  {{ item.statusActionLabel }}
                </button>
                <button class="mini-btn" :disabled="detailCommandeMediaLoading" @click="openCommandeItemPhotoDialog(item)">
                  Voir photos
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
            <p><strong>Telephone : </strong>{{ detailCommandeContactProfile?.telephone || "-" }}</p>
            <div class="row-actions detail-item-actions">
              <a class="mini-btn blue" :href="buildPhoneDialHref(detailCommandeContactProfile?.telephone)">Appeler</a>
              <a
                class="mini-btn whatsapp"
                :href="buildPreferredWhatsAppHref(detailCommandeContactProfile?.telephone, detailCommandeContactMessagePreview)"
                :target="isMobileViewport ? '_self' : '_blank'"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <button class="mini-btn" @click="copyTextToClipboard(detailCommandeContactProfile?.telephone, 'Numero copie.')">Copier numero</button>
              <button class="mini-btn" @click="openClientConsultationFromDetail(detailCommandeView.idClient)">Voir fiche client</button>
            </div>
          </div>
        </article>

        <article class="panel detail-history-panel">
          <div class="panel-header detail-panel-header">
            <h4>Historique des paiements</h4>
            <button class="mini-btn detail-collapsible-toggle" @click="detailCommandeHistoryPanels.paiements = !detailCommandeHistoryPanels.paiements">
              {{ detailCommandeHistoryPanels.paiements ? "Replier" : "Afficher" }}
            </button>
          </div>
          <div v-show="detailCommandeHistoryPanels.paiements" class="stack">
            <div v-show="isMobileViewport">
              <CommandeDetailPaymentMobileList
                :items="detailPaiementsPaged"
                :loading="detailPaiementsLoading"
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
                  <tr v-for="paiement in detailPaiementsPaged" :key="paiement.idOperation">
                    <td data-label="Date">{{ formatDateTime(paiement.dateOperation || paiement.dateJour) }}</td>
                    <td data-label="Montant">{{ formatCurrency(paiement.montant) }}</td>
                    <td data-label="Mode">{{ paiement.modePaiement || "-" }}</td>
                    <td data-label="Statut">{{ paiement.statutOperation || "-" }}</td>
                    <td data-label="Reference">{{ paiement.motif || paiement.referenceMetier || "-" }}</td>
                  </tr>
                  <tr v-if="!detailPaiementsLoading && detailPaiements.length === 0">
                    <td colspan="5">Aucun paiement enregistre.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              v-if="detailPaiementsPaged.length > 0 && detailPaiementsPaged.length < detailPaiements.length"
              :ref="detailPaiementsInfiniteSentinelRef"
              class="dossier-infinite-sentinel infinite-list-status"
            >
              <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
              <span class="helper">{{ detailPaiementsLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
            </div>
            <div v-else-if="detailPaiementsInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
              <span class="helper">Aucun autre paiement</span>
            </div>
          </div>
        </article>

        <article class="panel detail-history-panel">
          <div class="panel-header detail-panel-header">
            <h4>Historique des evenements</h4>
            <button class="mini-btn detail-collapsible-toggle" @click="detailCommandeHistoryPanels.evenements = !detailCommandeHistoryPanels.evenements">
              {{ detailCommandeHistoryPanels.evenements ? "Replier" : "Afficher" }}
            </button>
          </div>
          <div v-show="detailCommandeHistoryPanels.evenements" class="stack">
            <div v-show="isMobileViewport">
              <CommandeDetailEventMobileList
                :items="detailCommandeEventsPaged"
                :loading="detailCommandeEventsLoading"
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
                  <tr v-for="event in detailCommandeEventsPaged" :key="event.idEvent">
                    <td data-label="Date">{{ formatDateTime(event.dateEvent) }}</td>
                    <td data-label="Evenement">{{ event.typeEventLabel }}</td>
                    <td data-label="Etat precedent"><span class="status-pill" :data-status="event.ancienStatut || ''">{{ event.ancienStatutLabel }}</span></td>
                    <td data-label="Nouvel etat"><span class="status-pill" :data-status="event.nouveauStatut || ''">{{ event.nouveauStatutLabel }}</span></td>
                    <td data-label="Utilisateur">{{ event.utilisateurNom }}</td>
                    <td data-label="Role">{{ event.role }}</td>
                  </tr>
                  <tr v-if="!detailCommandeEventsLoading && detailCommandeEvents.length === 0">
                    <td colspan="6">Aucun evenement enregistre.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              v-if="detailCommandeEventsPaged.length > 0 && detailCommandeEventsPaged.length < detailCommandeEvents.length"
              :ref="detailCommandeEventsInfiniteSentinelRef"
              class="dossier-infinite-sentinel infinite-list-status"
            >
              <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
              <span class="helper">{{ detailCommandeEventsLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
            </div>
            <div v-else-if="detailCommandeEventsInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
              <span class="helper">Aucun autre evenement</span>
            </div>
          </div>
        </article>

        <div v-show="commandeItemPhotoDialog.open" class="detail-photo-dialog-backdrop" @click.self="closeCommandeItemPhotoDialog">
          <article class="panel detail-photo-dialog">
            <div class="panel-header detail-panel-header">
              <div>
                <h4>Photos de l'habit</h4>
                <p class="helper">{{ commandeItemPhotoDialog.title }}</p>
              </div>
              <button class="mini-btn" @click="closeCommandeItemPhotoDialog">Fermer</button>
            </div>
            <p v-show="detailCommandeMediaLoading" class="helper">Chargement des photos...</p>
            <p v-show="!!detailCommandeMediaError" class="helper">{{ detailCommandeMediaError }}</p>
            <CommandeMediaGallery
              v-show="commandeItemPhotoDialog.open"
              :items="commandeItemPhotoDialogItems"
              :loading="detailCommandeMediaLoading"
              :error="detailCommandeMediaError"
              :uploading="detailCommandeMediaUploading"
              :action-id="detailCommandeMediaActionId"
              @upload="uploadCommandeMediaForCurrentItem"
              @open="openCommandeMedia"
              @remove="deleteCommandeMedia"
              @set-primary="setCommandeMediaPrimary"
              @move="moveCommandeMedia"
              @save-note="saveCommandeMediaNote"
            />
            <p v-show="!detailCommandeMediaLoading && commandeItemPhotoDialogItems.length === 0" class="helper">Aucune photo rattachee a cet habit.</p>
          </article>
        </div>
      </div>

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && commandeDetailPrimaryAction"
          title="Action principale"
          :subtitle="commandeDetailPrimaryAction.subtitle"
        >
          <button
            :class="`action-btn ${commandeDetailPrimaryAction.tone}`"
            :disabled="detailLoading || detailPaiementsLoading"
            @click="commandeDetailPrimaryAction.handler"
          >
            {{ commandeDetailPrimaryAction.label }}
          </button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
