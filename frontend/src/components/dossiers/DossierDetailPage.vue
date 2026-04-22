<script setup>
import MobileSectionHeader from "../mobile/MobileSectionHeader.vue";
import ResponsiveDataContainer from "../mobile/ResponsiveDataContainer.vue";

defineProps({
  isMobileViewport: { type: Boolean, default: false },
  detailDossier: { type: Object, default: null },
  detailDossierLoading: { type: Boolean, default: false },
  detailDossierError: { type: String, default: "" },
  dossierWorkspaceHasDocuments: { type: Boolean, default: false },
  dossierRetoucheCards: { type: Array, default: () => [] },
  dossierCommandeCards: { type: Array, default: () => [] },
  dossierWorkspaceActiveDocumentKey: { type: String, default: "" },
  detailDossierDeliveredDocumentsCount: { type: Number, default: 0 },
  formatCurrency: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
  formatDossierLastActivity: { type: Function, required: true },
  dossierSummaryLine: { type: Function, required: true },
  dossierPrimarySignal: { type: Function, required: true },
  dossierRecommendedAction: { type: Function, required: true },
  normalizeDocumentStatus: { type: Function, required: true },
  canAccessRoute: { type: Function, required: true },
  isDossierWorkspaceActionPending: { type: Function, required: true },
  isDossierWorkspaceActionSuccessful: { type: Function, required: true },
  isDossierWorkspaceActionInError: { type: Function, required: true },
  openRoute: { type: Function, required: true },
  openCommandeWizardFromDossier: { type: Function, required: true },
  openRetoucheWizardFromDossier: { type: Function, required: true },
  onDetailDossierCash: { type: Function, required: true },
  onDossierWorkspaceOpen: { type: Function, required: true },
  onDossierWorkspaceCash: { type: Function, required: true }
});
</script>

