<script setup>
import DashboardMetricCardGrid from "../dashboard/DashboardMetricCardGrid.vue";
import MobileFilterBlock from "../mobile/MobileFilterBlock.vue";
import MobilePageLayout from "../mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "../mobile/MobilePrimaryActionBar.vue";
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";
import FactureMobileList from "./FactureMobileList.vue";

const props = defineProps({
  isMobileViewport: { type: Boolean, default: false },
  factureSection: { type: String, default: "liste" },
  factureMobileFiltersOpen: { type: Boolean, default: false },
  factureFilterSummary: { type: [Array, String], default: () => [] },
  factureFilters: { type: Object, required: true },
  factureStatusOptions: { type: Array, default: () => [] },
  soldeOptions: { type: Array, default: () => [] },
  facturesFiltered: { type: Array, default: () => [] },
  facturesMobileKpiCards: { type: Array, default: () => [] },
  facturesKpi: { type: Object, default: () => ({ total: 0, reglees: 0, enAttente: 0, montantTotal: 0 }) },
  formatFactureCurrency: { type: Function, required: true },
  facturesPaged: { type: Array, default: () => [] },
  formatDateShort: { type: Function, required: true },
  onVoirFacture: { type: Function, required: true },
  onImprimerFacture: { type: Function, required: true },
  onGenererPdfFacture: { type: Function, required: true },
  facturesLoadingMore: { type: Boolean, default: false },
  facturesInfiniteEndReached: { type: Boolean, default: false },
  factureInfiniteSentinelRef: { type: Function, required: true },
  onEmettreFacture: { type: Function, required: true },
  openRoute: { type: Function, required: true },
  resetFactureFilters: { type: Function, required: true }
});

const emit = defineEmits(["update:factureSection", "update:factureMobileFiltersOpen"]);

function setFactureSection(value) {
  emit("update:factureSection", value);
}

function setFactureMobileFiltersOpen(value) {
  emit("update:factureMobileFiltersOpen", value);
}
</script>

