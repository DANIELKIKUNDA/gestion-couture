<script setup>
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import MobileStateError from "../mobile/MobileStateError.vue";
import MobileStateLoading from "../mobile/MobileStateLoading.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";
import VenteDetailLinesMobileList from "./VenteDetailLinesMobileList.vue";
import VenteDetailOverviewCards from "./VenteDetailOverviewCards.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  venteDetailPrimaryAction: { type: Object, default: null },
  detailVente: { type: Object, default: null },
  detailVenteFacture: { type: Object, default: null },
  detailVenteError: { type: String, default: "" },
  detailVenteLoading: { type: Boolean, default: false },
  caisseOuverte: { type: Boolean, default: false },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  openRoute: { type: Function, required: true },
  onEmettreFactureVenteDetail: { type: Function, required: true },
  onVoirFactureParOrigine: { type: Function, required: true },
  onImprimerFactureParOrigine: { type: Function, required: true },
  onValiderVente: { type: Function, required: true },
  onValiderVenteEtFacturer: { type: Function, required: true },
  onAnnulerVente: { type: Function, required: true }
});
</script>

<template>
  <section class="commande-detail">
    <MobilePageLayout :has-action="isMobileViewport && !!venteDetailPrimaryAction">
      <template #header>
        <article class="panel panel-header detail-header">
          <MobileSectionHeader
            eyebrow="Vente"
            title="Detail vente"
            :subtitle="detailVente ? `ID: ${detailVente.idVente}` : 'Consultez la vente et ses lignes en lecture seule.'"
          />
          <div class="row-actions">
            <button class="mini-btn" @click="openRoute('stockVentes')">Retour</button>
            <button
              class="mini-btn"
              v-if="detailVente && detailVente.statut === 'VALIDEE' && !detailVenteFacture"
              @click="onEmettreFactureVenteDetail"
            >
              Emettre facture
            </button>
            <button class="mini-btn" v-if="detailVenteFacture" @click="onVoirFactureParOrigine('VENTE', detailVente.idVente)">
              Voir facture
            </button>
            <button class="mini-btn" v-if="detailVenteFacture" @click="onImprimerFactureParOrigine('VENTE', detailVente.idVente)">
              {{ isMobileViewport ? "Telecharger facture" : "Imprimer facture" }}
            </button>
            <button
              v-if="!isMobileViewport && detailVente && detailVente.statut === 'BROUILLON'"
              class="action-btn blue"
              :disabled="!caisseOuverte"
              :title="!caisseOuverte ? 'Caisse cloturee' : ''"
              @click="onValiderVente(detailVente)"
            >
              Valider
            </button>
            <button
              class="mini-btn"
              v-if="detailVente && detailVente.statut === 'BROUILLON'"
              :disabled="!caisseOuverte"
              :title="!caisseOuverte ? 'Caisse cloturee' : ''"
              @click="onValiderVenteEtFacturer(detailVente)"
            >
              Valider + facture
            </button>
            <button
              :class="isMobileViewport ? 'mini-btn' : 'action-btn red'"
              v-if="detailVente && detailVente.statut === 'BROUILLON'"
              @click="onAnnulerVente(detailVente)"
            >
              Annuler
            </button>
          </div>
        </article>
      </template>

      <ResponsiveDataContainer v-if="detailVenteError" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateError title="Erreur detail vente" :description="detailVenteError" />
        </template>
        <template #desktop>
          <article class="panel error-panel">
            <strong>Erreur detail vente</strong>
            <p>{{ detailVenteError }}</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <ResponsiveDataContainer v-else-if="detailVenteLoading" :mobile="isMobileViewport">
        <template #mobile>
          <MobileStateLoading title="Chargement de la vente" description="Preparation des informations detaillees..." />
        </template>
        <template #desktop>
          <article class="panel">
            <p>Chargement de la vente...</p>
          </article>
        </template>
      </ResponsiveDataContainer>

      <template v-else-if="detailVente">
        <ResponsiveDataContainer :mobile="isMobileViewport">
          <template #mobile>
            <VenteDetailOverviewCards
              :vente="detailVente"
              :facture-number="detailVenteFacture ? detailVenteFacture.numeroFacture : ''"
              :format-currency="formatCurrency"
              :format-date-time="formatDateTime"
            />
          </template>
          <template #desktop>
            <article class="panel detail-grid">
              <div>
                <h4>Informations vente</h4>
                <p><strong>Date:</strong> {{ formatDateTime(detailVente.date) }}</p>
                <p><strong>Statut:</strong> {{ detailVente.statut }}</p>
                <p><strong>Facture:</strong> {{ detailVenteFacture ? detailVenteFacture.numeroFacture : "Non emise" }}</p>
                <p><strong>Reference caisse:</strong> {{ detailVente.referenceCaisse || "-" }}</p>
                <p v-if="detailVente.statut === 'ANNULEE'"><strong>Motif annulation:</strong> {{ detailVente.motifAnnulation || "-" }}</p>
              </div>
              <div>
                <h4>Resume financier</h4>
                <p><strong>Total:</strong> {{ formatCurrency(detailVente.total) }}</p>
              </div>
            </article>
          </template>
        </ResponsiveDataContainer>

        <ResponsiveDataContainer :mobile="isMobileViewport">
          <template #mobile>
            <article class="panel">
              <MobileSectionHeader
                title="Lignes de vente"
                subtitle="Lecture detaillee des articles et quantites vendus."
              />
              <VenteDetailLinesMobileList
                :items="detailVente.lignesVente"
                :format-currency="formatCurrency"
              />
            </article>
          </template>
          <template #desktop>
            <article class="panel">
              <div class="panel-header detail-panel-header">
                <h4>Lignes de vente</h4>
                <span class="helper">Lecture seule</span>
              </div>
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Quantite</th>
                    <th>Prix unitaire</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ligne in detailVente.lignesVente" :key="ligne.idLigne">
                    <td data-label="Article">{{ ligne.libelleArticle || ligne.idArticle }}</td>
                    <td data-label="Quantite">{{ ligne.quantite }}</td>
                    <td data-label="Prix unitaire">{{ formatCurrency(ligne.prixUnitaire) }}</td>
                  </tr>
                  <tr v-if="detailVente.lignesVente.length === 0">
                    <td colspan="3">Aucune ligne.</td>
                  </tr>
                </tbody>
              </table>
            </article>
          </template>
        </ResponsiveDataContainer>
      </template>

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport && venteDetailPrimaryAction"
          title="Action principale"
          :subtitle="venteDetailPrimaryAction.subtitle"
        >
          <button
            :class="`action-btn ${venteDetailPrimaryAction.tone}`"
            :disabled="venteDetailPrimaryAction.disabled"
            @click="venteDetailPrimaryAction.handler"
          >
            {{ venteDetailPrimaryAction.label }}
          </button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