<template>
  <section class="commande-detail">
    <ResponsiveDataContainer :mobile="isMobileViewport">
      <template #mobile>
        <article class="panel panel-header detail-header">
          <MobileSectionHeader
            eyebrow="Dossier"
            title="Detail dossier"
            :subtitle="detailDossier ? `${detailDossier.idDossier} - ${detailDossier.responsable.nomComplet || 'Responsable'}` : 'Vue consolidee du dossier atelier.'"
          />
          <div class="row-actions dossier-workspace-actions">
            <button class="mini-btn" @click="openRoute('dossiers')">Retour</button>
            <button class="mini-btn" @click="openCommandeWizardFromDossier">+ Commande</button>
            <button class="mini-btn" @click="openRetoucheWizardFromDossier">+ Retouche</button>
            <button
              v-if="canAccessRoute('caisse') && detailDossier?.synthese?.documentsAvecSolde > 0"
              class="mini-btn"
              @click="onDetailDossierCash"
            >
              Encaisser
            </button>
          </div>
        </article>

        <article v-if="!detailDossier && detailDossierLoading" class="panel dossier-skeleton-card">
          <div class="dossier-skeleton-line lg"></div>
          <div class="dossier-skeleton-line md"></div>
          <div class="dossier-skeleton-grid">
            <span class="dossier-skeleton-pill"></span>
            <span class="dossier-skeleton-pill"></span>
            <span class="dossier-skeleton-pill"></span>
          </div>
        </article>
        <article v-else-if="detailDossierError" class="panel error-panel">
          <strong>Detail dossier</strong>
          <p>{{ detailDossierError }}</p>
        </article>
        <template v-else-if="detailDossier">
          <article class="panel dossier-workspace-hero">
            <div class="dossier-workspace-heading">
              <div>
                <p class="mobile-overline">Workspace dossier</p>
                <h3>{{ detailDossier.responsable.nomComplet }}</h3>
                <p class="helper">{{ detailDossier.responsable.telephone || "Sans telephone" }}</p>
                <p class="helper dossier-hero-subtitle">{{ dossierSummaryLine(detailDossier) }}</p>
              </div>
              <div class="dossier-badge-stack">
                <span class="status-pill" data-tone="ok">{{ detailDossier.typeDossier }}</span>
                <span class="status-chip">{{ detailDossier.statutDossier }}</span>
              </div>
            </div>
            <div class="dossier-card-signal dossier-hero-signal" :data-tone="dossierPrimarySignal(detailDossier).tone">
              <strong>{{ dossierPrimarySignal(detailDossier).label }}</strong>
              <span>{{ dossierPrimarySignal(detailDossier).detail }} · Activite : {{ formatDossierLastActivity(detailDossier) }}</span>
            </div>
            <div class="dossier-highlight-strip">
              <article class="dossier-highlight-card">
                <span>Prochaine action</span>
                <strong>{{ dossierRecommendedAction(detailDossier).label }}</strong>
                <p>{{ dossierRecommendedAction(detailDossier).detail }}</p>
              </article>
              <article class="dossier-highlight-card">
                <span>Responsable</span>
                <strong>{{ detailDossier.responsable.nomComplet }}</strong>
                <p>{{ detailDossier.responsable.telephone || "Telephone non renseigne" }}</p>
              </article>
            </div>
            <div class="mobile-kpi-grid dossier-workspace-kpis">
              <div class="mobile-kpi dossier-kpi-card"><span>Total montant</span><strong class="dossier-value-blue">{{ formatCurrency(detailDossier.synthese.totalMontant) }}</strong></div>
              <div class="mobile-kpi dossier-kpi-card"><span>Total paye</span><strong class="dossier-value-green">{{ formatCurrency(detailDossier.synthese.totalPaye) }}</strong></div>
              <div class="mobile-kpi dossier-kpi-card"><span>Solde restant</span><strong class="dossier-value-red">{{ formatCurrency(detailDossier.synthese.soldeRestant) }}</strong></div>
              <div class="mobile-kpi dossier-kpi-card"><span>Commandes en cours</span><strong>{{ detailDossier.synthese.commandesEnCours }}</strong></div>
              <div class="mobile-kpi dossier-kpi-card"><span>Retouches en cours</span><strong>{{ detailDossier.synthese.retouchesEnCours }}</strong></div>
              <div class="mobile-kpi dossier-kpi-card"><span>Documents avec solde</span><strong>{{ detailDossier.synthese.documentsAvecSolde }}</strong></div>
            </div>
          </article>

          <div class="dossier-document-columns" v-if="dossierWorkspaceHasDocuments">
            <article class="panel dossier-document-column">
              <div class="panel-header detail-panel-header dossier-section-header">
                <div>
                  <h3>Retouches</h3>
                  <p class="helper">{{ dossierRetoucheCards.length }} retouche(s) dans ce dossier.</p>
                </div>
              </div>
              <div v-if="dossierRetoucheCards.length > 0" class="stack-list dossier-workspace-list">
                <article
                  v-for="document in dossierRetoucheCards"
                  :key="document.key"
                  class="list-link-card dossier-workspace-card dossier-workspace-card-simple"
                  :class="{
                    'is-active': dossierWorkspaceActiveDocumentKey === document.key,
                    'is-success': isDossierWorkspaceActionSuccessful(`${document.key}:open`) || isDossierWorkspaceActionSuccessful(`${document.key}:cash`),
                    'is-error': isDossierWorkspaceActionInError(`${document.key}:open`) || isDossierWorkspaceActionInError(`${document.key}:cash`)
                  }"
                >
                  <div class="row-between">
                    <strong>{{ document.title }}</strong>
                    <span class="status-chip dossier-status-badge" :data-status="normalizeDocumentStatus(document.status)">{{ document.status }}</span>
                  </div>
                  <div class="dossier-simple-metrics">
                    <span>Statut : {{ document.status || "Non renseigne" }}</span>
                    <span>Montant total : <strong class="dossier-value-blue">{{ formatCurrency(document.amount) }}</strong></span>
                    <span>Reste a payer : <strong class="dossier-value-red">{{ formatCurrency(document.remaining) }}</strong></span>
                  </div>
                  <div class="row-actions dossier-card-actions">
                    <button class="mini-btn dossier-action-btn" :disabled="isDossierWorkspaceActionPending(`${document.key}:open`) || isDossierWorkspaceActionPending(`${document.key}:cash`)" @click="onDossierWorkspaceOpen(document)">
                      Voir
                    </button>
                    <button
                      v-if="canAccessRoute('caisse') && document.canCash"
                      class="mini-btn dossier-action-btn dossier-action-btn-cash"
                      :disabled="isDossierWorkspaceActionPending(`${document.key}:cash`) || isDossierWorkspaceActionPending(`${document.key}:open`)"
                      @click="onDossierWorkspaceCash(document)"
                    >
                      Payer
                    </button>
                  </div>
                </article>
              </div>
              <article v-else class="panel dossier-column-empty">
                <strong>0 retouche</strong>
                <p class="helper">Aucune retouche rattachee a ce dossier.</p>
              </article>
            </article>
            <article class="panel dossier-document-column">
              <div class="panel-header detail-panel-header dossier-section-header">
                <div>
                  <h3>Commandes</h3>
                  <p class="helper">{{ dossierCommandeCards.length }} commande(s) dans ce dossier.</p>
                </div>
              </div>
              <div v-if="dossierCommandeCards.length > 0" class="stack-list dossier-workspace-list">
                <article
                  v-for="document in dossierCommandeCards"
                  :key="document.key"
                  class="list-link-card dossier-workspace-card dossier-workspace-card-simple"
                  :class="{
                    'is-active': dossierWorkspaceActiveDocumentKey === document.key,
                    'is-success': isDossierWorkspaceActionSuccessful(`${document.key}:open`) || isDossierWorkspaceActionSuccessful(`${document.key}:cash`),
                    'is-error': isDossierWorkspaceActionInError(`${document.key}:open`) || isDossierWorkspaceActionInError(`${document.key}:cash`)
                  }"
                >
                  <div class="row-between">
                    <strong>{{ document.title }}</strong>
                    <span class="status-chip dossier-status-badge" :data-status="normalizeDocumentStatus(document.status)">{{ document.status }}</span>
                  </div>
                  <div class="dossier-simple-metrics">
                    <span>Statut : {{ document.status || "Non renseigne" }}</span>
                    <span>Montant total : <strong class="dossier-value-blue">{{ formatCurrency(document.amount) }}</strong></span>
                    <span>Reste a payer : <strong class="dossier-value-red">{{ formatCurrency(document.remaining) }}</strong></span>
                  </div>
                  <div class="row-actions dossier-card-actions">
                    <button class="mini-btn dossier-action-btn" :disabled="isDossierWorkspaceActionPending(`${document.key}:open`) || isDossierWorkspaceActionPending(`${document.key}:cash`)" @click="onDossierWorkspaceOpen(document)">
                      Voir
                    </button>
                    <button
                      v-if="canAccessRoute('caisse') && document.canCash"
                      class="mini-btn dossier-action-btn dossier-action-btn-cash"
                      :disabled="isDossierWorkspaceActionPending(`${document.key}:cash`) || isDossierWorkspaceActionPending(`${document.key}:open`)"
                      @click="onDossierWorkspaceCash(document)"
                    >
                      Payer
                    </button>
                  </div>
                </article>
              </div>
              <article v-else class="panel dossier-column-empty">
                <strong>0 commande</strong>
                <p class="helper">Aucune commande rattachee a ce dossier.</p>
              </article>
            </article>
          </div>
          <article v-else class="panel empty-state dossier-empty-state">
            <h3>0 document dans ce dossier</h3>
            <p>{{ detailDossier.totalCommandes }} commande(s) · {{ detailDossier.totalRetouches }} retouche(s)</p>
          </article>
        </template>
      </template>

      <template #desktop>
        <article class="panel panel-header detail-header" v-if="detailDossier">
          <div class="dossier-workspace-heading">
            <div>
              <p class="mobile-overline">Dossier</p>
              <h2>{{ detailDossier.responsable.nomComplet || detailDossier.idDossier }}</h2>
              <p class="helper">{{ detailDossier.idDossier }} - {{ detailDossier.responsable.telephone || "Sans telephone" }}</p>
            </div>
            <div class="dossier-badge-stack">
              <span class="status-pill" data-tone="ok">{{ detailDossier.typeDossier }}</span>
              <span class="status-chip">{{ detailDossier.statutDossier }}</span>
            </div>
          </div>
          <div class="row-actions dossier-workspace-actions">
            <button class="mini-btn" @click="openRoute('dossiers')">Retour</button>
            <button class="action-btn blue" @click="openCommandeWizardFromDossier">Ajouter une commande</button>
            <button class="action-btn blue" @click="openRetoucheWizardFromDossier">Ajouter une retouche</button>
            <button
              v-if="canAccessRoute('caisse') && detailDossier?.synthese?.documentsAvecSolde > 0"
              class="action-btn green"
              @click="onDetailDossierCash"
            >
              Encaisser
            </button>
          </div>
        </article>
        <article v-if="!detailDossier && detailDossierLoading" class="panel dossier-skeleton-card">
          <div class="dossier-skeleton-line lg"></div>
          <div class="dossier-skeleton-line md"></div>
          <div class="dossier-skeleton-grid">
            <span class="dossier-skeleton-pill"></span>
            <span class="dossier-skeleton-pill"></span>
            <span class="dossier-skeleton-pill"></span>
            <span class="dossier-skeleton-pill"></span>
          </div>
        </article>
        <article v-else-if="!detailDossier && detailDossierError" class="panel error-panel">
          <strong>Detail dossier</strong>
          <p>{{ detailDossierError }}</p>
        </article>
        <template v-if="detailDossier">
          <article class="panel dossier-workspace-hero">
            <div class="dossier-workspace-heading">
              <div>
                <p class="mobile-overline">Responsable</p>
                <h3>{{ detailDossier.responsable.nomComplet }}</h3>
                <p class="helper">{{ detailDossier.responsable.telephone || "Sans telephone" }}</p>
                <p class="helper dossier-hero-subtitle">{{ dossierSummaryLine(detailDossier) }}</p>
              </div>
              <div class="helper">Derniere activite : {{ formatDateTime(detailDossier.synthese.derniereActivite) }}</div>
            </div>
            <div class="dossier-card-signal dossier-hero-signal" :data-tone="dossierPrimarySignal(detailDossier).tone">
              <strong>{{ dossierPrimarySignal(detailDossier).label }}</strong>
              <span>{{ dossierPrimarySignal(detailDossier).detail }}</span>
            </div>
            <div class="dossier-highlight-strip">
              <article class="dossier-highlight-card">
                <span>Prochaine action</span>
                <strong>{{ dossierRecommendedAction(detailDossier).label }}</strong>
                <p>{{ dossierRecommendedAction(detailDossier).detail }}</p>
              </article>
              <article class="dossier-highlight-card">
                <span>Activite recente</span>
                <strong>{{ formatDossierLastActivity(detailDossier) }}</strong>
                <p>{{ detailDossier.responsable.telephone || "Telephone non renseigne" }}</p>
              </article>
              <article class="dossier-highlight-card">
                <span>Commandes / retouches livres</span>
                <strong>{{ detailDossierDeliveredDocumentsCount }}</strong>
                <p>Documents deja livres et visibles dans ce dossier</p>
              </article>
            </div>
            <div class="dossier-workspace-kpi-grid">
              <article class="dossier-kpi-card">
                <span>Total montant</span>
                <strong class="dossier-value-blue">{{ formatCurrency(detailDossier.synthese.totalMontant) }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Total paye</span>
                <strong class="dossier-value-green">{{ formatCurrency(detailDossier.synthese.totalPaye) }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Solde restant</span>
                <strong class="dossier-value-red">{{ formatCurrency(detailDossier.synthese.soldeRestant) }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Commandes en cours</span>
                <strong>{{ detailDossier.synthese.commandesEnCours }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Retouches en cours</span>
                <strong>{{ detailDossier.synthese.retouchesEnCours }}</strong>
              </article>
              <article class="dossier-kpi-card">
                <span>Cmd / ret. avec solde</span>
                <strong>{{ detailDossier.synthese.documentsAvecSolde }}</strong>
              </article>
            </div>
          </article>

          <div class="dossier-document-columns" v-if="dossierWorkspaceHasDocuments">
            <article class="panel dossier-document-column">
              <div class="panel-header detail-panel-header dossier-section-header">
                <div>
                  <h3>Retouches</h3>
                  <p class="helper">{{ dossierRetoucheCards.length }} retouche(s) dans ce dossier.</p>
                </div>
              </div>
              <div v-if="dossierRetoucheCards.length > 0" class="stack-list dossier-workspace-list">
                <article
                  v-for="document in dossierRetoucheCards"
                  :key="document.key"
                  class="dossier-workspace-card dossier-workspace-card-simple"
                  :class="{
                    'is-active': dossierWorkspaceActiveDocumentKey === document.key,
                    'is-success': isDossierWorkspaceActionSuccessful(`${document.key}:open`) || isDossierWorkspaceActionSuccessful(`${document.key}:cash`),
                    'is-error': isDossierWorkspaceActionInError(`${document.key}:open`) || isDossierWorkspaceActionInError(`${document.key}:cash`)
                  }"
                >
                  <div class="row-between">
                    <strong>{{ document.title }}</strong>
                    <span class="status-chip dossier-status-badge" :data-status="normalizeDocumentStatus(document.status)">{{ document.status }}</span>
                  </div>
                  <div class="dossier-simple-metrics">
                    <span>Statut : {{ document.status || "Non renseigne" }}</span>
                    <span>Montant total : <strong class="dossier-value-blue">{{ formatCurrency(document.amount) }}</strong></span>
                    <span>Reste a payer : <strong class="dossier-value-red">{{ formatCurrency(document.remaining) }}</strong></span>
                  </div>
                  <div class="row-actions dossier-card-actions">
                    <button class="mini-btn dossier-action-btn" :disabled="isDossierWorkspaceActionPending(`${document.key}:open`) || isDossierWorkspaceActionPending(`${document.key}:cash`)" @click="onDossierWorkspaceOpen(document)">
                      Voir
                    </button>
                    <button
                      v-if="canAccessRoute('caisse') && document.canCash"
                      class="mini-btn dossier-action-btn dossier-action-btn-cash"
                      :disabled="isDossierWorkspaceActionPending(`${document.key}:cash`) || isDossierWorkspaceActionPending(`${document.key}:open`)"
                      @click="onDossierWorkspaceCash(document)"
                    >
                      Payer
                    </button>
                  </div>
                </article>
              </div>
              <article v-else class="panel dossier-column-empty">
                <strong>0 retouche</strong>
                <p class="helper">Aucune retouche rattachee a ce dossier.</p>
              </article>
            </article>
            <article class="panel dossier-document-column">
              <div class="panel-header detail-panel-header dossier-section-header">
                <div>
                  <h3>Commandes</h3>
                  <p class="helper">{{ dossierCommandeCards.length }} commande(s) dans ce dossier.</p>
                </div>
              </div>
              <div v-if="dossierCommandeCards.length > 0" class="stack-list dossier-workspace-list">
                <article
                  v-for="document in dossierCommandeCards"
                  :key="document.key"
                  class="dossier-workspace-card dossier-workspace-card-simple"
                  :class="{
                    'is-active': dossierWorkspaceActiveDocumentKey === document.key,
                    'is-success': isDossierWorkspaceActionSuccessful(`${document.key}:open`) || isDossierWorkspaceActionSuccessful(`${document.key}:cash`),
                    'is-error': isDossierWorkspaceActionInError(`${document.key}:open`) || isDossierWorkspaceActionInError(`${document.key}:cash`)
                  }"
                >
                  <div class="row-between">
                    <strong>{{ document.title }}</strong>
                    <span class="status-chip dossier-status-badge" :data-status="normalizeDocumentStatus(document.status)">{{ document.status }}</span>
                  </div>
                  <div class="dossier-simple-metrics">
                    <span>Statut : {{ document.status || "Non renseigne" }}</span>
                    <span>Montant total : <strong class="dossier-value-blue">{{ formatCurrency(document.amount) }}</strong></span>
                    <span>Reste a payer : <strong class="dossier-value-red">{{ formatCurrency(document.remaining) }}</strong></span>
                  </div>
                  <div class="row-actions dossier-card-actions">
                    <button class="mini-btn dossier-action-btn" :disabled="isDossierWorkspaceActionPending(`${document.key}:open`) || isDossierWorkspaceActionPending(`${document.key}:cash`)" @click="onDossierWorkspaceOpen(document)">
                      Voir
                    </button>
                    <button
                      v-if="canAccessRoute('caisse') && document.canCash"
                      class="mini-btn dossier-action-btn dossier-action-btn-cash"
                      :disabled="isDossierWorkspaceActionPending(`${document.key}:cash`) || isDossierWorkspaceActionPending(`${document.key}:open`)"
                      @click="onDossierWorkspaceCash(document)"
                    >
                      Payer
                    </button>
                  </div>
                </article>
              </div>
              <article v-else class="panel dossier-column-empty">
                <strong>0 commande</strong>
                <p class="helper">Aucune commande rattachee a ce dossier.</p>
              </article>
            </article>
          </div>
          <article v-else class="panel empty-state dossier-empty-state">
            <h3>0 document dans ce dossier</h3>
            <p>{{ detailDossier.totalCommandes }} commande(s) · {{ detailDossier.totalRetouches }} retouche(s)</p>
          </article>
        </template>
      </template>
    </ResponsiveDataContainer>
  </section>
</template>