<template>
  <section class="commandes-page">
    <MobilePageLayout :has-action="isMobileViewport">
      <template #header>
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Facturation"
            title="Factures"
            subtitle="Module immuable en lecture seule. Le statut est derive de la caisse."
          />
          <div class="row-actions">
            <button v-if="!isMobileViewport" class="action-btn blue" @click="onEmettreFacture">Emettre facture</button>
          </div>
        </article>
      </template>

      <article class="panel">
        <div class="segmented">
          <button class="mini-btn" :class="{ active: factureSection === 'liste' }" @click="setFactureSection('liste')">Liste</button>
          <button class="mini-btn" :class="{ active: factureSection === 'indicateurs' }" @click="setFactureSection('indicateurs')">Indicateurs</button>
          <button class="mini-btn" :class="{ active: factureSection === 'actions' }" @click="setFactureSection('actions')">Actions rapides</button>
        </div>
      </article>

      <article v-show="factureSection === 'liste'" class="panel">
        <template v-if="isMobileViewport">
          <MobileFilterBlock
            title="Filtres factures"
            :summary="factureFilterSummary"
            :open="factureMobileFiltersOpen"
            @toggle="setFactureMobileFiltersOpen(!factureMobileFiltersOpen)"
          >
            <div class="filters compact">
              <select v-model="factureFilters.statut">
                <option v-for="status in factureStatusOptions" :key="`fac-st-${status}`" :value="status">
                  {{ status === "ALL" ? "Tous statuts" : status }}
                </option>
              </select>
              <select v-model="factureFilters.source">
                <option value="ALL">Toutes origines</option>
                <option value="COMMANDE">Commande</option>
                <option value="RETOUCHE">Retouche</option>
                <option value="VENTE">Vente</option>
              </select>
              <select v-model="factureFilters.soldeRestant">
                <option v-for="option in soldeOptions" :key="`fac-solde-${option.value}`" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <input v-model="factureFilters.recherche" type="text" placeholder="Recherche numero / client / origine" />
            </div>
            <div class="panel-footer">
              <button class="mini-btn" @click="resetFactureFilters">Reinitialiser filtres</button>
            </div>
          </MobileFilterBlock>
        </template>
        <template v-else>
          <h3>Filtres factures</h3>
          <div class="filters compact">
            <select v-model="factureFilters.statut">
              <option v-for="status in factureStatusOptions" :key="`fac-st-${status}`" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <select v-model="factureFilters.source">
              <option value="ALL">Toutes origines</option>
              <option value="COMMANDE">Commande</option>
              <option value="RETOUCHE">Retouche</option>
              <option value="VENTE">Vente</option>
            </select>
            <select v-model="factureFilters.soldeRestant">
              <option v-for="option in soldeOptions" :key="`fac-solde-${option.value}`" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <input v-model="factureFilters.recherche" type="text" placeholder="Recherche numero / client / origine" />
          </div>
          <div class="panel-footer">
            <button class="mini-btn" @click="resetFactureFilters">Reinitialiser filtres</button>
          </div>
        </template>
        <p v-if="factureFilters.recherche.trim()" class="helper">
          Recherche active - {{ facturesFiltered.length }} resultat(s)
        </p>
      </article>

      <article v-show="factureSection === 'indicateurs'" class="panel">
        <template v-if="isMobileViewport">
          <MobileSectionHeader
            title="Indicateurs factures"
            subtitle="Lecture rapide des statuts et montants sur la selection courante."
          />
          <DashboardMetricCardGrid :items="facturesMobileKpiCards" />
        </template>
        <template v-else>
          <h3>Indicateurs factures</h3>
          <div class="kpi-grid legacy-kpi-grid">
            <div class="kpi-card legacy-kpi" data-tone="blue">
              <div class="kpi-head"><span>Total</span></div>
              <strong>{{ facturesKpi.total }}</strong>
            </div>
            <div class="kpi-card legacy-kpi" data-tone="green">
              <div class="kpi-head"><span>Reglees</span></div>
              <strong>{{ facturesKpi.reglees }}</strong>
            </div>
            <div class="kpi-card legacy-kpi" data-tone="amber">
              <div class="kpi-head"><span>En attente</span></div>
              <strong>{{ facturesKpi.enAttente }}</strong>
            </div>
            <div class="kpi-card legacy-kpi" data-tone="slate">
              <div class="kpi-head"><span>Montant total</span></div>
              <strong>{{ formatFactureCurrency(facturesKpi.montantTotal) }}</strong>
            </div>
          </div>
        </template>
      </article>

      <article v-show="factureSection === 'actions'" class="panel">
        <div class="quick-actions">
          <button class="action-btn blue" @click="onEmettreFacture">Emettre facture</button>
          <button class="action-btn green" @click="setFactureSection('liste')">Voir la liste</button>
          <button class="action-btn amber" @click="openRoute('audit')">Ouvrir audit</button>
        </div>
      </article>

      <article v-show="factureSection === 'liste'" class="panel">
        <ResponsiveDataContainer :mobile="isMobileViewport">
          <template #mobile>
            <FactureMobileList
              :items="facturesPaged"
              :format-currency="formatFactureCurrency"
              :format-date="formatDateShort"
              @view="onVoirFacture"
            />
          </template>
          <template #desktop>
            <div class="table-scroll-x">
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Client</th>
                    <th>Origine</th>
                    <th>Date emission</th>
                    <th>Montant total</th>
                    <th>Montant paye</th>
                    <th>Solde</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="facture in facturesPaged" :key="facture.idFacture">
                    <td data-label="Numero">{{ facture.numeroFacture }}</td>
                    <td data-label="Client">{{ facture.client?.nom || "-" }}</td>
                    <td data-label="Origine">{{ facture.typeOrigine }} / {{ facture.idOrigine }}</td>
                    <td data-label="Date emission">{{ formatDateShort(facture.dateEmission) }}</td>
                    <td data-label="Montant total">{{ formatFactureCurrency(facture.montantTotal) }}</td>
                    <td data-label="Montant paye">{{ formatFactureCurrency(facture.montantPaye) }}</td>
                    <td data-label="Solde">{{ formatFactureCurrency(facture.solde) }}</td>
                    <td data-label="Statut">{{ facture.statut }}</td>
                    <td class="actions-cell">
                      <button class="mini-btn" @click="onVoirFacture(facture)">Voir</button>
                      <button class="mini-btn" @click="onImprimerFacture(facture)">Imprimer</button>
                      <button class="mini-btn" @click="onGenererPdfFacture(facture)">PDF</button>
                    </td>
                  </tr>
                  <tr v-if="facturesFiltered.length === 0">
                    <td colspan="9">Aucune facture ne correspond aux filtres actuels.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </ResponsiveDataContainer>
        <div
          v-if="facturesPaged.length > 0 && facturesPaged.length < facturesFiltered.length"
          :ref="factureInfiniteSentinelRef"
          class="dossier-infinite-sentinel infinite-list-status"
        >
          <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
          <span class="helper">{{ facturesLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
        </div>
        <div v-else-if="facturesInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
          <span class="helper">Aucune autre facture</span>
        </div>
      </article>

      <template #action>
        <MobilePrimaryActionBar
          v-if="isMobileViewport"
          title="Action principale"
          subtitle="Emettez une nouvelle facture depuis une origine disponible."
        >
          <button class="action-btn blue" @click="onEmettreFacture">Emettre facture</button>
        </MobilePrimaryActionBar>
      </template>
    </MobilePageLayout>
  </section>
</template>
