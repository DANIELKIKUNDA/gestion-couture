<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { atelierApi, ApiError, resolveMediaUrl, setAuthLostHandler } from "./services/api.js";
import {
  OFFLINE_READ_MESSAGES,
  loadCommandeDetailLocalFirst,
  loadMainListsLocalFirst,
  loadRetoucheDetailLocalFirst
} from "./services/offline-read-service.js";
import {
  addCommandePhotoOffline,
  deleteCommandePhotoOffline,
  loadCommandeMediaLocalFirst,
  moveCommandePhotoOffline,
  saveCommandePhotoNoteOffline,
  setCommandePhotoPrimaryOffline
} from "./services/media-local-store.js";
import { createOfflineCommande, createOfflineRetouche } from "./services/offline-write-service.js";
import { getNetworkState, subscribeToNetworkState, useNetwork } from "./services/network-service.js";
import { createServerClientId, createServerCommandeId, createServerRetoucheId } from "./services/server-id.js";
import {
  applyPwaUpdate,
  dismissPwaOfflineReady,
  isPwaInstallAvailable,
  isPwaOfflineReady,
  isPwaUpdateAvailable,
  promptPwaInstall
} from "./services/pwa-service.js";
import { requestSync, setSyncEngineAtelierContext, subscribeToSyncEvents } from "./services/sync-engine.js";
import { pendingActions, syncInProgress } from "./services/sync-status-service.js";
import { showToast, toastState } from "./services/toast-service.js";
import CommandeDetailEventMobileList from "./components/commandes/CommandeDetailEventMobileList.vue";
import CommandeDetailPaymentMobileList from "./components/commandes/CommandeDetailPaymentMobileList.vue";
import CommandeMobileList from "./components/commandes/CommandeMobileList.vue";
import CommandeMediaGallery from "./components/commandes/CommandeMediaGallery.vue";
import BottomNav from "./components/BottomNav.vue";
import AuditAnnualMobileList from "./components/audit/AuditAnnualMobileList.vue";
import AuditCaisseDailyMobileList from "./components/audit/AuditCaisseDailyMobileList.vue";
import AuditCommandeMobileList from "./components/audit/AuditCommandeMobileList.vue";
import AuditCaissePeriodMobileList from "./components/audit/AuditCaissePeriodMobileList.vue";
import AuditFactureMobileList from "./components/audit/AuditFactureMobileList.vue";
import AuditOperationMobileList from "./components/audit/AuditOperationMobileList.vue";
import AuditRetoucheMobileList from "./components/audit/AuditRetoucheMobileList.vue";
import AuditStockVenteMobileList from "./components/audit/AuditStockVenteMobileList.vue";
import AuditUtilisateurMobileList from "./components/audit/AuditUtilisateurMobileList.vue";
import CaisseOperationMobileList from "./components/caisse/CaisseOperationMobileList.vue";
import CaisseOverviewCards from "./components/caisse/CaisseOverviewCards.vue";
import ClientCommandeHistoryMobileList from "./components/clients/ClientCommandeHistoryMobileList.vue";
import ClientConsultationOverviewCards from "./components/clients/ClientConsultationOverviewCards.vue";
import ClientMesureHistoryMobileList from "./components/clients/ClientMesureHistoryMobileList.vue";
import ClientRetoucheHistoryMobileList from "./components/clients/ClientRetoucheHistoryMobileList.vue";
import DashboardActivityMobileList from "./components/dashboard/DashboardActivityMobileList.vue";
import DashboardMetricCardGrid from "./components/dashboard/DashboardMetricCardGrid.vue";
import DashboardRecentWorkMobileList from "./components/dashboard/DashboardRecentWorkMobileList.vue";
import VenteDetailLinesMobileList from "./components/stock/VenteDetailLinesMobileList.vue";
import VenteDetailOverviewCards from "./components/stock/VenteDetailOverviewCards.vue";
import FactureDetailLinesMobileList from "./components/facturation/FactureDetailLinesMobileList.vue";
import FactureDetailOverviewCards from "./components/facturation/FactureDetailOverviewCards.vue";
import FactureMobileList from "./components/facturation/FactureMobileList.vue";
import GlobalToastHost from "./components/GlobalToastHost.vue";
import MobileHeader from "./components/MobileHeader.vue";
import MobileFilterBlock from "./components/mobile/MobileFilterBlock.vue";
import MobileMediaViewer from "./components/mobile/MobileMediaViewer.vue";
import MobilePageLayout from "./components/mobile/MobilePageLayout.vue";
import MobilePrimaryActionBar from "./components/mobile/MobilePrimaryActionBar.vue";
import ResponsivePagination from "./components/mobile/ResponsivePagination.vue";
import MobileSectionHeader from "./components/mobile/MobileSectionHeader.vue";
import MobileStateEmpty from "./components/mobile/MobileStateEmpty.vue";
import MobileStateError from "./components/mobile/MobileStateError.vue";
import MobileStateLoading from "./components/mobile/MobileStateLoading.vue";
import ResponsiveDataContainer from "./components/mobile/ResponsiveDataContainer.vue";
import ScrollTopButton from "./components/mobile/ScrollTopButton.vue";
import OfflineBanner from "./components/OfflineBanner.vue";
import RetoucheDetailEventMobileList from "./components/retouches/RetoucheDetailEventMobileList.vue";
import RetoucheDetailPaymentMobileList from "./components/retouches/RetoucheDetailPaymentMobileList.vue";
import RetoucheMobileList from "./components/retouches/RetoucheMobileList.vue";
import Sidebar from "./components/Sidebar.vue";
import StockArticleMobileList from "./components/stock/StockArticleMobileList.vue";
import VenteDraftMobileList from "./components/stock/VenteDraftMobileList.vue";
import VenteMobileList from "./components/stock/VenteMobileList.vue";
import AtelierNotificationsPage from "./components/notifications/AtelierNotificationsPage.vue";
import SystemAtelierCreateModal from "./components/system/SystemAtelierCreateModal.vue";
import SystemAtelierDetailPage from "./components/system/SystemAtelierDetailPage.vue";
import SystemDashboardPage from "./components/system/SystemDashboardPage.vue";
import SystemAteliersPage from "./components/system/SystemAteliersPage.vue";
import SystemNotificationsPage from "./components/system/SystemNotificationsPage.vue";
import { getPasswordPolicyError } from "./utils/password-policy.js";

function createPagination(pageSize = 10) {
  return reactive({
    page: 1,
    pageSize
  });
}

function createClientSidePager(rowsComputed, pagination) {
  const pages = computed(() => Math.max(1, Math.ceil(rowsComputed.value.length / pagination.pageSize)));
  const paged = computed(() => {
    const page = Math.min(Math.max(1, pagination.page), pages.value);
    const start = (page - 1) * pagination.pageSize;
    return rowsComputed.value.slice(start, start + pagination.pageSize);
  });
  watch(pages, (total) => {
    if (pagination.page > total) pagination.page = total;
  });
  watch(
    () => pagination.pageSize,
    () => {
      pagination.page = 1;
    }
  );
  return { pages, paged };
}

function createEmptySystemDashboard() {
  return {
    summary: {
      total: 0,
      actifs: 0,
      inactifs: 0,
      utilisateurs: 0,
      sansProprietaire: 0,
      proprietairesInactifs: 0,
      sansUtilisateur: 0,
      nouveaux7J: 0,
      nouveaux30J: 0,
      ateliersActifsAvecActivite7J: 0
    },
    alerts: [],
    recentAteliers: []
  };
}

function createEmptyDashboardContactBoard() {
  return {
    clientsARelancer: {
      total: 0,
      items: []
    },
    commandesPretesNonSignalees: {
      total: 0,
      items: []
    },
    retouchesPretesNonSignalees: {
      total: 0,
      items: []
    }
  };
}

function createContactFollowUpState() {
  return reactive({
    loading: false,
    saving: false,
    lastContact: null,
    status: "A_RELANCER",
    note: ""
  });
}

const AUTH_PORTAL_STORAGE_KEY = "atelier.auth.portal.v1";
const AUTH_ATELIER_SLUG_STORAGE_KEY = "atelier.auth.slug.v1";
const AUTH_INVALID_CREDENTIALS_MESSAGE = "Email ou mot de passe incorrect";
const AUTH_DISABLED_ATELIER_MESSAGE = "Votre atelier est désactivé. Veuillez contacter l’administrateur.";
const MOBILE_BREAKPOINT = 768;

const currentRoute = ref("dashboard");
const contentScrollRef = ref(null);
const mobileScrollButtonMode = ref("none");
const isMobileViewport = ref(typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false);
const isSidebarDrawerOpen = ref(false);
const toast = computed(() => toastState.message);
const loading = ref(false);
const errorMessage = ref("");
const authReady = ref(false);
const authenticating = ref(false);
const authError = ref("");
const authMode = ref("checking");
const authPortal = ref(typeof window !== "undefined" && window.localStorage.getItem(AUTH_PORTAL_STORAGE_KEY) === "system" ? "system" : "atelier");
const authAtelierSlug = ref(typeof window !== "undefined" ? window.localStorage.getItem(AUTH_ATELIER_SLUG_STORAGE_KEY) || "" : "");
const authAtelierContext = ref(null);
const forbiddenMessage = ref("Acces refuse: permissions insuffisantes.");
const loginForm = reactive({
  email: "",
  motDePasse: ""
});
const showPassword = ref(false);
const authUser = ref(null);
const authPermissions = ref([]);
const bootstrapInitializing = ref(false);
let authModeDetectionTimer = null;
let systemAteliersSearchTimer = null;
let unsubscribeNetworkState = null;
let unsubscribeSyncEvents = null;
let lastKnownNetworkOnline = true;
let reconnectRefreshPromise = null;
let syncUiRefreshTimer = null;
let crossDeviceRefreshPromise = null;
let crossDeviceRefreshTimer = null;
let lastCrossDeviceRefreshAt = 0;
let commandeDetailLoadPromise = null;
let commandeDetailLoadTargetId = "";
let commandeDetailLoadRequestId = 0;
let retoucheDetailLoadPromise = null;
let retoucheDetailLoadTargetId = "";
let retoucheDetailLoadRequestId = 0;
let dossierDetailLoadPromise = null;
let dossierDetailLoadTargetId = "";
let dossierDetailLoadRequestId = 0;
let commandeMediaRenderSequence = 0;
let commandeMediaViewerRequestId = 0;
let contentScrollElement = null;
let globalErrorClearTimer = null;

const systemAteliers = ref([]);
const systemAteliersLoading = ref(false);
const systemAteliersError = ref("");
const systemAteliersSearch = ref("");
const systemAteliersStatus = ref("ALL");
const systemAteliersSort = ref("createdAt_desc");
const systemAteliersTotal = ref(0);
const systemAteliersSummary = reactive({
  total: 0,
  actifs: 0,
  inactifs: 0,
  utilisateurs: 0
});
const systemAteliersPagination = createPagination(10);
const systemAtelierActionId = ref("");
const systemAtelierDetailId = ref("");
const systemAtelierDetail = ref(null);
const systemAtelierDetailLoading = ref(false);
const systemAtelierDetailError = ref("");
const systemAtelierDetailRequestId = ref(0);
const systemAtelierDetailSeed = ref(null);
const systemOwnerActionKey = ref("");
const systemOwnerActionError = ref("");
const systemRecoveryActionKey = ref("");
const systemRecoveryActionError = ref("");
const systemDashboard = ref(createEmptySystemDashboard());
const systemDashboardLoading = ref(false);
const systemDashboardError = ref("");
const systemNotifications = ref([]);
const systemNotificationsContacts = ref([]);
const systemNotificationsLoading = ref(false);
const systemNotificationsSubmitting = ref(false);
const systemNotificationsError = ref("");
const atelierNotifications = ref([]);
const atelierNotificationsLoading = ref(false);
const atelierNotificationsError = ref("");
const atelierNotificationsUnreadCount = ref(0);
const atelierNotificationsActiveId = ref("");
const systemAtelierModal = reactive({
  open: false,
  submitting: false,
  error: "",
  nomAtelier: "",
  slug: "",
  slugTouched: false,
  proprietaireNom: "",
  proprietaireEmail: "",
  proprietaireTelephone: "",
  proprietaireMotDePasse: ""
});

const clients = ref([]);
const dossiers = ref([]);
const commandes = ref([]);
const retouches = ref([]);
const stockArticles = ref([]);
const ventes = ref([]);
const factures = ref([]);
const caisseJour = ref(null);

const stockVentesTab = ref("stock");
const venteSubmitting = ref(false);
const SIMPLE_STOCK_ENTRY_DEFAULT_MOTIF = "ENTREE";
const venteDraft = reactive({
  lignes: [],
  current: {
    idArticle: "",
    quantite: ""
  }
});
const stockInputs = reactive({});
const newArticle = reactive({
  nomArticle: "",
  categorieArticle: "TISSU",
  uniteStock: "METRE",
  quantiteDisponible: "",
  prixAchatInitial: "",
  prixVenteUnitaire: "",
  seuilAlerte: ""
});
const showNewArticle = ref(false);
const stockListRef = ref(null);

const filters = reactive({
  statut: "ALL",
  client: "ALL",
  periode: "ALL",
  recherche: "",
  soldeRestant: "ALL"
});
const commandeClientQuery = ref("");
const dossierFilters = reactive({
  statut: "ALL",
  type: "ALL",
  recherche: ""
});
const dossiersPagination = reactive({
  page: 1,
  pageSize: 15
});
const dossiersVisibleCount = ref(dossiersPagination.pageSize);
const dossierInfiniteSentinel = ref(null);
let dossierInfiniteObserver = null;
const dossierSection = ref("liste");
const dossierModalOpen = ref(false);
const dossierSubmitting = ref(false);
const selectedDossierId = ref("");
const detailDossier = ref(null);
const detailDossierLoading = ref(false);
const detailDossierError = ref("");
const dossierWorkspacePendingActionKey = ref("");
const dossierWorkspaceSuccessActionKey = ref("");
const dossierWorkspaceErrorActionKey = ref("");
const dossierWorkspaceActiveDocumentKey = ref("");
let dossierWorkspaceActionFeedbackTimer = null;
const dossierDraft = reactive({
  mode: "existing",
  existingClientId: "",
  newClient: {
    nom: "",
    prenom: "",
    telephone: ""
  },
  doublonDecisionAction: "",
  doublonDecisionId: "",
  typeDossier: "INDIVIDUEL",
  notes: ""
});
const commandeSection = ref("liste");
const commandeMobileFiltersOpen = ref(false);
const commandesPagination = reactive({
  page: 1,
  pageSize: 10
});
const commandesVisibleCount = ref(commandesPagination.pageSize);
const commandesLoadingMore = ref(false);
const commandeInfiniteSentinel = ref(null);
let commandeInfiniteObserver = null;

const retoucheFilters = reactive({
  statut: "ALL",
  client: "ALL",
  periode: "ALL",
  recherche: "",
  soldeRestant: "ALL"
});
const retoucheClientQuery = ref("");
const retoucheSection = ref("liste");
const retoucheMobileFiltersOpen = ref(false);
const retouchesPagination = reactive({
  page: 1,
  pageSize: 10
});
const retouchesVisibleCount = ref(retouchesPagination.pageSize);
const retouchesLoadingMore = ref(false);
const retoucheInfiniteSentinel = ref(null);
let retoucheInfiniteObserver = null;
const factureFilters = reactive({
  statut: "ALL",
  source: "ALL",
  recherche: "",
  soldeRestant: "ALL"
});
const factureSection = ref("liste");
const factureMobileFiltersOpen = ref(false);
const auditUtilisateursMobileFiltersOpen = ref(false);
const facturesPagination = reactive({
  page: 1,
  pageSize: 10
});
const facturesVisibleCount = ref(facturesPagination.pageSize);
const facturesLoadingMore = ref(false);
const factureInfiniteSentinel = ref(null);
let factureInfiniteObserver = null;
const ventesPagination = reactive({
  page: 1,
  pageSize: 10
});
const ventesVisibleCount = ref(ventesPagination.pageSize);
const ventesLoadingMore = ref(false);
const venteInfiniteSentinel = ref(null);
let venteInfiniteObserver = null;
const caisseOperationsPagination = reactive({
  page: 1,
  pageSize: 10
});
const caisseOperationsVisibleCount = ref(caisseOperationsPagination.pageSize);
const caisseOperationsLoadingMore = ref(false);
const caisseInfiniteSentinel = ref(null);
let caisseInfiniteObserver = null;

const dashboardPeriod = ref("LAST_7");
const dashboardPeriodOptions = [
  { value: "TODAY", label: "Aujourd'hui" },
  { value: "LAST_7", label: "7 derniers jours" },
  { value: "LAST_30", label: "30 derniers jours" }
];
const dashboardContactBoard = ref(createEmptyDashboardContactBoard());
const dashboardContactBoardLoading = ref(false);
const dashboardContactBoardError = ref("");

const wizard = reactive({
  open: false,
  step: 1,
  mode: "existing",
  dossierId: "",
  existingClientId: "",
  resolvedClientId: "",
  requestCommandeId: "",
  requestNewClientId: "",
  createdCommandeId: "",
  createdFactureId: "",
  submitting: false,
  doublonDecisionAction: "",
  doublonDecisionId: "",
  newClient: {
    nom: "",
    prenom: "",
    telephone: ""
  },
  commande: {
    descriptionCommande: "",
    montantTotal: "",
    datePrevue: "",
    emettreFacture: true,
    typeHabit: "",
    items: [],
    mesuresHabit: {},
    prefillLoading: false,
    prefill: null,
    prefillDecision: "idle"
  }
});

const retoucheWizard = reactive({
  open: false,
  step: 1,
  mode: "existing",
  dossierId: "",
  existingClientId: "",
  resolvedClientId: "",
  requestRetoucheId: "",
  requestNewClientId: "",
  createdRetoucheId: "",
  createdFactureId: "",
  submitting: false,
  newClient: {
    nom: "",
    prenom: "",
    telephone: ""
  },
  retouche: {
    descriptionRetouche: "",
    typeRetouche: "",
    montantTotal: "",
    datePrevue: "",
    emettreFacture: true,
    typeHabit: "",
    items: [],
    mesuresHabit: {}
  }
});

function createEmptyDossierDetail() {
  return {
    idDossier: "",
    idResponsableClient: "",
    responsable: {
      idClient: "",
      nom: "",
      prenom: "",
      telephone: "",
      nomComplet: ""
    },
    typeDossier: "INDIVIDUEL",
    statutDossier: "ACTIF",
    notes: "",
    dateCreation: "",
    dateDerniereActivite: "",
    totalCommandes: 0,
    totalRetouches: 0,
    totalMontant: 0,
    totalPaye: 0,
    soldeRestant: 0,
    synthese: {
      totalBeneficiaires: 0,
      documentsAvecSolde: 0,
      commandesEnCours: 0,
      retouchesEnCours: 0,
      totalMontant: 0,
      totalPaye: 0,
      soldeRestant: 0,
      derniereActivite: ""
    },
    commandes: [],
    retouches: []
  };
}

function normalizeDossierFlags(raw = {}) {
  return {
    enRetard: raw.enRetard === true || raw.en_retard === true,
    termineeNonLivree: raw.termineeNonLivree === true || raw.terminee_non_livree === true,
    soldeOuvert: raw.soldeOuvert === true || raw.solde_ouvert === true
  };
}

function normalizeDossierBeneficiaire(raw = {}) {
  return {
    idClient: raw.idClient || raw.id_client || "",
    nom: raw.nom || "",
    prenom: raw.prenom || "",
    telephone: raw.telephone || "",
    nomComplet:
      raw.nomComplet ||
      raw.nom_complet ||
      `${String(raw.nom || "").trim()} ${String(raw.prenom || "").trim()}`.trim(),
    role: raw.role || "",
    typeHabit: raw.typeHabit || raw.type_habit || ""
  };
}

function normalizeDossier(raw = {}) {
  return {
    idDossier: raw.idDossier || raw.id_dossier || "",
    idResponsableClient: raw.idResponsableClient || raw.id_responsable_client || "",
    responsable: {
      idClient: raw.responsable?.idClient || raw.idResponsableClient || raw.id_responsable_client || "",
      nom: raw.responsable?.nom || "",
      prenom: raw.responsable?.prenom || "",
      telephone: raw.responsable?.telephone || "",
      nomComplet:
        raw.responsable?.nomComplet ||
        `${String(raw.responsable?.nom || "").trim()} ${String(raw.responsable?.prenom || "").trim()}`.trim()
    },
    typeDossier: raw.typeDossier || raw.type_dossier || "INDIVIDUEL",
    statutDossier: raw.statutDossier || raw.statut_dossier || raw.statut || "ACTIF",
    notes: raw.notes || "",
    dateCreation: raw.dateCreation || raw.date_creation || "",
    dateDerniereActivite: raw.dateDerniereActivite || raw.date_derniere_activite || raw.dateCreation || raw.date_creation || "",
    totalCommandes: Number(raw.totalCommandes ?? raw.total_commandes ?? 0),
    totalRetouches: Number(raw.totalRetouches ?? raw.total_retouches ?? 0),
    totalMontant: Number(raw.totalMontant ?? raw.total_montant ?? 0),
    totalPaye: Number(raw.totalPaye ?? raw.total_paye ?? 0),
    soldeRestant: Number(raw.soldeRestant ?? raw.solde_restant ?? Math.max(0, Number(raw.totalMontant ?? raw.total_montant ?? 0) - Number(raw.totalPaye ?? raw.total_paye ?? 0))),
    synthese: {
      totalBeneficiaires: Number(raw.synthese?.totalBeneficiaires ?? raw.synthese?.total_beneficiaires ?? 0),
      documentsAvecSolde: Number(raw.synthese?.documentsAvecSolde ?? raw.synthese?.documents_avec_solde ?? 0),
      commandesEnCours: Number(raw.synthese?.commandesEnCours ?? raw.synthese?.commandes_en_cours ?? 0),
      retouchesEnCours: Number(raw.synthese?.retouchesEnCours ?? raw.synthese?.retouches_en_cours ?? 0),
      totalMontant: Number(raw.synthese?.totalMontant ?? raw.synthese?.total_montant ?? raw.totalMontant ?? raw.total_montant ?? 0),
      totalPaye: Number(raw.synthese?.totalPaye ?? raw.synthese?.total_paye ?? raw.totalPaye ?? raw.total_paye ?? 0),
      soldeRestant: Number(raw.synthese?.soldeRestant ?? raw.synthese?.solde_restant ?? Math.max(0, Number(raw.synthese?.totalMontant ?? raw.synthese?.total_montant ?? raw.totalMontant ?? raw.total_montant ?? 0) - Number(raw.synthese?.totalPaye ?? raw.synthese?.total_paye ?? raw.totalPaye ?? raw.total_paye ?? 0))),
      derniereActivite: raw.synthese?.derniereActivite || raw.synthese?.derniere_activite || raw.dateDerniereActivite || raw.date_derniere_activite || ""
    },
    commandes: (raw.commandes || []).map((row) => normalizeCommande(row)),
    retouches: (raw.retouches || []).map((row) => normalizeRetouche(row))
  };
}

function formatDossierLastActivity(dossier) {
  const value = dossier?.synthese?.derniereActivite || dossier?.dateDerniereActivite || dossier?.dateCreation || "";
  return value ? formatDateTime(value) : "Aucune activite recente";
}

function dossierPrimarySignal(dossier) {
  const withBalance = Number(dossier?.synthese?.documentsAvecSolde || 0);
  const commandesEnCours = Number(dossier?.synthese?.commandesEnCours || 0);
  const retouchesEnCours = Number(dossier?.synthese?.retouchesEnCours || 0);
  const remaining = Number(dossier?.synthese?.soldeRestant ?? dossier?.soldeRestant ?? 0);

  if (withBalance > 0 || remaining > 0) {
    return {
      tone: "cash",
      label: "Solde restant",
      detail: `${withBalance || 1} document(s) avec solde`
    };
  }
  if (commandesEnCours > 0 || retouchesEnCours > 0) {
    return {
      tone: "priority",
      label: "Production en cours",
      detail: `${commandesEnCours} commande(s) · ${retouchesEnCours} retouche(s)`
    };
  }
  return {
    tone: "ready",
    label: "Dossier stable",
    detail: "Aucun point bloquant immediat"
  };
}

function dossierSummaryLine(dossier) {
  const notes = String(dossier?.notes || "").trim();
  if (notes) return notes;
  return `${Number(dossier?.totalCommandes || 0)} commande(s) · ${Number(dossier?.totalRetouches || 0)} retouche(s)`;
}

function dossierRecommendedAction(dossier) {
  const withBalance = Number(dossier?.synthese?.documentsAvecSolde || 0);
  const commandesEnCours = Number(dossier?.synthese?.commandesEnCours || 0);
  const retouchesEnCours = Number(dossier?.synthese?.retouchesEnCours || 0);

  if (withBalance > 0) {
    return {
      label: "Priorite paiement",
      detail: `${withBalance} document(s) a solder`
    };
  }
  if (commandesEnCours > 0 || retouchesEnCours > 0) {
    return {
      label: "Suivi production",
      detail: `${commandesEnCours + retouchesEnCours} document(s) a suivre`
    };
  }
  return {
    label: "Dossier stable",
    detail: "Aucune action urgente detectee"
  };
}

function resetDossierFilters() {
  dossierFilters.recherche = "";
  dossierFilters.type = "ALL";
  dossierFilters.statut = "ALL";
  dossiersPagination.page = 1;
  dossiersVisibleCount.value = dossiersPagination.pageSize;
}

function resetCommandeVisibleCount() {
  commandesVisibleCount.value = commandesPagination.pageSize;
}

async function loadMoreCommandes() {
  const nextCount = Math.min(commandesFiltered.value.length, commandesVisibleCount.value + commandesPagination.pageSize);
  if (commandesLoadingMore.value || nextCount <= commandesVisibleCount.value) return;
  commandesLoadingMore.value = true;
  await nextTick();
  commandesVisibleCount.value = nextCount;
  await nextTick();
  commandesLoadingMore.value = false;
}

function setupCommandeInfiniteObserver() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
  if (commandeInfiniteObserver) {
    commandeInfiniteObserver.disconnect();
    commandeInfiniteObserver = null;
  }
  nextTick(() => {
    const target = commandeInfiniteSentinel.value;
    if (!target) return;
    commandeInfiniteObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreCommandes();
        }
      },
      { root: null, rootMargin: "0px 0px 260px 0px", threshold: 0.05 }
    );
    commandeInfiniteObserver.observe(target);
  });
}

function resetRetoucheVisibleCount() {
  retouchesVisibleCount.value = retouchesPagination.pageSize;
}

async function loadMoreRetouches() {
  const nextCount = Math.min(retouchesFiltered.value.length, retouchesVisibleCount.value + retouchesPagination.pageSize);
  if (retouchesLoadingMore.value || nextCount <= retouchesVisibleCount.value) return;
  retouchesLoadingMore.value = true;
  await nextTick();
  retouchesVisibleCount.value = nextCount;
  await nextTick();
  retouchesLoadingMore.value = false;
}

function setupRetoucheInfiniteObserver() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
  if (retoucheInfiniteObserver) {
    retoucheInfiniteObserver.disconnect();
    retoucheInfiniteObserver = null;
  }
  nextTick(() => {
    const target = retoucheInfiniteSentinel.value;
    if (!target) return;
    retoucheInfiniteObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreRetouches();
        }
      },
      { root: null, rootMargin: "0px 0px 260px 0px", threshold: 0.05 }
    );
    retoucheInfiniteObserver.observe(target);
  });
}

function resetFactureVisibleCount() {
  facturesVisibleCount.value = facturesPagination.pageSize;
}

async function loadMoreFactures() {
  const nextCount = Math.min(facturesFiltered.value.length, facturesVisibleCount.value + facturesPagination.pageSize);
  if (facturesLoadingMore.value || nextCount <= facturesVisibleCount.value) return;
  facturesLoadingMore.value = true;
  await nextTick();
  facturesVisibleCount.value = nextCount;
  await nextTick();
  facturesLoadingMore.value = false;
}

function setupFactureInfiniteObserver() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
  if (factureInfiniteObserver) {
    factureInfiniteObserver.disconnect();
    factureInfiniteObserver = null;
  }
  nextTick(() => {
    const target = factureInfiniteSentinel.value;
    if (!target) return;
    factureInfiniteObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreFactures();
        }
      },
      { root: null, rootMargin: "0px 0px 260px 0px", threshold: 0.05 }
    );
    factureInfiniteObserver.observe(target);
  });
}

function resetVenteVisibleCount() {
  ventesVisibleCount.value = ventesPagination.pageSize;
}

async function loadMoreVentes() {
  const nextCount = Math.min(ventesView.value.length, ventesVisibleCount.value + ventesPagination.pageSize);
  if (ventesLoadingMore.value || nextCount <= ventesVisibleCount.value) return;
  ventesLoadingMore.value = true;
  await nextTick();
  ventesVisibleCount.value = nextCount;
  await nextTick();
  ventesLoadingMore.value = false;
}

function setupVenteInfiniteObserver() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
  if (venteInfiniteObserver) {
    venteInfiniteObserver.disconnect();
    venteInfiniteObserver = null;
  }
  nextTick(() => {
    const target = venteInfiniteSentinel.value;
    if (!target) return;
    venteInfiniteObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreVentes();
        }
      },
      { root: null, rootMargin: "0px 0px 260px 0px", threshold: 0.05 }
    );
    venteInfiniteObserver.observe(target);
  });
}

function resetCaisseOperationsVisibleCount() {
  caisseOperationsVisibleCount.value = caisseOperationsPagination.pageSize;
}

async function loadMoreCaisseOperations() {
  const nextCount = Math.min(caisseOperations.value.length, caisseOperationsVisibleCount.value + caisseOperationsPagination.pageSize);
  if (caisseOperationsLoadingMore.value || nextCount <= caisseOperationsVisibleCount.value) return;
  caisseOperationsLoadingMore.value = true;
  await nextTick();
  caisseOperationsVisibleCount.value = nextCount;
  await nextTick();
  caisseOperationsLoadingMore.value = false;
}

function setupCaisseInfiniteObserver() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
  if (caisseInfiniteObserver) {
    caisseInfiniteObserver.disconnect();
    caisseInfiniteObserver = null;
  }
  nextTick(() => {
    const target = caisseInfiniteSentinel.value;
    if (!target) return;
    caisseInfiniteObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreCaisseOperations();
        }
      },
      { root: null, rootMargin: "0px 0px 260px 0px", threshold: 0.05 }
    );
    caisseInfiniteObserver.observe(target);
  });
}

function setupInfiniteObserver(targetRef, observerHolder, onIntersect) {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  if (observerHolder.current) {
    observerHolder.current.disconnect();
    observerHolder.current = null;
  }
  nextTick(() => {
    const target = targetRef.value;
    if (!target) return;
    observerHolder.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void onIntersect();
        }
      },
      { root: null, rootMargin: "0px 0px 220px 0px", threshold: 0.05 }
    );
    observerHolder.current.observe(target);
  });
  return observerHolder.current;
}

async function loadMoreDetailRows(sourceRows, visibleCountRef, pageSize, loadingRef) {
  const nextCount = Math.min(sourceRows.value.length, visibleCountRef.value + pageSize);
  if (loadingRef.value || nextCount <= visibleCountRef.value) return;
  loadingRef.value = true;
  await nextTick();
  visibleCountRef.value = nextCount;
  await nextTick();
  loadingRef.value = false;
}

function normalizeDocumentStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function createDossierWorkspaceDocument(kind, row = {}) {
  if (kind === "commande") {
    return {
      kind,
      sectionKey: "",
      id: row.idCommande,
      key: `commande:${row.idCommande}`,
      title: row.idCommande,
      subtitle: row.descriptionCommande || "Commande",
      status: row.statutCommande || "",
      amount: Number(row.montantTotal || 0),
      remaining: Number(row.soldeRestant || 0),
      flagsMetier: row.flagsMetier || normalizeDossierFlags(),
      canCash: Number(row.soldeRestant || 0) > 0,
      open: () => openCommandeDetail(row.idCommande),
      cash: () => onPaiementCommande(row)
    };
  }
  return {
    kind,
    sectionKey: "",
    id: row.idRetouche,
    key: `retouche:${row.idRetouche}`,
    title: row.idRetouche,
    subtitle: row.typeRetouche || row.descriptionRetouche || "Retouche",
    status: row.statutRetouche || "",
    amount: Number(row.montantTotal || 0),
    remaining: Number(row.soldeRestant || 0),
    flagsMetier: row.flagsMetier || normalizeDossierFlags(),
    canCash: Number(row.soldeRestant || 0) > 0,
    open: () => openRetoucheDetail(row.idRetouche),
    cash: () => onPaiementRetouche(row)
  };
}

const dossierRetoucheCards = computed(() =>
  (detailDossier.value?.retouches || []).map((row) => createDossierWorkspaceDocument("retouche", row))
);

const dossierCommandeCards = computed(() =>
  (detailDossier.value?.commandes || []).map((row) => createDossierWorkspaceDocument("commande", row))
);

const dossierWorkspaceHasDocuments = computed(() => dossierRetoucheCards.value.length > 0 || dossierCommandeCards.value.length > 0);

const detailDossierDeliveredDocumentsCount = computed(() => {
  if (!detailDossier.value) return 0;
  const commandes = Array.isArray(detailDossier.value.commandes) ? detailDossier.value.commandes : [];
  const retouches = Array.isArray(detailDossier.value.retouches) ? detailDossier.value.retouches : [];
  return [
    ...commandes.map((row) => row?.statutCommande),
    ...retouches.map((row) => row?.statutRetouche)
  ].filter((status) => normalizeDocumentStatus(status) === "LIVREE").length;
});

function getDetailDossierFirstCashableDocument() {
  if (!detailDossier.value) return null;
  const commande = (detailDossier.value.commandes || []).find((row) => Number(row?.soldeRestant || 0) > 0);
  if (commande) return createDossierWorkspaceDocument("commande", commande);
  const retouche = (detailDossier.value.retouches || []).find((row) => Number(row?.soldeRestant || 0) > 0);
  if (retouche) return createDossierWorkspaceDocument("retouche", retouche);
  return null;
}

function clearDossierWorkspaceActionFeedback() {
  dossierWorkspacePendingActionKey.value = "";
  dossierWorkspaceSuccessActionKey.value = "";
  dossierWorkspaceErrorActionKey.value = "";
  if (dossierWorkspaceActionFeedbackTimer) {
    window.clearTimeout(dossierWorkspaceActionFeedbackTimer);
    dossierWorkspaceActionFeedbackTimer = null;
  }
}

function scheduleDossierWorkspaceFeedbackReset() {
  if (dossierWorkspaceActionFeedbackTimer) window.clearTimeout(dossierWorkspaceActionFeedbackTimer);
  dossierWorkspaceActionFeedbackTimer = window.setTimeout(() => {
    dossierWorkspaceSuccessActionKey.value = "";
    dossierWorkspaceErrorActionKey.value = "";
    dossierWorkspaceActionFeedbackTimer = null;
  }, 1400);
}

function isDossierWorkspaceActionPending(actionKey) {
  return dossierWorkspacePendingActionKey.value === actionKey;
}

function isDossierWorkspaceActionSuccessful(actionKey) {
  return dossierWorkspaceSuccessActionKey.value === actionKey;
}

function isDossierWorkspaceActionInError(actionKey) {
  return dossierWorkspaceErrorActionKey.value === actionKey;
}

function dossierWorkspaceActionLabel(document, actionType) {
  const actionKey = `${document.key}:${actionType}`;
  if (isDossierWorkspaceActionPending(actionKey)) {
    return actionType === "open" ? "Ouverture..." : "Paiement...";
  }
  if (isDossierWorkspaceActionSuccessful(actionKey)) {
    return actionType === "open" ? "Ouvert" : "Enregistre";
  }
  if (actionType === "open") return "Voir";
  return "Payer";
}

async function runDossierWorkspaceAction(document, actionType, action) {
  if (!document || typeof action !== "function") return;
  const actionKey = `${document.key}:${actionType}`;
  clearDossierWorkspaceActionFeedback();
  dossierWorkspaceActiveDocumentKey.value = document.key;
  dossierWorkspacePendingActionKey.value = actionKey;
  try {
    await action();
    dossierWorkspacePendingActionKey.value = "";
    dossierWorkspaceSuccessActionKey.value = actionKey;
    scheduleDossierWorkspaceFeedbackReset();
  } catch (err) {
    dossierWorkspacePendingActionKey.value = "";
    dossierWorkspaceErrorActionKey.value = actionKey;
    scheduleDossierWorkspaceFeedbackReset();
    notify(readableError(err));
  }
}

async function onDossierWorkspaceOpen(document) {
  await runDossierWorkspaceAction(document, "open", document?.open);
}

async function onDossierWorkspaceCash(document) {
  await runDossierWorkspaceAction(document, "cash", document?.cash);
}

async function onDetailDossierCash() {
  const document = getDetailDossierFirstCashableDocument();
  if (!document) {
    notify("Aucun document avec solde a encaisser.");
    return;
  }
  await runDossierWorkspaceAction(document, "cash", document.cash);
}

function resetDossierVisibleCount() {
  dossiersVisibleCount.value = dossiersPagination.pageSize;
}

function loadMoreDossiers() {
  const nextCount = Math.min(dossiersFiltered.value.length, dossiersVisibleCount.value + dossiersPagination.pageSize);
  if (nextCount > dossiersVisibleCount.value) {
    dossiersVisibleCount.value = nextCount;
  }
}

function setupDossierInfiniteObserver() {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
  if (dossierInfiniteObserver) {
    dossierInfiniteObserver.disconnect();
    dossierInfiniteObserver = null;
  }
  nextTick(() => {
    const target = dossierInfiniteSentinel.value;
    if (!target) return;
    dossierInfiniteObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreDossiers();
        }
      },
      { root: null, rootMargin: "0px 0px 240px 0px", threshold: 0.05 }
    );
    dossierInfiniteObserver.observe(target);
  });
}

function resetDossierDraft() {
  dossierDraft.mode = "existing";
  dossierDraft.existingClientId = "";
  dossierDraft.newClient.nom = "";
  dossierDraft.newClient.prenom = "";
  dossierDraft.newClient.telephone = "";
  dossierDraft.doublonDecisionAction = "";
  dossierDraft.doublonDecisionId = "";
  dossierDraft.typeDossier = "INDIVIDUEL";
  dossierDraft.notes = "";
  dossierClientSearchQuery.value = "";
  dossierClientSearchOpen.value = false;
  dossierClientSearchIndex.value = -1;
}
const MAX_CLIENT_SEARCH_RESULTS = 10;
const CLIENT_INSIGHT_PREVIEW_SIZE = 3;
const dossierClientSearchQuery = ref("");
const dossierClientSearchOpen = ref(false);
const dossierClientSearchIndex = ref(-1);
const wizardClientSearchQuery = ref("");
const wizardClientSearchOpen = ref(false);
const wizardClientSearchIndex = ref(-1);
const retoucheClientSearchQueryWizard = ref("");
const retoucheClientSearchOpen = ref(false);
const retoucheClientSearchIndex = ref(-1);
const wizardClientInsight = ref(null);
const wizardClientInsightLoading = ref(false);
const wizardClientInsightError = ref("");
const wizardClientInsightRequestId = ref(0);
const retoucheClientInsight = ref(null);
const retoucheClientInsightLoading = ref(false);
const retoucheClientInsightError = ref("");
const retoucheClientInsightRequestId = ref(0);

const factureEmission = reactive({
  open: false,
  typeOrigine: "COMMANDE",
  idOrigine: "",
  submitting: false
});

const selectedCommandeId = ref("");
const detailCommande = ref(null);
const detailPaiements = ref([]);
const detailCommandeEvents = ref([]);
const detailCommandeMedia = ref([]);
const detailCommandeContactTemplateKey = ref("");
const detailCommandeContactFollowUp = createContactFollowUpState();
const commandeMediaViewer = reactive({
  open: false,
  items: [],
  index: -1,
  currentMediaId: "",
  currentBlobUrl: ""
});
const detailPaiementsPagination = createPagination(10);
const detailCommandeEventsPagination = createPagination(10);
const detailPaiementsVisibleCount = ref(detailPaiementsPagination.pageSize);
const detailCommandeEventsVisibleCount = ref(detailCommandeEventsPagination.pageSize);
const detailLoading = ref(false);
const detailPaiementsLoading = ref(false);
const detailCommandeEventsLoading = ref(false);
const detailPaiementsLoadingMore = ref(false);
const detailCommandeEventsLoadingMore = ref(false);
const detailCommandeMediaLoading = ref(false);
const detailCommandeMediaUploading = ref(false);
const detailCommandeMediaActionId = ref("");
const detailCommandeMediaError = ref("");
const detailError = ref("");
const detailCommandeHistoryPanels = reactive({ paiements: false, evenements: false });
const detailRetoucheHistoryPanels = reactive({ paiements: false, evenements: false });
const detailPaiementsInfiniteSentinel = ref(null);
const detailCommandeEventsInfiniteSentinel = ref(null);
let detailPaiementsInfiniteObserver = null;
let detailCommandeEventsInfiniteObserver = null;
const detailCommandeItemStatuses = reactive({});
const detailRetoucheItemStatuses = reactive({});
const commandeItemPhotoDialog = reactive({ open: false, itemId: "", title: "" });
const commandeMediaViewerCurrentItem = computed(() => {
  if (commandeMediaViewer.index >= 0 && commandeMediaViewer.index < commandeMediaViewer.items.length) {
    return commandeMediaViewer.items[commandeMediaViewer.index] || null;
  }
  if (commandeMediaViewer.currentMediaId) {
    return commandeMediaViewer.items.find((item) => mediaActionKey(item) === commandeMediaViewer.currentMediaId) || null;
  }
  return null;
});
const commandeMediaViewerCanPrev = computed(() => commandeMediaViewer.index > 0);
const commandeMediaViewerCanNext = computed(
  () => commandeMediaViewer.index >= 0 && commandeMediaViewer.index < commandeMediaViewer.items.length - 1
);
const commandeMediaViewerTitle = computed(() => {
  const item = commandeMediaViewerCurrentItem.value;
  if (!item) return "Photo commande";
  return String(item.nomFichierOriginal || "").trim() || `Photo ${Math.max(1, commandeMediaViewer.index + 1)}`;
});
const commandeMediaViewerSubtitle = computed(() => {
  if (!commandeMediaViewerCurrentItem.value || commandeMediaViewer.items.length <= 1) return "";
  return `Photo ${commandeMediaViewer.index + 1} sur ${commandeMediaViewer.items.length}`;
});
const wizardCommandeMeasureIndex = ref(0);
const wizardRetoucheMeasureIndex = ref(0);
const commandeMediaViewerImageUrl = computed(
  () => commandeMediaViewer.currentBlobUrl || commandeMediaViewerCurrentItem.value?.fileBlobUrl || ""
);
const commandeMediaViewerLoading = computed(() => {
  if (!commandeMediaViewer.open) return false;
  if (commandeMediaViewerImageUrl.value) return false;
  return Boolean(
    commandeMediaViewer.currentMediaId &&
      detailCommandeMediaActionId.value &&
      detailCommandeMediaActionId.value === commandeMediaViewer.currentMediaId
  );
});

const selectedRetoucheId = ref("");
const detailRetouche = ref(null);
const detailRetouchePaiements = ref([]);
const detailRetoucheEvents = ref([]);
const detailRetoucheContactTemplateKey = ref("");
const detailRetoucheContactFollowUp = createContactFollowUpState();
const detailRetouchePaiementsPagination = createPagination(10);
const detailRetoucheEventsPagination = createPagination(10);
const detailRetouchePaiementsVisibleCount = ref(detailRetouchePaiementsPagination.pageSize);
const detailRetoucheEventsVisibleCount = ref(detailRetoucheEventsPagination.pageSize);
const detailRetoucheLoading = ref(false);
const detailRetouchePaiementsLoading = ref(false);
const detailRetoucheEventsLoading = ref(false);
const detailRetouchePaiementsLoadingMore = ref(false);
const detailRetoucheEventsLoadingMore = ref(false);
const detailRetoucheError = ref("");
const detailRetouchePaiementsInfiniteSentinel = ref(null);
const detailRetoucheEventsInfiniteSentinel = ref(null);
let detailRetouchePaiementsInfiniteObserver = null;
let detailRetoucheEventsInfiniteObserver = null;

const selectedVenteId = ref("");
const detailVente = ref(null);
const detailVenteLoading = ref(false);
const detailVenteError = ref("");

const selectedFactureId = ref("");
const detailFacture = ref(null);
const detailFactureLoading = ref(false);
const detailFactureError = ref("");
const detailCommandeActions = ref(null);
const detailRetoucheActions = ref(null);
const detailItemEditModal = reactive({
  open: false,
  kind: "",
  parentId: "",
  itemId: "",
  title: "",
  subtitle: "",
  description: "",
  prix: "",
  mesures: {},
  fields: [],
  submitting: false,
  error: ""
});
const detailPaiementsPaged = computed(() => detailPaiements.value.slice(0, detailPaiementsVisibleCount.value));
const detailCommandeEventsPaged = computed(() => detailCommandeEvents.value.slice(0, detailCommandeEventsVisibleCount.value));
const detailRetouchePaiementsPaged = computed(() => detailRetouchePaiements.value.slice(0, detailRetouchePaiementsVisibleCount.value));
const detailRetoucheEventsPaged = computed(() => detailRetoucheEvents.value.slice(0, detailRetoucheEventsVisibleCount.value));
const detailPaiementsInfiniteEndReached = computed(() => detailPaiements.value.length > 0 && detailPaiementsPaged.value.length >= detailPaiements.value.length);
const detailCommandeEventsInfiniteEndReached = computed(
  () => detailCommandeEvents.value.length > 0 && detailCommandeEventsPaged.value.length >= detailCommandeEvents.value.length
);
const detailRetouchePaiementsInfiniteEndReached = computed(
  () => detailRetouchePaiements.value.length > 0 && detailRetouchePaiementsPaged.value.length >= detailRetouchePaiements.value.length
);
const detailRetoucheEventsInfiniteEndReached = computed(
  () => detailRetoucheEvents.value.length > 0 && detailRetoucheEventsPaged.value.length >= detailRetoucheEvents.value.length
);

const selectedClientConsultationId = ref("");
const clientConsultationQuery = ref("");
const clientConsultationSection = ref("commandes");
const clientMobileFiltersOpen = ref(false);
const wizardMeasureStepRef = ref(null);
const retoucheMeasureStepRef = ref(null);
let wizardMeasureScrollRestoreTop = 0;
let wizardMeasureRestoreToken = 0;
let activeMeasureScrollContext = "";
let measureViewportResizeHandler = null;
const CLIENT_CONSULT_SECTION_KEY = "atelier.clients_consult.section.v1";
const clientConsultation = ref(null);
const clientConsultationLoading = ref(false);
const clientConsultationError = ref("");
const clientConsultationContactTemplateKey = ref("");
const clientConsultationContactFollowUp = createContactFollowUpState();
const clientHistoryFilters = reactive({
  source: "ALL",
  typeHabit: "ALL",
  periode: "ALL"
});
const clientPagination = reactive({
  commandesPage: 1,
  retouchesPage: 1,
  mesuresPage: 1,
  pageSize: 5
});

const bilanHebdo = ref([]);
const bilanMensuel = ref([]);
const bilanAnnuel = ref([]);
const auditCaisseJournalier = ref([]);
const auditOperations = ref([]);
const auditCommandes = ref([]);
const auditRetouches = ref([]);
const auditStockVentes = ref([]);
const auditFactures = ref([]);
const auditCaisseJournalierPagination = createPagination(10);
const bilanHebdoPagination = createPagination(10);
const bilanMensuelPagination = createPagination(10);
const bilanAnnuelPagination = createPagination(10);
const auditOperationsPagination = createPagination(20);
const auditCommandesPagination = createPagination(10);
const auditRetouchesPagination = createPagination(10);
const auditStockVentesPagination = createPagination(10);
const auditFacturesPagination = createPagination(10);
const auditUtilisateurs = ref([]);
const auditUtilisateursFiltres = reactive({
  recherche: "",
  action: "ALL",
  statut: "ALL"
});
const auditUtilisateursPagination = reactive({
  page: 1,
  pageSize: 20
});
const auditError = ref("");
const auditLoading = ref(false);
const auditHubMetrics = ref({
  caissesCloturees: 0,
  dernierSoldeCloture: 0,
  moisCourant: "",
  totalOperations: 0,
  montantCumule: 0
});
const auditSubRoute = ref("/audit");
const { pages: auditCaisseJournalierPages, paged: auditCaisseJournalierPaged } = createClientSidePager(auditCaisseJournalier, auditCaisseJournalierPagination);
const { pages: bilanHebdoPages, paged: bilanHebdoPaged } = createClientSidePager(bilanHebdo, bilanHebdoPagination);
const { pages: bilanMensuelPages, paged: bilanMensuelPaged } = createClientSidePager(bilanMensuel, bilanMensuelPagination);
const { pages: bilanAnnuelPages, paged: bilanAnnuelPaged } = createClientSidePager(bilanAnnuel, bilanAnnuelPagination);
const { pages: auditOperationsPages, paged: auditOperationsPaged } = createClientSidePager(auditOperations, auditOperationsPagination);
const { pages: auditCommandesPages, paged: auditCommandesPaged } = createClientSidePager(auditCommandes, auditCommandesPagination);
const { pages: auditRetouchesPages, paged: auditRetouchesPaged } = createClientSidePager(auditRetouches, auditRetouchesPagination);
const { pages: auditStockVentesPages, paged: auditStockVentesPaged } = createClientSidePager(auditStockVentes, auditStockVentesPagination);
const { pages: auditFacturesPages, paged: auditFacturesPaged } = createClientSidePager(auditFactures, auditFacturesPagination);

const SETTINGS_STORAGE_KEY = "atelier.settings.v1";
const RUNTIME_SETTINGS_STORAGE_KEY = "atelier.runtime-settings.v1";
const settingsEditMode = ref(false);
const settingsConfirmSave = ref(false);
const settingsAuditNote = ref("");
const settingsLoading = ref(false);
const settingsSaving = ref(false);
const settingsError = ref("");
const settingsLogoUploading = ref(false);
const settingsLogoLocalPreviewUrl = ref("");
const settingsLogoSelectedFile = ref(null);
const settingsLogoInputRef = ref(null);
const settingsActiveTab = ref("identite");
const settingsSnapshot = ref("");
const settingsUserSnapshot = ref("");
const settingsMeasureQuery = ref("");
const settingsMeasureStatusFilter = ref("ALL");
const selectedSettingsHabitKey = ref("");
const settingsMeasurePagination = reactive({
  page: 1,
  pageSize: 12
});
const settingsRetoucheQuery = ref("");
const settingsRetoucheStatusFilter = ref("ALL");
const selectedSettingsRetoucheTypeCode = ref("");
const settingsRetouchePagination = reactive({
  page: 1,
  pageSize: 10
});
const contactTemplateFieldDefinitions = [
  { key: "commandePrete", label: "Commande prete", group: "commandes" },
  { key: "commandeSuivi", label: "Commande en cours", group: "commandes" },
  { key: "commandeSolde", label: "Rappel solde commande", group: "commandes" },
  { key: "commandeRetard", label: "Nouveau delai commande", group: "commandes" },
  { key: "retouchePrete", label: "Retouche prete", group: "retouches" },
  { key: "retoucheSuivi", label: "Retouche en cours", group: "retouches" },
  { key: "retoucheSolde", label: "Rappel solde retouche", group: "retouches" },
  { key: "retoucheDelai", label: "Date prevue retouche", group: "retouches" },
  { key: "clientBonjour", label: "Relance simple", group: "client" },
  { key: "clientRendezVous", label: "Rappel atelier", group: "client" },
  { key: "clientMerci", label: "Message de remerciement", group: "client" }
];
const contactFollowUpStatusOptions = [
  { value: "A_RELANCER", label: "A relancer" },
  { value: "CONTACTE", label: "Contacte" },
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "PROMIS", label: "Promis" },
  { value: "TERMINE", label: "Termine" }
];
const contactFollowUpStatusLabels = Object.fromEntries(contactFollowUpStatusOptions.map((option) => [option.value, option.label]));
const settingsConfirmModal = reactive({
  open: false,
  title: "",
  message: "",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler"
});
const actionModal = reactive({
  open: false,
  title: "",
  message: "",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
  tone: "blue",
  stacked: false,
  fields: [],
  values: {},
  error: ""
});
let settingsConfirmResolver = null;
let actionModalResolver = null;
const settingsCancelButtonRef = ref(null);
const actionCancelButtonRef = ref(null);
const settingsTabs = [
  { id: "identite", label: "Identite" },
  { id: "contact", label: "Contact client" },
  { id: "commandes", label: "Commandes" },
  { id: "retouches", label: "Retouches" },
  { id: "mesures", label: "Mesures" },
  { id: "caisse", label: "Caisse" },
  { id: "facturation", label: "Facturation" },
  { id: "securite", label: "Securite" }
];
const settingsUser = reactive({
  nom: "",
  role: "COUTURIER"
});
const settingsRoleOptions = [
  { value: "PROPRIETAIRE", label: "Proprietaire" },
  { value: "COUTURIER", label: "Couturier" },
  { value: "CAISSIER", label: "Caissier" }
];
const securityRoleOptions = [...settingsRoleOptions];
const securityPermissionLabels = {
  VOIR_CLIENTS: "Voir clients",
  CREER_CLIENT: "Creer client",
  MODIFIER_CLIENT: "Modifier client",
  DESACTIVER_CLIENT: "Desactiver client",
  VOIR_COMMANDES: "Voir commandes",
  CREER_COMMANDE: "Creer commande",
  VOIR_RETOUCHES: "Voir retouches",
  CREER_RETOUCHE: "Creer retouche",
  ANNULER_COMMANDE: "Annuler commande/retouche",
  VOIR_BILANS_GLOBAUX: "Voir bilans & audit",
  GERER_STOCK: "Gerer stock",
  GERER_VENTES: "Gerer ventes",
  GERER_ACHATS_STOCK: "Gerer achats stock",
  GERER_AJUSTEMENTS_STOCK: "Gerer ajustements stock",
  VOIR_AUDIT_STOCK: "Voir audit stock & ventes",
  OUVRIR_CAISSE: "Ouvrir caisse",
  ENREGISTRER_ENTREE_CAISSE: "Enregistrer entree caisse",
  ENREGISTRER_SORTIE_CAISSE: "Enregistrer sortie caisse",
  ANNULER_OPERATION_CAISSE: "Annuler operation caisse",
  CLOTURER_CAISSE: "Cloturer caisse",
  LIVRER_COMMANDE: "Livrer commande/retouche",
  TERMINER_COMMANDE: "Terminer commande/retouche",
  MODIFIER_PARAMETRES: "Modifier parametres atelier",
  GERER_UTILISATEURS: "Gerer utilisateurs & permissions"
};
const securityPermissionOptions = Object.keys(securityPermissionLabels);
const securityUsers = ref([]);
const securityRolePermissions = ref({});
const securityLoading = ref(false);
const securitySaving = ref(false);
const securityError = ref("");
const securityUserQuery = ref("");
const securityUserRoleFilter = ref("ALL");
const securityUserStatusFilter = ref("ALL");
const securityUsersPagination = reactive({
  page: 1,
  pageSize: 10
});
const securityNewUser = reactive({
  nom: "",
  email: "",
  motDePasse: "",
  roleId: "COUTURIER",
  actif: true
});
const deviseOptions = ["FC", "USD", "EUR"];

const periodOptions = [
  { value: "ALL", label: "Toute periode" },
  { value: "TODAY", label: "A livrer aujourd'hui" },
  { value: "NEXT_7", label: "7 prochains jours" },
  { value: "OVERDUE", label: "En retard" }
];
const soldeOptions = [
  { value: "ALL", label: "Tous soldes" },
  { value: "DUE", label: "Solde restant" },
  { value: "PAID", label: "Solde a 0" }
];
const retoucheTypeDefinitions = ref([]);

const habitTypeOptions = [
  { value: "PANTALON", label: "Pantalon" },
  { value: "CHEMISE", label: "Chemise" },
  { value: "CHEMISIER", label: "Chemisier" },
  { value: "VESTE", label: "Veste" },
  { value: "GILET", label: "Gilet" },
  { value: "JACKET", label: "Jacket" },
  { value: "BOUBOU", label: "Boubou" },
  { value: "ROBE", label: "Robe" },
  { value: "JUPE", label: "Jupe" },
  { value: "VESTE_FEMME", label: "Veste femme" },
  { value: "LIBAYA", label: "Libaya" },
  { value: "ENSEMBLE", label: "Ensemble (haut + bas)" }
];

const habitMesureDefinitions = {
  PANTALON: {
    required: ["longueur", "tourTaille", "tourHanche", "largeurBas", "hauteurFourche"],
    optional: []
  },
  CHEMISE: {
    required: ["poitrine", "longueurChemise", "typeManches", "poignet", "carrure"],
    optional: ["longueurManches"]
  },
  CHEMISIER: {
    required: ["poitrine", "longueurChemise", "typeManches", "poignet", "carrure"],
    optional: ["longueurManches"]
  },
  VESTE: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  GILET: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  JACKET: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  ROBE: {
    required: ["poitrine", "taille", "hanche", "longueur"],
    optional: ["largeurBas"]
  },
  JUPE: {
    required: ["poitrine", "taille", "hanche", "longueur"],
    optional: ["largeurBas"]
  },
  LIBAYA: {
    required: ["poitrine", "taille", "hanche", "longueur"],
    optional: ["largeurBas"]
  },
  BOUBOU: {
    required: ["poitrine", "longueur", "largeur", "ouvertureManches"],
    optional: []
  },
  VESTE_FEMME: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  ENSEMBLE: {
    required: ["poitrine", "taille", "hanche", "longueur", "tourTaille", "tourHanche", "largeurBas"],
    optional: []
  }
};

const mesureLabels = {
  longueur: "Longueur",
  tourTaille: "Tour taille",
  tourHanche: "Tour hanche",
  largeurBas: "Largeur bas",
  hauteurFourche: "Hauteur fourche",
  poitrine: "Poitrine",
  longueurChemise: "Longueur chemise/chemisier",
  typeManches: "Type manches",
  longueurManches: "Longueur manches",
  poignet: "Poignet",
  carrure: "Carrure",
  taille: "Taille",
  longueurVeste: "Longueur veste",
  hanche: "Hanche",
  largeur: "Largeur",
  ouvertureManches: "Ouverture manches"
};

const habitConfigOrder = ["PANTALON", "CHEMISE", "ROBE", "JUPE", "VESTE", "BOUBOU", "GILET", "LIBAYA", "AUTRES"];
const mesureTypeOptions = [
  { value: "number", label: "Nombre" },
  { value: "text", label: "Texte" },
  { value: "select", label: "Liste" }
];
const wildcardHabitOption = { value: "*", label: "Tous les habits" };

function buildDefaultRetoucheTypes() {
  return [
    {
      code: "OURLET_PANTALON",
      libelle: "Ourlet pantalon",
      actif: true,
      ordreAffichage: 1,
      necessiteMesures: true,
      mesures: [
        { code: "longueur", label: "Longueur", unite: "cm", typeChamp: "number", obligatoire: true, actif: true, ordre: 1 },
        { code: "largeurBas", label: "Largeur bas", unite: "cm", typeChamp: "number", obligatoire: false, actif: true, ordre: 2 }
      ],
      descriptionObligatoire: false,
      habitsCompatibles: ["PANTALON"]
    },
    {
      code: "REPARATION_DECHIRURE",
      libelle: "Reparation dechirure",
      actif: true,
      ordreAffichage: 2,
      necessiteMesures: false,
      mesures: [],
      descriptionObligatoire: true,
      habitsCompatibles: ["*"]
    },
    {
      code: "REPARATION",
      libelle: "Reparation",
      actif: true,
      ordreAffichage: 3,
      necessiteMesures: false,
      mesures: [],
      descriptionObligatoire: false,
      habitsCompatibles: ["*"]
    },
    {
      code: "OURLET",
      libelle: "Ourlet",
      actif: true,
      ordreAffichage: 4,
      necessiteMesures: true,
      mesures: [
        { code: "longueur", label: "Longueur", unite: "cm", typeChamp: "number", obligatoire: true, actif: true, ordre: 1 }
      ],
      descriptionObligatoire: false,
      habitsCompatibles: ["*"]
    }
  ];
}

function mesureLabelFromKey(key) {
  return mesureLabels[key] || key;
}

function normalizeSortOrder(value, fallback = Number.MAX_SAFE_INTEGER) {
  const order = Number(value);
  return Number.isFinite(order) && order >= 0 ? order : fallback;
}

function normalizeBoolean(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeMesureFieldType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "text" || type === "select") return type;
  return "number";
}

function buildDefaultHabitConfig() {
  const config = {};
  for (const [index, option] of habitTypeOptions.entries()) {
    const def = habitMesureDefinitions[option.value] || { required: [], optional: [] };
    config[option.value] = {
      label: option.label,
      ordre: index + 1,
      actif: true,
      mesures: [
        ...def.required.map((key, measureIndex) => ({
          code: key,
          label: mesureLabelFromKey(key),
          obligatoire: true,
          actif: true,
          ordre: measureIndex + 1,
          typeChamp: key === "typeManches" ? "select" : "number"
        })),
        ...def.optional.map((key, measureIndex) => ({
          code: key,
          label: mesureLabelFromKey(key),
          obligatoire: false,
          actif: true,
          ordre: def.required.length + measureIndex + 1,
          typeChamp: key === "typeManches" ? "select" : "number"
        }))
      ]
    };
  }
  if (!config.AUTRES) {
    config.AUTRES = {
      label: "Autres",
      ordre: habitTypeOptions.length + 1,
      actif: true,
      mesures: []
    };
  }
  return config;
}

function cloneSettings(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveScopedStorageKey(baseKey, atelierId = "") {
  const normalizedAtelierId = String(atelierId || "").trim();
  return normalizedAtelierId ? `${baseKey}:${normalizedAtelierId}` : baseKey;
}

function readScopedStorageValue(baseKey, atelierId = "", { allowLegacy = false } = {}) {
  const scopedKey = resolveScopedStorageKey(baseKey, atelierId);
  const scopedValue = window.localStorage.getItem(scopedKey);
  if (scopedValue) return { raw: scopedValue, key: scopedKey, legacy: false };
  if (!allowLegacy) return { raw: null, key: scopedKey, legacy: false };
  const legacyValue = window.localStorage.getItem(baseKey);
  if (!legacyValue) return { raw: null, key: scopedKey, legacy: false };
  return { raw: legacyValue, key: scopedKey, legacy: true };
}

function writeScopedStorageValue(baseKey, atelierId, payload) {
  const scopedKey = resolveScopedStorageKey(baseKey, atelierId);
  window.localStorage.setItem(scopedKey, JSON.stringify(payload));
  return scopedKey;
}

const atelierSettingsDefault = {
  meta: {
    version: 1,
    lastSavedAt: ""
  },
  identite: {
    nomAtelier: "Atelier",
    adresse: "",
    telephone: "",
    email: "",
    devise: "FC",
    logoUrl: ""
  },
  commandes: {
    mesuresObligatoires: true,
    interdictionSansMesures: true,
    uniteMesure: "cm",
    decimalesAutorisees: true,
    delaiDefautJours: 7,
    passageAutomatiqueEnCoursApresPremierPaiement: true,
    livraisonAutoriseeSeulementSiPaiementTotal: true,
    autoriserModificationMesuresApresCreation: true,
    autoriserAnnulationApresPaiement: false
  },
  retouches: {
    mesuresOptionnelles: true,
    saisiePartielle: true,
    descriptionObligatoire: true,
    typesRetouche: buildDefaultRetoucheTypes()
  },
  habits: buildDefaultHabitConfig(),
  caisse: {
    ouvertureAuto: "07:30",
    ouvertureDimanche: "08:00",
    finSemaineComptable: "DIMANCHE",
    clotureAutoActive: true,
    heureClotureAuto: "00:00",
    clotureAutoMinuit: true,
    paiementAvantLivraison: true,
    livraisonExpress: true
  },
  facturation: {
    prefixeNumero: "FAC",
    mentions: "Merci pour votre confiance.",
    afficherLogo: true
  },
  contactClient: {
    signatureAuto: true,
    templates: {
      commandePrete: "{salutation}\nVotre commande {reference} est prete. Merci de passer a l'atelier quand vous etes disponible.\n\n{signature}",
      commandeSuivi: "{salutation}\nVotre commande {reference} est en cours de traitement. Nous vous recontacterons des qu'elle sera prete.\n\n{signature}",
      commandeSolde: "{salutation}\nIl reste un solde de {montantRestant} pour votre commande {reference}. Merci pour votre confiance.\n\n{signature}",
      commandeRetard: "{salutation}\nVotre commande {reference} demande un peu plus de temps. Nous vous informerons du nouveau delai au plus vite.\n\n{signature}",
      retouchePrete: "{salutation}\nVotre retouche {reference} est prete. Vous pouvez passer a l'atelier quand vous voulez.\n\n{signature}",
      retoucheSuivi: "{salutation}\nVotre retouche {reference} est en cours de traitement. Nous vous informerons des qu'elle sera finalisee.\n\n{signature}",
      retoucheSolde: "{salutation}\nIl reste un solde de {montantRestant} pour votre retouche {reference}. Merci pour votre confiance.\n\n{signature}",
      retoucheDelai: "{salutation}\nVotre retouche {reference} suit son traitement. Nous reviendrons vers vous avec la date prevue de retrait.\n\n{signature}",
      clientBonjour: "{salutation}\nNous vous contactons depuis l'atelier pour faire le suivi de votre dossier.\n\n{signature}",
      clientRendezVous: "{salutation}\nMerci de nous confirmer votre disponibilite pour votre prochain passage a l'atelier.\n\n{signature}",
      clientMerci: "{salutation}\nMerci pour votre confiance. Nous restons disponibles si vous avez besoin d'un suivi complementaire.\n\n{signature}"
    }
  },
  securite: {
    rolesAutorises: ["PROPRIETAIRE"],
    confirmationAvantSauvegarde: true,
    verrouillageActif: true,
    auditLog: []
  }
};

const atelierSettings = reactive(cloneSettings(atelierSettingsDefault));
const atelierRuntimeSettingsDefault = {
  meta: {
    version: 1,
    lastSavedAt: ""
  },
  identite: {
    nomAtelier: "Atelier",
    devise: "FC",
    logoUrl: "",
    telephone: ""
  },
  commandes: cloneSettings(atelierSettingsDefault.commandes),
  retouches: cloneSettings(atelierSettingsDefault.retouches),
  habits: cloneSettings(atelierSettingsDefault.habits),
  contactClient: cloneSettings(atelierSettingsDefault.contactClient)
};
const atelierRuntimeSettings = reactive(cloneSettings(atelierRuntimeSettingsDefault));
const atelierRuntimeSettingsReady = ref(false);

function applySettings(target, source) {
  if (!source || typeof source !== "object") return;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (Array.isArray(value)) {
      target[key] = value;
    } else if (value && typeof value === "object") {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      applySettings(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function buildRuntimeSettingsSubset(source) {
  const next = cloneSettings(atelierRuntimeSettingsDefault);
  if (source && typeof source === "object") {
    applySettings(next, {
      meta: source.meta || {},
      identite: {
        nomAtelier: source.identite?.nomAtelier || next.identite.nomAtelier,
        devise: source.identite?.devise || next.identite.devise,
        logoUrl: source.identite?.logoUrl || next.identite.logoUrl,
        telephone: source.identite?.telephone || next.identite.telephone
      },
      commandes: source.commandes || {},
      retouches: source.retouches || {},
      habits: source.habits || {},
      contactClient: source.contactClient || {}
    });
  }
  return next;
}

function applyRuntimeSettingsSubset(source) {
  const next = buildRuntimeSettingsSubset(source);
  atelierRuntimeSettings.meta = next.meta;
  atelierRuntimeSettings.identite = next.identite;
  atelierRuntimeSettings.commandes = next.commandes;
  atelierRuntimeSettings.retouches = next.retouches;
  atelierRuntimeSettings.habits = next.habits;
  atelierRuntimeSettings.contactClient = next.contactClient;
}

function resetRuntimeSettings() {
  applyRuntimeSettingsSubset(atelierRuntimeSettingsDefault);
  atelierRuntimeSettingsReady.value = false;
}

function loadRuntimeSettingsLocal() {
  try {
    const entry = readScopedStorageValue(RUNTIME_SETTINGS_STORAGE_KEY, currentAtelierId.value);
    if (!entry.raw) return false;
    applyRuntimeSettingsSubset(JSON.parse(entry.raw));
    atelierRuntimeSettingsReady.value = true;
    return true;
  } catch (err) {
    console.warn("Failed to load atelier runtime settings (local)", err);
    return false;
  }
}

function normalizeCaisseSettings(caisse) {
  if (!caisse || typeof caisse !== "object") return;
  const finSemaine = String(caisse.finSemaineComptable || caisse.finSemaine || "").trim().toUpperCase();
  caisse.finSemaineComptable = finSemaine === "SAMEDI" ? "SAMEDI" : "DIMANCHE";
  if (typeof caisse.clotureAutoActive !== "boolean") {
    caisse.clotureAutoActive = typeof caisse.clotureAutoMinuit === "boolean" ? caisse.clotureAutoMinuit : true;
  }
  if (typeof caisse.heureClotureAuto !== "string" || !/^\d{2}:\d{2}$/.test(caisse.heureClotureAuto)) {
    caisse.heureClotureAuto = "00:00";
  }
  caisse.clotureAutoMinuit = caisse.clotureAutoActive === true && caisse.heureClotureAuto === "00:00";
}

function loadAtelierSettingsLocal() {
  try {
    const entry = readScopedStorageValue(SETTINGS_STORAGE_KEY, currentAtelierId.value, { allowLegacy: true });
    if (!entry.raw) return false;
    const parsed = JSON.parse(entry.raw);
    applySettings(atelierSettings, parsed);
    normalizeCaisseSettings(atelierSettings.caisse);
    if (entry.legacy && currentAtelierId.value) {
      writeScopedStorageValue(SETTINGS_STORAGE_KEY, currentAtelierId.value, cloneSettings(atelierSettings));
    }
    return true;
  } catch (err) {
    console.warn("Failed to load atelier settings (local)", err);
    return false;
  }
}

function serializeSettings() {
  return JSON.stringify(cloneSettings(atelierSettings));
}

function buildNormalizedSettingsSnapshotPayload() {
  const payload = cloneSettings(atelierSettings);
  normalizeCaisseSettings(payload.caisse);
  payload.retouches = prepareRetoucheSettingsForSave(payload.retouches);
  payload.habits = prepareHabitSettingsForSave(payload.habits);
  return payload;
}

function serializeSettingsUser() {
  return JSON.stringify({
    nom: settingsUser.nom,
    role: settingsUser.role
  });
}

function captureSettingsSnapshot() {
  try {
    settingsSnapshot.value = JSON.stringify(buildNormalizedSettingsSnapshotPayload());
  } catch {
    settingsSnapshot.value = serializeSettings();
  }
  settingsUserSnapshot.value = serializeSettingsUser();
}

function restoreSettingsFromSnapshot() {
  if (!settingsSnapshot.value) return;
  try {
    applySettings(atelierSettings, JSON.parse(settingsSnapshot.value));
    normalizeCaisseSettings(atelierSettings.caisse);
    if (settingsUserSnapshot.value) {
      const parsedUser = JSON.parse(settingsUserSnapshot.value);
      settingsUser.nom = parsedUser.nom || "";
      settingsUser.role = parsedUser.role || "COUTURIER";
    }
  } catch (err) {
    console.warn("Failed to restore settings snapshot", err);
  }
}

function openSettingsConfirmModal({
  title = "Confirmation",
  message = "",
  confirmLabel = "Continuer",
  cancelLabel = "Annuler"
}) {
  settingsConfirmModal.title = title;
  settingsConfirmModal.message = message;
  settingsConfirmModal.confirmLabel = confirmLabel;
  settingsConfirmModal.cancelLabel = cancelLabel;
  settingsConfirmModal.open = true;
  nextTick(() => settingsCancelButtonRef.value?.focus());
  return new Promise((resolve) => {
    settingsConfirmResolver = resolve;
  });
}

function closeSettingsConfirmModal(confirmed) {
  settingsConfirmModal.open = false;
  if (settingsConfirmResolver) {
    settingsConfirmResolver(confirmed);
    settingsConfirmResolver = null;
  }
}

async function loadAtelierSettings() {
  loadAtelierSettingsLocal();
  captureSettingsSnapshot();
  if (currentRole.value === "MANAGER_SYSTEME") {
    settingsLoading.value = false;
    settingsError.value = "";
    return;
  }
  try {
    settingsLoading.value = true;
    settingsError.value = "";
    const response = await atelierApi.getParametresAtelier();
    if (response?.payload) {
      applySettings(atelierSettings, response.payload);
      normalizeCaisseSettings(atelierSettings.caisse);
      if (response.version !== undefined && response.version !== null) {
        atelierSettings.meta.version = Number(response.version || 1);
      }
      persistAtelierSettings();
      captureSettingsSnapshot();
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
    settingsError.value = readableError(err);
    console.warn("Failed to load atelier settings (api)", err);
  } finally {
    settingsLoading.value = false;
  }
}

function persistAtelierSettings() {
  const payload = cloneSettings(atelierSettings);
  writeScopedStorageValue(SETTINGS_STORAGE_KEY, currentAtelierId.value, payload);
}

function persistAtelierRuntimeSettings() {
  const payload = buildRuntimeSettingsSubset(atelierRuntimeSettings);
  writeScopedStorageValue(RUNTIME_SETTINGS_STORAGE_KEY, currentAtelierId.value, payload);
}

function withVersionedUrl(url, versionToken = "") {
  const value = String(url || "").trim();
  const token = String(versionToken || "").trim();
  if (!value || !token) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}v=${encodeURIComponent(token)}`;
}

function revokeSettingsLogoPreviewUrl() {
  if (settingsLogoLocalPreviewUrl.value) {
    URL.revokeObjectURL(settingsLogoLocalPreviewUrl.value);
    settingsLogoLocalPreviewUrl.value = "";
  }
}

async function loadAtelierRuntimeSettings() {
  resetRuntimeSettings();
  if (!isAuthenticated.value || currentRole.value === "MANAGER_SYSTEME") {
    atelierRuntimeSettingsReady.value = true;
    return;
  }

  loadRuntimeSettingsLocal();

  try {
    const response = await atelierApi.getRuntimeParametresAtelier();
    if (response?.payload) {
      applyRuntimeSettingsSubset(response.payload);
      if (response.version !== undefined && response.version !== null) {
        atelierRuntimeSettings.meta.version = Number(response.version || 1);
      }
      if (response.updatedAt) {
        atelierRuntimeSettings.meta.lastSavedAt = String(response.updatedAt || "");
      }
      persistAtelierRuntimeSettings();
    } else {
      applyRuntimeSettingsSubset(atelierSettings);
      persistAtelierRuntimeSettings();
    }
  } catch (err) {
    if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
      console.warn("Failed to load atelier runtime settings", err);
    }
    if (!atelierRuntimeSettingsReady.value) {
      applyRuntimeSettingsSubset(atelierSettings);
      persistAtelierRuntimeSettings();
    }
  } finally {
    atelierRuntimeSettingsReady.value = true;
  }
}

async function refreshRetoucheTypeDefinitions() {
  try {
    const rows = await atelierApi.listRetoucheTypes();
    retoucheTypeDefinitions.value = (rows || [])
      .map(normalizeRetoucheTypeDefinition)
      .filter(Boolean)
      .sort((left, right) => {
        if (left.ordreAffichage !== right.ordreAffichage) return left.ordreAffichage - right.ordreAffichage;
        return String(left.libelle || left.code).localeCompare(String(right.libelle || right.code), "fr", {
          sensitivity: "base"
        });
      });
  } catch (err) {
    console.warn("Failed to refresh retouche types", err);
  }
}

function clearSelectedAtelierLogo({ resetInput = true } = {}) {
  settingsLogoSelectedFile.value = null;
  revokeSettingsLogoPreviewUrl();
  if (resetInput && settingsLogoInputRef.value) {
    settingsLogoInputRef.value.value = "";
  }
}

function onAtelierLogoFileChange(event) {
  const file = event?.target?.files?.[0] || null;
  clearSelectedAtelierLogo({ resetInput: false });
  if (!file) return;
  const mimeType = String(file.type || "").trim().toLowerCase();
  if (!["image/png", "image/jpeg"].includes(mimeType)) {
    if (event?.target) event.target.value = "";
    notify("Le logo doit etre un fichier PNG ou JPG.");
    return;
  }
  if (Number(file.size || 0) > 2 * 1024 * 1024) {
    if (event?.target) event.target.value = "";
    notify("Le logo ne doit pas depasser 2 MB.");
    return;
  }
  settingsLogoSelectedFile.value = file;
  settingsLogoLocalPreviewUrl.value = URL.createObjectURL(file);
}

function normalizeAtelierSlugInput(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

function persistAuthPortal() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_PORTAL_STORAGE_KEY, authPortal.value);
}

function persistAuthAtelierSlug() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_ATELIER_SLUG_STORAGE_KEY, authAtelierSlug.value);
}

function resetSystemAtelierModal() {
  systemAtelierModal.open = false;
  systemAtelierModal.submitting = false;
  systemAtelierModal.error = "";
  systemAtelierModal.nomAtelier = "";
  systemAtelierModal.slug = "";
  systemAtelierModal.slugTouched = false;
  systemAtelierModal.proprietaireNom = "";
  systemAtelierModal.proprietaireEmail = "";
  systemAtelierModal.proprietaireTelephone = "";
  systemAtelierModal.proprietaireMotDePasse = "";
}

const settingsRoleAllowed = computed(() => hasPermission(PERMISSIONS.MODIFIER_PARAMETRES));
const settingsCanEdit = computed(() => settingsEditMode.value && settingsRoleAllowed.value);
const canAccessSecurityModule = computed(() => hasPermission(PERMISSIONS.GERER_UTILISATEURS));
const canCreateClient = computed(() => hasPermission(PERMISSIONS.CREER_CLIENT));
const canCreateCommande = computed(() => hasPermission(PERMISSIONS.CREER_COMMANDE));
const canCreateRetouche = computed(() => hasPermission(PERMISSIONS.CREER_RETOUCHE));
const canCreateWizardClient = computed(() => canCreateClient.value || canCreateCommande.value || canCreateRetouche.value);
const canCreateVente = computed(() => hasAnyPermission([PERMISSIONS.GERER_VENTES, PERMISSIONS.VOIR_BILANS_GLOBAUX]));
const canOpenCaisse = computed(() => hasAnyPermission([PERMISSIONS.OUVRIR_CAISSE, PERMISSIONS.VOIR_BILANS_GLOBAUX]));
const canRecordCaisseExpense = computed(() => hasAnyPermission([PERMISSIONS.ENREGISTRER_SORTIE_CAISSE, PERMISSIONS.VOIR_BILANS_GLOBAUX]));
const canCloseCaisse = computed(() => hasAnyPermission([PERMISSIONS.CLOTURER_CAISSE, PERMISSIONS.VOIR_BILANS_GLOBAUX]));
const canManageStockPurchases = computed(() =>
  hasAnyPermission([PERMISSIONS.GERER_STOCK, PERMISSIONS.GERER_ACHATS_STOCK, PERMISSIONS.VOIR_BILANS_GLOBAUX])
);
const canManageStockAdjustments = computed(() =>
  hasAnyPermission([PERMISSIONS.GERER_STOCK, PERMISSIONS.GERER_AJUSTEMENTS_STOCK, PERMISSIONS.VOIR_BILANS_GLOBAUX])
);
const canManageStockArticles = computed(() =>
  hasAnyPermission([
    PERMISSIONS.GERER_STOCK,
    PERMISSIONS.GERER_ACHATS_STOCK,
    PERMISSIONS.GERER_AJUSTEMENTS_STOCK,
    PERMISSIONS.VOIR_BILANS_GLOBAUX
  ])
);
const visibleSettingsTabs = computed(() =>
  settingsTabs.filter((tab) => tab.id !== "securite" || canAccessSecurityModule.value)
);
const settingsLogoPreview = computed(() => (atelierSettings.identite.logoUrl || "").trim());
const settingsLogoVersionToken = computed(() => String(atelierSettings.meta?.lastSavedAt || atelierSettings.meta?.version || "").trim());
const settingsCurrentLogoPreview = computed(() => withVersionedUrl(resolveMediaUrl(settingsLogoPreview.value), settingsLogoVersionToken.value));
const settingsDisplayedLogoPreview = computed(() => settingsLogoLocalPreviewUrl.value || settingsCurrentLogoPreview.value);
const canUploadAtelierLogo = computed(() => settingsCanEdit.value && currentRole.value === "PROPRIETAIRE" && Boolean(currentAtelierId.value));
const authAtelierLogoUrl = computed(() => withVersionedUrl(resolveMediaUrl(String(authAtelierContext.value?.logoUrl || "").trim()), ""));
const atelierLogoUrl = computed(() => settingsCurrentLogoPreview.value || authAtelierLogoUrl.value);
const atelierNomAffichage = computed(() => {
  const value = String(atelierSettings.identite?.nomAtelier || "").trim();
  return value || "Atelier de Couture";
});
const isSystemManager = computed(() => currentRole.value === "MANAGER_SYSTEME");
const authPortalLabel = computed(() => (authPortal.value === "system" ? "Administration systeme" : "Connexion atelier"));
const authCardTitle = computed(() => {
  if (authPortal.value === "system") return "Administration systeme";
  const nomAtelier = String(authAtelierContext.value?.nom || "").trim();
  return nomAtelier || "Connexion atelier";
});
const authCardSubtitle = computed(() => {
  if (authPortal.value === "system") return "Console multi-tenant securisee";
  if (authAtelierContext.value?.slug) return `Slug actif: ${authAtelierContext.value.slug}`;
  return "Connexion securisee a votre atelier";
});
const workspaceName = computed(() => (isSystemManager.value ? "Administration systeme" : atelierNomAffichage.value));
const workspaceSubtitle = computed(() => (isSystemManager.value ? "Console multi-tenant" : "Gestion metier"));
const workspaceLogoText = computed(() => (isSystemManager.value || authPortal.value === "system" ? "MS" : "AT"));
const { isOnline: networkIsOnline } = useNetwork();
const syncStatusLabel = computed(() => {
  if (syncInProgress.value) return "🔄 Synchronisation...";
  if (pendingActions.value > 0) {
    return `⏳ ${pendingActions.value} action${pendingActions.value > 1 ? "s" : ""} en attente`;
  }
  return "✅ Synchronisé";
});
const syncStatusTone = computed(() => {
  if (syncInProgress.value) return "blue";
  if (pendingActions.value > 0) return "amber";
  return "ok";
});
const atelierDevise = computed(() => {
  const value = String(atelierSettings.identite?.devise || "").trim().toUpperCase();
  return value || "FC";
});
const factureAtelierProfile = computed(() => {
  const identite = atelierSettings.identite || {};
  const facturation = atelierSettings.facturation || {};
  return {
    nomAtelier: String(identite.nomAtelier || "").trim(),
    adresse: String(identite.adresse || "").trim(),
    telephone: String(identite.telephone || "").trim(),
    email: String(identite.email || "").trim(),
    devise: String(identite.devise || "").trim().toUpperCase(),
    logo: withVersionedUrl(resolveMediaUrl(String(identite.logoUrl || "").trim()), settingsLogoVersionToken.value),
    mentions: String(facturation.mentions || "").trim(),
    afficherLogo: facturation.afficherLogo === true
  };
});
const factureAtelierContactLine = computed(() =>
  [factureAtelierProfile.value.telephone, factureAtelierProfile.value.email].filter(Boolean).join(" • ")
);
const settingsSnapshotParsed = computed(() => {
  if (!settingsSnapshot.value) return cloneSettings(atelierSettingsDefault);
  try {
    return JSON.parse(settingsSnapshot.value);
  } catch {
    return cloneSettings(atelierSettingsDefault);
  }
});
const settingsUserSnapshotParsed = computed(() => {
  if (!settingsUserSnapshot.value) return { nom: settingsUser.nom, role: settingsUser.role };
  try {
    return JSON.parse(settingsUserSnapshot.value);
  } catch {
    return { nom: settingsUser.nom, role: settingsUser.role };
  }
});
const settingsHasUnsavedChanges = computed(() => {
  let currentSerialized = serializeSettings();
  try {
    currentSerialized = JSON.stringify(buildNormalizedSettingsSnapshotPayload());
  } catch {
    currentSerialized = serializeSettings();
  }
  const noteDirty = settingsAuditNote.value.trim().length > 0;
  const userDirty = serializeSettingsUser() !== settingsUserSnapshot.value;
  return currentSerialized !== settingsSnapshot.value || userDirty || noteDirty;
});
const wizardSettings = computed(() => (atelierRuntimeSettingsReady.value ? atelierRuntimeSettings : atelierSettings));
const wizardCommandesSettings = computed(() => wizardSettings.value?.commandes || atelierSettingsDefault.commandes);
const wizardRetouchesSettings = computed(() => wizardSettings.value?.retouches || atelierSettingsDefault.retouches);
const wizardHabitsSettings = computed(() => wizardSettings.value?.habits || atelierSettingsDefault.habits);
const availableHabitTypeOptions = computed(() => {
  const configuredEntries = Object.entries(atelierSettings.habits || {})
    .map(([value, config]) => ({
      value,
      label: String(config?.label || "").trim() || value,
      ordre: normalizeSortOrder(config?.ordre, Number.MAX_SAFE_INTEGER),
      actif: config?.actif !== false
    }))
    .filter((item) => item.value && item.actif);
  if (configuredEntries.length === 0) return habitTypeOptions;
  return configuredEntries.sort((left, right) => {
    if (left.ordre !== right.ordre) return left.ordre - right.ordre;
    const leftIndex = habitConfigOrder.indexOf(left.value);
    const rightIndex = habitConfigOrder.indexOf(right.value);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label, "fr", { sensitivity: "base" });
  });
});
const wizardAvailableHabitTypeOptions = computed(() => {
  const configuredEntries = Object.entries(wizardHabitsSettings.value || {})
    .map(([value, config]) => ({
      value,
      label: String(config?.label || "").trim() || value,
      ordre: normalizeSortOrder(config?.ordre, Number.MAX_SAFE_INTEGER),
      actif: config?.actif !== false
    }))
    .filter((item) => item.value && item.actif);
  if (configuredEntries.length === 0) return habitTypeOptions;
  return configuredEntries.sort((left, right) => {
    if (left.ordre !== right.ordre) return left.ordre - right.ordre;
    const leftIndex = habitConfigOrder.indexOf(left.value);
    const rightIndex = habitConfigOrder.indexOf(right.value);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label, "fr", { sensitivity: "base" });
  });
});
const habitConfigEntries = computed(() => {
  const keys = [
    ...habitConfigOrder,
    ...Object.keys(atelierSettings.habits || {}).filter((key) => !habitConfigOrder.includes(key))
  ];
  return keys
    .filter((key) => atelierSettings.habits && atelierSettings.habits[key])
    .map((key) => ({ key, config: atelierSettings.habits[key] }))
    .sort((left, right) => {
      const orderDiff = normalizeSortOrder(left.config?.ordre) - normalizeSortOrder(right.config?.ordre);
      if (orderDiff !== 0) return orderDiff;
      return String(left.config?.label || left.key).localeCompare(String(right.config?.label || right.key), "fr", {
        sensitivity: "base"
      });
    });
});
const filteredHabitConfigEntries = computed(() => {
  const query = settingsMeasureQuery.value.trim().toLowerCase();
  return habitConfigEntries.value.filter(({ key, config }) => {
    if (settingsMeasureStatusFilter.value === "ACTIVE" && config?.actif === false) return false;
    if (settingsMeasureStatusFilter.value === "INACTIVE" && config?.actif !== false) return false;
    if (!query) return true;
    const mesures = Array.isArray(config?.mesures) ? config.mesures : [];
    const haystack = [
      key,
      config?.label || "",
      ...mesures.flatMap((mesure) => [mesure?.code || "", mesure?.label || ""])
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});
const settingsUsedHabitTypes = computed(() => {
  const used = new Set();
  for (const row of commandes.value || []) {
    const typeHabit = String(row?.typeHabit || row?.type_habit || "").trim().toUpperCase();
    if (typeHabit) used.add(typeHabit);
  }
  for (const row of retouches.value || []) {
    const typeHabit = String(row?.typeHabit || row?.type_habit || "").trim().toUpperCase();
    if (typeHabit) used.add(typeHabit);
  }
  return used;
});
const settingsUsedRetoucheTypes = computed(() => {
  const used = new Set();
  for (const row of retouches.value || []) {
    const typeRetouche = String(row?.typeRetouche || row?.type_retouche || "").trim().toUpperCase();
    if (typeRetouche) used.add(typeRetouche);
  }
  return used;
});
const settingsMeasurePages = computed(() =>
  Math.max(1, Math.ceil(filteredHabitConfigEntries.value.length / settingsMeasurePagination.pageSize))
);
const pagedHabitConfigEntries = computed(() => {
  const page = Math.min(Math.max(1, settingsMeasurePagination.page), settingsMeasurePages.value);
  const start = (page - 1) * settingsMeasurePagination.pageSize;
  return filteredHabitConfigEntries.value.slice(start, start + settingsMeasurePagination.pageSize);
});
const selectedHabitConfigEntry = computed(() => {
  const selected = filteredHabitConfigEntries.value.find((entry) => entry.key === selectedSettingsHabitKey.value);
  if (selected) return selected;
  return filteredHabitConfigEntries.value[0] || habitConfigEntries.value[0] || null;
});
const availableRetoucheTypeDefinitions = computed(() => {
  const configured = Array.isArray(retoucheTypeDefinitions.value) ? retoucheTypeDefinitions.value : [];
  if (configured.length > 0) return configured;
  const runtimeSource = wizardRetouchesSettings.value?.typesRetouche || wizardRetouchesSettings.value?.typesRetouches || [];
  if (!Array.isArray(runtimeSource)) return [];
  return runtimeSource
    .map(normalizeRetoucheTypeDefinition)
    .filter(Boolean)
    .sort((left, right) => {
      if (left.ordreAffichage !== right.ordreAffichage) return left.ordreAffichage - right.ordreAffichage;
      return String(left.libelle || left.code).localeCompare(String(right.libelle || right.code), "fr", {
        sensitivity: "base"
      });
    });
});
const retoucheTypeOptions = computed(() => {
  return availableRetoucheTypeDefinitions.value
    .filter((row) => row?.actif !== false)
    .map((row) => ({
      value: row.code,
      label: row.libelle,
      definition: row
    }));
});
const wizardRetoucheMeasureItems = computed(() => (retoucheWizard.retouche.items || []).filter((row) => String(row?.typeRetouche || "").trim()));
const wizardRetoucheMeasureActiveItem = computed(() => wizardRetoucheMeasureItems.value[wizardRetoucheMeasureIndex.value] || null);
const wizardRetoucheMeasureCompletion = computed(() => {
  const items = wizardRetoucheMeasureItems.value;
  const complete = items.filter((item) => {
    const hasHabit = Boolean(String(item?.typeHabit || "").trim());
    const progress = getRetoucheItemMeasureProgress(item);
    return hasHabit && (progress.total === 0 || progress.missingRequired === 0);
  }).length;
  return {
    total: items.length,
    complete
  };
});
const selectedRetoucheTypeDefinition = computed(() => {
  const code = String(wizardRetoucheMeasureActiveItem.value?.typeRetouche || retoucheWizard.retouche.typeRetouche || "").trim().toUpperCase();
  return availableRetoucheTypeDefinitions.value.find((row) => row.code === code) || null;
});
const wizardCompatibleRetoucheHabitOptions = computed(() => {
  if (!wizardRetoucheMeasureActiveItem.value) return wizardAvailableHabitTypeOptions.value;
  return getRetoucheItemCompatibleHabitOptions(wizardRetoucheMeasureActiveItem.value);
});
const wizardRetoucheDescriptionRequired = computed(() => {
  const hasTypeLevelRequirement = (retoucheWizard.retouche.items || []).some((item) => getRetoucheItemTypeDefinition(item)?.descriptionObligatoire === true);
  return Boolean(hasTypeLevelRequirement || wizardRetouchesSettings.value?.descriptionObligatoire);
});
const retoucheMeasuresRequired = computed(() => selectedRetoucheTypeDefinition.value?.necessiteMesures === true);
const settingsRetoucheTypeEntries = computed(() => {
  const source = atelierSettings.retouches?.typesRetouche || atelierSettings.retouches?.typesRetouches || [];
  if (!Array.isArray(source)) return [];
  let fallbackOrder = 1;
  for (const row of source) {
    const normalized = ensureRetoucheTypeDraft(row, fallbackOrder);
    if (normalized) fallbackOrder += 1;
  }
  return [...source]
    .filter(Boolean)
    .sort((left, right) => {
      if (Number(left.ordreAffichage || 0) !== Number(right.ordreAffichage || 0)) {
        return Number(left.ordreAffichage || 0) - Number(right.ordreAffichage || 0);
      }
      return String(left.libelle || left.code).localeCompare(String(right.libelle || right.code), "fr", {
        sensitivity: "base"
      });
    });
});
const filteredSettingsRetoucheTypeEntries = computed(() => {
  const query = settingsRetoucheQuery.value.trim().toLowerCase();
  return settingsRetoucheTypeEntries.value.filter((row) => {
    if (settingsRetoucheStatusFilter.value === "ACTIVE" && row.actif === false) return false;
    if (settingsRetoucheStatusFilter.value === "INACTIVE" && row.actif !== false) return false;
    if (!query) return true;
    const haystack = [
      row.code,
      row.libelle,
      ...(row.habitsCompatibles || []),
      ...(row.mesures || []).flatMap((mesure) => [mesure.code, mesure.label])
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});
const settingsRetouchePages = computed(() =>
  Math.max(1, Math.ceil(filteredSettingsRetoucheTypeEntries.value.length / settingsRetouchePagination.pageSize))
);
const pagedSettingsRetoucheTypeEntries = computed(() => {
  const page = Math.min(Math.max(1, settingsRetouchePagination.page), settingsRetouchePages.value);
  const start = (page - 1) * settingsRetouchePagination.pageSize;
  return filteredSettingsRetoucheTypeEntries.value.slice(start, start + settingsRetouchePagination.pageSize);
});
const selectedSettingsRetoucheType = computed(() => {
  const selected = filteredSettingsRetoucheTypeEntries.value.find((row) => row.code === selectedSettingsRetoucheTypeCode.value);
  if (selected) return selected;
  return filteredSettingsRetoucheTypeEntries.value[0] || settingsRetoucheTypeEntries.value[0] || null;
});
const securityUsersFiltered = computed(() => {
  const query = securityUserQuery.value.trim().toLowerCase();
  return securityUsers.value.filter((user) => {
    if (securityUserRoleFilter.value !== "ALL" && String(user.roleId || "").toUpperCase() !== securityUserRoleFilter.value) return false;
    if (securityUserStatusFilter.value !== "ALL") {
      const expectedActive = securityUserStatusFilter.value === "ACTIVE";
      if ((user.actif !== false) !== expectedActive) return false;
    }
    if (!query) return true;
    const haystack = `${user.nom || ""} ${user.email || ""} ${user.roleId || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});
const securityUsersPages = computed(() => Math.max(1, Math.ceil(securityUsersFiltered.value.length / securityUsersPagination.pageSize)));
const securityUsersPaged = computed(() => {
  const page = Math.min(Math.max(1, securityUsersPagination.page), securityUsersPages.value);
  const start = (page - 1) * securityUsersPagination.pageSize;
  return securityUsersFiltered.value.slice(start, start + securityUsersPagination.pageSize);
});

function settingsTabIsDirty(tabId) {
  let current = cloneSettings(atelierSettings);
  try {
    current = buildNormalizedSettingsSnapshotPayload();
  } catch {
    current = cloneSettings(atelierSettings);
  }
  const snapshot = settingsSnapshotParsed.value;
  if (tabId === "identite") return JSON.stringify(current.identite || {}) !== JSON.stringify(snapshot.identite || {});
  if (tabId === "contact") return JSON.stringify(current.contactClient || {}) !== JSON.stringify(snapshot.contactClient || {});
  if (tabId === "commandes") return JSON.stringify(current.commandes || {}) !== JSON.stringify(snapshot.commandes || {});
  if (tabId === "retouches") return JSON.stringify(current.retouches || {}) !== JSON.stringify(snapshot.retouches || {});
  if (tabId === "mesures") return JSON.stringify(current.habits || {}) !== JSON.stringify(snapshot.habits || {});
  if (tabId === "caisse") return JSON.stringify(current.caisse || {}) !== JSON.stringify(snapshot.caisse || {});
  if (tabId === "facturation") return JSON.stringify(current.facturation || {}) !== JSON.stringify(snapshot.facturation || {});
  if (tabId === "securite") {
    const securityDirty = JSON.stringify(current.securite || {}) !== JSON.stringify(snapshot.securite || {});
    const userDirty = JSON.stringify({
      nom: settingsUser.nom,
      role: settingsUser.role
    }) !== JSON.stringify(settingsUserSnapshotParsed.value || {});
    return securityDirty || userDirty || settingsAuditNote.value.trim().length > 0;
  }
  return false;
}

async function toggleSettingsEdit() {
  if (!settingsRoleAllowed.value) {
    notify("Role non autorise pour modifier ces parametres.");
    return;
  }
  if (settingsEditMode.value && settingsHasUnsavedChanges.value) {
    const discard = await openSettingsConfirmModal({
      title: "Quitter le mode edition",
      message: "Des modifications non sauvegardees seront perdues. Continuer ?",
      confirmLabel: "Oui, abandonner"
    });
    if (!discard) return;
    restoreSettingsFromSnapshot();
    settingsAuditNote.value = "";
  }
  settingsEditMode.value = !settingsEditMode.value;
  settingsConfirmSave.value = false;
}

function habitMesuresForEditor(habitConfig) {
  const mesures = Array.isArray(habitConfig?.mesures) ? habitConfig.mesures : [];
  return [...mesures].sort((left, right) => {
    const orderDiff = normalizeSortOrder(left?.ordre) - normalizeSortOrder(right?.ordre);
    if (orderDiff !== 0) return orderDiff;
    return String(left?.label || left?.code || "").localeCompare(String(right?.label || right?.code || ""), "fr", {
      sensitivity: "base"
    });
  });
}

function habitMeasureSummary(habitConfig) {
  const mesures = habitMesuresForEditor(habitConfig);
  const active = mesures.filter((mesure) => mesure?.actif !== false);
  const required = active.filter((mesure) => mesure?.obligatoire === true);
  return {
    total: mesures.length,
    active: active.length,
    required: required.length
  };
}

function retoucheMeasuresForEditor(typeConfig) {
  const mesures = Array.isArray(typeConfig?.mesures) ? typeConfig.mesures : [];
  return [...mesures].sort((left, right) => {
    const orderDiff = normalizeSortOrder(left?.ordre) - normalizeSortOrder(right?.ordre);
    if (orderDiff !== 0) return orderDiff;
    return String(left?.label || left?.code || "").localeCompare(String(right?.label || right?.code || ""), "fr", {
      sensitivity: "base"
    });
  });
}

function retoucheMeasureSummary(typeConfig) {
  const mesures = retoucheMeasuresForEditor(typeConfig);
  const active = mesures.filter((mesure) => mesure?.actif !== false);
  const required = active.filter((mesure) => mesure?.obligatoire === true);
  return {
    total: mesures.length,
    active: active.length,
    required: required.length
  };
}

function selectSettingsHabit(habitKey) {
  selectedSettingsHabitKey.value = habitKey;
}

function isHabitTypeUsed(habitKey) {
  return settingsUsedHabitTypes.value.has(String(habitKey || "").trim().toUpperCase());
}

function toggleHabitTypeActive(habitKey) {
  if (!settingsCanEdit.value) return;
  const normalizedKey = String(habitKey || "").trim().toUpperCase();
  const habit = atelierSettings.habits[normalizedKey];
  if (!habit) return;
  const nextActif = habit.actif === false;
  habit.actif = nextActif;
  notify(
    nextActif
      ? "Type d'habit active: il reapparait dans les nouveaux choix."
      : isHabitTypeUsed(normalizedKey)
        ? "Type d'habit desactive: il disparait des nouveaux choix mais reste visible dans l'historique."
        : "Type d'habit desactive: il disparait des nouveaux choix."
  );
}

async function duplicateHabitType(sourceKey) {
  if (!settingsCanEdit.value) return;
  const source = atelierSettings.habits[sourceKey];
  if (!source) return;
  const payload = await openActionModal({
    title: "Dupliquer un type d'habit",
    message: "Saisis le nom de la copie. Le code technique sera genere automatiquement par le systeme.",
    confirmLabel: "Dupliquer",
    cancelLabel: "Annuler",
    fields: [
      { key: "label", label: "Nom de la copie", type: "text", required: true, defaultValue: `${source.label || sourceKey} copie` },
      { key: "ordre", label: "Ordre", type: "number", required: true, min: 0, defaultValue: Number(source.ordre || 0) + 1 }
    ]
  });
  if (!payload) return;
  const label = String(payload.label || "").trim();
  if (!label) return notify("Le nom du type d'habit est obligatoire.");
  const newKey = resolveUniqueGeneratedCode(
    normalizeHabitTypeKeyInput(label),
    (candidate) => Boolean(atelierSettings.habits[String(candidate || "").trim().toUpperCase()])
  );
  if (!newKey) return notify("Impossible de generer un code technique valide pour ce type d'habit.");
  atelierSettings.habits[newKey] = {
    label,
    actif: true,
    ordre: Number(payload.ordre),
    mesures: habitMesuresForEditor(source).map((mesure) => ({
      code: mesure.code,
      label: mesure.label,
      obligatoire: mesure.obligatoire === true,
      actif: mesure.actif !== false,
      ordre: Number(mesure.ordre || 0),
      typeChamp: normalizeMesureFieldType(mesure.typeChamp)
    }))
  };
  selectedSettingsHabitKey.value = newKey;
  notify(`Type d'habit duplique: ${newKey}.`);
}

function normalizeHabitTypeKeyInput(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMeasureCodeInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveUniqueGeneratedCode(baseCode, hasConflict) {
  const normalizedBase = String(baseCode || "").trim();
  if (!normalizedBase) return "";
  if (!hasConflict(normalizedBase)) return normalizedBase;
  let index = 2;
  while (hasConflict(`${normalizedBase}_${index}`)) {
    index += 1;
  }
  return `${normalizedBase}_${index}`;
}

function normalizeRetoucheTypeDefinition(raw) {
  const code = String(raw?.code || "").trim().toUpperCase();
  if (!code) return null;
  const habitsCompatibles = Array.isArray(raw?.habitsCompatibles)
    ? raw.habitsCompatibles.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : ["*"];
  const mesuresSource = Array.isArray(raw?.mesures)
    ? raw.mesures
    : Array.isArray(raw?.mesuresCibles)
      ? raw.mesuresCibles.map((item, index) => ({
          code: String(item || "").trim(),
          label: mesureLabelFromKey(item),
          unite: "cm",
          typeChamp: "number",
          obligatoire: true,
          actif: true,
          ordre: index + 1
        }))
      : [];
  const mesures = mesuresSource
    .map((mesure, index) => ({
      code: String(mesure?.code || "").trim(),
      label: String(mesure?.label || mesure?.code || "").trim() || String(mesure?.code || "").trim(),
      unite: String(mesure?.unite || (normalizeMesureFieldType(mesure?.typeChamp) === "number" ? "cm" : "")).trim(),
      typeChamp: normalizeMesureFieldType(mesure?.typeChamp),
      obligatoire: mesure?.obligatoire === true,
      actif: mesure?.actif !== false,
      ordre: Number.isFinite(Number(mesure?.ordre)) ? Number(mesure.ordre) : index + 1
    }))
    .filter((mesure) => mesure.code)
    .sort((left, right) => normalizeSortOrder(left?.ordre) - normalizeSortOrder(right?.ordre));
  return {
    code,
    libelle: String(raw?.libelle || code).trim() || code,
    actif: raw?.actif !== false,
    ordreAffichage: Number.isFinite(Number(raw?.ordreAffichage)) ? Number(raw.ordreAffichage) : Number.MAX_SAFE_INTEGER,
    necessiteMesures: raw?.necessiteMesures === true,
    mesures,
    descriptionObligatoire: raw?.descriptionObligatoire === true,
    habitsCompatibles: habitsCompatibles.length > 0 ? habitsCompatibles : ["*"]
  };
}

function ensureRetoucheTypeDraft(row, fallbackOrder = 1) {
  if (!row || typeof row !== "object") return null;
  row.code = String(row.code || "").trim().toUpperCase();
  if (!row.code) return null;
  row.libelle = String(row.libelle || row.code).trim() || row.code;
  row.actif = row.actif !== false;
  row.ordreAffichage = Number.isFinite(Number(row.ordreAffichage)) ? Number(row.ordreAffichage) : fallbackOrder;
  row.necessiteMesures = row.necessiteMesures === true;
  row.descriptionObligatoire = row.descriptionObligatoire === true;
  const mesuresSource = Array.isArray(row.mesures)
    ? row.mesures
    : Array.isArray(row.mesuresCibles)
      ? row.mesuresCibles.map((item, index) => ({
          code: String(item || "").trim(),
          label: mesureLabelFromKey(item),
          unite: "cm",
          typeChamp: "number",
          obligatoire: true,
          actif: true,
          ordre: index + 1
        }))
      : [];
  row.mesures = mesuresSource
    .map((mesure, index) => ({
      code: String(mesure?.code || "").trim(),
      label: String(mesure?.label || mesure?.code || "").trim() || String(mesure?.code || "").trim(),
      unite: String(mesure?.unite || (normalizeMesureFieldType(mesure?.typeChamp) === "number" ? "cm" : "")).trim(),
      typeChamp: normalizeMesureFieldType(mesure?.typeChamp),
      obligatoire: mesure?.obligatoire === true,
      actif: mesure?.actif !== false,
      ordre: Number.isFinite(Number(mesure?.ordre)) ? Number(mesure.ordre) : index + 1
    }))
    .filter((mesure) => mesure.code);
  row.habitsCompatibles = Array.isArray(row.habitsCompatibles)
    ? row.habitsCompatibles.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : ["*"];
  if (row.habitsCompatibles.length === 0) row.habitsCompatibles = ["*"];
  return row;
}

function prepareHabitSettingsForSave(habitsRaw) {
  if (!habitsRaw || typeof habitsRaw !== "object") throw new Error("Configuration des habits invalide.");
  const prepared = {};
  const orderedHabits = Object.entries(habitsRaw).sort((left, right) => {
    const leftOrder = normalizeSortOrder(left?.[1]?.ordre);
    const rightOrder = normalizeSortOrder(right?.[1]?.ordre);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left?.[1]?.label || left?.[0] || "").localeCompare(String(right?.[1]?.label || right?.[0] || ""), "fr", {
      sensitivity: "base"
    });
  });
  for (const [habitIndex, [rawKey, habit]] of orderedHabits.entries()) {
    const key = normalizeHabitTypeKeyInput(rawKey);
    if (!key) throw new Error("Chaque type d'habit doit avoir un code valide.");
    if (!habit || typeof habit !== "object") throw new Error(`Configuration invalide pour le type d'habit ${key}.`);
    const label = String(habit.label || "").trim();
    if (!label) throw new Error(`Le libelle du type d'habit ${key} est obligatoire.`);
    const ordre = habitIndex + 1;
    const mesuresRaw = Array.isArray(habit.mesures) ? habit.mesures : [];
    const measureCodes = new Set();
    const mesures = [...mesuresRaw]
      .sort((left, right) => {
        const leftOrder = normalizeSortOrder(left?.ordre);
        const rightOrder = normalizeSortOrder(right?.ordre);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left?.label || left?.code || "").localeCompare(String(right?.label || right?.code || ""), "fr", {
          sensitivity: "base"
        });
      })
      .map((mesure, index) => {
      const code = String(mesure?.code || "").trim();
      if (!code) throw new Error(`Une mesure du type ${label} n'a pas de code.`);
      if (measureCodes.has(code)) throw new Error(`Code de mesure duplique pour ${label}: ${code}.`);
      measureCodes.add(code);
      const mesureLabel = String(mesure?.label || "").trim();
      if (!mesureLabel) throw new Error(`Le libelle de la mesure ${code} est obligatoire.`);
      const typeChamp = normalizeMesureFieldType(mesure?.typeChamp);
      if (String(mesure?.typeChamp || "").trim() && typeChamp !== String(mesure?.typeChamp || "").trim().toLowerCase()) {
        throw new Error(`typeChamp invalide pour ${label} / ${code}. Valeurs autorisees: nombre, texte, liste.`);
      }
      return {
        code,
        label: mesureLabel,
        obligatoire: normalizeBoolean(mesure?.obligatoire, false),
        actif: normalizeBoolean(mesure?.actif, true),
        ordre: index + 1,
        typeChamp
      };
    });
    prepared[key] = {
      label,
      actif: normalizeBoolean(habit.actif, true),
      ordre,
      mesures
    };
  }
  return prepared;
}

function prepareRetoucheSettingsForSave(retouchesRaw) {
  const retouches = retouchesRaw && typeof retouchesRaw === "object" ? retouchesRaw : {};
  const sourceTypes = Array.isArray(retouches.typesRetouche) ? retouches.typesRetouche : Array.isArray(retouches.typesRetouches) ? retouches.typesRetouches : [];
  const codes = new Set();
  const typesRetouche = [...sourceTypes]
    .sort((left, right) => {
      const leftOrder = normalizeSortOrder(left?.ordreAffichage);
      const rightOrder = normalizeSortOrder(right?.ordreAffichage);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left?.libelle || left?.code || "").localeCompare(String(right?.libelle || right?.code || ""), "fr", {
        sensitivity: "base"
      });
    })
    .map((row, index) => {
    const draft = ensureRetoucheTypeDraft({ ...row }, index + 1);
    if (!draft) throw new Error("Un type de retouche a un code invalide.");
    if (codes.has(draft.code)) throw new Error(`Code de type de retouche duplique: ${draft.code}.`);
    codes.add(draft.code);
    const uniqueMesures = [];
    const mesureCodes = new Set();
    for (const [measureIndex, mesure] of [...(draft.mesures || [])]
      .sort((left, right) => {
        const leftOrder = normalizeSortOrder(left?.ordre);
        const rightOrder = normalizeSortOrder(right?.ordre);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left?.label || left?.code || "").localeCompare(String(right?.label || right?.code || ""), "fr", {
          sensitivity: "base"
        });
      })
      .entries()) {
      if (mesureCodes.has(mesure.code)) throw new Error(`Mesure dupliquee pour ${draft.code}: ${mesure.code}.`);
      mesureCodes.add(mesure.code);
      uniqueMesures.push({
        code: mesure.code,
        label: mesure.label,
        unite: mesure.unite || (mesure.typeChamp === "number" ? "cm" : ""),
        typeChamp: normalizeMesureFieldType(mesure.typeChamp),
        obligatoire: mesure.obligatoire === true,
        actif: mesure.actif !== false,
        ordre: measureIndex + 1
      });
    }
    const uniqueHabits = Array.from(new Set(draft.habitsCompatibles));
    if (uniqueHabits.length === 0) uniqueHabits.push("*");
    return {
      code: draft.code,
      libelle: draft.libelle,
      actif: draft.actif !== false,
      ordreAffichage: index + 1,
      necessiteMesures: draft.necessiteMesures === true,
      mesures: uniqueMesures,
      descriptionObligatoire: draft.descriptionObligatoire === true,
      habitsCompatibles: uniqueHabits
    };
  });
  return {
    ...retouches,
    typesRetouche
  };
}

function selectSettingsRetoucheType(code) {
  selectedSettingsRetoucheTypeCode.value = String(code || "").trim().toUpperCase();
}

async function addRetoucheType() {
  if (!settingsCanEdit.value) return;
  const payload = await openActionModal({
    title: "Nouveau type de retouche",
    message: "Saisis le nom du type. Le code technique sera genere automatiquement par le systeme.",
    confirmLabel: "Creer",
    cancelLabel: "Annuler",
    fields: [
      { key: "libelle", label: "Nom du type", type: "text", required: true, defaultValue: "" },
      {
        key: "ordreAffichage",
        label: "Ordre",
        type: "number",
        required: true,
        min: 1,
        defaultValue: settingsRetoucheTypeEntries.value.length + 1
      }
    ]
  });
  if (!payload) return;
  const libelle = String(payload.libelle || "").trim();
  if (!libelle) return notify("Le nom du type de retouche est obligatoire.");
  const list = atelierSettings.retouches.typesRetouche;
  const code = resolveUniqueGeneratedCode(
    normalizeHabitTypeKeyInput(libelle),
    (candidate) => list.some((row) => String(row?.code || "").trim().toUpperCase() === String(candidate || "").trim().toUpperCase())
  );
  if (!code) return notify("Impossible de generer un code technique valide pour ce type de retouche.");
  list.push(
    ensureRetoucheTypeDraft(
      {
        code,
        libelle,
        actif: true,
        ordreAffichage: Number(payload.ordreAffichage),
        necessiteMesures: false,
        mesures: [],
        descriptionObligatoire: false,
        habitsCompatibles: ["*"]
      },
      list.length + 1
    )
  );
  selectedSettingsRetoucheTypeCode.value = code;
}

function removeRetoucheType(code) {
  if (!settingsCanEdit.value) return;
  if (settingsUsedRetoucheTypes.value.has(String(code || "").trim().toUpperCase())) {
    notify("Ce type de retouche a deja ete utilise. Desactive-le au lieu de le supprimer.");
    return;
  }
  const list = atelierSettings.retouches.typesRetouche;
  const index = list.findIndex((row) => String(row?.code || "").trim().toUpperCase() === String(code || "").trim().toUpperCase());
  if (index === -1) return;
  list.splice(index, 1);
  notify("Type de retouche supprime des parametres.");
}

function toggleRetoucheTypeActive(code) {
  if (!settingsCanEdit.value) return;
  const type = atelierSettings.retouches.typesRetouche.find((row) => String(row?.code || "").trim().toUpperCase() === String(code || "").trim().toUpperCase());
  if (!type) return;
  const nextActif = type.actif === false;
  type.actif = nextActif;
  notify(
    nextActif
      ? "Type de retouche active: il reapparait dans les nouveaux choix."
      : settingsUsedRetoucheTypes.value.has(String(code || "").trim().toUpperCase())
        ? "Type de retouche desactive: il disparait des nouveaux choix mais reste conserve dans l'historique."
        : "Type de retouche desactive: il disparait des nouveaux choix."
  );
}

async function addMesureToRetoucheType(code) {
  if (!settingsCanEdit.value) return;
  const type = atelierSettings.retouches.typesRetouche.find((row) => String(row?.code || "").trim().toUpperCase() === String(code || "").trim().toUpperCase());
  if (!type) return;
  if (!Array.isArray(type.mesures)) type.mesures = [];
  const payload = await openActionModal({
    title: "Nouvelle mesure de retouche",
    message: "Saisis le nom de la mesure. Le code technique sera genere automatiquement par le systeme.",
    confirmLabel: "Ajouter",
    cancelLabel: "Annuler",
    fields: [
      { key: "label", label: "Nom de la mesure", type: "text", required: true, defaultValue: "" },
      { key: "typeChamp", label: "Type de champ", type: "select", required: true, defaultValue: "number", options: mesureTypeOptions },
      { key: "unite", label: "Unite", type: "text", required: false, defaultValue: "cm" },
      { key: "obligatoire", label: "Obligatoire", type: "select", required: true, defaultValue: "true", options: [{ value: "true", label: "Oui" }, { value: "false", label: "Non" }] }
    ]
  });
  if (!payload) return;
  const mesureLabel = String(payload.label || "").trim();
  if (!mesureLabel) return notify("Le nom de la mesure est obligatoire.");
  const mesureCode = resolveUniqueGeneratedCode(
    normalizeMeasureCodeInput(mesureLabel),
    (candidate) => type.mesures.some((mesure) => String(mesure?.code || "") === String(candidate || ""))
  );
  if (!mesureCode) return notify("Impossible de generer un code technique valide pour cette mesure.");
  type.mesures.push({
    code: mesureCode,
    label: mesureLabel,
    unite: String(payload.unite || "").trim() || (payload.typeChamp === "number" ? "cm" : ""),
    typeChamp: normalizeMesureFieldType(payload.typeChamp),
    obligatoire: String(payload.obligatoire) === "true",
    actif: true,
    ordre: type.mesures.length + 1
  });
}

function removeMesureFromRetoucheType(typeCode, mesureCode) {
  if (!settingsCanEdit.value) return;
  const type = atelierSettings.retouches.typesRetouche.find((row) => String(row?.code || "").trim().toUpperCase() === String(typeCode || "").trim().toUpperCase());
  if (!type || !Array.isArray(type.mesures)) return;
  const index = type.mesures.findIndex((mesure) => String(mesure?.code || "") === String(mesureCode || ""));
  if (index === -1) return;
  const mesure = type.mesures[index];
  if (mesure?.actif !== false) {
    mesure.actif = false;
    notify("Mesure archivee: elle disparaitra des nouveaux choix apres sauvegarde.");
    return;
  }
  type.mesures.splice(index, 1);
  notify("Mesure supprimee de la configuration.");
}

async function canLeaveSettings() {
  if (currentRoute.value !== "parametres") return true;
  if (!settingsHasUnsavedChanges.value) return true;
  return openSettingsConfirmModal({
    title: "Modifications non sauvegardees",
    message: "Vous avez des modifications non sauvegardees. Quitter la page Parametres ?",
    confirmLabel: "Quitter"
  });
}

async function addMesureToHabit(habitKey) {
  if (!settingsCanEdit.value) return;
  const habit = atelierSettings.habits[habitKey];
  if (!habit) return;
  const payload = await openActionModal({
    title: "Nouvelle mesure",
    message: "Saisis le nom de la mesure. Le code technique sera genere automatiquement par le systeme.",
    confirmLabel: "Ajouter",
    cancelLabel: "Annuler",
    fields: [
      { key: "label", label: "Nom de la mesure", type: "text", required: true, defaultValue: "" },
      { key: "typeChamp", label: "Type de champ", type: "select", required: true, defaultValue: "number", options: mesureTypeOptions },
      { key: "obligatoire", label: "Obligatoire", type: "select", required: true, defaultValue: "false", options: [{ value: "true", label: "Oui" }, { value: "false", label: "Non" }] }
    ]
  });
  if (!payload) return;
  const label = String(payload.label || "").trim();
  if (!label) return notify("Le nom de la mesure est obligatoire.");
  const code = resolveUniqueGeneratedCode(
    normalizeMeasureCodeInput(label),
    (candidate) => habit.mesures.some((mesure) => String(mesure?.code || "") === String(candidate || ""))
  );
  if (!code) return notify("Impossible de generer un code technique valide pour cette mesure.");
  habit.mesures.push({
    code,
    label,
    obligatoire: String(payload.obligatoire) === "true",
    actif: true,
    ordre: habit.mesures.length + 1,
    typeChamp: normalizeMesureFieldType(payload.typeChamp)
  });
}

function removeMesureFromHabit(habitKey, mesureCode) {
  if (!settingsCanEdit.value) return;
  const habit = atelierSettings.habits[habitKey];
  if (!habit) return;
  const index = habit.mesures.findIndex((mesure) => String(mesure?.code || "") === String(mesureCode || ""));
  if (index === -1) return;
  const mesure = habit.mesures[index];
  if (mesure?.actif !== false) {
    mesure.actif = false;
    notify("Mesure archivee: elle disparaitra des nouveaux choix apres sauvegarde.");
    return;
  }
  habit.mesures.splice(index, 1);
  notify("Mesure supprimee de la configuration.");
}

function removeHabitType(habitKey) {
  if (!settingsCanEdit.value) return;
  const normalizedKey = String(habitKey || "").trim().toUpperCase();
  if (!normalizedKey || !atelierSettings.habits[normalizedKey]) return;
  if (isHabitTypeUsed(normalizedKey)) {
    notify("Ce type d'habit a deja ete utilise. Desactive-le au lieu de le supprimer.");
    return;
  }
  delete atelierSettings.habits[normalizedKey];
  if (selectedSettingsHabitKey.value === normalizedKey) {
    selectedSettingsHabitKey.value = filteredHabitConfigEntries.value[0]?.key || habitConfigEntries.value[0]?.key || "";
  }
  notify("Type d'habit supprime des parametres.");
}

async function addHabitType() {
  if (!settingsCanEdit.value) return;
  const payload = await openActionModal({
    title: "Nouveau type d'habit",
    message: "Saisis le nom du type. Le code technique sera genere automatiquement par le systeme.",
    confirmLabel: "Creer",
    cancelLabel: "Annuler",
    fields: [
      { key: "label", label: "Nom du type", type: "text", required: true, defaultValue: "" },
      {
        key: "ordre",
        label: "Ordre",
        type: "number",
        required: true,
        min: 0,
        defaultValue: Object.keys(atelierSettings.habits || {}).length + 1
      }
    ]
  });
  if (!payload) return;
  const label = String(payload.label || "").trim();
  if (!label) return notify("Le nom du type d'habit est obligatoire.");
  const key = resolveUniqueGeneratedCode(
    normalizeHabitTypeKeyInput(label),
    (candidate) => Boolean(atelierSettings.habits[String(candidate || "").trim().toUpperCase()])
  );
  if (!key) return notify("Impossible de generer un code technique valide pour ce type d'habit.");
  const order = Number(payload.ordre);
  if (!Number.isFinite(order) || order < 0) {
    notify("Ordre invalide pour le type d'habit.");
    return;
  }
  atelierSettings.habits[key] = {
    label,
    actif: true,
    ordre: order,
    mesures: []
  };
  selectedSettingsHabitKey.value = key;
  notify(`Type d'habit cree: ${key}.`);
}

async function saveAtelierSettings() {
  if (!settingsRoleAllowed.value) {
    notify("Role non autorise pour sauvegarder.");
    return;
  }
  if (atelierSettings.securite.confirmationAvantSauvegarde && !settingsConfirmSave.value) {
    notify("Confirmation obligatoire avant sauvegarde.");
    return;
  }
  const now = new Date().toISOString();
  atelierSettings.meta.lastSavedAt = now;
  const note = settingsAuditNote.value.trim() || "Mise a jour des parametres";
  const entry = {
    date: now,
    utilisateur: settingsUser.nom || "inconnu",
    role: settingsUser.role,
    note
  };
  atelierSettings.securite.auditLog = [entry, ...(atelierSettings.securite.auditLog || [])].slice(0, 30);
  try {
    settingsSaving.value = true;
    settingsError.value = "";
    const payload = cloneSettings(atelierSettings);
    normalizeCaisseSettings(payload.caisse);
    payload.retouches = prepareRetoucheSettingsForSave(payload.retouches);
    payload.habits = prepareHabitSettingsForSave(payload.habits);
    const expectedVersion = Number(payload?.meta?.version || 1);
    const saved = await atelierApi.saveParametresAtelier(payload, settingsUser.nom || "", expectedVersion);
    if (saved?.payload) {
      applySettings(atelierSettings, saved.payload);
    }
    if (saved?.version !== undefined && saved?.version !== null) {
      atelierSettings.meta.version = Number(saved.version || atelierSettings.meta.version || 1);
    }
    await loadAtelierRuntimeSettings();
    await refreshRetoucheTypeDefinitions();
    persistAtelierSettings();
    captureSettingsSnapshot();
    settingsConfirmSave.value = false;
    settingsAuditNote.value = "";
    settingsEditMode.value = false;
    notify("Parametres atelier sauvegardes.");
  } catch (err) {
    const message = readableError(err);
    settingsError.value = message;
    notify(message);
  } finally {
    settingsSaving.value = false;
  }
}

async function uploadAtelierLogo() {
  if (!canUploadAtelierLogo.value) {
    notify("Seul le proprietaire de l'atelier peut modifier le logo.");
    return;
  }
  if (!settingsLogoSelectedFile.value) {
    notify("Selectionne d'abord une image PNG ou JPG.");
    return;
  }
  if (settingsHasUnsavedChanges.value) {
    notify("Sauvegarde ou annule d'abord les autres modifications avant de changer le logo.");
    return;
  }
  const atelierId = currentAtelierId.value;
  if (!atelierId) {
    notify("Atelier introuvable pour l'upload du logo.");
    return;
  }

  try {
    settingsLogoUploading.value = true;
    settingsError.value = "";
    const formData = new FormData();
    formData.append("logo", settingsLogoSelectedFile.value);
    const response = await atelierApi.uploadAtelierLogo(atelierId, formData);
    if (response?.logoUrl) {
      atelierSettings.identite.logoUrl = String(response.logoUrl || "").trim();
      persistAtelierSettings();
      await loadAtelierSettings();
    }
    clearSelectedAtelierLogo();
    notify("Logo atelier mis a jour.");
  } catch (err) {
    const message = readableError(err);
    settingsError.value = message;
    notify(message);
  } finally {
    settingsLogoUploading.value = false;
  }
}

async function resetAtelierSettings() {
  if (!settingsCanEdit.value) return;
  const confirmed = await openSettingsConfirmModal({
    title: "Reinitialiser les parametres",
    message: "Reinitialiser tous les parametres de l'atelier ?",
    confirmLabel: "Reinitialiser"
  });
  if (!confirmed) return;
  applySettings(atelierSettings, cloneSettings(atelierSettingsDefault));
  persistAtelierSettings();
  captureSettingsSnapshot();
  settingsConfirmSave.value = false;
  settingsEditMode.value = false;
  settingsAuditNote.value = "";
  notify("Parametres reinitialises.");
}

function getRolePermissionSet(roleId) {
  const role = String(roleId || "").toUpperCase();
  const raw = securityRolePermissions.value[role];
  return new Set(Array.isArray(raw) ? raw : []);
}

function normalizeSecurityRolePermissions(roleId, permissions = []) {
  const role = String(roleId || "").toUpperCase();
  const normalized = new Set((permissions || []).map((permission) => String(permission || "").toUpperCase()).filter(Boolean));
  if (role === "PROPRIETAIRE") {
    for (const permission of OWNER_CRITICAL_PERMISSIONS) normalized.add(permission);
  }
  return [...normalized];
}

function isRolePermissionLocked(roleId, permission) {
  return String(roleId || "").toUpperCase() === "PROPRIETAIRE" && OWNER_CRITICAL_PERMISSIONS.includes(String(permission || "").toUpperCase());
}

function roleHasPermission(roleId, permission) {
  return getRolePermissionSet(roleId).has(permission);
}

function setRolePermission(roleId, permission, enabled) {
  const role = String(roleId || "").toUpperCase();
  if (isRolePermissionLocked(role, permission) && enabled === false) return;
  const next = getRolePermissionSet(role);
  if (enabled) next.add(permission);
  else next.delete(permission);
  securityRolePermissions.value = {
    ...securityRolePermissions.value,
    [role]: normalizeSecurityRolePermissions(role, [...next])
  };
}

async function loadSecurityModule() {
  if (!canAccessSecurityModule.value) return;
  securityLoading.value = true;
  securityError.value = "";
  try {
    const [users, roleRows] = await Promise.all([atelierApi.listUsers(), atelierApi.listRolePermissions()]);
    securityUsers.value = (users || []).map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      roleId: String(u.roleId || "COUTURIER").toUpperCase(),
      actif: u.actif !== false,
      etatCompte: String(u.etatCompte || (u.actif === false ? "DISABLED" : "ACTIVE")).toUpperCase()
    }));
    securityUsersPagination.page = 1;
    const map = {};
    for (const role of securityRoleOptions) map[role.value] = [];
    for (const row of roleRows || []) {
      const role = String(row.role || "").toUpperCase();
      if (!Object.prototype.hasOwnProperty.call(map, role)) continue;
      map[role] = normalizeSecurityRolePermissions(role, row.permissions || []);
    }
    map.PROPRIETAIRE = normalizeSecurityRolePermissions("PROPRIETAIRE", map.PROPRIETAIRE || []);
    securityRolePermissions.value = map;
  } catch (err) {
    securityError.value = readableError(err);
  } finally {
    securityLoading.value = false;
  }
}

function sanitizeModalValue(field, value) {
  if (field.type === "number") {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num;
  }
  return typeof value === "string" ? value.trim() : value;
}

function openActionModal({
  title = "Confirmation",
  message = "",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "blue",
  fields = [],
  stacked = false
}) {
  actionModal.title = title;
  actionModal.message = message;
  actionModal.confirmLabel = confirmLabel;
  actionModal.cancelLabel = cancelLabel;
  actionModal.tone = tone;
  actionModal.stacked = stacked === true;
  actionModal.fields = fields;
  actionModal.error = "";
  actionModal.values = fields.reduce((acc, field) => {
    acc[field.key] = field.defaultValue ?? "";
    return acc;
  }, {});
  actionModal.open = true;
  nextTick(() => actionCancelButtonRef.value?.focus());
  return new Promise((resolve) => {
    actionModalResolver = resolve;
  });
}

function closeActionModal(payload) {
  actionModal.open = false;
  actionModal.stacked = false;
  if (actionModalResolver) {
    actionModalResolver(payload);
    actionModalResolver = null;
  }
}

function validateActionModal() {
  for (const field of actionModal.fields) {
    const raw = actionModal.values[field.key];
    const value = sanitizeModalValue(field, raw);
    if (field.required && (value === "" || value === null || value === undefined)) {
      actionModal.error = `${field.label} est obligatoire.`;
      return null;
    }
    if (field.type === "number" && value !== "" && value !== null && value !== undefined) {
      if (Number.isNaN(Number(value))) {
        actionModal.error = `${field.label} est invalide.`;
        return null;
      }
      if (field.min !== undefined && Number(value) < Number(field.min)) {
        actionModal.error = `${field.label} doit etre superieur ou egal a ${field.min}.`;
        return null;
      }
    }
  }

  actionModal.error = "";
  const payload = actionModal.fields.reduce((acc, field) => {
    acc[field.key] = sanitizeModalValue(field, actionModal.values[field.key]);
    return acc;
  }, {});
  return payload;
}

function confirmActionModal() {
  const payload = validateActionModal();
  if (!payload) return;
  closeActionModal(payload);
}

async function saveRolePermissions(roleId) {
  if (!canAccessSecurityModule.value) return;
  const role = String(roleId || "").toUpperCase();
  const nextPermissions = normalizeSecurityRolePermissions(role, securityRolePermissions.value[role] || []);
  if (role === "PROPRIETAIRE") {
    const missingCriticalPermissions = OWNER_CRITICAL_PERMISSIONS.filter((permission) => !nextPermissions.includes(permission));
    if (missingCriticalPermissions.length > 0) {
      securityError.value = `Le role proprietaire doit garder les permissions critiques: ${missingCriticalPermissions.join(", ")}.`;
      return;
    }
    securityRolePermissions.value = {
      ...securityRolePermissions.value,
      [role]: nextPermissions
    };
  }
  const confirmed = await openActionModal({
    title: "Confirmer permissions",
    message: `Appliquer les nouvelles permissions pour le role ${role} ?`,
    confirmLabel: "Confirmer",
    cancelLabel: "Annuler"
  });
  if (!confirmed) return;
  if (role === "PROPRIETAIRE") {
    const confirmedOwner = await openActionModal({
      title: "Confirmation critique",
      message: "Vous modifiez les permissions du proprietaire. Cette action impacte tout le systeme. Confirmer ?",
      confirmLabel: "Oui, confirmer",
      cancelLabel: "Annuler",
      tone: "red"
    });
    if (!confirmedOwner) return;
  }
  securitySaving.value = true;
  securityError.value = "";
  try {
    await atelierApi.updateRolePermissions(role, nextPermissions);
    notify(`Permissions enregistrees pour ${role}.`);
    if (authUser.value?.roleId === role) {
      const me = await atelierApi.me();
      const session = normalizeSessionPayload(me);
      applyAuthSession(session);
    }
  } catch (err) {
    securityError.value = readableError(err);
  } finally {
    securitySaving.value = false;
  }
}

async function createSecurityUser() {
  if (!canAccessSecurityModule.value) return;
  securitySaving.value = true;
  securityError.value = "";
  try {
    await atelierApi.createUser({
      nom: securityNewUser.nom,
      email: securityNewUser.email,
      motDePasse: securityNewUser.motDePasse,
      roleId: securityNewUser.roleId,
      actif: securityNewUser.actif
    });
    securityNewUser.nom = "";
    securityNewUser.email = "";
    securityNewUser.motDePasse = "";
    securityNewUser.roleId = "COUTURIER";
    securityNewUser.actif = true;
    await loadSecurityModule();
    notify("Utilisateur cree.");
  } catch (err) {
    securityError.value = readableError(err);
  } finally {
    securitySaving.value = false;
  }
}

async function saveSecurityUser(user) {
  if (!canAccessSecurityModule.value || !user?.id) return;
  securitySaving.value = true;
  securityError.value = "";
  try {
    await atelierApi.updateUser(user.id, {
      nom: user.nom,
      roleId: user.roleId
    });
    notify(`Utilisateur ${user.nom} mis a jour.`);
  } catch (err) {
    securityError.value = readableError(err);
  } finally {
    securitySaving.value = false;
  }
}

async function toggleSecurityUserActivation(user) {
  if (!canAccessSecurityModule.value || !user?.id) return;
  const nextActif = !(user.actif !== false);
  const actionLabel = nextActif ? "activer" : "desactiver";
  const confirmed = await openActionModal({
    title: "Confirmer activation",
    message: `Voulez-vous ${actionLabel} le compte de ${user.nom} ?`,
    confirmLabel: "Confirmer",
    cancelLabel: "Annuler"
  });
  if (!confirmed) return;
  securitySaving.value = true;
  securityError.value = "";
  try {
    const updated = await atelierApi.setUserActivation(user.id, nextActif);
    user.actif = updated?.actif !== false;
    user.etatCompte = String(updated?.etatCompte || (user.actif ? "ACTIVE" : "DISABLED")).toUpperCase();
    notify(`Utilisateur ${user.nom} ${user.actif ? "active" : "desactive"}.`);
  } catch (err) {
    securityError.value = readableError(err);
  } finally {
    securitySaving.value = false;
  }
}

const iconPaths = {
  dashboard: ["M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"],
  clipboard: ["M9 3h6", "M8 2h8v4H8z", "M6 6h12v16H6z"],
  scissors: ["M6 6 18 18", "M18 6 6 18", "M6 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z", "M6 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a4 4 0 1 0 0 0.01", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  bell: ["M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5", "M10 17a2 2 0 1 0 4 0"],
  wallet: ["M2 7h20v12H2z", "M16 13h4", "M2 7V5a2 2 0 0 1 2-2h14"],
  box: ["M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8Z", "M3.3 7 12 12l8.7-5", "M12 22V12"],
  invoice: ["M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z", "M9 8h6", "M9 12h6", "M9 16h4"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z"],
  history: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v4h4", "M12 7v5l4 2"],
  plus: ["M12 5v14", "M5 12h14"],
  cash: ["M2 7h20v10H2z", "M12 10v4", "M17 12h.01", "M7 12h.01"],
  check: ["M20 6 9 17l-5-5"],
  lock: ["M7 10V7a5 5 0 0 1 10 0v3", "M6 10h12v10H6z"],
  eye: ["M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  alert: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z", "M12 9v4", "M12 17h.01"]
};

const PERMISSIONS = {
  ANNULER_COMMANDE: "ANNULER_COMMANDE",
  VOIR_CLIENTS: "VOIR_CLIENTS",
  CREER_CLIENT: "CREER_CLIENT",
  MODIFIER_CLIENT: "MODIFIER_CLIENT",
  DESACTIVER_CLIENT: "DESACTIVER_CLIENT",
  VOIR_COMMANDES: "VOIR_COMMANDES",
  CREER_COMMANDE: "CREER_COMMANDE",
  VOIR_RETOUCHES: "VOIR_RETOUCHES",
  CREER_RETOUCHE: "CREER_RETOUCHE",
  VOIR_BILANS_GLOBAUX: "VOIR_BILANS_GLOBAUX",
  GERER_STOCK: "GERER_STOCK",
  GERER_VENTES: "GERER_VENTES",
  GERER_ACHATS_STOCK: "GERER_ACHATS_STOCK",
  GERER_AJUSTEMENTS_STOCK: "GERER_AJUSTEMENTS_STOCK",
  VOIR_AUDIT_STOCK: "VOIR_AUDIT_STOCK",
  OUVRIR_CAISSE: "OUVRIR_CAISSE",
  ENREGISTRER_ENTREE_CAISSE: "ENREGISTRER_ENTREE_CAISSE",
  ENREGISTRER_SORTIE_CAISSE: "ENREGISTRER_SORTIE_CAISSE",
  ANNULER_OPERATION_CAISSE: "ANNULER_OPERATION_CAISSE",
  CLOTURER_CAISSE: "CLOTURER_CAISSE",
  LIVRER_COMMANDE: "LIVRER_COMMANDE",
  TERMINER_COMMANDE: "TERMINER_COMMANDE",
  MODIFIER_PARAMETRES: "MODIFIER_PARAMETRES",
  GERER_UTILISATEURS: "GERER_UTILISATEURS",
  GERER_ATELIERS: "GERER_ATELIERS"
};
const OWNER_CRITICAL_PERMISSIONS = Object.freeze([PERMISSIONS.MODIFIER_PARAMETRES, PERMISSIONS.GERER_UTILISATEURS]);

function normalizeSessionPayload(payload) {
  return atelierApi.normalizeSession(payload);
}

const isAuthenticated = computed(() => Boolean(authUser.value));
const currentRole = computed(() => String(authUser.value?.roleId || "").toUpperCase());
const currentAtelierId = computed(() => String(authUser.value?.atelierId || "").trim());
const atelierNomConnexion = computed(() => {
  return authCardTitle.value;
});

function hasPermission(permission) {
  if (!permission) return true;
  if (!isAuthenticated.value) return false;
  if (currentRole.value === "MANAGER_SYSTEME") {
    return authPermissions.value.includes(permission);
  }
  if (currentRole.value === "PROPRIETAIRE") return permission !== PERMISSIONS.GERER_ATELIERS;
  return authPermissions.value.includes(permission);
}

function hasAnyPermission(list = []) {
  if (!Array.isArray(list) || list.length === 0) return isAuthenticated.value;
  return list.some((permission) => hasPermission(permission));
}

const canReadClients = computed(() =>
  hasAnyPermission([
    PERMISSIONS.VOIR_CLIENTS,
    PERMISSIONS.GERER_UTILISATEURS,
    PERMISSIONS.VOIR_BILANS_GLOBAUX,
    PERMISSIONS.CLOTURER_CAISSE
  ])
);
const canReadCommandes = computed(() =>
  hasAnyPermission([
    PERMISSIONS.VOIR_COMMANDES,
    PERMISSIONS.VOIR_BILANS_GLOBAUX,
    PERMISSIONS.CLOTURER_CAISSE,
    PERMISSIONS.TERMINER_COMMANDE,
    PERMISSIONS.LIVRER_COMMANDE,
    PERMISSIONS.ANNULER_COMMANDE
  ])
);
const canReadRetouches = computed(() =>
  hasAnyPermission([
    PERMISSIONS.VOIR_RETOUCHES,
    PERMISSIONS.VOIR_BILANS_GLOBAUX,
    PERMISSIONS.CLOTURER_CAISSE,
    PERMISSIONS.TERMINER_COMMANDE,
    PERMISSIONS.LIVRER_COMMANDE,
    PERMISSIONS.ANNULER_COMMANDE
  ])
);
const canReadStockArticles = computed(() =>
  hasAnyPermission([
    PERMISSIONS.GERER_STOCK,
    PERMISSIONS.GERER_VENTES,
    PERMISSIONS.GERER_ACHATS_STOCK,
    PERMISSIONS.GERER_AJUSTEMENTS_STOCK,
    PERMISSIONS.VOIR_BILANS_GLOBAUX
  ])
);
const canReadVentes = computed(() =>
  hasAnyPermission([
    PERMISSIONS.GERER_VENTES,
    PERMISSIONS.VOIR_BILANS_GLOBAUX
  ])
);
const canAccessContactFollowUpDashboard = computed(() =>
  canReadClients.value ||
  canCreateClient.value ||
  hasPermission(PERMISSIONS.MODIFIER_CLIENT) ||
  canReadCommandes.value ||
  canCreateCommande.value ||
  canReadRetouches.value ||
  canCreateRetouche.value ||
  canAccessSecurityModule.value ||
  hasPermission(PERMISSIONS.VOIR_BILANS_GLOBAUX) ||
  hasPermission(PERMISSIONS.CLOTURER_CAISSE)
);

function hasModuleAccessPermissions(moduleId) {
  if (moduleId === "systemAteliers") return hasPermission(PERMISSIONS.GERER_ATELIERS);
  if (moduleId === "systemNotifications") return hasPermission(PERMISSIONS.GERER_ATELIERS);
  if (moduleId === "dashboard") return true;
  if (moduleId === "dossiers") {
    return (
      canReadClients.value ||
      canCreateClient.value ||
      canReadCommandes.value ||
      canCreateCommande.value ||
      canReadRetouches.value ||
      canCreateRetouche.value ||
      hasPermission(PERMISSIONS.VOIR_BILANS_GLOBAUX) ||
      hasPermission(PERMISSIONS.CLOTURER_CAISSE)
    );
  }
  if (moduleId === "commandes") {
    return canReadCommandes.value || canCreateCommande.value;
  }
  if (moduleId === "retouches") {
    return canReadRetouches.value || canCreateRetouche.value;
  }
  if (moduleId === "clientsMesures") {
    return canReadClients.value || canCreateClient.value || hasPermission(PERMISSIONS.MODIFIER_CLIENT) || hasPermission(PERMISSIONS.DESACTIVER_CLIENT);
  }
  if (moduleId === "caisse") {
    return hasAnyPermission([
      PERMISSIONS.OUVRIR_CAISSE,
      PERMISSIONS.ENREGISTRER_ENTREE_CAISSE,
      PERMISSIONS.ENREGISTRER_SORTIE_CAISSE,
      PERMISSIONS.ANNULER_OPERATION_CAISSE,
      PERMISSIONS.CLOTURER_CAISSE,
      PERMISSIONS.VOIR_BILANS_GLOBAUX
    ]);
  }
  if (moduleId === "stockVentes") {
    return canReadStockArticles.value || canReadVentes.value || hasPermission(PERMISSIONS.VOIR_AUDIT_STOCK);
  }
  if (moduleId === "facturation") {
    return hasAnyPermission([
      PERMISSIONS.VOIR_COMMANDES,
      PERMISSIONS.CREER_COMMANDE,
      PERMISSIONS.VOIR_RETOUCHES,
      PERMISSIONS.CREER_RETOUCHE,
      PERMISSIONS.GERER_VENTES,
      PERMISSIONS.VOIR_BILANS_GLOBAUX,
      PERMISSIONS.CLOTURER_CAISSE
    ]);
  }
  if (moduleId === "parametres") return hasPermission(PERMISSIONS.MODIFIER_PARAMETRES);
  if (moduleId === "audit") return canAccessAuditPath("/audit");
  return false;
}

function canAccessAuditPath(path = "/audit") {
  if (!isAuthenticated.value) return false;
  if (currentRole.value === "MANAGER_SYSTEME") return false;
  if (currentRole.value === "PROPRIETAIRE") return true;
  if (path === "/audit" || path === "/audit/stock-ventes") {
    return hasAnyPermission([PERMISSIONS.VOIR_BILANS_GLOBAUX, PERMISSIONS.VOIR_AUDIT_STOCK]);
  }
  return hasPermission(PERMISSIONS.VOIR_BILANS_GLOBAUX);
}

function canAccessModule(moduleId) {
  if (!isAuthenticated.value) return false;
  if (moduleId === "notifications") {
    return !isSystemManager.value && currentRole.value === "PROPRIETAIRE" && Boolean(currentAtelierId.value);
  }
  if (currentRole.value === "MANAGER_SYSTEME") {
    return ["systemDashboard", "systemAteliers", "systemNotifications"].includes(moduleId) && hasPermission(PERMISSIONS.GERER_ATELIERS);
  }
  if (currentRole.value === "PROPRIETAIRE") return !["systemDashboard", "systemAteliers", "systemNotifications"].includes(moduleId);
  return hasModuleAccessPermissions(moduleId);
}

function canAccessRoute(routeId) {
  if (routeId === "notifications") return canAccessModule("notifications");
  if (routeId === "commande-detail" || routeId === "retouche-detail") return canAccessModule("commandes");
  if (routeId === "dossier-detail") return canAccessModule("dossiers");
  if (routeId === "vente-detail") return canAccessModule("stockVentes");
  if (routeId === "facture-detail") return canAccessModule("facturation");
  if (routeId === "systemAtelierDetail") return canAccessModule("systemAteliers");
  if (routeId === "forbidden") return true;
  return canAccessModule(routeId);
}

const atelierMenuItems = [
  { id: "dashboard", label: "Tableau de Bord", icon: "dashboard" },
  { id: "dossiers", label: "Dossiers", icon: "users" },
  { id: "commandes", label: "Commandes", icon: "clipboard" },
  { id: "retouches", label: "Retouches", icon: "scissors" },
  { id: "clientsMesures", label: "Clients & Mesures", icon: "users" },
  { id: "caisse", label: "Caisse", icon: "wallet" },
  { id: "stockVentes", label: "Stock & Ventes", icon: "box" },
  { id: "facturation", label: "Facturation", icon: "invoice" },
  { id: "parametres", label: "Parametres Atelier", icon: "settings" },
  { id: "audit", label: "Historique & Audit", icon: "history" }
];

const systemMenuItems = [
  { id: "systemDashboard", label: "Vue globale", icon: "dashboard" },
  { id: "systemAteliers", label: "Ateliers", icon: "users" },
  { id: "systemNotifications", label: "Notifications", icon: "bell" }
];
const menuItems = computed(() => (isSystemManager.value ? systemMenuItems : atelierMenuItems));
const visibleMenuItems = computed(() => menuItems.value.filter((item) => canAccessModule(item.id)));

function resolveAccessibleRoute(preferredRoute = "dashboard") {
  if (canAccessRoute(preferredRoute)) return preferredRoute;
  return visibleMenuItems.value[0]?.id || (isSystemManager.value ? "systemAteliers" : "dashboard");
}

const mobileNavItems = computed(() => {
  if (isSystemManager.value) {
    return [
      {
        id: "system-dashboard",
        target: "systemDashboard",
        label: "Accueil",
        icon: "dashboard",
        activeRoutes: ["systemDashboard"]
      },
      {
        id: "system-ateliers",
        target: "systemAteliers",
        label: "Ateliers",
        icon: "users",
        activeRoutes: ["systemAteliers", "systemAtelierDetail"]
      },
      {
        id: "system-notifications",
        target: "systemNotifications",
        label: "Notifs",
        icon: "bell",
        activeRoutes: ["systemNotifications"]
      }
    ].filter((item) => canAccessRoute(item.target));
  }

  return [
    {
      id: "dashboard",
      target: "dashboard",
      label: "Accueil",
      icon: "dashboard",
      activeRoutes: ["dashboard"]
    },
    {
      id: "dossiers",
      target: canAccessRoute("dossiers") ? "dossiers" : "",
      label: "Dossiers",
      icon: "users",
      activeRoutes: ["dossiers", "dossier-detail"]
    },
    {
      id: "commandes",
      target: canAccessRoute("commandes") ? "commandes" : "",
      label: "Commandes",
      icon: "clipboard",
      activeRoutes: ["commandes", "commande-detail"]
    },
    {
      id: "retouches",
      target: canAccessRoute("retouches") ? "retouches" : "",
      label: "Retouches",
      icon: "scissors",
      activeRoutes: ["retouches", "retouche-detail"]
    },
    {
      id: "caisse",
      target: canAccessRoute("caisse") ? "caisse" : "",
      label: "Caisse",
      icon: "wallet",
      activeRoutes: ["caisse"]
    }
  ].filter((item) => item.target);
});

const hasBlockingMobileOverlay = computed(
  () =>
    Boolean(
      systemAtelierModal.open ||
        factureEmission.open ||
        wizard.open ||
        retoucheWizard.open ||
        settingsConfirmModal.open ||
        actionModal.open
    )
);

const showMobileBottomNav = computed(
  () =>
    Boolean(
      isMobileViewport.value &&
        mobileNavItems.value.length > 0 &&
        !hasBlockingMobileOverlay.value
    )
);

const mobileLayoutStyle = computed(() => ({
  "--mobile-bottom-offset": showMobileBottomNav.value
    ? "calc(var(--mobile-bottom-nav-height) + var(--mobile-bottom-nav-gap) + env(safe-area-inset-bottom))"
    : "calc(12px + env(safe-area-inset-bottom))"
}));

const activeMobileScrollButtonMode = computed(() =>
  isMobileViewport.value && !isSidebarDrawerOpen.value && !hasBlockingMobileOverlay.value ? mobileScrollButtonMode.value : "none"
);

const showMobileScrollTopButton = computed(() => activeMobileScrollButtonMode.value === "up");
const showMobileScrollBottomButton = computed(() => activeMobileScrollButtonMode.value === "down");

function updateMobileScrollButtonVisibility() {
  const container = contentScrollRef.value;
  if (!container) {
    mobileScrollButtonMode.value = "none";
    return;
  }

  const scrollTop = Math.max(0, Number(container.scrollTop || 0));
  const maxScrollTop = Math.max(0, Number(container.scrollHeight || 0) - Number(container.clientHeight || 0));
  const topThreshold = 96;
  const bottomThreshold = 96;

  if (maxScrollTop < 220) {
    mobileScrollButtonMode.value = "none";
    return;
  }

  const distanceFromBottom = Math.max(0, maxScrollTop - scrollTop);
  const nearTop = scrollTop <= topThreshold;
  const nearBottom = distanceFromBottom <= bottomThreshold;

  if (nearTop) {
    mobileScrollButtonMode.value = "down";
    return;
  }

  if (nearBottom) {
    mobileScrollButtonMode.value = "up";
    return;
  }

  mobileScrollButtonMode.value = scrollTop / maxScrollTop < 0.5 ? "down" : "up";
}

function updateScrollTopButtonVisibility() {
  updateMobileScrollButtonVisibility();
}

function scrollMainContentToBottom(behavior = "auto") {
  nextTick(() => {
    const container = contentScrollRef.value;
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      const targetTop = Math.max(
        0,
        (document.documentElement?.scrollHeight || 0) - (window.innerHeight || document.documentElement?.clientHeight || 0)
      );
      window.scrollTo({ top: targetTop, behavior });
    }
  });
}

function handleContentScroll() {
  updateScrollTopButtonVisibility();
}

function bindContentScrollListener() {
  if (contentScrollElement && contentScrollElement !== contentScrollRef.value) {
    contentScrollElement.removeEventListener("scroll", handleContentScroll);
    contentScrollElement = null;
  }

  if (!contentScrollRef.value) {
    mobileScrollButtonMode.value = "none";
    return;
  }

  if (contentScrollElement === contentScrollRef.value) {
    updateScrollTopButtonVisibility();
    return;
  }

  contentScrollElement = contentScrollRef.value;
  contentScrollElement.addEventListener("scroll", handleContentScroll, { passive: true });
  updateScrollTopButtonVisibility();
}

function updateViewportState() {
  if (typeof window === "undefined") return;
  const nextIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
  isMobileViewport.value = nextIsMobile;
  if (!nextIsMobile) {
    isSidebarDrawerOpen.value = false;
  }
}

function closeSidebarDrawer() {
  isSidebarDrawerOpen.value = false;
}

function toggleSidebarDrawer() {
  if (!isMobileViewport.value) return;
  isSidebarDrawerOpen.value = !isSidebarDrawerOpen.value;
}

const auditRoutes = [
  { path: "/audit", title: "Historique & Audit", subtitle: "Hub de navigation audit" },
  { path: "/audit/caisse", title: "Audit de la Caisse", subtitle: "Bilans journaliers, hebdomadaires et mensuels" },
  { path: "/audit/operations", title: "Audit des Operations", subtitle: "Journal global des operations financieres" },
  { path: "/audit/commandes", title: "Audit des Commandes", subtitle: "Historique commandes, paiements, livraisons, annulations" },
  { path: "/audit/retouches", title: "Audit des Retouches", subtitle: "Historique retouches, paiements, livraisons" },
  { path: "/audit/stock-ventes", title: "Audit Stock & Ventes", subtitle: "Ventes, sorties stock et lien caisse" },
  { path: "/audit/factures", title: "Audit des Factures", subtitle: "Factures emises en lecture seule" },
  { path: "/audit/utilisateurs", title: "Audit Utilisateurs", subtitle: "Journal des actions de securite et gestion utilisateurs" },
  { path: "/audit/annuel", title: "Audit Annuel", subtitle: "Consolidation annuelle des bilans de caisse" }
];

const clientMap = computed(() => {
  const map = new Map();
  for (const client of clients.value) {
    map.set(client.idClient, `${client.nom || ""} ${client.prenom || ""}`.trim());
  }
  return map;
});

const clientDirectory = computed(() => {
  const map = new Map();
  for (const client of clients.value) {
    map.set(client.idClient, {
      nomComplet: `${client.nom || ""} ${client.prenom || ""}`.trim(),
      telephone: String(client.telephone || "")
    });
  }
  return map;
});

const clientsActifs = computed(() =>
  clients.value
    .filter((client) => client && client.actif !== false)
    .slice()
    .sort((left, right) =>
      formatClientDisplayName(left).localeCompare(formatClientDisplayName(right), "fr", { sensitivity: "base" })
    )
);

function formatClientDisplayName(client) {
  return `${client?.nom || ""} ${client?.prenom || ""}`.trim() || "Client sans nom";
}

function scoreClientResult(client, rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase();
  if (!query) return null;
  const nomComplet = formatClientDisplayName(client).toLowerCase();
  const telephone = String(client?.telephone || "").toLowerCase();
  const startsName = nomComplet.startsWith(query);
  const startsPhone = telephone.startsWith(query);
  const containsName = nomComplet.includes(query);
  const containsPhone = telephone.includes(query);
  const tokenStartsName = nomComplet.split(/\s+/).some((part) => part.startsWith(query));

  if (!(startsName || startsPhone || containsName || containsPhone || tokenStartsName)) return null;
  if (startsName) return 0;
  if (startsPhone) return 1;
  if (containsName) return 2;
  if (containsPhone) return 3;
  return 4;
}

function searchClients(rawQuery) {
  const query = String(rawQuery || "").trim();
  if (!query) return [];

  return clients.value
    .map((client) => {
      const score = scoreClientResult(client, query);
      if (score === null) return null;
      return {
        client,
        score,
        nomComplet: formatClientDisplayName(client),
        telephone: String(client?.telephone || "")
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.nomComplet.localeCompare(b.nomComplet) || a.telephone.localeCompare(b.telephone))
    .slice(0, MAX_CLIENT_SEARCH_RESULTS);
}

const dossierClientSearchResults = computed(() => searchClients(dossierClientSearchQuery.value));
const wizardClientSearchResults = computed(() => searchClients(wizardClientSearchQuery.value));
const retoucheClientSearchResultsWizard = computed(() => searchClients(retoucheClientSearchQueryWizard.value));
const dossierSelectedExistingClient = computed(() =>
  clientsActifs.value.find((client) => client.idClient === dossierDraft.existingClientId) || null
);

function normalizeClientDuplicateName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeClientDuplicatePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

const wizardNewClientDraft = computed(() => ({
  nom: String(wizard.newClient.nom || "").trim(),
  prenom: String(wizard.newClient.prenom || "").trim(),
  telephone: String(wizard.newClient.telephone || "").trim()
}));

const wizardExactPhoneDuplicateClient = computed(() => {
  if (wizard.mode !== "new") return null;
  const normalizedPhone = normalizeClientDuplicatePhone(wizardNewClientDraft.value.telephone);
  if (!normalizedPhone) return null;
  return clients.value.find((client) => normalizeClientDuplicatePhone(client.telephone) === normalizedPhone) || null;
});

const wizardProbableDuplicateClients = computed(() => {
  if (wizard.mode !== "new") return [];
  const normalizedNom = normalizeClientDuplicateName(wizardNewClientDraft.value.nom);
  const normalizedPrenom = normalizeClientDuplicateName(wizardNewClientDraft.value.prenom);
  if (!normalizedNom || !normalizedPrenom) return [];

  return clients.value
    .filter((client) => {
      if (wizardExactPhoneDuplicateClient.value?.idClient === client.idClient) return false;
      return (
        normalizeClientDuplicateName(client.nom) === normalizedNom &&
        normalizeClientDuplicateName(client.prenom) === normalizedPrenom
      );
    })
    .slice(0, 3);
});

const retoucheWizardNewClientDraft = computed(() => ({
  nom: String(retoucheWizard.newClient.nom || "").trim(),
  prenom: String(retoucheWizard.newClient.prenom || "").trim(),
  telephone: String(retoucheWizard.newClient.telephone || "").trim()
}));

const retoucheWizardExactPhoneDuplicateClient = computed(() => {
  if (retoucheWizard.mode !== "new") return null;
  const normalizedPhone = normalizeClientDuplicatePhone(retoucheWizardNewClientDraft.value.telephone);
  if (!normalizedPhone) return null;
  return clients.value.find((client) => normalizeClientDuplicatePhone(client.telephone) === normalizedPhone) || null;
});

const retoucheWizardProbableDuplicateClients = computed(() => {
  if (retoucheWizard.mode !== "new") return [];
  const normalizedNom = normalizeClientDuplicateName(retoucheWizardNewClientDraft.value.nom);
  const normalizedPrenom = normalizeClientDuplicateName(retoucheWizardNewClientDraft.value.prenom);
  if (!normalizedNom || !normalizedPrenom) return [];

  return clients.value
    .filter((client) => {
      if (retoucheWizardExactPhoneDuplicateClient.value?.idClient === client.idClient) return false;
      return (
        normalizeClientDuplicateName(client.nom) === normalizedNom &&
        normalizeClientDuplicateName(client.prenom) === normalizedPrenom
      );
    })
    .slice(0, 3);
});

function findExactPhoneDuplicateForDraft(draft = {}, excludeClientId = "") {
  const normalizedPhone = normalizeClientDuplicatePhone(draft.telephone);
  if (!normalizedPhone) return null;
  return (
    clients.value.find((client) => {
      if (excludeClientId && String(client.idClient || "") === String(excludeClientId || "")) return false;
      return normalizeClientDuplicatePhone(client.telephone) === normalizedPhone;
    }) || null
  );
}

function findProbableDuplicatesForDraft(draft = {}, options = {}) {
  const normalizedNom = normalizeClientDuplicateName(draft.nom);
  const normalizedPrenom = normalizeClientDuplicateName(draft.prenom);
  if (!normalizedNom || !normalizedPrenom) return [];
  const excludeClientId = String(options.excludeClientId || "").trim();
  const exactPhoneDuplicate = options.exactPhoneDuplicate || null;
  return clients.value
    .filter((client) => {
      if (excludeClientId && String(client.idClient || "") === excludeClientId) return false;
      if (exactPhoneDuplicate?.idClient && exactPhoneDuplicate.idClient === client.idClient) return false;
      return (
        normalizeClientDuplicateName(client.nom) === normalizedNom &&
        normalizeClientDuplicateName(client.prenom) === normalizedPrenom
      );
    })
    .slice(0, 4);
}

function getWizardDuplicateDecision() {
  const action = String(wizard.doublonDecisionAction || "").trim().toUpperCase();
  if (!action) return undefined;
  return {
    action,
    idClient: String(wizard.doublonDecisionId || "").trim() || undefined
  };
}

function clearWizardDuplicateDecision() {
  wizard.doublonDecisionAction = "";
  wizard.doublonDecisionId = "";
}

function resolveCommandeMesureFields(typeHabit) {
  const def = resolveHabitUiDefinition(typeHabit);
  if (!def) return [];
  return [
    ...def.required.map((key) => ({
      key,
      label: def.labels?.[key] || mesureLabelFromKey(key),
      required: true,
      inputType: def.fieldTypes?.[key] || "number"
    })),
    ...def.optional.map((key) => ({
      key,
      label: def.labels?.[key] || mesureLabelFromKey(key),
      required: false,
      inputType: def.fieldTypes?.[key] || "number"
    }))
  ];
}

function createCommandeItemDraft() {
  return {
    idItem: `cmd-item-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    typeHabit: "",
    description: "",
    prix: "",
    mesures: {}
  };
}

function createRetoucheItemDraft() {
  return {
    idItem: `ret-item-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    typeRetouche: "",
    typeHabit: "",
    description: "",
    prix: "",
    mesures: {}
  };
}

function syncCommandePrimaryTypeFromItems() {
  const primaryType = String((wizard.commande.items || []).find((item) => String(item?.typeHabit || "").trim())?.typeHabit || "").trim();
  wizard.commande.typeHabit = primaryType;
}

function getCommandeItemMeasureFields(item) {
  return resolveCommandeMesureFields(item?.typeHabit);
}

function resolveRetoucheMeasureFieldsForType(typeRetouche = "") {
  const code = String(typeRetouche || "").trim().toUpperCase();
  if (!code) return [];
  const definition = availableRetoucheTypeDefinitions.value.find((row) => row.code === code) || null;
  if (!definition || definition.necessiteMesures !== true) return [];
  return (definition.mesures || [])
    .filter((mesure) => mesure?.actif !== false)
    .sort((left, right) => normalizeSortOrder(left?.ordre) - normalizeSortOrder(right?.ordre))
    .map((mesure) => ({
      key: mesure.code,
      label: mesure.label || mesureLabelFromKey(mesure.code),
      required: mesure.obligatoire === true,
      inputType: normalizeMesureFieldType(mesure.typeChamp),
      unite: mesure.unite || "cm"
    }));
}

function isCommandeMeasureFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

function getCommandeItemMeasureProgress(item) {
  const fields = getCommandeItemMeasureFields(item);
  const mesures = item?.mesures || {};
  const total = fields.length;
  const requiredTotal = fields.filter((field) => field.required).length;
  const completed = fields.filter((field) => isCommandeMeasureFilled(mesures[field.key])).length;
  const requiredCompleted = fields.filter((field) => field.required && isCommandeMeasureFilled(mesures[field.key])).length;
  return {
    total,
    completed,
    requiredTotal,
    requiredCompleted,
    missingRequired: Math.max(requiredTotal - requiredCompleted, 0),
    completionLabel: total > 0 ? `${completed}/${total} mesure(s)` : "Aucune mesure attendue"
  };
}

function getCommandeMeasureStateLabel(item) {
  const progress = getCommandeItemMeasureProgress(item);
  if (progress.total === 0) return "Sans mesures";
  if (progress.completed === 0) return "A completer";
  if (progress.missingRequired > 0) return "Partiel";
  return "Complet";
}

function resetCommandeItemMesures(item) {
  if (!item || typeof item !== "object") return;
  item.mesures = {};
  resetMesuresModel(item.mesures);
}

function getPrimaryCommandeItem() {
  return (wizard.commande.items || []).find((item) => String(item?.typeHabit || "").trim()) || wizard.commande.items?.[0] || null;
}

function onCommandeItemTypeChange(item) {
  resetCommandeItemMesures(item);
  syncCommandePrimaryTypeFromItems();
  void refreshCommandePrefill();
}

function getRetoucheItemTypeDefinition(item) {
  const code = String(item?.typeRetouche || "").trim().toUpperCase();
  if (!code) return null;
  return availableRetoucheTypeDefinitions.value.find((row) => row.code === code) || null;
}

function getRetoucheItemCompatibleHabitOptions(item) {
  const definition = getRetoucheItemTypeDefinition(item);
  const compatibles = Array.isArray(definition?.habitsCompatibles) ? definition.habitsCompatibles : ["*"];
  if (compatibles.includes("*")) return wizardAvailableHabitTypeOptions.value;
  const allowed = new Set(compatibles.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean));
  return wizardAvailableHabitTypeOptions.value.filter((option) => allowed.has(String(option.value || "").trim().toUpperCase()));
}

function getRetoucheItemMeasureFields(item) {
  const definition = getRetoucheItemTypeDefinition(item);
  if (!definition || definition.necessiteMesures !== true) return [];
  return (definition.mesures || [])
    .filter((mesure) => mesure?.actif !== false)
    .sort((left, right) => normalizeSortOrder(left?.ordre) - normalizeSortOrder(right?.ordre))
    .map((mesure) => ({
      key: mesure.code,
      label: mesure.label || mesureLabelFromKey(mesure.code),
      required: mesure.obligatoire === true,
      inputType: normalizeMesureFieldType(mesure.typeChamp),
      unite: mesure.unite || "cm"
    }));
}

function resetRetoucheItemMesures(item) {
  if (!item || typeof item !== "object") return;
  item.mesures = {};
  resetMesuresModel(item.mesures);
}

function onRetoucheItemTypeChange(item) {
  const options = getRetoucheItemCompatibleHabitOptions(item);
  const currentHabit = String(item?.typeHabit || "").trim().toUpperCase();
  if (!options.some((option) => String(option.value || "").trim().toUpperCase() === currentHabit)) {
    item.typeHabit = options.length === 1 ? options[0].value : "";
  }
  resetRetoucheItemMesures(item);
  syncRetouchePrimaryTypeFromItems();
}

function onRetoucheItemHabitChange(item) {
  resetRetoucheItemMesures(item);
  syncRetouchePrimaryTypeFromItems();
}

function getRetoucheItemMeasureProgress(item) {
  const fields = getRetoucheItemMeasureFields(item);
  const mesures = item?.mesures || {};
  const total = fields.length;
  const requiredTotal = fields.filter((field) => field.required).length;
  const completed = fields.filter((field) => isCommandeMeasureFilled(mesures[field.key])).length;
  const requiredCompleted = fields.filter((field) => field.required && isCommandeMeasureFilled(mesures[field.key])).length;
  const needsMeasures = total > 0;
  return {
    total,
    completed,
    requiredTotal,
    requiredCompleted,
    missingRequired: needsMeasures ? Math.max(requiredTotal - requiredCompleted, 0) : 0,
    requiresMeasures: needsMeasures,
    completionLabel: total > 0 ? `${completed}/${total} mesure(s)` : "Sans mesures"
  };
}

function getRetoucheMeasureStateLabel(item) {
  const hasType = Boolean(String(item?.typeRetouche || "").trim());
  const hasHabit = Boolean(String(item?.typeHabit || "").trim());
  if (!hasType) return "A definir";
  const progress = getRetoucheItemMeasureProgress(item);
  if (!hasHabit) return "A completer";
  if (progress.total === 0) return "Sans mesures";
  if (progress.completed === 0) return "A completer";
  if (progress.missingRequired > 0) return "Partiel";
  return "Complet";
}

function getPrimaryRetoucheItem() {
  return (retoucheWizard.retouche.items || []).find((item) => String(item?.typeRetouche || "").trim()) || retoucheWizard.retouche.items?.[0] || null;
}

function syncRetouchePrimaryTypeFromItems() {
  const primaryItem = getPrimaryRetoucheItem();
  retoucheWizard.retouche.typeRetouche = String(primaryItem?.typeRetouche || "").trim();
  retoucheWizard.retouche.typeHabit = String(primaryItem?.typeHabit || "").trim();
  retoucheWizard.retouche.mesuresHabit = primaryItem?.mesures || {};
}

function recalculateCommandeTotalFromItems() {
  const total = (wizard.commande.items || []).reduce((sum, item) => sum + (Number(item?.prix || 0) || 0), 0);
  wizard.commande.montantTotal = total > 0 ? String(total) : "";
}

function recalculateRetoucheTotalFromItems() {
  const total = (retoucheWizard.retouche.items || []).reduce((sum, item) => sum + (Number(item?.prix || 0) || 0), 0);
  retoucheWizard.retouche.montantTotal = total > 0 ? String(total) : "";
}

function addCommandeItem() {
  wizard.commande.items.push(createCommandeItemDraft());
}

function removeCommandeItem(index) {
  if ((wizard.commande.items || []).length <= 1) return;
  wizard.commande.items.splice(index, 1);
  syncCommandePrimaryTypeFromItems();
  recalculateCommandeTotalFromItems();
}

const wizardCommandeMeasureItems = computed(() => (wizard.commande.items || []).filter((row) => String(row?.typeHabit || "").trim()));
const wizardCommandeMeasureActiveItem = computed(() => wizardCommandeMeasureItems.value[wizardCommandeMeasureIndex.value] || null);
const wizardCommandeMeasureCompletion = computed(() => {
  const items = wizardCommandeMeasureItems.value;
  const complete = items.filter((item) => {
    const progress = getCommandeItemMeasureProgress(item);
    return progress.total === 0 || progress.missingRequired === 0;
  }).length;
  return {
    total: items.length,
    complete
  };
});

function setWizardCommandeMeasureIndex(index) {
  const total = wizardCommandeMeasureItems.value.length;
  if (total <= 0) {
    wizardCommandeMeasureIndex.value = 0;
    return;
  }
  wizardCommandeMeasureIndex.value = Math.max(0, Math.min(total - 1, Number(index || 0)));
}

function goToPreviousCommandeMeasureItem() {
  setWizardCommandeMeasureIndex(wizardCommandeMeasureIndex.value - 1);
}

function goToNextCommandeMeasureItem() {
  setWizardCommandeMeasureIndex(wizardCommandeMeasureIndex.value + 1);
}

function setWizardRetoucheMeasureIndex(index) {
  const total = wizardRetoucheMeasureItems.value.length;
  if (total <= 0) {
    wizardRetoucheMeasureIndex.value = 0;
    return;
  }
  wizardRetoucheMeasureIndex.value = Math.max(0, Math.min(total - 1, Number(index || 0)));
}

function goToPreviousRetoucheMeasureItem() {
  setWizardRetoucheMeasureIndex(wizardRetoucheMeasureIndex.value - 1);
}

function goToNextRetoucheMeasureItem() {
  setWizardRetoucheMeasureIndex(wizardRetoucheMeasureIndex.value + 1);
}

function getMeasureScrollContainer(context = "") {
  const normalizedContext = String(context || "");
  const section =
    normalizedContext === "retouche"
      ? retoucheMeasureStepRef.value
      : wizardMeasureStepRef.value;
  if (!section) return null;
  return section instanceof HTMLElement ? section : null;
}

function isMeasureScrollContextActive(context = "") {
  const normalizedContext = String(context || "");
  if (!isMobileViewport.value) return false;
  if (normalizedContext === "retouche") return retoucheWizard.step === 3;
  return wizard.step === 3;
}

function rememberWizardMeasureScrollPosition(context = "") {
  if (!isMeasureScrollContextActive(context)) return;
  const container = getMeasureScrollContainer(context);
  if (!container) return;
  wizardMeasureScrollRestoreTop = Number(container.scrollTop || 0);
}

function restoreWizardMeasureScrollPosition(context = "") {
  if (!isMeasureScrollContextActive(context)) return;
  const container = getMeasureScrollContainer(context);
  if (!container) return;
  const targetTop = Math.max(0, Number(wizardMeasureScrollRestoreTop || 0));
  if (Math.abs(Number(container.scrollTop || 0) - targetTop) < 2) return;
  container.scrollTop = targetTop;
}

function onWizardMeasureFieldFocusIn() {
  activeMeasureScrollContext = "commande";
  rememberWizardMeasureScrollPosition("commande");
}

function onWizardMeasureFieldFocusOut() {
  if (!isMeasureScrollContextActive("commande")) return;
  const token = ++wizardMeasureRestoreToken;
  const runRestore = () => {
    if (token !== wizardMeasureRestoreToken) return;
    restoreWizardMeasureScrollPosition("commande");
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      runRestore();
      window.requestAnimationFrame(runRestore);
    });
    setTimeout(runRestore, 140);
    return;
  }
  setTimeout(runRestore, 0);
}

function onRetoucheMeasureFieldFocusIn() {
  activeMeasureScrollContext = "retouche";
  rememberWizardMeasureScrollPosition("retouche");
}

function onRetoucheMeasureFieldFocusOut() {
  if (!isMeasureScrollContextActive("retouche")) return;
  const token = ++wizardMeasureRestoreToken;
  const runRestore = () => {
    if (token !== wizardMeasureRestoreToken) return;
    restoreWizardMeasureScrollPosition("retouche");
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      runRestore();
      window.requestAnimationFrame(runRestore);
    });
    setTimeout(runRestore, 140);
    return;
  }
  setTimeout(runRestore, 0);
}

function handleMeasureViewportResize() {
  if (!activeMeasureScrollContext) return;
  const context = activeMeasureScrollContext;
  if (!isMeasureScrollContextActive(context)) return;
  const token = ++wizardMeasureRestoreToken;
  const runRestore = () => {
    if (token !== wizardMeasureRestoreToken) return;
    restoreWizardMeasureScrollPosition(context);
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      runRestore();
      window.requestAnimationFrame(runRestore);
    });
    return;
  }
  setTimeout(runRestore, 0);
}

function addRetoucheItem() {
  retoucheWizard.retouche.items.push(createRetoucheItemDraft());
}

function removeRetoucheItem(index) {
  if ((retoucheWizard.retouche.items || []).length <= 1) return;
  retoucheWizard.retouche.items.splice(index, 1);
  syncRetouchePrimaryTypeFromItems();
  recalculateRetoucheTotalFromItems();
}

function setWizardDuplicateDecision(action, client = null) {
  wizard.doublonDecisionAction = String(action || "").trim().toUpperCase();
  wizard.doublonDecisionId = String(client?.idClient || "").trim();
}

function markWizardCreateAnyway(client = null) {
  setWizardDuplicateDecision("CONFIRM_NEW", client);
}

async function refreshCommandePrefill() {
  wizard.commande.prefill = null;
  wizard.commande.prefillDecision = "idle";
  const primaryItem = getPrimaryCommandeItem();
  const typeHabit = String(primaryItem?.typeHabit || wizard.commande.typeHabit || "").trim().toUpperCase();
  if (!typeHabit) return;

  let targetClientId = "";
  if (wizard.mode === "existing") {
    targetClientId = String(wizard.resolvedClientId || wizard.existingClientId || "").trim();
  }

  if (!targetClientId) return;
  wizard.commande.prefillLoading = true;
  try {
    const payload = await atelierApi.getClientLatestMeasures(targetClientId, typeHabit);
    wizard.commande.prefill = payload?.prefill || null;
  } catch {
    wizard.commande.prefill = null;
  } finally {
    wizard.commande.prefillLoading = false;
  }
}

function applyCommandePrefill(mode = "use") {
  if (!wizard.commande?.prefill?.mesuresHabit?.valeurs) return;
  const primaryItem = getPrimaryCommandeItem();
  if (!primaryItem) return;
  primaryItem.mesures = {};
  resetMesuresModel(primaryItem.mesures);
  for (const [key, value] of Object.entries(wizard.commande.prefill.mesuresHabit.valeurs || {})) {
    primaryItem.mesures[key] = value;
  }
  wizard.commande.prefillDecision = mode === "modify" ? "modify" : "use";
}

function ignoreCommandePrefill() {
  wizard.commande.prefillDecision = "ignored";
}

const wizardSummary = computed(() => ({
  mesuresRenseignees: (wizard.commande.items || []).reduce(
    (sum, item) => sum + Object.keys(item?.mesures || {}).filter((key) => item?.mesures?.[key]).length,
    0
  ),
  montantTotal: Number(wizard.commande.montantTotal || 0) || 0,
  typeHabit: wizard.commande.typeHabit || "",
  items: wizard.commande.items || []
}));

const wizardValidationStats = computed(() => {
  const items = (wizard.commande.items || []).filter((item) => String(item?.typeHabit || "").trim());
  const missingRequired = items.reduce((sum, item) => sum + getCommandeItemMeasureProgress(item).missingRequired, 0);
  const completeItems = items.filter((item) => getCommandeItemMeasureProgress(item).missingRequired === 0).length;
  return {
    itemsCount: items.length,
    completeItems,
    missingRequired,
    datePrevueLabel: wizard.commande.datePrevue ? formatDateShort(`${wizard.commande.datePrevue}T00:00:00.000Z`) : "Non definie",
    factureLabel: wizard.commande.emettreFacture ? "Facture a emettre" : "Sans facture immediate",
    readyLabel: missingRequired === 0 && items.length > 0 ? "Pret a enregistrer" : "Verification requise"
  };
});

const retoucheSummary = computed(() => ({
  items: (retoucheWizard.retouche.items || []).filter((item) => String(item?.typeRetouche || "").trim()),
  montantTotal: Number(retoucheWizard.retouche.montantTotal || 0) || 0,
  mesuresRenseignees: (retoucheWizard.retouche.items || []).reduce(
    (sum, item) =>
      sum +
      Object.keys(item?.mesures || {}).filter(
        (key) =>
          item?.mesures?.[key] !== undefined &&
          item?.mesures?.[key] !== null &&
          String(item?.mesures?.[key]).trim() !== ""
      ).length,
    0
  )
}));

const retoucheValidationStats = computed(() => {
  const items = (retoucheWizard.retouche.items || []).filter((item) => String(item?.typeRetouche || "").trim());
  const datePrevueLabel = retoucheWizard.retouche.datePrevue
    ? formatDateShort(`${retoucheWizard.retouche.datePrevue}T00:00:00.000Z`)
    : "Non definie";
  const factureLabel = retoucheWizard.retouche.emettreFacture ? "Facture a emettre" : "Sans facture immediate";
  const completeItems = items.filter((item) => {
    const hasHabit = Boolean(String(item?.typeHabit || "").trim());
    const progress = getRetoucheItemMeasureProgress(item);
    return hasHabit && (progress.total === 0 || progress.missingRequired === 0);
  }).length;
  const missingMeasures = items.reduce((sum, item) => sum + getRetoucheItemMeasureProgress(item).missingRequired, 0);
  const missingHabitCount = items.filter((item) => !String(item?.typeHabit || "").trim()).length;
  const measuresConfigured = items.every((item) => {
    const hasHabit = Boolean(String(item?.typeHabit || "").trim());
    const progress = getRetoucheItemMeasureProgress(item);
    return hasHabit && (progress.total === 0 || progress.missingRequired === 0);
  });
  const ready =
    items.length > 0 &&
    measuresConfigured &&
    (!wizardRetoucheDescriptionRequired.value || Boolean(String(retoucheWizard.retouche.descriptionRetouche || "").trim()));
  return {
    itemsCount: items.length,
    completeItems,
    datePrevueLabel,
    factureLabel,
    measuresConfigured,
    missingMeasures,
    missingHabitCount,
    readyLabel: ready ? "Pret a enregistrer" : "Verification requise"
  };
});

function buildClientInsight(consultation) {
  const synthese = consultation?.synthese || {};
  const historique = consultation?.historique || {};
  const commandesRows = (historique.commandes || []).map((row, index) => ({
    id: `cmd-${row.idCommande || row.date || index}`,
    date: row.date || "",
    libelle: row.typeHabit || "Commande",
    statut: formatWorkflowStatus(row.statut)
  }));
  const retouchesRows = (historique.retouches || []).map((row, index) => ({
    id: `ret-${row.idRetouche || row.date || index}`,
    date: row.date || "",
    libelle: row.typeHabit ? `Retouche ${row.typeHabit}` : "Retouche",
    statut: formatWorkflowStatus(row.statut)
  }));

  const operations = [...commandesRows, ...retouchesRows]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, CLIENT_INSIGHT_PREVIEW_SIZE);

  const mesuresTypes = Array.from(
    new Set(
      (historique.mesures || [])
        .map((row) => String(row.typeHabit || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  return {
    totalCommandes: Number(synthese.totalCommandes || 0),
    totalRetouches: Number(synthese.totalRetouches || 0),
    derniereVisite: synthese.dateDerniereActivite || consultation?.client?.dateDernierPassage || "",
    operations,
    mesuresTypes
  };
}

function resetWizardClientInsight() {
  wizardClientInsight.value = null;
  wizardClientInsightLoading.value = false;
  wizardClientInsightError.value = "";
}

function resetRetoucheClientInsight() {
  retoucheClientInsight.value = null;
  retoucheClientInsightLoading.value = false;
  retoucheClientInsightError.value = "";
}

async function loadWizardClientInsight(idClient) {
  const requestId = wizardClientInsightRequestId.value + 1;
  wizardClientInsightRequestId.value = requestId;
  if (!idClient) {
    resetWizardClientInsight();
    return;
  }

  if (!getNetworkState().online || !isRemoteEntityId(idClient)) {
    wizardClientInsight.value = null;
    wizardClientInsightLoading.value = false;
    wizardClientInsightError.value = OFFLINE_READ_MESSAGES.CLIENT_CONSULTATION;
    return;
  }
  wizardClientInsightLoading.value = true;
  wizardClientInsightError.value = "";

  try {
    const payload = await atelierApi.getClientConsultation(idClient, {
      source: "ALL",
      typeHabit: "ALL",
      periode: "ALL",
      size: CLIENT_INSIGHT_PREVIEW_SIZE,
      pageCommandes: 1,
      pageRetouches: 1,
      pageMesures: 1
    });
    if (wizardClientInsightRequestId.value !== requestId) return;
    const normalized = normalizeClientConsultation(payload);
    wizardClientInsight.value = buildClientInsight(normalized);
  } catch (err) {
    if (wizardClientInsightRequestId.value !== requestId) return;
    wizardClientInsight.value = null;
    wizardClientInsightError.value = readableError(err);
  } finally {
    if (wizardClientInsightRequestId.value === requestId) {
      wizardClientInsightLoading.value = false;
    }
  }
}

async function loadRetoucheClientInsight(idClient) {
  const requestId = retoucheClientInsightRequestId.value + 1;
  retoucheClientInsightRequestId.value = requestId;
  if (!idClient) {
    resetRetoucheClientInsight();
    return;
  }

  if (!getNetworkState().online || !isRemoteEntityId(idClient)) {
    retoucheClientInsight.value = null;
    retoucheClientInsightLoading.value = false;
    retoucheClientInsightError.value = OFFLINE_READ_MESSAGES.CLIENT_CONSULTATION;
    return;
  }
  retoucheClientInsightLoading.value = true;
  retoucheClientInsightError.value = "";

  try {
    const payload = await atelierApi.getClientConsultation(idClient, {
      source: "ALL",
      typeHabit: "ALL",
      periode: "ALL",
      size: CLIENT_INSIGHT_PREVIEW_SIZE,
      pageCommandes: 1,
      pageRetouches: 1,
      pageMesures: 1
    });
    if (retoucheClientInsightRequestId.value !== requestId) return;
    const normalized = normalizeClientConsultation(payload);
    retoucheClientInsight.value = buildClientInsight(normalized);
  } catch (err) {
    if (retoucheClientInsightRequestId.value !== requestId) return;
    retoucheClientInsight.value = null;
    retoucheClientInsightError.value = readableError(err);
  } finally {
    if (retoucheClientInsightRequestId.value === requestId) {
      retoucheClientInsightLoading.value = false;
    }
  }
}

watch(wizardClientSearchResults, (results) => {
  if (results.length === 0) {
    wizardClientSearchIndex.value = -1;
    return;
  }
  if (wizardClientSearchIndex.value < 0 || wizardClientSearchIndex.value >= results.length) {
    wizardClientSearchIndex.value = 0;
  }
});

watch(retoucheClientSearchResultsWizard, (results) => {
  if (results.length === 0) {
    retoucheClientSearchIndex.value = -1;
    return;
  }
  if (retoucheClientSearchIndex.value < 0 || retoucheClientSearchIndex.value >= results.length) {
    retoucheClientSearchIndex.value = 0;
  }
});

watch(
  () => wizard.mode,
  (mode) => {
    if (mode !== "existing") resetWizardClientInsight();
  }
);

watch(
  () => retoucheWizard.mode,
  (mode) => {
    if (mode !== "existing") resetRetoucheClientInsight();
  }
);

const stockArticleMap = computed(() => {
  const map = new Map();
  for (const article of stockArticles.value) {
    map.set(article.idArticle, article.nomArticle);
  }
  return map;
});

function stockArticleLabel(idArticle) {
  return stockArticleMap.value.get(idArticle) || idArticle || "-";
}

const currentTitle = computed(() => {
  if (currentRoute.value === "systemDashboard") return "Vue Globale";
  if (currentRoute.value === "systemAteliers") return "Ateliers";
  if (currentRoute.value === "systemNotifications") return "Notifications";
  if (currentRoute.value === "notifications") return "Notifications";
  if (currentRoute.value === "systemAtelierDetail") return "Detail Atelier";
  if (currentRoute.value === "dossier-detail") return "Detail Dossier";
  if (currentRoute.value === "commande-detail") return "Detail Commande";
  if (currentRoute.value === "retouche-detail") return "Detail Retouche";
  if (currentRoute.value === "vente-detail") return "Detail Vente";
  if (currentRoute.value === "facture-detail") return "Detail Facture";
  if (currentRoute.value === "forbidden") return "Acces refuse";
  if (currentRoute.value === "audit") {
    return auditRoutes.find((item) => item.path === auditSubRoute.value)?.title || "Historique & Audit";
  }
  return menuItems.value.find((item) => item.id === currentRoute.value)?.label || "Atelier";
});

const canOpenAtelierNotifications = computed(() => canAccessRoute("notifications"));

const currentAuditRoute = computed(() => {
  return auditRoutes.find((item) => item.path === auditSubRoute.value) || auditRoutes[0];
});

const systemAteliersPages = computed(() => Math.max(1, Math.ceil(systemAteliersTotal.value / systemAteliersPagination.pageSize)));
const systemAteliersFilteredCount = computed(() => Number(systemAteliersTotal.value || 0));
const systemAteliersStats = computed(() => ({
  total: Number(systemAteliersSummary.total || systemAteliers.value.length),
  actifs: Number(systemAteliersSummary.actifs || systemAteliers.value.filter((atelier) => atelier.actif).length),
  inactifs: Number(systemAteliersSummary.inactifs || systemAteliers.value.filter((atelier) => !atelier.actif).length),
  utilisateurs: Number(
    systemAteliersSummary.utilisateurs || systemAteliers.value.reduce((sum, atelier) => sum + Number(atelier.nombreUtilisateurs || 0), 0)
  )
}));

const detailSoldeRestant = computed(() => soldeRestant(detailCommande.value));
const canPayerDetail = computed(() => {
  if (!detailCommande.value) return false;
  if (detailCommandeActions.value && typeof detailCommandeActions.value.payer === "boolean") {
    return detailCommandeActions.value.payer;
  }
  if (detailCommande.value.statutCommande === "LIVREE" || detailCommande.value.statutCommande === "ANNULEE") return false;
  return detailSoldeRestant.value > 0;
});
const canLivrerDetail = computed(() => {
  if (!detailCommande.value) return false;
  if (detailCommandeActions.value && typeof detailCommandeActions.value.livrer === "boolean") {
    return detailCommandeActions.value.livrer;
  }
  return false;
});
const canTerminerDetail = computed(() => {
  if (!detailCommande.value) return false;
  if (detailCommandeActions.value && typeof detailCommandeActions.value.terminer === "boolean") {
    return detailCommandeActions.value.terminer;
  }
  return false;
});
const canAnnulerDetail = computed(() => {
  if (!detailCommande.value) return false;
  if (detailCommande.value.statutCommande === "TERMINEE") return false;
  if (detailCommandeActions.value && typeof detailCommandeActions.value.annuler === "boolean") {
    return detailCommandeActions.value.annuler;
  }
  return false;
});
const canEditCommandeDetail = computed(() => {
  if (!detailCommande.value) return false;
  const locallyEditable =
    Number(detailCommande.value.montantPaye || 0) === 0 &&
    detailCommande.value.statutCommande !== "LIVREE" &&
    detailCommande.value.statutCommande !== "ANNULEE";
  if (!locallyEditable) return false;
  if (detailCommandeActions.value && typeof detailCommandeActions.value.modifier === "boolean") {
    return detailCommandeActions.value.modifier;
  }
  return locallyEditable;
});
const canEmitCommandeDetailFacture = computed(() => Boolean(detailCommande.value && !detailCommandeFacture.value && detailCommande.value.statutCommande !== "ANNULEE"));
const ITEM_STATUS_SEQUENCE = Object.freeze(["CREEE", "EN_COURS", "TERMINEE", "LIVREE"]);

function resetReactiveRecord(target) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
}

function syncDetailItemStatuses(target, items = [], fallbackStatus = "") {
  const nextEntries = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.idItem || item?.id || "").trim();
    if (!id) continue;
    nextEntries.set(id, String(item?.statut || item?.statutCommande || item?.statutRetouche || fallbackStatus || "").trim());
  }
  for (const key of Object.keys(target)) {
    if (!nextEntries.has(key)) delete target[key];
  }
  for (const [key, value] of nextEntries.entries()) {
    target[key] = value;
  }
}

function resolveDetailItemStatus(target, item, fallbackStatus = "") {
  const id = String(item?.idItem || item?.id || "").trim();
  if (!id) return String(fallbackStatus || "").trim();
  return String(target[id] || item?.statut || item?.statutCommande || item?.statutRetouche || fallbackStatus || "").trim();
}

function resolveNextDetailItemStatus(currentStatus = "") {
  const normalized = String(currentStatus || "").trim().toUpperCase();
  if (!normalized || normalized === "ANNULEE" || normalized === "LIVREE") return null;
  const currentIndex = ITEM_STATUS_SEQUENCE.indexOf(normalized);
  if (currentIndex === -1) return "TERMINEE";
  if (normalized === "TERMINEE") return "LIVREE";
  return "TERMINEE";
}

function resolveDetailItemStatusLabel(currentStatus = "") {
  const nextStatus = resolveNextDetailItemStatus(currentStatus);
  if (!nextStatus) return "";
  if (nextStatus === "TERMINEE") return "Terminer";
  if (nextStatus === "LIVREE") return "Livrer";
  return "Changer statut";
}

function updateCommandeItemStatus(itemId = "") {
  const normalizedId = String(itemId || "").trim();
  if (!normalizedId) return;
  const currentStatus = String(detailCommandeItemStatuses[normalizedId] || "").trim();
  const nextStatus = resolveNextDetailItemStatus(currentStatus);
  if (!nextStatus) return;
  detailCommandeItemStatuses[normalizedId] = nextStatus;
}

function updateRetoucheItemStatus(itemId = "") {
  const normalizedId = String(itemId || "").trim();
  if (!normalizedId) return;
  const currentStatus = String(detailRetoucheItemStatuses[normalizedId] || "").trim();
  const nextStatus = resolveNextDetailItemStatus(currentStatus);
  if (!nextStatus) return;
  detailRetoucheItemStatuses[normalizedId] = nextStatus;
}

function buildItemPaymentBreakdown(items = [], totalPaid = 0) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const explicitPaidTotal = normalizedItems.reduce((sum, item) => sum + Math.max(0, Number(item?.montantPaye || 0)), 0);
  let remainingPaid = Math.max(0, Number(totalPaid || 0) - explicitPaidTotal);
  return normalizedItems.map((item) => {
    const montant = Math.max(0, Number(item?.prix || 0));
    const explicitPaid = Math.min(montant, Math.max(0, Number(item?.montantPaye || 0)));
    const implicitPaid = Math.min(Math.max(0, montant - explicitPaid), remainingPaid);
    const paye = explicitPaid + implicitPaid;
    remainingPaid = Math.max(0, remainingPaid - implicitPaid);
    return {
      montant,
      paye,
      reste: Math.max(0, montant - paye)
    };
  });
}

function normalizeUiToken(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const detailCommandeItemCards = computed(() => {
  const items = Array.isArray(detailCommande.value?.items) ? detailCommande.value.items : [];
  const breakdown = buildItemPaymentBreakdown(items, detailCommande.value?.montantPaye || 0);
  return items.map((item, index) => {
    const mesuresLines = formatMesuresLines(item?.mesures || null);
    const finance = breakdown[index] || { montant: Number(item?.prix || 0), paye: 0, reste: Number(item?.prix || 0) };
    const statut = resolveDetailItemStatus(detailCommandeItemStatuses, item, detailCommande.value?.statutCommande || "");
    return {
      id: item?.idItem || `detail-item-${index + 1}`,
      index: index + 1,
      title: item?.description || humanizeContactLabel(item?.typeHabit) || item?.typeHabit || `Habit ${index + 1}`,
      typeHabit: item?.typeHabit || "",
      statut,
      prix: finance.montant,
      montantPaye: finance.paye,
      reste: finance.reste,
      mesuresLines,
      mesuresCount: mesuresLines.length,
      canPay: canPayerDetail.value && finance.reste > 0,
      canEdit: canEditCommandeDetail.value,
      canAdvanceStatus: Boolean(resolveNextDetailItemStatus(statut)),
      statusActionLabel: resolveDetailItemStatusLabel(statut)
    };
  });
});
const detailCommandeStatusAction = computed(() => {
  if (canTerminerDetail.value) {
    return { label: "Terminer", handler: onTerminerDetail };
  }
  if (canLivrerDetail.value) {
    return { label: "Livrer", handler: onLivrerDetail };
  }
  if (canAnnulerDetail.value) {
    return { label: "Annuler", handler: onAnnulerDetail };
  }
  return null;
});
const commandeDetailPrimaryAction = computed(() => {
  if (canPayerDetail.value) {
    return {
      label: "Payer",
      subtitle: "Enregistrez rapidement un paiement sur cette commande.",
      tone: "green",
      handler: onPaiementDetail
    };
  }
  if (canLivrerDetail.value) {
    return {
      label: "Livrer",
      subtitle: "Marquez la commande comme livree depuis le detail.",
      tone: "blue",
      handler: onLivrerDetail
    };
  }
  if (canTerminerDetail.value) {
    return {
      label: "Terminer",
      subtitle: "Finalisez la commande pour preparer la livraison.",
      tone: "blue",
      handler: onTerminerDetail
    };
  }
  if (canEmitCommandeDetailFacture.value) {
    return {
      label: "Emettre facture",
      subtitle: "Generez la facture associee a cette commande.",
      tone: "blue",
      handler: onEmettreFactureCommandeDetail
    };
  }
  return null;
});

const detailRetoucheSoldeRestant = computed(() => soldeRestant(detailRetouche.value));
const canPayerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  if (detailRetoucheActions.value && typeof detailRetoucheActions.value.payer === "boolean") {
    return detailRetoucheActions.value.payer;
  }
  if (detailRetouche.value.statutRetouche === "LIVREE" || detailRetouche.value.statutRetouche === "ANNULEE") return false;
  return detailRetoucheSoldeRestant.value > 0;
});
const canLivrerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  if (detailRetoucheActions.value && typeof detailRetoucheActions.value.livrer === "boolean") {
    return detailRetoucheActions.value.livrer;
  }
  return false;
});
const canTerminerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  if (detailRetoucheActions.value && typeof detailRetoucheActions.value.terminer === "boolean") {
    return detailRetoucheActions.value.terminer;
  }
  return false;
});
const canAnnulerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  if (detailRetouche.value.statutRetouche === "TERMINEE") return false;
  if (detailRetoucheActions.value && typeof detailRetoucheActions.value.annuler === "boolean") {
    return detailRetoucheActions.value.annuler;
  }
  return false;
});
const canEditRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  const locallyEditable =
    Number(detailRetouche.value.montantPaye || 0) === 0 &&
    detailRetouche.value.statutRetouche !== "LIVREE" &&
    detailRetouche.value.statutRetouche !== "ANNULEE";
  if (!locallyEditable) return false;
  if (detailRetoucheActions.value && typeof detailRetoucheActions.value.modifier === "boolean") {
    return detailRetoucheActions.value.modifier;
  }
  return locallyEditable;
});
const canEmitRetoucheDetailFacture = computed(() => Boolean(detailRetouche.value && !detailRetoucheFacture.value && detailRetouche.value.statutRetouche !== "ANNULEE"));
const detailRetoucheItemCards = computed(() => {
  const items = Array.isArray(detailRetouche.value?.items) ? detailRetouche.value.items : [];
  const breakdown = buildItemPaymentBreakdown(items, detailRetouche.value?.montantPaye || 0);
  return items.map((item, index) => {
    const mesuresLines = formatMesuresLines(item?.mesures);
    const finance = breakdown[index] || { montant: Number(item?.prix || 0), paye: 0, reste: Number(item?.prix || 0) };
    const statut = resolveDetailItemStatus(detailRetoucheItemStatuses, item, detailRetouche.value?.statutRetouche || "");
    return {
      id: item?.idItem || `retouche-item-${index + 1}`,
      index: index + 1,
      title: item?.description || humanizeContactLabel(item?.typeRetouche) || item?.typeRetouche || `Intervention ${index + 1}`,
      typeRetouche: item?.typeRetouche || "",
      typeHabit: item?.typeHabit || detailRetouche.value?.typeHabit || "",
      statut,
      prix: finance.montant,
      montantPaye: finance.paye,
      reste: finance.reste,
      mesuresLines,
      mesuresCount: mesuresLines.length,
      canPay: canPayerRetoucheDetail.value && finance.reste > 0,
      canEdit: canEditRetoucheDetail.value,
      canAdvanceStatus: Boolean(resolveNextDetailItemStatus(statut)),
      statusActionLabel: resolveDetailItemStatusLabel(statut)
    };
  });
});
const detailRetoucheStatusAction = computed(() => {
  if (canTerminerRetoucheDetail.value) {
    return { label: "Terminer", handler: onTerminerRetoucheDetail };
  }
  if (canLivrerRetoucheDetail.value) {
    return { label: "Livrer", handler: onLivrerRetoucheDetail };
  }
  if (canAnnulerRetoucheDetail.value) {
    return { label: "Annuler", handler: onAnnulerRetoucheDetail };
  }
  return null;
});
const retoucheDetailPrimaryAction = computed(() => {
  if (canPayerRetoucheDetail.value) {
    return {
      label: "Payer",
      subtitle: "Enregistrez rapidement un paiement sur cette retouche.",
      tone: "green",
      handler: onPaiementRetoucheDetail
    };
  }
  if (canLivrerRetoucheDetail.value) {
    return {
      label: "Livrer",
      subtitle: "Marquez la retouche comme livree depuis le detail.",
      tone: "blue",
      handler: onLivrerRetoucheDetail
    };
  }
  if (canTerminerRetoucheDetail.value) {
    return {
      label: "Terminer",
      subtitle: "Finalisez la retouche avant la livraison.",
      tone: "blue",
      handler: onTerminerRetoucheDetail
    };
  }
  if (canEmitRetoucheDetailFacture.value) {
    return {
      label: "Emettre facture",
      subtitle: "Generez la facture associee a cette retouche.",
      tone: "blue",
      handler: onEmettreFactureRetoucheDetail
    };
  }
  return null;
});

const detailCommandeFacture = computed(() => {
  const id = detailCommande.value?.idCommande;
  if (!id) return null;
  return findFactureByOrigine("COMMANDE", id);
});

const detailRetoucheFacture = computed(() => {
  const id = detailRetouche.value?.idRetouche;
  if (!id) return null;
  return findFactureByOrigine("RETOUCHE", id);
});

const factureDetailPrimaryAction = computed(() => {
  if (!detailFacture.value) return null;
  return {
    label: isMobileViewport.value ? "Telecharger" : "Generer PDF",
    subtitle: isMobileViewport.value
      ? "Telechargez le document de la facture pour l'ouvrir depuis votre telephone."
      : "Creez un PDF propre de la facture depuis ce detail.",
    tone: "blue",
    handler: () => onGenererPdfFacture(detailFacture.value)
  };
});

const detailVenteFacture = computed(() => {
  const id = detailVente.value?.idVente;
  if (!id) return null;
  return findFactureByOrigine("VENTE", id);
});
const detailCommandeView = computed(() => ({
  idCommande: detailCommande.value?.idCommande || "",
  idClient: detailCommande.value?.idClient || "",
  clientNom: detailCommande.value?.clientNom || "",
  descriptionCommande: detailCommande.value?.descriptionCommande || "",
  statutCommande: detailCommande.value?.statutCommande || "",
  dateCreation: detailCommande.value?.dateCreation || "",
  datePrevue: detailCommande.value?.datePrevue || "",
  typeHabit: detailCommande.value?.typeHabit || "",
  montantTotal: Number(detailCommande.value?.montantTotal || 0),
  montantPaye: Number(detailCommande.value?.montantPaye || 0),
  nombreBeneficiaires: Number(detailCommande.value?.nombreBeneficiaires || 0),
  nombreLignes: Number(detailCommande.value?.nombreLignes || 0),
  items: Array.isArray(detailCommande.value?.items) ? detailCommande.value.items : []
}));
const detailRetoucheView = computed(() => ({
  idRetouche: detailRetouche.value?.idRetouche || "",
  idClient: detailRetouche.value?.idClient || "",
  clientNom: detailRetouche.value?.clientNom || "",
  typeRetouche: detailRetouche.value?.typeRetouche || "",
  descriptionRetouche: detailRetouche.value?.descriptionRetouche || "",
  statutRetouche: detailRetouche.value?.statutRetouche || "",
  dateDepot: detailRetouche.value?.dateDepot || "",
  datePrevue: detailRetouche.value?.datePrevue || "",
  typeHabit: detailRetouche.value?.typeHabit || "",
  montantTotal: Number(detailRetouche.value?.montantTotal || 0),
  montantPaye: Number(detailRetouche.value?.montantPaye || 0),
  items: Array.isArray(detailRetouche.value?.items) ? detailRetouche.value.items : []
}));
const venteDetailPrimaryAction = computed(() => {
  if (!detailVente.value) return null;
  if (detailVente.value.statut === "BROUILLON") {
    return {
      label: "Valider",
      subtitle: caisseOuverte.value
        ? "Validez la vente pour finaliser l'encaissement."
        : "La caisse doit etre ouverte pour valider la vente.",
      tone: "blue",
      disabled: !caisseOuverte.value,
      handler: () => onValiderVente(detailVente.value)
    };
  }
  if (detailVente.value.statut === "VALIDEE" && !detailVenteFacture.value) {
    return {
      label: "Emettre facture",
      subtitle: "Generez la facture associee a cette vente validee.",
      tone: "blue",
      disabled: false,
      handler: onEmettreFactureVenteDetail
    };
  }
  return null;
});

const commandesView = computed(() =>
  commandes.value.map((commande) => {
    const nomClient = commande.clientNom || clientMap.value.get(commande.idClient) || commande.idClient;
    return {
      ...commande,
      clientNom: nomClient,
      montantTotal: Number(commande.montantTotal || 0),
      montantPaye: Number(commande.montantPaye || 0),
      soldeRestant: Math.max(0, Number(commande.montantTotal || 0) - Number(commande.montantPaye || 0))
    };
  })
);

const retouchesView = computed(() =>
  retouches.value.map((retouche) => {
    const nomClient = retouche.clientNom || clientMap.value.get(retouche.idClient) || retouche.idClient;
    return {
      ...retouche,
      clientNom: nomClient,
      montantTotal: Number(retouche.montantTotal || 0),
      montantPaye: Number(retouche.montantPaye || 0),
      soldeRestant: Math.max(0, Number(retouche.montantTotal || 0) - Number(retouche.montantPaye || 0))
    };
  })
);

const ventesView = computed(() =>
  ventes.value.map((vente) => ({
    ...vente,
    total: Number(vente.total || 0)
  }))
);
const ventesPaged = computed(() => ventesView.value.slice(0, ventesVisibleCount.value));
const ventesInfiniteEndReached = computed(() => ventesView.value.length > 0 && ventesPaged.value.length >= ventesView.value.length);

const facturesView = computed(() =>
  factures.value.map((facture) => ({
    ...facture,
    montantTotal: Number(facture.montantTotal || 0),
    montantPaye: Number(facture.montantPaye || 0),
    solde: Number(facture.solde || 0)
  }))
);

const factureStatusOptions = computed(() => {
  const dynamic = Array.from(new Set(facturesView.value.map((row) => row.statut).filter(Boolean)));
  const ordered = ["BROUILLON", "VALIDEE", "ANNULEE"];
  const merged = ordered.filter((status) => dynamic.includes(status));
  const rest = dynamic.filter((status) => !ordered.includes(status));
  return ["ALL", ...merged, ...rest];
});

const facturesFiltered = computed(() => {
  return facturesView.value.filter((facture) => {
    if (factureFilters.statut !== "ALL" && facture.statut !== factureFilters.statut) return false;
    if (factureFilters.source !== "ALL" && facture.typeOrigine !== factureFilters.source) return false;
    if (factureFilters.soldeRestant === "DUE" && Number(facture.solde || 0) === 0) return false;
    if (factureFilters.soldeRestant === "PAID" && Number(facture.solde || 0) > 0) return false;

    const query = factureFilters.recherche.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${facture.numeroFacture || ""} ${facture.client?.nom || ""} ${facture.typeOrigine || ""} ${facture.idOrigine || ""} ${facture.statut || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});

const facturesPaged = computed(() => facturesFiltered.value.slice(0, facturesVisibleCount.value));
const facturesInfiniteEndReached = computed(() => facturesFiltered.value.length > 0 && facturesPaged.value.length >= facturesFiltered.value.length);

const facturesKpi = computed(() => ({
  total: facturesFiltered.value.length,
  reglees: facturesFiltered.value.filter((row) => Number(row.solde || 0) === 0).length,
  enAttente: facturesFiltered.value.filter((row) => Number(row.solde || 0) > 0).length,
  montantTotal: facturesFiltered.value.reduce((sum, row) => sum + Number(row.montantTotal || 0), 0)
}));
const factureFilterSummary = computed(() => {
  const summary = [];
  if (factureFilters.statut !== "ALL") summary.push(`Statut: ${factureFilters.statut}`);
  if (factureFilters.source !== "ALL") summary.push(`Origine: ${factureFilters.source}`);
  if (factureFilters.soldeRestant !== "ALL") {
    summary.push(soldeOptions.find((option) => option.value === factureFilters.soldeRestant)?.label || "Solde filtre");
  }
  if (factureFilters.recherche.trim()) summary.push("Recherche active");
  return summary.length > 0 ? summary.join(" · ") : "Aucun filtre applique";
});
const facturesMobileKpiCards = computed(() => [
  {
    label: "Total",
    value: facturesKpi.value.total,
    tone: "blue"
  },
  {
    label: "Reglees",
    value: facturesKpi.value.reglees,
    tone: "green"
  },
  {
    label: "En attente",
    value: facturesKpi.value.enAttente,
    tone: "amber"
  },
  {
    label: "Montant total",
    value: formatFactureCurrency(facturesKpi.value.montantTotal),
    tone: "slate"
  }
]);
const auditUtilisateursActions = computed(() => {
  const dynamic = Array.from(new Set(auditUtilisateurs.value.map((row) => String(row.actionType || "").toUpperCase()).filter(Boolean)));
  return ["ALL", ...dynamic];
});
const auditUtilisateursFiltered = computed(() => {
  const query = auditUtilisateursFiltres.recherche.trim().toLowerCase();
  return auditUtilisateurs.value.filter((row) => {
    if (auditUtilisateursFiltres.action !== "ALL" && String(row.actionType || "").toUpperCase() !== auditUtilisateursFiltres.action) return false;
    if (auditUtilisateursFiltres.statut === "SUCCES" && !row.success) return false;
    if (auditUtilisateursFiltres.statut === "ECHEC" && row.success) return false;
    if (!query) return true;
    const haystack = [
      row.atelierId,
      row.userId,
      row.userName,
      row.userEmail,
      formatRoleLabel(row.role),
      row.actionType,
      formatAuditAction(row),
      row.entityType,
      formatAuditEntity(row),
      row.reason,
      JSON.stringify(row.metadata || {})
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});
const auditUtilisateursPages = computed(() => Math.max(1, Math.ceil(auditUtilisateursFiltered.value.length / auditUtilisateursPagination.pageSize)));
const auditUtilisateursPaged = computed(() => {
  const page = Math.min(Math.max(1, auditUtilisateursPagination.page), auditUtilisateursPages.value);
  const start = (page - 1) * auditUtilisateursPagination.pageSize;
  return auditUtilisateursFiltered.value.slice(start, start + auditUtilisateursPagination.pageSize);
});
const auditUtilisateursFilterSummary = computed(() => {
  const summary = [];
  if (auditUtilisateursFiltres.recherche.trim()) summary.push("Recherche active");
  if (auditUtilisateursFiltres.action !== "ALL") {
    summary.push(formatAuditAction({ actionType: auditUtilisateursFiltres.action, entityId: "", metadata: null }));
  }
  if (auditUtilisateursFiltres.statut === "SUCCES") summary.push("Succes");
  if (auditUtilisateursFiltres.statut === "ECHEC") summary.push("Echec");
  return summary.length > 0 ? summary.join(" · ") : "Aucun filtre applique";
});

const facturesOriginesSet = computed(() => {
  const set = new Set();
  for (const facture of facturesView.value) {
    set.add(`${facture.typeOrigine}:${facture.idOrigine}`);
  }
  return set;
});

const facturesCandidates = computed(() => {
  const used = facturesOriginesSet.value;
  if (factureEmission.typeOrigine === "COMMANDE") {
    return commandesView.value
      .filter((c) => !used.has(`COMMANDE:${c.idCommande}`))
      .map((c) => ({
        id: c.idCommande,
        title: `${c.idCommande} - ${c.clientNom || c.idClient}`,
        subtitle: `Montant: ${formatCurrency(c.montantTotal)} | Statut: ${c.statutCommande}`
      }));
  }
  if (factureEmission.typeOrigine === "RETOUCHE") {
    return retouchesView.value
      .filter((r) => !used.has(`RETOUCHE:${r.idRetouche}`))
      .map((r) => ({
        id: r.idRetouche,
        title: `${r.idRetouche} - ${r.clientNom || r.idClient}`,
        subtitle: `Montant: ${formatCurrency(r.montantTotal)} | Statut: ${r.statutRetouche}`
      }));
  }
  return ventesView.value
    .filter((v) => !used.has(`VENTE:${v.idVente}`))
    .map((v) => ({
      id: v.idVente,
      title: `${v.idVente}`,
      subtitle: `Total: ${formatCurrency(v.total)} | Statut: ${v.statut}`
    }));
});

const clientConsultationClient = computed(() => clientConsultation.value?.client || null);
const clientConsultationSynthese = computed(() => clientConsultation.value?.synthese || null);
const clientConsultationCommandes = computed(() => clientConsultation.value?.historique?.commandes || []);
const clientConsultationRetouches = computed(() => clientConsultation.value?.historique?.retouches || []);
const clientConsultationMesures = computed(() => clientConsultation.value?.historique?.mesures || []);
const clientConsultationPagination = computed(() => clientConsultation.value?.historique?.pagination || {});
const clientConsultationResultats = computed(
  () =>
    clientConsultation.value?.historique?.resultats || {
      commandes: clientConsultationCommandes.value.length,
      retouches: clientConsultationRetouches.value.length,
      mesures: clientConsultationMesures.value.length
    }
);

const clientTypeHabitOptions = computed(() => {
  const set = new Set(availableHabitTypeOptions.value.map((item) => item.value));
  for (const row of clientConsultationCommandes.value) if (row.typeHabit) set.add(row.typeHabit);
  for (const row of clientConsultationRetouches.value) if (row.typeHabit) set.add(row.typeHabit);
  for (const row of clientConsultationMesures.value) if (row.typeHabit) set.add(row.typeHabit);
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
});

const clientConsultationClientOptions = computed(() => {
  const query = clientConsultationQuery.value.trim().toLowerCase();
  if (!query) return clients.value;
  return clients.value.filter((client) => {
    const haystack = `${client.idClient || ""} ${client.nom || ""} ${client.prenom || ""} ${client.telephone || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});

const clientHistoryFilterSummary = computed(() => {
  const summary = [];
  if (clientHistoryFilters.source !== "ALL") {
    summary.push(clientHistoryFilters.source === "COMMANDE" ? "Commandes" : "Retouches");
  }
  if (clientHistoryFilters.typeHabit !== "ALL") summary.push(clientHistoryFilters.typeHabit);
  if (clientHistoryFilters.periode !== "ALL") {
    summary.push(
      {
        "30J": "30 derniers jours",
        "90J": "90 derniers jours",
        "365J": "12 derniers mois"
      }[clientHistoryFilters.periode] || "Periode filtree"
    );
  }
  summary.push(`${clientPagination.pageSize} / page`);
  return summary.join(" · ");
});

function loadClientConsultationSectionPreference() {
  try {
    const raw = window.localStorage.getItem(CLIENT_CONSULT_SECTION_KEY);
    if (raw === "commandes" || raw === "retouches" || raw === "mesures") {
      clientConsultationSection.value = raw;
    }
  } catch (err) {
    console.warn("Failed to load clients consultation section preference", err);
  }
}

const clientFilteredCommandes = computed(() => clientConsultationCommandes.value);

const clientFilteredRetouches = computed(() => clientConsultationRetouches.value);

const clientFilteredMesures = computed(() => clientConsultationMesures.value);

const clientCommandesPages = computed(() => Math.max(1, Number(clientConsultationPagination.value.commandes?.totalPages || 1)));
const clientRetouchesPages = computed(() => Math.max(1, Number(clientConsultationPagination.value.retouches?.totalPages || 1)));
const clientMesuresPages = computed(() => Math.max(1, Number(clientConsultationPagination.value.mesures?.totalPages || 1)));

const clientCommandesPaged = computed(() => clientFilteredCommandes.value);
const clientRetouchesPaged = computed(() => clientFilteredRetouches.value);
const clientMesuresPaged = computed(() => clientFilteredMesures.value);

const atelierContactRuntimeSource = computed(() => {
  if (atelierRuntimeSettingsReady.value) return atelierRuntimeSettings;
  return atelierSettings;
});

const atelierContactConfig = computed(() => atelierContactRuntimeSource.value?.contactClient || atelierSettingsDefault.contactClient);

const atelierContactSignature = computed(() => {
  const parts = [];
  const identite = atelierContactRuntimeSource.value?.identite || atelierSettings.identite || {};
  const nomAtelier = String(identite.nomAtelier || "").trim();
  const telephone = String(identite.telephone || "").trim();
  if (nomAtelier) parts.push(nomAtelier);
  if (telephone) parts.push(telephone);
  return parts.join(" - ");
});

function formatContactGreeting(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? `Bonjour ${trimmed},` : "Bonjour,";
}

function buildContactTemplates(items = []) {
  return items
    .filter((item) => item && String(item.key || "").trim() && String(item.label || "").trim() && String(item.message || "").trim())
    .map((item) => ({
      key: String(item.key).trim(),
      label: String(item.label).trim(),
      message: String(item.message).trim()
    }));
}

function renderContactTemplate(template, variables = {}) {
  const source = String(template || "").trim();
  if (!source) return "";
  const rendered = source.replace(/\{(\w+)\}/g, (_, key) => String(variables?.[key] ?? ""));
  return rendered.replace(/\n{3,}/g, "\n\n").trim();
}

function resolveConfiguredContactTemplate(key) {
  const configured = String(atelierContactConfig.value?.templates?.[key] || "").trim();
  if (configured) return configured;
  return String(atelierSettingsDefault.contactClient?.templates?.[key] || "").trim();
}

function buildContactVariables({ nomClient = "", reference = "", montantRestant = "", signature = "" } = {}) {
  return {
    salutation: formatContactGreeting(nomClient),
    clientNom: String(nomClient || "").trim(),
    reference: String(reference || "").trim(),
    montantRestant: String(montantRestant || "").trim(),
    signature: signature && atelierContactConfig.value?.signatureAuto !== false ? signature : "",
    atelierNom: String(atelierContactRuntimeSource.value?.identite?.nomAtelier || atelierSettings.identite?.nomAtelier || "").trim(),
    atelierTelephone: String(atelierContactRuntimeSource.value?.identite?.telephone || atelierSettings.identite?.telephone || "").trim()
  };
}

function humanizeContactLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/[a-zàâçéèêëîïôûùüÿñæœ]/.test(text)) return text.trim();
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
}

function resolveContactTemplateKey(templates, selectedKey) {
  if (!Array.isArray(templates) || templates.length === 0) return "";
  const key = String(selectedKey || "").trim();
  if (key && templates.some((template) => template.key === key)) return key;
  return templates[0].key;
}

function resolveContactMessagePreview(templates, selectedKey) {
  const key = resolveContactTemplateKey(templates, selectedKey);
  return templates.find((template) => template.key === key)?.message || "";
}

function normalizeDialTelephone(value) {
  return String(value || "")
    .trim()
    .replace(/(?!^\+)[^\d]/g, "")
    .replace(/^\+{2,}/, "+");
}

function normalizeWhatsAppTelephone(value) {
  let digits = String(value || "").trim();
  if (!digits) return "";
  digits = digits.replace(/\s+/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("243")) return digits;
  if (digits.length === 10 && digits.startsWith("0")) return `243${digits.slice(1)}`;
  return digits;
}

function buildPhoneDialHref(telephone) {
  const normalized = normalizeDialTelephone(telephone);
  return normalized ? `tel:${normalized}` : "";
}

function buildWhatsAppWebHref(telephone, message = "") {
  const normalized = normalizeWhatsAppTelephone(telephone);
  if (!normalized) return "";
  const text = String(message || "").trim();
  return text
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${normalized}`;
}

function buildWhatsAppAppHref(telephone, message = "") {
  const normalized = normalizeWhatsAppTelephone(telephone);
  if (!normalized) return "";
  const text = String(message || "").trim();
  return text
    ? `whatsapp://send?phone=${normalized}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?phone=${normalized}`;
}

function buildPreferredWhatsAppHref(telephone, message = "") {
  return isMobileViewport.value
    ? buildWhatsAppAppHref(telephone, message)
    : buildWhatsAppWebHref(telephone, message);
}

async function copyTextToClipboard(text, successMessage = "Copie terminee.") {
  const value = String(text || "").trim();
  if (!value) {
    notify("Aucune donnee a copier.");
    return;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!copied) throw new Error("copy_failed");
    }
    notify(successMessage);
  } catch (err) {
    notify("Copie impossible sur cet appareil.");
  }
}

function normalizeClientContactEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    idContact: String(raw.idContact || raw.id_contact || "").trim(),
    canal: String(raw.canal || "").trim().toUpperCase(),
    modeleKey: String(raw.modeleKey || raw.modele_key || "").trim(),
    statut: String(raw.statut || "A_RELANCER").trim().toUpperCase(),
    note: String(raw.note || "").trim(),
    utilisateur: String(raw.utilisateur || "").trim(),
    dateContact: raw.dateContact || raw.date_contact || "",
    origineType: String(raw.origineType || raw.origine_type || "").trim().toUpperCase(),
    origineId: String(raw.origineId || raw.origine_id || "").trim()
  };
}

function resetContactFollowUpState(state) {
  if (!state) return;
  state.loading = false;
  state.saving = false;
  state.lastContact = null;
  state.status = "A_RELANCER";
  state.note = "";
}

function applyContactFollowUpSummary(state, payload) {
  const lastContact = normalizeClientContactEntry(payload?.suivi?.dernierContact || null);
  state.lastContact = lastContact;
  state.status = lastContact?.statut || "A_RELANCER";
  state.note = lastContact?.note || "";
}

function formatContactChannelLabel(value) {
  const key = String(value || "").trim().toUpperCase();
  if (key === "CALL") return "Appel";
  if (key === "WHATSAPP") return "WhatsApp";
  if (key === "COPY_NUMBER") return "Copie numero";
  if (key === "COPY_MESSAGE") return "Copie message";
  if (key === "NOTE") return "Suivi manuel";
  return "Suivi";
}

function buildLastContactSummary(entry) {
  if (!entry) return "";
  const parts = [
    formatContactChannelLabel(entry.canal),
    contactFollowUpStatusLabels[entry.statut] || entry.statut || "A relancer"
  ];
  if (entry.dateContact) parts.push(formatDateTime(entry.dateContact));
  if (entry.utilisateur) parts.push(entry.utilisateur);
  return parts.filter(Boolean).join(" · ");
}

async function loadClientContactSummaryIntoState(state, idClient) {
  resetContactFollowUpState(state);
  const clientId = String(idClient || "").trim();
  if (!clientId || !getNetworkState().online || !isRemoteEntityId(clientId)) return;
  state.loading = true;
  try {
    const payload = await atelierApi.getClientContactSummary(clientId);
    applyContactFollowUpSummary(state, payload);
  } catch (err) {
    state.lastContact = null;
  } finally {
    state.loading = false;
  }
}

async function saveClientContactFollowUp({
  state,
  idClient,
  canal = "NOTE",
  modeleKey = "",
  statut = "A_RELANCER",
  note = "",
  origineType = null,
  origineId = null,
  utilisateur = "",
  quiet = false
} = {}) {
  const clientId = String(idClient || "").trim();
  if (!state || !clientId || !getNetworkState().online || !isRemoteEntityId(clientId)) {
    if (!quiet) notify("Suivi client indisponible hors ligne.");
    return false;
  }

  if (!quiet) state.saving = true;
  try {
    const payload = await atelierApi.createClientContactEntry(clientId, {
      canal,
      modeleKey: modeleKey || null,
      statut,
      note,
      origineType,
      origineId,
      utilisateur: utilisateur || authUser.value?.nom || authUser.value?.email || ""
    });
    applyContactFollowUpSummary(state, payload);
    if (!quiet) notify("Suivi client enregistre.");
    return true;
  } catch (err) {
    if (!quiet) notify(readableError(err));
    return false;
  } finally {
    state.saving = false;
  }
}

async function trackClientContactAction({
  state,
  profile,
  canal,
  modeleKey = "",
  origineType = null,
  origineId = null
} = {}) {
  const clientId = String(profile?.idClient || "").trim();
  if (!clientId) return;
  await saveClientContactFollowUp({
    state,
    idClient: clientId,
    canal,
    modeleKey,
    statut: state?.status || "A_RELANCER",
    note: state?.note || "",
    origineType,
    origineId,
    quiet: true
  });
}

const detailCommandeContactProfile = computed(() => {
  if (!detailCommande.value) return null;
  const directoryEntry = clientDirectory.value.get(detailCommande.value.idClient) || {};
  const habitLabel = wizardAvailableHabitTypeOptions.value.find(
    (option) => String(option.value || "").trim().toUpperCase() === String(detailCommande.value.typeHabit || "").trim().toUpperCase()
  )?.label || humanizeContactLabel(detailCommande.value.typeHabit);
  return {
    idClient: String(detailCommande.value.idClient || "").trim(),
    nomClient: String(detailCommande.value.clientNom || directoryEntry.nomComplet || "").trim(),
    telephone: String(directoryEntry.telephone || "").trim(),
    originId: String(detailCommande.value.idCommande || "").trim(),
    reference: habitLabel ? `de ${habitLabel.toLowerCase()}` : "en cours",
    soldeRestant: Number(detailSoldeRestant.value || 0)
  };
});

const detailCommandeContactTemplates = computed(() => {
  const profile = detailCommandeContactProfile.value;
  if (!profile) return [];
  const variables = buildContactVariables({
    nomClient: profile.nomClient,
    reference: profile.reference || "commande",
    montantRestant: formatCurrency(profile.soldeRestant),
    signature: atelierContactSignature.value
  });
  return buildContactTemplates([
    {
      key: "commande-prete",
      label: "Commande prete",
      message: renderContactTemplate(resolveConfiguredContactTemplate("commandePrete"), variables)
    },
    {
      key: "commande-suivi",
      label: "Commande en cours",
      message: renderContactTemplate(resolveConfiguredContactTemplate("commandeSuivi"), variables)
    },
    {
      key: "commande-solde",
      label: "Rappel solde",
      message: renderContactTemplate(resolveConfiguredContactTemplate("commandeSolde"), variables)
    },
    {
      key: "commande-retard",
      label: "Nouveau delai",
      message: renderContactTemplate(resolveConfiguredContactTemplate("commandeRetard"), variables)
    }
  ]);
});

const detailCommandeContactSelectedTemplateKey = computed(() =>
  resolveContactTemplateKey(detailCommandeContactTemplates.value, detailCommandeContactTemplateKey.value)
);
const detailCommandeContactMessagePreview = computed(() =>
  resolveContactMessagePreview(detailCommandeContactTemplates.value, detailCommandeContactSelectedTemplateKey.value)
);

const detailRetoucheContactProfile = computed(() => {
  if (!detailRetouche.value) return null;
  const directoryEntry = clientDirectory.value.get(detailRetouche.value.idClient) || {};
  const retoucheLabel =
    availableRetoucheTypeDefinitions.value.find(
      (row) => String(row.code || "").trim().toUpperCase() === String(detailRetouche.value.typeRetouche || "").trim().toUpperCase()
    )?.libelle || humanizeContactLabel(detailRetouche.value.typeRetouche);
  const habitLabel = wizardAvailableHabitTypeOptions.value.find(
    (option) => String(option.value || "").trim().toUpperCase() === String(detailRetouche.value.typeHabit || "").trim().toUpperCase()
  )?.label || humanizeContactLabel(detailRetouche.value.typeHabit);
  return {
    idClient: String(detailRetouche.value.idClient || "").trim(),
    nomClient: String(detailRetouche.value.clientNom || directoryEntry.nomComplet || "").trim(),
    telephone: String(directoryEntry.telephone || "").trim(),
    originId: String(detailRetouche.value.idRetouche || "").trim(),
    reference:
      retoucheLabel && habitLabel
        ? `${retoucheLabel.toLowerCase()} sur ${habitLabel.toLowerCase()}`
        : retoucheLabel
          ? retoucheLabel.toLowerCase()
          : habitLabel
            ? `sur ${habitLabel.toLowerCase()}`
            : "en cours",
    soldeRestant: Number(detailRetoucheSoldeRestant.value || 0)
  };
});

const detailRetoucheContactTemplates = computed(() => {
  const profile = detailRetoucheContactProfile.value;
  if (!profile) return [];
  const variables = buildContactVariables({
    nomClient: profile.nomClient,
    reference: profile.reference || "retouche",
    montantRestant: formatCurrency(profile.soldeRestant),
    signature: atelierContactSignature.value
  });
  return buildContactTemplates([
    {
      key: "retouche-prete",
      label: "Retouche prete",
      message: renderContactTemplate(resolveConfiguredContactTemplate("retouchePrete"), variables)
    },
    {
      key: "retouche-suivi",
      label: "Retouche en cours",
      message: renderContactTemplate(resolveConfiguredContactTemplate("retoucheSuivi"), variables)
    },
    {
      key: "retouche-solde",
      label: "Rappel solde",
      message: renderContactTemplate(resolveConfiguredContactTemplate("retoucheSolde"), variables)
    },
    {
      key: "retouche-delai",
      label: "Date prevue",
      message: renderContactTemplate(resolveConfiguredContactTemplate("retoucheDelai"), variables)
    }
  ]);
});

const detailRetoucheContactSelectedTemplateKey = computed(() =>
  resolveContactTemplateKey(detailRetoucheContactTemplates.value, detailRetoucheContactTemplateKey.value)
);
const detailRetoucheContactMessagePreview = computed(() =>
  resolveContactMessagePreview(detailRetoucheContactTemplates.value, detailRetoucheContactSelectedTemplateKey.value)
);

const detailCommandeMediaByItemId = computed(() => {
  const map = new Map();
  const cards = Array.isArray(detailCommandeItemCards.value) ? detailCommandeItemCards.value : [];
  const medias = Array.isArray(detailCommandeMedia.value) ? detailCommandeMedia.value : [];
  const singleItemId = cards.length === 1 ? String(cards[0]?.id || "").trim() : "";
  for (const card of cards) {
    map.set(String(card.id || "").trim(), []);
  }
  for (const media of medias) {
    const explicitItemId = String(media?.idItem || "").trim();
    if (explicitItemId && map.has(explicitItemId)) {
      map.get(explicitItemId)?.push(media);
      continue;
    }
    if (singleItemId) {
      map.get(singleItemId)?.push(media);
      continue;
    }
    const haystack = normalizeUiToken([media?.note, media?.nomFichierOriginal, media?.sourceType].filter(Boolean).join(" "));
    const match = cards.find((card) => {
      const titleToken = normalizeUiToken(card.title);
      const habitToken = normalizeUiToken(card.typeHabit);
      const idToken = normalizeUiToken(card.id);
      return Boolean(
        (titleToken && haystack.includes(titleToken)) ||
        (habitToken && haystack.includes(habitToken)) ||
        (idToken && haystack.includes(idToken))
      );
    });
    if (match) {
      map.get(String(match.id || "").trim())?.push(media);
    }
  }
  return map;
});

const commandeItemPhotoDialogItems = computed(() => {
  const itemId = String(commandeItemPhotoDialog.itemId || "").trim();
  return itemId ? detailCommandeMediaByItemId.value.get(itemId) || [] : [];
});

function getCommandeMediaRowsForItem(itemId = "") {
  const normalizedId = String(itemId || "").trim();
  return normalizedId ? detailCommandeMediaByItemId.value.get(normalizedId) || [] : [];
}

function openCommandeItemPhotoDialog(item) {
  if (!item?.id) return;
  commandeItemPhotoDialog.open = true;
  commandeItemPhotoDialog.itemId = String(item.id || "").trim();
  commandeItemPhotoDialog.title = item.title || "Photos";
}

function closeCommandeItemPhotoDialog() {
  commandeItemPhotoDialog.open = false;
  commandeItemPhotoDialog.itemId = "";
  commandeItemPhotoDialog.title = "";
}

function onCommandeDetailStatusChange() {
  detailCommandeStatusAction.value?.handler?.();
}

function onRetoucheDetailStatusChange() {
  detailRetoucheStatusAction.value?.handler?.();
}

function openClientConsultationFromDetail(idClient = "") {
  const targetId = String(idClient || "").trim();
  if (!targetId) return;
  selectedClientConsultationId.value = targetId;
  openRoute("clientsMesures");
}

function focusDetailItemSection(kind = "commande") {
  nextTick(() => {
    if (typeof document === "undefined") return;
    const selector = kind === "retouche" ? ".retouche-detail .detail-items-shell" : ".commande-detail .detail-items-shell";
    const element = document.querySelector(selector);
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function resetDetailItemEditModal() {
  detailItemEditModal.open = false;
  detailItemEditModal.kind = "";
  detailItemEditModal.parentId = "";
  detailItemEditModal.itemId = "";
  detailItemEditModal.title = "";
  detailItemEditModal.subtitle = "";
  detailItemEditModal.description = "";
  detailItemEditModal.prix = "";
  detailItemEditModal.mesures = {};
  detailItemEditModal.fields = [];
  detailItemEditModal.submitting = false;
  detailItemEditModal.error = "";
}

function openCommandeItemEditModal(card) {
  if (!card?.id || !detailCommande.value?.idCommande || !canEditCommandeDetail.value) return;
  const item = (detailCommande.value.items || []).find((row) => String(row?.idItem || "").trim() === String(card.id || "").trim());
  if (!item) return;
  const fields = getCommandeItemMeasureFields(item);
  detailItemEditModal.open = true;
  detailItemEditModal.kind = "commande";
  detailItemEditModal.parentId = String(detailCommande.value.idCommande || "").trim();
  detailItemEditModal.itemId = String(item.idItem || "").trim();
  detailItemEditModal.title = "Modifier l'habit";
  detailItemEditModal.subtitle = card.title || "Correction avant paiement";
  detailItemEditModal.description = String(item.description || "");
  detailItemEditModal.prix = String(item.prix ?? "");
  detailItemEditModal.fields = fields;
  detailItemEditModal.mesures = {};
  for (const field of fields) {
    detailItemEditModal.mesures[field.key] = item?.mesures?.valeurs?.[field.key] ?? item?.mesures?.[field.key] ?? "";
  }
  detailItemEditModal.error = "";
}

function openRetoucheItemEditModal(card) {
  if (!card?.id || !detailRetouche.value?.idRetouche || !canEditRetoucheDetail.value) return;
  const item = (detailRetouche.value.items || []).find((row) => String(row?.idItem || "").trim() === String(card.id || "").trim());
  if (!item) return;
  const fields = resolveRetoucheMeasureFieldsForType(item.typeRetouche);
  detailItemEditModal.open = true;
  detailItemEditModal.kind = "retouche";
  detailItemEditModal.parentId = String(detailRetouche.value.idRetouche || "").trim();
  detailItemEditModal.itemId = String(item.idItem || "").trim();
  detailItemEditModal.title = "Modifier l'intervention";
  detailItemEditModal.subtitle = card.title || "Correction avant paiement";
  detailItemEditModal.description = String(item.description || "");
  detailItemEditModal.prix = String(item.prix ?? "");
  detailItemEditModal.fields = fields;
  detailItemEditModal.mesures = {};
  for (const field of fields) {
    detailItemEditModal.mesures[field.key] = item?.mesures?.valeurs?.[field.key] ?? item?.mesures?.[field.key] ?? "";
  }
  detailItemEditModal.error = "";
}

function buildDetailItemEditPayload() {
  const payload = {
    description: String(detailItemEditModal.description || "").trim(),
    prix: Number(detailItemEditModal.prix || 0)
  };
  if (detailItemEditModal.fields.length > 0) {
    const mesures = {};
    for (const field of detailItemEditModal.fields) {
      const raw = detailItemEditModal.mesures[field.key];
      if (raw === undefined || raw === null || String(raw).trim() === "") continue;
      mesures[field.key] = mesureInputType(field) === "number" ? Number(raw) : String(raw).trim();
    }
    payload.mesures = mesures;
  }
  return payload;
}

async function submitDetailItemEdit() {
  if (detailItemEditModal.submitting) return;
  detailItemEditModal.submitting = true;
  detailItemEditModal.error = "";
  try {
    const payload = buildDetailItemEditPayload();
    if (detailItemEditModal.kind === "commande") {
      const updatedCommande = await atelierApi.updateCommandeItem(detailItemEditModal.parentId, detailItemEditModal.itemId, payload);
      if (updatedCommande && typeof updatedCommande === "object") {
        detailCommande.value = normalizeCommande(updatedCommande);
        syncDetailItemStatuses(detailCommandeItemStatuses, detailCommande.value?.items, detailCommande.value?.statutCommande || "");
        void loadCommandeActionsForId(detailItemEditModal.parentId, { force: true, detail: true });
      } else {
        await loadCommandeDetail(detailItemEditModal.parentId, { preserveExisting: true });
      }
      notify("Habit mis a jour avant paiement.");
    } else if (detailItemEditModal.kind === "retouche") {
      const updatedRetouche = await atelierApi.updateRetoucheItem(detailItemEditModal.parentId, detailItemEditModal.itemId, payload);
      if (updatedRetouche && typeof updatedRetouche === "object") {
        detailRetouche.value = normalizeRetouche(updatedRetouche);
        syncDetailItemStatuses(detailRetoucheItemStatuses, detailRetouche.value?.items, detailRetouche.value?.statutRetouche || "");
        void loadRetoucheActionsForId(detailItemEditModal.parentId, { force: true, detail: true });
      } else {
        await loadRetoucheDetail(detailItemEditModal.parentId, { preserveExisting: true });
      }
      notify("Intervention mise a jour avant paiement.");
    }
    resetDetailItemEditModal();
  } catch (err) {
    detailItemEditModal.error = readableError(err);
  } finally {
    detailItemEditModal.submitting = false;
  }
}

const clientConsultationContactProfile = computed(() => {
  if (!clientConsultationClient.value) return null;
  return {
    idClient: String(clientConsultationClient.value.idClient || "").trim(),
    nomClient: String(clientConsultationClient.value.nomComplet || "").trim(),
    telephone: String(clientConsultationClient.value.telephone || "").trim(),
    originId: String(clientConsultationClient.value.idClient || "").trim(),
    reference: "dossier client"
  };
});

const clientConsultationContactTemplates = computed(() => {
  const profile = clientConsultationContactProfile.value;
  if (!profile) return [];
  const variables = buildContactVariables({
    nomClient: profile.nomClient,
    reference: profile.reference || "client",
    signature: atelierContactSignature.value
  });
  return buildContactTemplates([
    {
      key: "client-bonjour",
      label: "Relance simple",
      message: renderContactTemplate(resolveConfiguredContactTemplate("clientBonjour"), variables)
    },
    {
      key: "client-rendezvous",
      label: "Rappel atelier",
      message: renderContactTemplate(resolveConfiguredContactTemplate("clientRendezVous"), variables)
    },
    {
      key: "client-merci",
      label: "Message de remerciement",
      message: renderContactTemplate(resolveConfiguredContactTemplate("clientMerci"), variables)
    }
  ]);
});

const clientConsultationContactSelectedTemplateKey = computed(() =>
  resolveContactTemplateKey(clientConsultationContactTemplates.value, clientConsultationContactTemplateKey.value)
);
const clientConsultationContactMessagePreview = computed(() =>
  resolveContactMessagePreview(clientConsultationContactTemplates.value, clientConsultationContactSelectedTemplateKey.value)
);

watch(
  () => detailCommande.value?.idCommande || "",
  () => {
    detailCommandeContactTemplateKey.value = "";
  }
);

watch(
  () => detailRetouche.value?.idRetouche || "",
  () => {
    detailRetoucheContactTemplateKey.value = "";
  }
);

watch(
  () => clientConsultationClient.value?.idClient || "",
  () => {
    clientConsultationContactTemplateKey.value = "";
  }
);

function handleContactCall({ profile, state, origineType = null, origineId = null, modeleKey = "" } = {}) {
  if (!normalizeDialTelephone(profile?.telephone)) {
    notify("Numero client indisponible.");
    return;
  }
  void trackClientContactAction({
    state,
    profile,
    canal: "CALL",
    modeleKey,
    origineType,
    origineId
  });
}

function handleContactWhatsApp({ profile, message = "", state, origineType = null, origineId = null, modeleKey = "" } = {}) {
  if (!normalizeWhatsAppTelephone(profile?.telephone)) {
    notify("Numero WhatsApp indisponible.");
    return;
  }
  void trackClientContactAction({
    state,
    profile,
    canal: "WHATSAPP",
    modeleKey,
    origineType,
    origineId
  });
}

async function handleSaveContactFollowUp({ profile, state, origineType = null, origineId = null, modeleKey = "" } = {}) {
  await saveClientContactFollowUp({
    state,
    idClient: profile?.idClient,
    canal: "NOTE",
    modeleKey,
    statut: state?.status || "A_RELANCER",
    note: state?.note || "",
    origineType,
    origineId
  });
}

function normalizeDashboardContactSection(section, idKey) {
  const payload = section && typeof section === "object" ? section : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    total: Math.max(0, Number(payload.total || 0)),
    items: items
      .map((item) => ({
        ...item,
        [idKey]: String(item?.[idKey] || "").trim()
      }))
      .filter((item) => item[idKey])
  };
}

function normalizeDashboardContactBoard(payload) {
  return {
    clientsARelancer: normalizeDashboardContactSection(payload?.clientsARelancer, "idClient"),
    commandesPretesNonSignalees: normalizeDashboardContactSection(payload?.commandesPretesNonSignalees, "idCommande"),
    retouchesPretesNonSignalees: normalizeDashboardContactSection(payload?.retouchesPretesNonSignalees, "idRetouche")
  };
}

async function loadDashboardContactBoard({ syncGlobalError = false } = {}) {
  if (!isAuthenticated.value || isSystemManager.value || !canAccessContactFollowUpDashboard.value) {
    dashboardContactBoard.value = createEmptyDashboardContactBoard();
    dashboardContactBoardError.value = "";
    dashboardContactBoardLoading.value = false;
    return false;
  }
  if (!getNetworkState().online) {
    dashboardContactBoard.value = createEmptyDashboardContactBoard();
    dashboardContactBoardError.value = "Suivi client indisponible hors ligne.";
    dashboardContactBoardLoading.value = false;
    return false;
  }

  dashboardContactBoardLoading.value = true;
  dashboardContactBoardError.value = "";
  try {
    const payload = await atelierApi.getClientContactDashboard(5);
    dashboardContactBoard.value = normalizeDashboardContactBoard(payload);
    return true;
  } catch (err) {
    dashboardContactBoard.value = createEmptyDashboardContactBoard();
    dashboardContactBoardError.value = readableError(err);
    if (syncGlobalError) appendError(err);
    return false;
  } finally {
    dashboardContactBoardLoading.value = false;
  }
}

function formatDashboardClientFollowUpDescription(item) {
  if (!item) return "";
  const parts = [contactFollowUpStatusLabels[String(item.statut || "").trim().toUpperCase()] || "A relancer"];
  if (item.telephone) parts.push(item.telephone);
  if (item.dateContact) parts.push(formatDateTime(item.dateContact));
  return parts.filter(Boolean).join(" · ");
}

function formatDashboardPendingCommandeDescription(item) {
  if (!item) return "";
  const parts = [];
  if (item.typeHabit) parts.push(item.typeHabit);
  if (Number(item.soldeRestant || 0) > 0) parts.push(`Solde: ${formatCurrency(item.soldeRestant)}`);
  if (item.datePrevue) parts.push(`Prevue: ${formatDateShort(item.datePrevue)}`);
  return parts.filter(Boolean).join(" · ") || "Commande prete a signaler";
}

function formatDashboardPendingRetoucheDescription(item) {
  if (!item) return "";
  const parts = [];
  if (item.typeRetouche) parts.push(item.typeRetouche);
  else if (item.typeHabit) parts.push(item.typeHabit);
  if (Number(item.soldeRestant || 0) > 0) parts.push(`Solde: ${formatCurrency(item.soldeRestant)}`);
  if (item.datePrevue) parts.push(`Prevue: ${formatDateShort(item.datePrevue)}`);
  return parts.filter(Boolean).join(" · ") || "Retouche prete a signaler";
}

function resolveHabitUiDefinition(typeHabit) {
  const type = String(typeHabit || "").trim().toUpperCase();
  if (!type) return null;
  const configured = wizardHabitsSettings.value?.[type];
  if (configured && configured.actif !== false && Array.isArray(configured.mesures)) {
    const required = [];
    const optional = [];
    const fieldTypes = {};
    const labels = {};
    const mesures = [...configured.mesures].sort(
      (left, right) => normalizeSortOrder(left?.ordre) - normalizeSortOrder(right?.ordre)
    );
    for (const row of mesures) {
      if (row?.actif === false) continue;
      const code = String(row?.code || "").trim();
      if (!code) continue;
      if (row?.obligatoire === true) required.push(code);
      else optional.push(code);
      const configuredType = String(row?.typeChamp || "").trim().toLowerCase();
      fieldTypes[code] = configuredType === "text" || configuredType === "select" ? configuredType : code === "typeManches" ? "select" : "number";
      labels[code] = String(row?.label || "").trim() || mesureLabelFromKey(code);
    }
    return {
      required: Array.from(new Set(required)),
      optional: Array.from(new Set(optional)),
      fieldTypes,
      labels
    };
  }
  const fallback = habitMesureDefinitions[type];
  if (!fallback) return null;
  const fieldTypes = {};
  const labels = {};
  for (const field of [...fallback.required, ...fallback.optional]) {
    fieldTypes[field] = field === "typeManches" ? "select" : "number";
    labels[field] = mesureLabelFromKey(field);
  }
  return {
    required: [...fallback.required],
    optional: [...fallback.optional],
    fieldTypes,
    labels
  };
}

const commandeMesureFields = computed(() => {
  const type = wizard.commande.typeHabit;
  const def = resolveHabitUiDefinition(type);
  if (!def) return [];
  return [
    ...def.required.map((key) => ({
      key,
      label: def.labels?.[key] || mesureLabelFromKey(key),
      required: true,
      inputType: def.fieldTypes?.[key] || "number"
    })),
    ...def.optional.map((key) => ({
      key,
      label: def.labels?.[key] || mesureLabelFromKey(key),
      required: false,
      inputType: def.fieldTypes?.[key] || "number"
    }))
  ];
});

const retoucheMesureFields = computed(() => {
  if (!wizardRetoucheMeasureActiveItem.value) return [];
  return getRetoucheItemMeasureFields(wizardRetoucheMeasureActiveItem.value);
});
const retoucheMeasuresConfigError = computed(() => {
  if (!wizardRetoucheMeasureActiveItem.value) return "";
  if (!String(wizardRetoucheMeasureActiveItem.value.typeHabit || "").trim()) return "";
  if (!retoucheMeasuresRequired.value) return "";
  if (retoucheMesureFields.value.length > 0) return "";
  return "Configuration invalide: aucune mesure n'est definie pour ce type de retouche.";
});

const lowStockArticles = computed(() =>
  stockArticles.value.filter((a) => Number(a.quantiteDisponible || 0) <= Number(a.seuilAlerte || 0))
);

const dashboardScopedCommandes = computed(() => {
  const today = todayIso();
  const last7 = addDays(today, -7);
  const last30 = addDays(today, -30);
  return commandesView.value.filter((commande) => {
    const dateRef = dateOnly(commande.dateCreation || commande.datePrevue || "");
    if (!dateRef) return true;
    if (dashboardPeriod.value === "TODAY") return dateRef === today;
    if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
    if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
    return true;
  });
});

const dashboardScopedRetouches = computed(() => {
  const today = todayIso();
  const last7 = addDays(today, -7);
  const last30 = addDays(today, -30);
  return retouchesView.value.filter((retouche) => {
    const dateRef = dateOnly(retouche.dateDepot || retouche.datePrevue || "");
    if (!dateRef) return true;
    if (dashboardPeriod.value === "TODAY") return dateRef === today;
    if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
    if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
    return true;
  });
});

const dashboardCards = computed(() => [
  {
    label:
      dashboardPeriod.value === "TODAY"
        ? "Commandes creees aujourd'hui"
        : dashboardPeriod.value === "LAST_7"
          ? "Commandes creees ces 7 derniers jours"
          : "Commandes creees ces 30 derniers jours",
    value: dashboardScopedCommandes.value.filter((c) => Boolean(dateOnly(c.dateCreation))).length,
    tone: "blue"
  },
  {
    label:
      dashboardPeriod.value === "TODAY"
        ? "Retouches creees aujourd'hui"
        : dashboardPeriod.value === "LAST_7"
          ? "Retouches creees ces 7 derniers jours"
          : "Retouches creees ces 30 derniers jours",
    value: dashboardScopedRetouches.value.filter((r) => Boolean(dateOnly(r.dateDepot))).length,
    tone: "teal"
  },
  { label: "Commandes en cours", value: dashboardScopedCommandes.value.filter((c) => c.statutCommande === "EN_COURS").length, tone: "blue" },
  { label: "Commandes pretes", value: dashboardScopedCommandes.value.filter((c) => c.statutCommande === "TERMINEE").length, tone: "green" },
  {
    label: "Commandes a solder",
    value: dashboardScopedCommandes.value.filter((c) => c.soldeRestant > 0 && c.statutCommande !== "ANNULEE").length,
    tone: "amber"
  },
  { label: "Retouches en cours", value: dashboardScopedRetouches.value.filter((r) => r.statutRetouche === "EN_COURS").length, tone: "teal" },
  { label: "Retouches pretes", value: dashboardScopedRetouches.value.filter((r) => r.statutRetouche === "TERMINEE").length, tone: "green" },
  { label: "Retouches a solder", value: dashboardScopedRetouches.value.filter((r) => r.soldeRestant > 0).length, tone: "amber" },
  { label: "Clients actifs", value: clients.value.filter((c) => c.actif !== false).length, tone: "slate" }
]);

const dashboardCommandesCards = computed(() => [
  dashboardCards.value.find((card) => card.label.startsWith("Commandes creees")),
  dashboardCards.value.find((card) => card.label === "Commandes en cours"),
  dashboardCards.value.find((card) => card.label === "Commandes pretes"),
  dashboardCards.value.find((card) => card.label === "Commandes a solder")
].filter(Boolean));

const dashboardRetouchesCards = computed(() => [
  dashboardCards.value.find((card) => card.label.startsWith("Retouches creees")),
  dashboardCards.value.find((card) => card.label === "Retouches en cours"),
  dashboardCards.value.find((card) => card.label === "Retouches pretes"),
  dashboardCards.value.find((card) => card.label === "Retouches a solder")
].filter(Boolean));

const dashboardClientsActifs = computed(() => dashboardCards.value.find((card) => card.label === "Clients actifs") || null);

const financeMetrics = computed(() => {
  const today = todayIso();
  const last7 = addDays(today, -7);
  const last30 = addDays(today, -30);
  const ops = (caisseJour.value?.operations || []).filter((op) => op.statutOperation !== "ANNULEE");
  const totalEntrees = ops.filter((op) => op.typeOperation === "ENTREE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  const isWithinDashboardPeriod = (dateRef) => {
    if (!dateRef) return true;
    if (dashboardPeriod.value === "TODAY") return dateRef === today;
    if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
    if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
    return true;
  };
  const acomptesCommandes = commandesView.value
    .filter((commande) => isWithinDashboardPeriod(dateOnly(commande.dateCreation || commande.datePrevue || "")))
    .reduce((sum, commande) => sum + Number(commande.montantPaye || 0), 0);
  const acomptesRetouches = retouches.value
    .filter((retouche) => isWithinDashboardPeriod(dateOnly(retouche.dateDepot || retouche.datePrevue || "")))
    .reduce((sum, retouche) => sum + Number(retouche.montantPaye || 0), 0);

  return {
    soldeCaisse: Number(caisseJour.value?.soldeCourant || 0),
    totalEncaissement: totalEntrees,
    depensesJour: totalSorties,
    acomptesEncaisses: acomptesCommandes + acomptesRetouches
  };
});

const dashboardSalesMetrics = computed(() => {
  const today = todayIso();
  const last7 = addDays(today, -7);
  const last30 = addDays(today, -30);
  const rows = ventes.value.filter((vente) => {
    if (vente.statut !== "VALIDEE") return false;
    const dateRef = dateOnly(vente.date || "");
    if (!dateRef) return true;
    if (dashboardPeriod.value === "TODAY") return dateRef === today;
    if (dashboardPeriod.value === "LAST_7") return dateRef >= last7 && dateRef <= today;
    if (dashboardPeriod.value === "LAST_30") return dateRef >= last30 && dateRef <= today;
    return true;
  });

  const nombreVentes = rows.length;
  const chiffreAffaires = rows.reduce((sum, vente) => sum + Number(vente.total || 0), 0);
  const beneficeBrut = rows.reduce((sum, vente) => sum + Number(vente.beneficeTotal || 0), 0);
  const totalPrixAchat = rows.reduce((sum, vente) => sum + Number(vente.totalPrixAchat || 0), 0);

  return {
    nombreVentes,
    chiffreAffaires,
    beneficeBrut,
    margeMoyenne: chiffreAffaires > 0 ? (beneficeBrut / chiffreAffaires) * 100 : 0,
    rentabilite: totalPrixAchat > 0 ? (beneficeBrut / totalPrixAchat) * 100 : 0
  };
});

const dashboardPrimaryMobileCards = computed(() => [
  dashboardCommandesCards.value[0],
  dashboardCommandesCards.value[1],
  dashboardRetouchesCards.value[0],
  dashboardRetouchesCards.value[1]
].filter(Boolean));

const dashboardFinanceMobileCards = computed(() => [
  { label: "Solde caisse", value: formatCurrency(financeMetrics.value.soldeCaisse), tone: "blue" },
  { label: "Encaissement", value: formatCurrency(financeMetrics.value.totalEncaissement), tone: "green" },
  { label: "Depenses", value: formatCurrency(financeMetrics.value.depensesJour), tone: "amber" },
  { label: "Acomptes", value: formatCurrency(financeMetrics.value.acomptesEncaisses), tone: "slate" }
]);

const dashboardSalesMobileCards = computed(() => [
  { label: "Ventes stock", value: dashboardSalesMetrics.value.nombreVentes, tone: "blue" },
  { label: "CA ventes", value: formatCurrency(dashboardSalesMetrics.value.chiffreAffaires), tone: "blue" },
  { label: "Benefice brut", value: formatCurrency(dashboardSalesMetrics.value.beneficeBrut), tone: "green" },
  { label: "Taux de marge", value: formatPercent(dashboardSalesMetrics.value.margeMoyenne), tone: "teal" }
]);

const dashboardFollowUpCards = computed(() => [
  { label: "Clients a relancer", value: dashboardContactBoard.value.clientsARelancer.total, tone: "amber" },
  { label: "Commandes a signaler", value: dashboardContactBoard.value.commandesPretesNonSignalees.total, tone: "green" },
  { label: "Retouches a signaler", value: dashboardContactBoard.value.retouchesPretesNonSignalees.total, tone: "teal" },
  {
    label: "Total a traiter",
    value:
      dashboardContactBoard.value.clientsARelancer.total +
      dashboardContactBoard.value.commandesPretesNonSignalees.total +
      dashboardContactBoard.value.retouchesPretesNonSignalees.total,
    tone: "slate"
  }
]);

const dashboardClientsToFollowUpMobileItems = computed(() =>
  dashboardContactBoard.value.clientsARelancer.items.map((item) => ({
    id: item.idClient,
    libelle: item.nomClient || item.telephone || item.idClient,
    description: formatDashboardClientFollowUpDescription(item)
  }))
);

const dashboardCommandesToNotifyMobileItems = computed(() =>
  dashboardContactBoard.value.commandesPretesNonSignalees.items.map((item) => ({
    id: item.idCommande,
    libelle: `${item.idCommande} - ${item.clientNom || item.idClient}`,
    description: formatDashboardPendingCommandeDescription(item)
  }))
);

const dashboardRetouchesToNotifyMobileItems = computed(() =>
  dashboardContactBoard.value.retouchesPretesNonSignalees.items.map((item) => ({
    id: item.idRetouche,
    libelle: `${item.idRetouche} - ${item.clientNom || item.idClient}`,
    description: formatDashboardPendingRetoucheDescription(item)
  }))
);

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

const recentWorkRows = computed(() => {
  const today = todayIso();
  const last7 = addDays(today, -7);
  const last30 = addDays(today, -30);

  const cmdRows = commandesView.value.map((c) => ({
    id: c.idCommande,
    clientNom: c.clientNom,
    type: "Commande",
    statut: c.statutCommande,
    montantTotal: c.montantTotal,
    avancePayee: c.montantPaye,
    dateRef: dateOnly(c.dateCreation || c.datePrevue || "")
  }));

  const retRows = retouches.value.map((r) => ({
    id: r.idRetouche,
    clientNom: r.clientNom || clientMap.value.get(r.idClient) || r.idClient,
    type: "Retouche",
    statut: r.statutRetouche,
    montantTotal: Number(r.montantTotal || 0),
    avancePayee: Number(r.montantPaye || 0),
    dateRef: dateOnly(r.dateDepot || r.datePrevue || "")
  }));

  const venteRows = ventes.value.map((v) => ({
    id: v.idVente,
    clientNom: "Client comptoir",
    type: "Vente",
    statut: v.statut,
    montantTotal: Number(v.total || 0),
    avancePayee: Number(v.beneficeTotal || 0),
    dateRef: dateOnly(v.date || "")
  }));

  const rows = [...cmdRows, ...retRows, ...venteRows];
  const filtered = rows.filter((row) => {
    if (!row.dateRef) return true;
    if (dashboardPeriod.value === "TODAY") return row.dateRef === today;
    if (dashboardPeriod.value === "LAST_7") return row.dateRef >= last7 && row.dateRef <= today;
    if (dashboardPeriod.value === "LAST_30") return row.dateRef >= last30 && row.dateRef <= today;
    return true;
  });

  return filtered
    .sort((a, b) => String(b.dateRef).localeCompare(String(a.dateRef)))
    .slice(0, 5);
});

const recentCaisseActivity = computed(() => {
  const ops = [...(caisseJour.value?.operations || [])].sort((a, b) => String(b.dateOperation).localeCompare(String(a.dateOperation)));
  return ops.slice(0, 4).map((op) => ({
    id: op.idOperation,
    libelle: op.motif || op.typeOperation,
    montant: op.typeOperation === "SORTIE" ? -Number(op.montant || 0) : Number(op.montant || 0)
  }));
});

const caisseStatus = computed(() => caisseJour.value?.statutCaisse || "INCONNUE");
const caisseOuverte = computed(() => caisseStatus.value === "OUVERTE");
const caisseOperations = computed(() =>
  [...(caisseJour.value?.operations || [])].sort((a, b) =>
    String(b.dateOperation || "").localeCompare(String(a.dateOperation || ""))
  )
);
const caisseOperationsPaged = computed(() => caisseOperations.value.slice(0, caisseOperationsVisibleCount.value));
const caisseOperationsInfiniteEndReached = computed(
  () => caisseOperations.value.length > 0 && caisseOperationsPaged.value.length >= caisseOperations.value.length
);
const caisseTotals = computed(() => {
  const totalEntrees = Number(caisseJour.value?.totalEntreesJour ?? 0);
  const totalSortiesQuotidiennes = Number(caisseJour.value?.totalSortiesQuotidiennesJour ?? 0);
  const resultatJournalier = Number(caisseJour.value?.resultatJournalier ?? (totalEntrees - totalSortiesQuotidiennes));
  const soldeJournalierRestant = Number(caisseJour.value?.soldeJournalierRestant ?? resultatJournalier);
  const ops = caisseOperations.value.filter((op) => op.statutOperation !== "ANNULEE");
  const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  return { totalEntrees, totalSorties, totalSortiesQuotidiennes, resultatJournalier, soldeJournalierRestant };
});

const alerts = computed(() => {
  const today = todayIso();
  const lateCommandes = commandesView.value.filter(
    (c) => c.datePrevue && c.datePrevue < today && c.statutCommande !== "LIVREE" && c.statutCommande !== "ANNULEE"
  );
  const lowStock = stockArticles.value.filter((a) => Number(a.quantiteDisponible || 0) <= Number(a.seuilAlerte || 0));
  const caisseNotClosed = caisseJour.value && caisseJour.value.statutCaisse !== "CLOTUREE";

  const items = [];
  if (lateCommandes.length > 0) items.push({ tone: "due", label: `${lateCommandes.length} commande(s) en retard` });
  for (const article of lowStock) {
    items.push({ tone: "due", label: `Stock faible: ${article.nomArticle}` });
  }
  if (caisseNotClosed) items.push({ tone: "due", label: "Caisse non cloturee" });
  return items;
});

const statusOptions = computed(() => {
  const dynamic = Array.from(new Set(commandes.value.map((row) => row.statutCommande).filter(Boolean)));
  const ordered = ["CREEE", "EN_COURS", "TERMINEE", "LIVREE", "ANNULEE"];
  const merged = ordered.filter((status) => dynamic.includes(status));
  const rest = dynamic.filter((status) => !ordered.includes(status));
  return ["ALL", ...merged, ...rest];
});

const commandesFiltered = computed(() => {
  const today = todayIso();
  const next7 = addDays(today, 7);
  const clientQuery = commandeClientQuery.value.trim().toLowerCase();

  return commandesView.value.filter((commande) => {
    if (filters.statut !== "ALL" && commande.statutCommande !== filters.statut) return false;
    if (filters.client !== "ALL" && commande.idClient !== filters.client) return false;

    if (clientQuery) {
      const ref = clientDirectory.value.get(commande.idClient) || { nomComplet: commande.clientNom || "", telephone: "" };
      const haystackClient = `${commande.idClient || ""} ${ref.nomComplet || ""} ${ref.telephone || ""}`.toLowerCase();
      if (!haystackClient.includes(clientQuery)) return false;
    }

    if (filters.periode === "TODAY" && commande.datePrevue !== today) return false;
    if (filters.periode === "OVERDUE" && (!commande.datePrevue || commande.datePrevue >= today)) return false;
    if (filters.periode === "NEXT_7") {
      if (!commande.datePrevue) return false;
      if (commande.datePrevue < today || commande.datePrevue > next7) return false;
    }

    if (filters.soldeRestant === "DUE" && commande.soldeRestant === 0) return false;
    if (filters.soldeRestant === "PAID" && commande.soldeRestant > 0) return false;

    const query = filters.recherche.trim().toLowerCase();
    if (!query) return true;

    const haystack = `${commande.idCommande} ${commande.clientNom} ${commande.statutCommande} ${commande.descriptionCommande}`.toLowerCase();
    return haystack.includes(query);
  });
});

const commandesSoldeRestantCount = computed(() => commandesFiltered.value.filter((commande) => commande.soldeRestant > 0).length);
const commandesPaged = computed(() => commandesFiltered.value.slice(0, commandesVisibleCount.value));
const commandesInfiniteEndReached = computed(() => commandesFiltered.value.length > 0 && commandesPaged.value.length >= commandesFiltered.value.length);
const commandesKpi = computed(() => ({
  total: commandesFiltered.value.length,
  enCours: commandesFiltered.value.filter((item) => item.statutCommande === "EN_COURS").length,
  livrees: commandesFiltered.value.filter((item) => item.statutCommande === "LIVREE").length,
  avecSolde: commandesSoldeRestantCount.value
}));
const commandeClientOptions = computed(() => {
  const query = commandeClientQuery.value.trim().toLowerCase();
  if (!query) return clients.value;
  return clients.value.filter((client) => {
    const haystack = `${client.idClient || ""} ${client.nom || ""} ${client.prenom || ""} ${client.telephone || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});
const commandeFilterSummary = computed(() => {
  const summary = [];
  if (filters.statut !== "ALL") summary.push(`Statut: ${filters.statut}`);
  if (filters.client !== "ALL") summary.push("Client selectionne");
  if (filters.periode !== "ALL") summary.push(periodOptions.find((option) => option.value === filters.periode)?.label || "Periode filtree");
  if (filters.soldeRestant !== "ALL") summary.push(soldeOptions.find((option) => option.value === filters.soldeRestant)?.label || "Solde filtre");
  if (commandeClientQuery.value.trim()) summary.push("Recherche client active");
  if (filters.recherche.trim()) summary.push("Recherche texte active");
  return summary.length > 0 ? summary.join(" · ") : "Aucun filtre applique";
});

const retoucheStatusOptions = computed(() => {
  const dynamic = Array.from(new Set(retouches.value.map((row) => row.statutRetouche).filter(Boolean)));
  const ordered = ["DEPOSEE", "EN_COURS", "TERMINEE", "LIVREE", "ANNULEE"];
  const merged = ordered.filter((status) => dynamic.includes(status));
  const rest = dynamic.filter((status) => !ordered.includes(status));
  return ["ALL", ...merged, ...rest];
});

const retouchesFiltered = computed(() => {
  const today = todayIso();
  const next7 = addDays(today, 7);
  const clientQuery = retoucheClientQuery.value.trim().toLowerCase();

  return retouchesView.value.filter((retouche) => {
    if (retoucheFilters.statut !== "ALL" && retouche.statutRetouche !== retoucheFilters.statut) return false;
    if (retoucheFilters.client !== "ALL" && retouche.idClient !== retoucheFilters.client) return false;

    if (clientQuery) {
      const ref = clientDirectory.value.get(retouche.idClient) || { nomComplet: retouche.clientNom || "", telephone: "" };
      const haystackClient = `${retouche.idClient || ""} ${ref.nomComplet || ""} ${ref.telephone || ""}`.toLowerCase();
      if (!haystackClient.includes(clientQuery)) return false;
    }

    if (retoucheFilters.periode === "TODAY" && retouche.datePrevue !== today) return false;
    if (retoucheFilters.periode === "OVERDUE" && (!retouche.datePrevue || retouche.datePrevue >= today)) return false;
    if (retoucheFilters.periode === "NEXT_7") {
      if (!retouche.datePrevue) return false;
      if (retouche.datePrevue < today || retouche.datePrevue > next7) return false;
    }

    if (retoucheFilters.soldeRestant === "DUE" && retouche.soldeRestant === 0) return false;
    if (retoucheFilters.soldeRestant === "PAID" && retouche.soldeRestant > 0) return false;

    const query = retoucheFilters.recherche.trim().toLowerCase();
    if (!query) return true;

    const haystack = `${retouche.idRetouche} ${retouche.clientNom} ${retouche.statutRetouche} ${retouche.descriptionRetouche}`.toLowerCase();
    return haystack.includes(query);
  });
});

const retouchesSoldeRestantCount = computed(() => retouchesFiltered.value.filter((retouche) => retouche.soldeRestant > 0).length);
const retouchesPaged = computed(() => retouchesFiltered.value.slice(0, retouchesVisibleCount.value));
const retouchesInfiniteEndReached = computed(() => retouchesFiltered.value.length > 0 && retouchesPaged.value.length >= retouchesFiltered.value.length);
const retouchesKpi = computed(() => ({
  total: retouchesFiltered.value.length,
  enCours: retouchesFiltered.value.filter((item) => item.statutRetouche === "EN_COURS").length,
  livrees: retouchesFiltered.value.filter((item) => item.statutRetouche === "LIVREE").length,
  avecSolde: retouchesSoldeRestantCount.value
}));
const commandeActionsById = ref({});
const retoucheActionsById = ref({});
const retoucheClientOptions = computed(() => {
  const query = retoucheClientQuery.value.trim().toLowerCase();
  if (!query) return clients.value;
  return clients.value.filter((client) => {
    const haystack = `${client.idClient || ""} ${client.nom || ""} ${client.prenom || ""} ${client.telephone || ""}`.toLowerCase();
    return haystack.includes(query);
  });
});
const retoucheFilterSummary = computed(() => {
  const summary = [];
  if (retoucheFilters.statut !== "ALL") summary.push(`Statut: ${retoucheFilters.statut}`);
  if (retoucheFilters.client !== "ALL") summary.push("Client selectionne");
  if (retoucheFilters.periode !== "ALL") summary.push(periodOptions.find((option) => option.value === retoucheFilters.periode)?.label || "Periode filtree");
  if (retoucheFilters.soldeRestant !== "ALL") summary.push(soldeOptions.find((option) => option.value === retoucheFilters.soldeRestant)?.label || "Solde filtre");
  if (retoucheClientQuery.value.trim()) summary.push("Recherche client active");
  if (retoucheFilters.recherche.trim()) summary.push("Recherche texte active");
  return summary.length > 0 ? summary.join(" · ") : "Aucun filtre applique";
});

function hasActionEntry(store, id) {
  return Object.prototype.hasOwnProperty.call(store.value || {}, String(id || ""));
}

function readActionEntry(store, id) {
  return (store.value || {})[String(id || "")] || null;
}

function normalizeActionFlags(payload) {
  const actions = payload?.actions && typeof payload.actions === "object" ? payload.actions : {};
  return {
    voir: actions.voir === true,
    payer: actions.payer === true,
    terminer: actions.terminer === true,
    livrer: actions.livrer === true,
    annuler: actions.annuler === true,
    modifier: actions.modifier === true
  };
}

async function loadCommandeActionsForId(idCommande, { force = false, detail = false } = {}) {
  const id = String(idCommande || "");
  if (!id) return null;
  if (!isRemoteEntityId(id)) {
    commandeActionsById.value = { ...commandeActionsById.value, [id]: null };
    if (detail) detailCommandeActions.value = null;
    return null;
  }
  if (!force && hasActionEntry(commandeActionsById, id)) {
    const cached = readActionEntry(commandeActionsById, id);
    if (detail) detailCommandeActions.value = cached;
    return cached;
  }
  const previous = readActionEntry(commandeActionsById, id);
  try {
    const payload = await atelierApi.getCommandeActions(id);
    const normalized = normalizeActionFlags(payload);
    commandeActionsById.value = { ...commandeActionsById.value, [id]: normalized };
    if (detail) detailCommandeActions.value = normalized;
    return normalized;
  } catch {
    commandeActionsById.value = { ...commandeActionsById.value, [id]: previous };
    if (detail) detailCommandeActions.value = previous;
    return previous;
  }
}

async function loadRetoucheActionsForId(idRetouche, { force = false, detail = false } = {}) {
  const id = String(idRetouche || "");
  if (!id) return null;
  if (!isRemoteEntityId(id)) {
    retoucheActionsById.value = { ...retoucheActionsById.value, [id]: null };
    if (detail) detailRetoucheActions.value = null;
    return null;
  }
  if (!force && hasActionEntry(retoucheActionsById, id)) {
    const cached = readActionEntry(retoucheActionsById, id);
    if (detail) detailRetoucheActions.value = cached;
    return cached;
  }
  const previous = readActionEntry(retoucheActionsById, id);
  try {
    const payload = await atelierApi.getRetoucheActions(id);
    const normalized = normalizeActionFlags(payload);
    retoucheActionsById.value = { ...retoucheActionsById.value, [id]: normalized };
    if (detail) detailRetoucheActions.value = normalized;
    return normalized;
  } catch {
    retoucheActionsById.value = { ...retoucheActionsById.value, [id]: previous };
    if (detail) detailRetoucheActions.value = previous;
    return previous;
  }
}

watch(commandesPaged, (rows) => {
  const ids = (rows || []).map((row) => row?.idCommande).filter(Boolean);
  for (const id of ids) {
    void loadCommandeActionsForId(id, { force: false, detail: false });
  }
}, { immediate: true });

watch(retouchesPaged, (rows) => {
  const ids = (rows || []).map((row) => row?.idRetouche).filter(Boolean);
  for (const id of ids) {
    void loadRetoucheActionsForId(id, { force: false, detail: false });
  }
}, { immediate: true });

const selectedCommande = computed(() =>
  commandesView.value.find((commande) => commande.idCommande === selectedCommandeId.value) || null
);

const selectedVente = computed(() =>
  ventesView.value.find((vente) => vente.idVente === selectedVenteId.value) || null
);

function scrollMainContentToTop(behavior = "auto") {
  nextTick(() => {
    const container = contentScrollRef.value;
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0, behavior });
      return;
    }
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior });
    }
  });
}

function normalizeAuditPath(pathname = "") {
  const clean = String(pathname || "").replace(/\/+$/, "") || "/";
  if (!clean.startsWith("/audit")) return "";
  const supported = new Set(auditRoutes.map((item) => item.path));
  if (supported.has(clean)) return clean;
  return "/audit";
}

function syncRouteFromLocation() {
  const auditPath = normalizeAuditPath(window.location.pathname);
  if (!auditPath) return;
  currentRoute.value = "audit";
  auditSubRoute.value = auditPath;
}

function navigateAudit(path, replace = false) {
  const target = normalizeAuditPath(path) || "/audit";
  currentRoute.value = "audit";
  auditSubRoute.value = target;

  if (window.location.pathname !== target) {
    if (replace) window.history.replaceState({}, "", target);
    else window.history.pushState({}, "", target);
  }

  loadAuditPage(target);
}

async function onBrowserNavigation() {
  if (!isAuthenticated.value) return;
  if (isSystemManager.value) {
    if (window.location.pathname.startsWith("/audit")) {
      window.history.replaceState({}, "", "/");
    }
    currentRoute.value = resolveAccessibleRoute(currentRoute.value);
    return;
  }
  const canLeave = await canLeaveSettings();
  if (!canLeave) {
    window.history.pushState({}, "", "/");
    return;
  }
  const auditPath = normalizeAuditPath(window.location.pathname);
  if (!auditPath) return;
  if (!canAccessAuditPath(auditPath)) {
    currentRoute.value = resolveAccessibleRoute(currentRoute.value);
    window.history.replaceState({}, "", "/");
    return;
  }
  currentRoute.value = "audit";
  auditSubRoute.value = auditPath;
  loadAuditPage(auditPath);
}

function onBeforeUnload(event) {
  if (currentRoute.value !== "parametres") return;
  if (!settingsHasUnsavedChanges.value) return;
  event.preventDefault();
  event.returnValue = "";
}

function applyAuthSession(session) {
  if (!session) {
    authUser.value = null;
    authPermissions.value = [];
    settingsUser.nom = "";
    settingsUser.role = "COUTURIER";
    resetRuntimeSettings();
    return;
  }
  authUser.value = {
    id: session.id || "",
    nom: session.nom || "",
    email: session.email || "",
    atelierId: session.atelierId || "",
    roleId: String(session.roleId || session.roles?.[0] || "").toUpperCase()
  };
  authPermissions.value = Array.from(new Set((session.permissions || []).map((p) => String(p || "").toUpperCase())));
  settingsUser.nom = authUser.value.nom || "";
  settingsUser.role = authUser.value.roleId || "COUTURIER";
}

async function hydrateAuthSession() {
  try {
    const session = await atelierApi.restoreSession();
    applyAuthSession(session);
    authError.value = "";
    authMode.value = session ? "login" : "checking";
    return Boolean(session);
  } catch (err) {
    applyAuthSession(null);
    const message = readableError(err);
    const lowered = message.toLowerCase();
    const status = err instanceof ApiError ? Number(err.status || 0) : 0;
    const isAuthNoise =
      status === 401 ||
      status === 403 ||
      lowered.includes("acces non autorise") ||
      lowered.includes("connexion requise") ||
      lowered.includes("action non autorisee") ||
      lowered.includes("session invalide");
    authError.value = isAuthNoise ? "" : message;
    authMode.value = "login";
    return false;
  }
}

async function detectAuthMode() {
  if (isAuthenticated.value) {
    authMode.value = "login";
    return;
  }
  authError.value = "";
  authMode.value = "checking";
  if (authPortal.value === "system") {
    authAtelierContext.value = null;
    try {
      const payload = await atelierApi.getSystemBootstrapStatus();
      authMode.value = payload?.initialized ? "login" : "system-bootstrap";
    } catch {
      authMode.value = "login";
    }
    return;
  }

  authAtelierSlug.value = normalizeAtelierSlugInput(authAtelierSlug.value);
  persistAuthAtelierSlug();
  if (!authAtelierSlug.value) {
    authAtelierContext.value = null;
    authMode.value = "slug-required";
    return;
  }
  try {
    const status = await atelierApi.getOwnerBootstrapStatus({ atelierSlug: authAtelierSlug.value });
    authAtelierContext.value = status?.atelier || null;
    if (status?.atelierExists === false) {
      authMode.value = "atelier-not-found";
      return;
    }
    if (status?.atelier?.actif === false) {
      authMode.value = "atelier-inactive";
      return;
    }
    authMode.value = status?.initialized ? "login" : "bootstrap";
  } catch {
    authMode.value = "login";
  }
}

async function submitLogin() {
  if (authenticating.value) return;
  if (authPortal.value === "atelier" && !authAtelierSlug.value) {
    authMode.value = "slug-required";
    authError.value = "Renseigne d'abord le slug de l'atelier.";
    return;
  }
  if (authPortal.value === "atelier" && (authMode.value === "atelier-inactive" || authAtelierContext.value?.actif === false)) {
    authError.value = AUTH_DISABLED_ATELIER_MESSAGE;
    return;
  }
  authError.value = "";
  authenticating.value = true;
  try {
    await atelierApi.login({
      email: loginForm.email.trim(),
      motDePasse: loginForm.motDePasse,
      atelierSlug: authPortal.value === "atelier" ? authAtelierSlug.value : ""
    });
    const session = normalizeSessionPayload(await atelierApi.me());
    applyAuthSession(session);
    authMode.value = "login";
    loginForm.motDePasse = "";
    await loadAtelierSettings();
    await loadAtelierRuntimeSettings();
    await reloadAll();
    if (!canAccessRoute(currentRoute.value)) currentRoute.value = resolveAccessibleRoute(currentRoute.value);
  } catch (err) {
    applyAuthSession(null);
    authError.value = loginErrorMessage(err);
  } finally {
    authenticating.value = false;
  }
}

async function sendForgotPassword() {
  const email = loginForm.email.trim();
  if (!email) {
    authError.value = "Renseigne d'abord ton email.";
    return;
  }
  try {
    await atelierApi.forgotPassword(email);
    authError.value = "Si ce compte existe, un lien de reinitialisation a ete envoye.";
  } catch (err) {
    authError.value = readableError(err);
  }
}

async function bootstrapAtelier() {
  if (bootstrapInitializing.value) return;
  if (!authAtelierSlug.value) {
    authMode.value = "slug-required";
    authError.value = "Renseigne d'abord le slug de l'atelier.";
    return;
  }
  const payload = await openActionModal({
    title: "Initialiser l'atelier",
    message: "Creer le compte proprietaire initial.",
    confirmLabel: "Initialiser",
    fields: [
      { key: "nom", label: "Nom du proprietaire", type: "text", required: true, defaultValue: "" },
      { key: "email", label: "Email du proprietaire", type: "email", required: true, defaultValue: "" },
      { key: "motDePasse", label: "Mot de passe", type: "password", required: true, defaultValue: "" }
    ]
  });
  if (!payload) return;
  const ownerPasswordError = getPasswordPolicyError(String(payload.motDePasse || ""));
  if (ownerPasswordError) {
    authError.value = ownerPasswordError;
    return;
  }

  bootstrapInitializing.value = true;
  authError.value = "";
  try {
    await atelierApi.bootstrapOwner({
      nom: String(payload.nom || "").trim(),
      email: String(payload.email || "").trim(),
      motDePasse: String(payload.motDePasse || ""),
      atelierSlug: authAtelierSlug.value
    });
    authMode.value = "login";
    loginForm.email = String(payload.email || "").trim();
    loginForm.motDePasse = "";
    authError.value = "Atelier initialise. Connecte-toi avec le compte proprietaire.";
  } catch (err) {
    const message = readableError(err);
    if (message.toLowerCase().includes("deja initialise")) {
      authMode.value = "login";
      authError.value = "Un proprietaire existe deja. Utilise la connexion.";
    } else {
      authError.value = message;
    }
  } finally {
    bootstrapInitializing.value = false;
  }
}

async function bootstrapSystemManager() {
  if (bootstrapInitializing.value) return;
  const payload = await openActionModal({
    title: "Initialiser le manager systeme",
    message: "Creer le compte global d'administration multi-tenant.",
    confirmLabel: "Initialiser",
    fields: [
      { key: "nom", label: "Nom du manager", type: "text", required: true, defaultValue: "" },
      { key: "email", label: "Email du manager", type: "email", required: true, defaultValue: "" },
      { key: "motDePasse", label: "Mot de passe", type: "password", required: true, defaultValue: "" }
    ]
  });
  if (!payload) return;
  const managerPasswordError = getPasswordPolicyError(String(payload.motDePasse || ""));
  if (managerPasswordError) {
    authError.value = managerPasswordError;
    return;
  }

  bootstrapInitializing.value = true;
  authError.value = "";
  try {
    await atelierApi.bootstrapSystemManager({
      nom: String(payload.nom || "").trim(),
      email: String(payload.email || "").trim(),
      motDePasse: String(payload.motDePasse || "")
    });
    authMode.value = "login";
    loginForm.email = String(payload.email || "").trim();
    loginForm.motDePasse = "";
    authError.value = "Manager systeme initialise. Connecte-toi avec ce compte.";
  } catch (err) {
    authError.value = readableError(err);
  } finally {
    bootstrapInitializing.value = false;
  }
}

async function submitLogout() {
  try {
    await atelierApi.logout();
  } catch {
    // ignore logout transport errors
  }
  applyAuthSession(null);
  authError.value = "";
  currentRoute.value = "dashboard";
  authAtelierContext.value = null;
  systemAteliers.value = [];
  systemDashboard.value = createEmptySystemDashboard();
  systemDashboardError.value = "";
  systemDashboardLoading.value = false;
  clearSystemNotificationsState();
  clearOwnerNotificationsState();
  closeSystemAtelierDetail();
  await detectAuthMode();
}

onMounted(async () => {
  loadAtelierSettingsLocal();
  updateViewportState();
  lastKnownNetworkOnline = getNetworkState().online;
  unsubscribeNetworkState = subscribeToNetworkState((state) => {
    const reconnected = lastKnownNetworkOnline === false && state.online === true;
    lastKnownNetworkOnline = state.online;
    if (!reconnected) return;
    void refreshVisibleDataAfterReconnect();
  });
  unsubscribeSyncEvents = subscribeToSyncEvents((event) => {
    if (!event || event.atelierId !== currentAtelierId.value) return;
    if (event.type === "job-blocked") {
      scheduleSyncUiRefresh();
      return;
    }
    if (event.type === "cycle-complete" && (Number(event.syncedCount || 0) > 0 || Number(event.blockedCount || 0) > 0)) {
      scheduleSyncUiRefresh();
    }
  });
  setAuthLostHandler((context) => {
    if (!isAuthenticated.value) return;
    const reason = String(context?.reason || "").trim();
    authError.value = reason || "Session expiree. Reconnecte-toi.";
  });
  syncRouteFromLocation();
  loadClientConsultationSectionPreference();
  window.addEventListener("popstate", onBrowserNavigation);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("resize", updateViewportState);
  window.addEventListener("focus", handleCrossDeviceFocus);
  measureViewportResizeHandler = handleMeasureViewportResize;
  if (window.visualViewport?.addEventListener) {
    window.visualViewport.addEventListener("resize", measureViewportResizeHandler);
    window.visualViewport.addEventListener("scroll", measureViewportResizeHandler);
  }
  document.addEventListener("visibilitychange", handleCrossDeviceVisibilityChange);
  await nextTick();
  bindContentScrollListener();
  await hydrateAuthSession();
  if (!isAuthenticated.value) {
    await detectAuthMode();
  }
  if (isAuthenticated.value) {
    await loadAtelierSettings();
    await loadAtelierRuntimeSettings();
    await reloadAll();
    if (currentRoute.value === "audit" && canAccessRoute("audit")) loadAuditPage(auditSubRoute.value);
    if (!canAccessRoute(currentRoute.value)) currentRoute.value = resolveAccessibleRoute();
  }
  authReady.value = true;
  scheduleCrossDeviceRefresh();
});

onUnmounted(() => {
  if (unsubscribeNetworkState) {
    unsubscribeNetworkState();
    unsubscribeNetworkState = null;
  }
  if (unsubscribeSyncEvents) {
    unsubscribeSyncEvents();
    unsubscribeSyncEvents = null;
  }
  setAuthLostHandler(null);
  window.removeEventListener("popstate", onBrowserNavigation);
  window.removeEventListener("beforeunload", onBeforeUnload);
  window.removeEventListener("resize", updateViewportState);
  window.removeEventListener("focus", handleCrossDeviceFocus);
  if (measureViewportResizeHandler && window.visualViewport?.removeEventListener) {
    window.visualViewport.removeEventListener("resize", measureViewportResizeHandler);
    window.visualViewport.removeEventListener("scroll", measureViewportResizeHandler);
  }
  measureViewportResizeHandler = null;
  document.removeEventListener("visibilitychange", handleCrossDeviceVisibilityChange);
  if (contentScrollElement) {
    contentScrollElement.removeEventListener("scroll", handleContentScroll);
    contentScrollElement = null;
  }
  if (authModeDetectionTimer) window.clearTimeout(authModeDetectionTimer);
  if (syncUiRefreshTimer) window.clearTimeout(syncUiRefreshTimer);
  clearCrossDeviceRefreshTimer();
  clearGlobalErrorMessage();
  clearSystemAteliersSearchDebounce();
  if (dossierInfiniteObserver) dossierInfiniteObserver.disconnect();
  if (commandeInfiniteObserver) commandeInfiniteObserver.disconnect();
  if (retoucheInfiniteObserver) retoucheInfiniteObserver.disconnect();
  if (factureInfiniteObserver) factureInfiniteObserver.disconnect();
  if (venteInfiniteObserver) venteInfiniteObserver.disconnect();
  if (caisseInfiniteObserver) caisseInfiniteObserver.disconnect();
  if (detailPaiementsInfiniteObserver) detailPaiementsInfiniteObserver.disconnect();
  if (detailCommandeEventsInfiniteObserver) detailCommandeEventsInfiniteObserver.disconnect();
  if (detailRetouchePaiementsInfiniteObserver) detailRetouchePaiementsInfiniteObserver.disconnect();
  if (detailRetoucheEventsInfiniteObserver) detailRetoucheEventsInfiniteObserver.disconnect();
  clearDossierWorkspaceActionFeedback();
  revokeCommandeMediaObjectUrls(detailCommandeMedia.value);
  revokeSettingsLogoPreviewUrl();
});

watch(currentRoute, (routeName) => {
  clearGlobalErrorMessage();
  if (isMobileViewport.value) {
    closeSidebarDrawer();
  }
  if (routeName === "dashboard" && isAuthenticated.value && !loading.value) {
    void loadDashboardContactBoard();
  }
  if (routeName === "notifications" && isAuthenticated.value && !loading.value) {
    void loadAtelierNotifications();
  }
  scheduleCrossDeviceRefresh();
  nextTick(() => {
    bindContentScrollListener();
    updateMobileScrollButtonVisibility();
  });
});

watch([() => isAuthenticated.value, () => currentAtelierId.value, networkIsOnline], () => {
  scheduleCrossDeviceRefresh();
});

watch(contentScrollRef, () => {
  nextTick(() => {
    bindContentScrollListener();
  });
});

watch([isMobileViewport, currentRoute, commandeSection], ([mobile, routeName, sectionName]) => {
  if (!mobile || routeName !== "commandes" || sectionName !== "liste") {
    commandeMobileFiltersOpen.value = false;
  }
});

watch([isMobileViewport, currentRoute, retoucheSection], ([mobile, routeName, sectionName]) => {
  if (!mobile || routeName !== "retouches" || sectionName !== "liste") {
    retoucheMobileFiltersOpen.value = false;
  }
});

watch([isMobileViewport, currentRoute, selectedClientConsultationId], ([mobile, routeName, selectedId]) => {
  if (!mobile || routeName !== "clientsMesures" || !selectedId) {
    clientMobileFiltersOpen.value = false;
  }
});

watch([isMobileViewport, currentRoute, factureSection], ([mobile, routeName, sectionName]) => {
  if (!mobile || routeName !== "facturation" || sectionName !== "liste") {
    factureMobileFiltersOpen.value = false;
  }
});

watch([isMobileViewport, currentRoute, auditSubRoute], ([mobile, routeName, subRoute]) => {
  if (!mobile || routeName !== "audit" || subRoute !== "/audit/utilisateurs") {
    auditUtilisateursMobileFiltersOpen.value = false;
  }
});

watch(
  [isAuthenticated, currentAtelierId, currentRole],
  ([authenticated, atelierId, roleId]) => {
    if (!authenticated || !atelierId || roleId === "MANAGER_SYSTEME") {
      void setSyncEngineAtelierContext("");
      return;
    }
    void setSyncEngineAtelierContext(atelierId);
  },
  { immediate: true }
);

function scheduleDetectAuthMode(delay = 240) {
  if (authModeDetectionTimer) window.clearTimeout(authModeDetectionTimer);
  authModeDetectionTimer = window.setTimeout(() => {
    authModeDetectionTimer = null;
    void detectAuthMode();
  }, delay);
}

function setAuthPortal(portal) {
  const nextPortal = portal === "system" ? "system" : "atelier";
  if (authPortal.value === nextPortal) return;
  authPortal.value = nextPortal;
  authError.value = "";
  loginForm.motDePasse = "";
  showPassword.value = false;
  authAtelierContext.value = null;
  persistAuthPortal();
  if (!isAuthenticated.value && authReady.value) {
    scheduleDetectAuthMode(0);
  }
}

watch(
  () => [isAuthenticated.value, currentRole.value, authPermissions.value.join("|"), currentRoute.value],
  () => {
    if (!authReady.value) return;
    if (!isAuthenticated.value) return;
    if (!canAccessRoute(currentRoute.value)) {
      currentRoute.value = resolveAccessibleRoute();
    }
  }
);

watch(authPortal, () => {
  persistAuthPortal();
});

watch(authAtelierSlug, (value) => {
  const normalized = normalizeAtelierSlugInput(value);
  if (normalized !== value) {
    authAtelierSlug.value = normalized;
    return;
  }
  persistAuthAtelierSlug();
  if (authPortal.value !== "atelier" || isAuthenticated.value || !authReady.value) return;
  scheduleDetectAuthMode();
});

watch(
  () => systemAtelierModal.nomAtelier,
  (value) => {
    if (!systemAtelierModal.open || systemAtelierModal.slugTouched) return;
    systemAtelierModal.slug = normalizeAtelierSlugInput(value);
  }
);

watch(
  () => [currentRoute.value, settingsActiveTab.value, canAccessSecurityModule.value],
  async ([route, tab, canAccess]) => {
    if (route !== "parametres" || tab !== "securite" || !canAccess) return;
    await loadSecurityModule();
  }
);

watch(
  () => [settingsActiveTab.value, filteredHabitConfigEntries.value.map((entry) => entry.key).join("|")],
  ([tab]) => {
    if (tab !== "mesures") return;
    if (!filteredHabitConfigEntries.value.some((entry) => entry.key === selectedSettingsHabitKey.value)) {
      selectedSettingsHabitKey.value = filteredHabitConfigEntries.value[0]?.key || "";
    }
  },
  { immediate: true }
);

watch(
  () => [settingsMeasureQuery.value, settingsMeasureStatusFilter.value, settingsMeasurePagination.pageSize],
  () => {
    settingsMeasurePagination.page = 1;
  }
);

watch(
  () => settingsMeasurePages.value,
  (pages) => {
    if (settingsMeasurePagination.page > pages) settingsMeasurePagination.page = pages;
  }
);

watch(
  () => [settingsRetoucheQuery.value, settingsRetoucheStatusFilter.value, settingsRetouchePagination.pageSize],
  () => {
    settingsRetouchePagination.page = 1;
  }
);

watch(
  () => settingsRetouchePages.value,
  (pages) => {
    if (settingsRetouchePagination.page > pages) settingsRetouchePagination.page = pages;
  }
);

watch(
  () => [settingsActiveTab.value, filteredSettingsRetoucheTypeEntries.value.map((row) => row.code).join("|")],
  ([tab]) => {
    if (tab !== "retouches") return;
    if (!filteredSettingsRetoucheTypeEntries.value.some((row) => row.code === selectedSettingsRetoucheTypeCode.value)) {
      selectedSettingsRetoucheTypeCode.value = filteredSettingsRetoucheTypeEntries.value[0]?.code || "";
    }
  },
  { immediate: true }
);

watch(
  () => [securityUserQuery.value, securityUserRoleFilter.value, securityUserStatusFilter.value, securityUsersPagination.pageSize],
  () => {
    securityUsersPagination.page = 1;
  }
);

watch(
  () => securityUsersPages.value,
  (pages) => {
    if (securityUsersPagination.page > pages) securityUsersPagination.page = pages;
  }
);

watch(
  () => canAccessSecurityModule.value,
  (canAccess) => {
    if (!canAccess && settingsActiveTab.value === "securite") {
      settingsActiveTab.value = "identite";
    }
  }
);

watch(
  () => [currentRoute.value, selectedVenteId.value],
  ([route, id]) => {
    if (route !== "vente-detail" || !id) return;
    if (detailVenteLoading.value) return;
    if (detailVente.value && detailVente.value.idVente === id) return;
    loadVenteDetail(id);
  }
);

watch(
  () => [currentRoute.value, selectedClientConsultationId.value, clients.value.length],
  async ([route, id, total]) => {
    if (route !== "clientsMesures") return;
    if (!id && total > 0) {
      selectedClientConsultationId.value = clients.value[0].idClient;
      return;
    }
    if (!id) {
      clientConsultation.value = null;
      clientConsultationError.value = "";
      return;
    }
    await loadClientConsultation(id);
  }
);

watch(
  () => factureEmission.typeOrigine,
  () => {
    factureEmission.idOrigine = facturesCandidates.value[0]?.id || "";
  }
);

watch(
  () => [clientHistoryFilters.source, clientHistoryFilters.typeHabit, clientHistoryFilters.periode, clientPagination.pageSize, selectedClientConsultationId.value],
  async () => {
    clientPagination.commandesPage = 1;
    clientPagination.retouchesPage = 1;
    clientPagination.mesuresPage = 1;
    if (currentRoute.value === "clientsMesures" && selectedClientConsultationId.value) {
      await loadClientConsultation(selectedClientConsultationId.value, true);
    }
  }
);

watch(
  () => clientConsultationSection.value,
  (section) => {
    try {
      window.localStorage.setItem(CLIENT_CONSULT_SECTION_KEY, section);
    } catch (err) {
      console.warn("Failed to persist clients consultation section preference", err);
    }
  }
);

watch(
  () => [clientPagination.commandesPage, clientPagination.retouchesPage, clientPagination.mesuresPage],
  async () => {
    if (currentRoute.value === "clientsMesures" && selectedClientConsultationId.value) {
      await loadClientConsultation(selectedClientConsultationId.value, true);
    }
  }
);

watch(
  () => [retoucheFilters.statut, retoucheFilters.client, retoucheFilters.periode, retoucheFilters.soldeRestant, retoucheFilters.recherche, retouchesPagination.pageSize],
  () => {
    resetRetoucheVisibleCount();
    setupRetoucheInfiniteObserver();
  }
);

watch(
  () => [currentRoute.value, retoucheSection.value],
  ([routeName, sectionName]) => {
    if (routeName === "retouches" && sectionName === "liste") {
      resetRetoucheVisibleCount();
      setupRetoucheInfiniteObserver();
    }
  },
  { immediate: true }
);

watch(retoucheInfiniteSentinel, () => {
  setupRetoucheInfiniteObserver();
});

watch(
  () => [factureFilters.statut, factureFilters.source, factureFilters.recherche, factureFilters.soldeRestant, facturesPagination.pageSize],
  () => {
    resetFactureVisibleCount();
    setupFactureInfiniteObserver();
  }
);

watch(
  () => [currentRoute.value, factureSection.value],
  ([routeName, sectionName]) => {
    if (routeName === "facturation" && sectionName === "liste") {
      resetFactureVisibleCount();
      setupFactureInfiniteObserver();
    }
  },
  { immediate: true }
);

watch(factureInfiniteSentinel, () => {
  setupFactureInfiniteObserver();
});

watch(
  () => [auditUtilisateursFiltres.recherche, auditUtilisateursFiltres.action, auditUtilisateursFiltres.statut, auditUtilisateursPagination.pageSize],
  () => {
    auditUtilisateursPagination.page = 1;
  }
);

watch(auditUtilisateursPages, (total) => {
  if (auditUtilisateursPagination.page > total) auditUtilisateursPagination.page = total;
});

watch(
  () => [filters.statut, filters.client, filters.periode, filters.soldeRestant, filters.recherche, commandesPagination.pageSize],
  () => {
    resetCommandeVisibleCount();
    setupCommandeInfiniteObserver();
  }
);

watch(
  () => [currentRoute.value, commandeSection.value],
  ([routeName, sectionName]) => {
    if (routeName === "commandes" && sectionName === "liste") {
      resetCommandeVisibleCount();
      setupCommandeInfiniteObserver();
    }
  },
  { immediate: true }
);

watch(commandeInfiniteSentinel, () => {
  setupCommandeInfiniteObserver();
});

watch(
  () => ventesPagination.pageSize,
  () => {
    resetVenteVisibleCount();
    setupVenteInfiniteObserver();
  }
);

watch(
  () => [currentRoute.value, stockVentesTab.value, ventesPagination.pageSize],
  ([routeName, activeTab]) => {
    if (routeName === "stockVentes" && activeTab === "ventes") {
      resetVenteVisibleCount();
      setupVenteInfiniteObserver();
    }
  },
  { immediate: true }
);

watch(venteInfiniteSentinel, () => {
  setupVenteInfiniteObserver();
});

watch(
  () => [currentRoute.value, caisseOperationsPagination.pageSize, caisseOperations.value.length],
  ([routeName]) => {
    if (routeName === "caisse") {
      resetCaisseOperationsVisibleCount();
      setupCaisseInfiniteObserver();
    }
  },
  { immediate: true }
);

watch(caisseInfiniteSentinel, () => {
  setupCaisseInfiniteObserver();
});

watch(
  () => [detailCommandeHistoryPanels.paiements, detailPaiements.value.length, detailPaiementsPagination.pageSize],
  ([open]) => {
    detailPaiementsVisibleCount.value = detailPaiementsPagination.pageSize;
    if (!open) return;
    const holder = { current: detailPaiementsInfiniteObserver };
    setupInfiniteObserver(detailPaiementsInfiniteSentinel, holder, () =>
      loadMoreDetailRows(detailPaiements, detailPaiementsVisibleCount, detailPaiementsPagination.pageSize, detailPaiementsLoadingMore)
    );
    detailPaiementsInfiniteObserver = holder.current;
  }
);

watch(detailPaiementsInfiniteSentinel, () => {
  if (!detailCommandeHistoryPanels.paiements) return;
  const holder = { current: detailPaiementsInfiniteObserver };
  setupInfiniteObserver(detailPaiementsInfiniteSentinel, holder, () =>
    loadMoreDetailRows(detailPaiements, detailPaiementsVisibleCount, detailPaiementsPagination.pageSize, detailPaiementsLoadingMore)
  );
  detailPaiementsInfiniteObserver = holder.current;
});

watch(
  () => [detailCommandeHistoryPanels.evenements, detailCommandeEvents.value.length, detailCommandeEventsPagination.pageSize],
  ([open]) => {
    detailCommandeEventsVisibleCount.value = detailCommandeEventsPagination.pageSize;
    if (!open) return;
    const holder = { current: detailCommandeEventsInfiniteObserver };
    setupInfiniteObserver(detailCommandeEventsInfiniteSentinel, holder, () =>
      loadMoreDetailRows(
        detailCommandeEvents,
        detailCommandeEventsVisibleCount,
        detailCommandeEventsPagination.pageSize,
        detailCommandeEventsLoadingMore
      )
    );
    detailCommandeEventsInfiniteObserver = holder.current;
  }
);

watch(detailCommandeEventsInfiniteSentinel, () => {
  if (!detailCommandeHistoryPanels.evenements) return;
  const holder = { current: detailCommandeEventsInfiniteObserver };
  setupInfiniteObserver(detailCommandeEventsInfiniteSentinel, holder, () =>
    loadMoreDetailRows(
      detailCommandeEvents,
      detailCommandeEventsVisibleCount,
      detailCommandeEventsPagination.pageSize,
      detailCommandeEventsLoadingMore
    )
  );
  detailCommandeEventsInfiniteObserver = holder.current;
});

watch(
  () => [detailRetoucheHistoryPanels.paiements, detailRetouchePaiements.value.length, detailRetouchePaiementsPagination.pageSize],
  ([open]) => {
    detailRetouchePaiementsVisibleCount.value = detailRetouchePaiementsPagination.pageSize;
    if (!open) return;
    const holder = { current: detailRetouchePaiementsInfiniteObserver };
    setupInfiniteObserver(detailRetouchePaiementsInfiniteSentinel, holder, () =>
      loadMoreDetailRows(
        detailRetouchePaiements,
        detailRetouchePaiementsVisibleCount,
        detailRetouchePaiementsPagination.pageSize,
        detailRetouchePaiementsLoadingMore
      )
    );
    detailRetouchePaiementsInfiniteObserver = holder.current;
  }
);

watch(detailRetouchePaiementsInfiniteSentinel, () => {
  if (!detailRetoucheHistoryPanels.paiements) return;
  const holder = { current: detailRetouchePaiementsInfiniteObserver };
  setupInfiniteObserver(detailRetouchePaiementsInfiniteSentinel, holder, () =>
    loadMoreDetailRows(
      detailRetouchePaiements,
      detailRetouchePaiementsVisibleCount,
      detailRetouchePaiementsPagination.pageSize,
      detailRetouchePaiementsLoadingMore
    )
  );
  detailRetouchePaiementsInfiniteObserver = holder.current;
});

watch(
  () => [detailRetoucheHistoryPanels.evenements, detailRetoucheEvents.value.length, detailRetoucheEventsPagination.pageSize],
  ([open]) => {
    detailRetoucheEventsVisibleCount.value = detailRetoucheEventsPagination.pageSize;
    if (!open) return;
    const holder = { current: detailRetoucheEventsInfiniteObserver };
    setupInfiniteObserver(detailRetoucheEventsInfiniteSentinel, holder, () =>
      loadMoreDetailRows(
        detailRetoucheEvents,
        detailRetoucheEventsVisibleCount,
        detailRetoucheEventsPagination.pageSize,
        detailRetoucheEventsLoadingMore
      )
    );
    detailRetoucheEventsInfiniteObserver = holder.current;
  }
);

watch(detailRetoucheEventsInfiniteSentinel, () => {
  if (!detailRetoucheHistoryPanels.evenements) return;
  const holder = { current: detailRetoucheEventsInfiniteObserver };
  setupInfiniteObserver(detailRetoucheEventsInfiniteSentinel, holder, () =>
    loadMoreDetailRows(
      detailRetoucheEvents,
      detailRetoucheEventsVisibleCount,
      detailRetoucheEventsPagination.pageSize,
      detailRetoucheEventsLoadingMore
    )
  );
  detailRetoucheEventsInfiniteObserver = holder.current;
});

watch(
  () => caisseOperationsPagination.pageSize,
  () => {
    caisseOperationsPagination.page = 1;
  }
);

watch(clientCommandesPages, (total) => {
  if (clientPagination.commandesPage > total) clientPagination.commandesPage = total;
});
watch(clientRetouchesPages, (total) => {
  if (clientPagination.retouchesPage > total) clientPagination.retouchesPage = total;
});
watch(clientMesuresPages, (total) => {
  if (clientPagination.mesuresPage > total) clientPagination.mesuresPage = total;
});

watch(
  () => wizard.commande.items.map((item) => `${item.typeHabit}:${item.prix}`).join("|"),
  () => {
    syncCommandePrimaryTypeFromItems();
    recalculateCommandeTotalFromItems();
  }
);

watch(
  () => wizard.commande.typeHabit,
  () => {
    void refreshCommandePrefill();
  }
);

watch(
  () => retoucheWizard.retouche.items.map((item) => `${item.typeRetouche}:${item.typeHabit}:${item.prix}`).join("|"),
  () => {
    syncRetouchePrimaryTypeFromItems();
    recalculateRetoucheTotalFromItems();
  }
);

watch(
  () => [wizard.step, wizardCommandeMeasureItems.value.length, wizard.commande.items.map((item) => item.idItem).join("|")],
  () => {
    if (wizard.step !== 3) {
      wizardCommandeMeasureIndex.value = 0;
      return;
    }
    setWizardCommandeMeasureIndex(wizardCommandeMeasureIndex.value);
  }
);

watch(
  () => [retoucheWizard.step, wizardRetoucheMeasureItems.value.length, retoucheWizard.retouche.items.map((item) => item.idItem).join("|")],
  () => {
    if (retoucheWizard.step !== 3) {
      wizardRetoucheMeasureIndex.value = 0;
      return;
    }
    setWizardRetoucheMeasureIndex(wizardRetoucheMeasureIndex.value);
  },
  { immediate: true }
);

watch(isPwaOfflineReady, (ready) => {
  if (!ready) return;
  notify("Interface hors ligne prete.");
  dismissPwaOfflineReady();
});

watch(isPwaUpdateAvailable, (available) => {
  if (!available) return;
  notify("Nouvelle version disponible.");
});

function notify(message) {
  showToast(message);
}

async function installApplication() {
  const installed = await promptPwaInstall();
  if (installed) {
    notify("Application installee sur cet appareil.");
    return;
  }
  if (isPwaInstallAvailable.value) {
    notify("Installation annulee.");
  }
}

async function reloadApplicationForUpdate() {
  try {
    notify("Mise a jour de l'application...");
    const triggered = await applyPwaUpdate();
    if (!triggered) {
      notify("Aucune mise a jour en attente.");
    }
  } catch (err) {
    notify(readableError(err));
  }
}

function resetRetoucheFilters() {
  retoucheFilters.statut = "ALL";
  retoucheFilters.client = "ALL";
  retoucheFilters.periode = "ALL";
  retoucheFilters.recherche = "";
  retoucheFilters.soldeRestant = "ALL";
  retoucheClientQuery.value = "";
  resetRetoucheVisibleCount();
}

function resetFactureFilters() {
  factureFilters.statut = "ALL";
  factureFilters.source = "ALL";
  factureFilters.recherche = "";
  factureFilters.soldeRestant = "ALL";
  resetFactureVisibleCount();
}

function resetCommandeFilters() {
  filters.statut = "ALL";
  filters.client = "ALL";
  filters.periode = "ALL";
  filters.recherche = "";
  filters.soldeRestant = "ALL";
  commandeClientQuery.value = "";
  resetCommandeVisibleCount();
}

async function openRoute(routeId) {
  if (!isAuthenticated.value) {
    authError.value = "Connexion requise.";
    return;
  }
  if (!canAccessRoute(routeId)) {
    currentRoute.value = resolveAccessibleRoute(currentRoute.value);
    return;
  }
  if (routeId !== currentRoute.value) {
    const canLeave = await canLeaveSettings();
    if (!canLeave) return;
  }
  if (routeId === "audit") {
    navigateAudit("/audit");
    return;
  }
  if (window.location.pathname.startsWith("/audit")) {
    window.history.pushState({}, "", "/");
  }
  if (routeId === "stockVentes" && !stockVentesTab.value) {
    stockVentesTab.value = "stock";
  }
  if (routeId === "clientsMesures" && !selectedClientConsultationId.value && clients.value.length > 0) {
    selectedClientConsultationId.value = clients.value[0].idClient;
  }
  if (currentRoute.value === "systemAtelierDetail" && routeId !== "systemAtelierDetail") {
    closeSystemAtelierDetail();
  }
  if (currentRoute.value === "commande-detail" && routeId !== "commande-detail") {
    await setDetailCommandeMediaRows([]);
    detailCommandeMediaError.value = "";
  }
  currentRoute.value = routeId;
  if (routeId === "clientsMesures" && selectedClientConsultationId.value) {
    loadClientConsultation(selectedClientConsultationId.value);
  }
}

async function handlePrimaryNavigation(routeId) {
  if (!routeId) return;
  closeSidebarDrawer();
  await openRoute(routeId);
}

async function handleSidebarLogout() {
  closeSidebarDrawer();
  await submitLogout();
}

function canReloadSystemAteliers() {
  return authReady.value && isAuthenticated.value && isSystemManager.value;
}

function clearSystemAteliersSearchDebounce() {
  if (!systemAteliersSearchTimer) return;
  window.clearTimeout(systemAteliersSearchTimer);
  systemAteliersSearchTimer = null;
}

function resolveSystemAteliersSortOption(value = "createdAt_desc") {
  const normalized = String(value || "").trim();
  const allowed = new Set([
    "createdAt_desc",
    "createdAt_asc",
    "nom_asc",
    "nom_desc",
    "slug_asc",
    "slug_desc",
    "utilisateurs_desc",
    "utilisateurs_asc"
  ]);
  const safeValue = allowed.has(normalized) ? normalized : "createdAt_desc";
  const [sortBy, sortDir] = safeValue.split("_");
  return {
    value: safeValue,
    sortBy,
    sortDir
  };
}

async function loadSystemAteliers({ syncGlobalError = false, page = null, pageSize = null, scrollToTop = false } = {}) {
  const requestedPage = Math.max(1, Number(page || systemAteliersPagination.page || 1));
  const requestedPageSize = Math.max(1, Number(pageSize || systemAteliersPagination.pageSize || 10));
  const sort = resolveSystemAteliersSortOption(systemAteliersSort.value);
  clearSystemAteliersSearchDebounce();
  systemAteliersLoading.value = true;
  systemAteliersError.value = "";
  try {
    const payload = await atelierApi.listSystemAteliers({
      search: systemAteliersSearch.value,
      status: systemAteliersStatus.value,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
      page: requestedPage,
      pageSize: requestedPageSize
    });
    const normalized = normalizeSystemAtelierListPayload(payload, {
      page: requestedPage,
      pageSize: requestedPageSize,
      search: systemAteliersSearch.value,
      status: systemAteliersStatus.value,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir
    });
    systemAteliers.value = normalized.items;
    systemAteliersTotal.value = normalized.pagination.total;
    systemAteliersPagination.page = normalized.pagination.page;
    systemAteliersPagination.pageSize = normalized.pagination.pageSize;
    systemAteliersSummary.total = normalized.summary.total;
    systemAteliersSummary.actifs = normalized.summary.actifs;
    systemAteliersSummary.inactifs = normalized.summary.inactifs;
    systemAteliersSummary.utilisateurs = normalized.summary.utilisateurs;
    if (scrollToTop && currentRoute.value === "systemAteliers") {
      scrollMainContentToTop("smooth");
    }
  } catch (err) {
    systemAteliers.value = [];
    systemAteliersTotal.value = 0;
    systemAteliersSummary.total = 0;
    systemAteliersSummary.actifs = 0;
    systemAteliersSummary.inactifs = 0;
    systemAteliersSummary.utilisateurs = 0;
    systemAteliersError.value = readableError(err);
    if (syncGlobalError) appendError(err);
  } finally {
    systemAteliersLoading.value = false;
  }
}

async function loadSystemDashboard({ syncGlobalError = false } = {}) {
  systemDashboardLoading.value = true;
  systemDashboardError.value = "";
  try {
    const payload = await atelierApi.getSystemDashboard();
    systemDashboard.value = normalizeSystemDashboard(payload);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      try {
        const fallbackPayload = await atelierApi.listSystemAteliers({
          sortBy: "createdAt",
          sortDir: "desc",
          page: 1,
          pageSize: 100
        });
        const normalized = normalizeSystemAtelierListPayload(fallbackPayload, {
          page: 1,
          pageSize: 100,
          sortBy: "createdAt",
          sortDir: "desc"
        });
        systemDashboard.value = buildSystemDashboardFallback(normalized.items, normalized.summary);
        return;
      } catch {
        systemDashboard.value = buildSystemDashboardFallback(systemAteliers.value, systemAteliersSummary);
        return;
      }
    }
    systemDashboard.value = buildSystemDashboardFallback(systemAteliers.value, systemAteliersSummary);
    systemDashboardError.value = readableError(err);
    if (syncGlobalError) appendError(err);
  } finally {
    systemDashboardLoading.value = false;
  }
}

async function loadSystemNotifications({ syncGlobalError = false } = {}) {
  systemNotificationsLoading.value = true;
  systemNotificationsError.value = "";
  try {
    const [notificationsPayload, contactsPayload] = await Promise.all([
      atelierApi.listSystemNotifications(),
      atelierApi.listSystemAtelierContacts({ includeInactive: true })
    ]);
    const contacts = normalizeSystemAtelierContacts(contactsPayload);
    const contactsById = new Map(contacts.map((item) => [item.idAtelier, item.nomAtelier]));
    systemNotificationsContacts.value = contacts;
    systemNotifications.value = normalizeSystemNotifications(notificationsPayload).map((item) => ({
      ...item,
      atelierNom: item.atelierNom || contactsById.get(item.atelierId) || ""
    }));
  } catch (err) {
    systemNotifications.value = [];
    systemNotificationsContacts.value = [];
    systemNotificationsError.value = readableError(err);
    if (syncGlobalError) appendError(err);
  } finally {
    systemNotificationsLoading.value = false;
  }
}

async function submitSystemNotification(payload) {
  if (systemNotificationsSubmitting.value) return;
  systemNotificationsSubmitting.value = true;
  systemNotificationsError.value = "";
  try {
    await atelierApi.createSystemNotification(payload);
    await loadSystemNotifications();
    notify("Notification systeme envoyee.");
  } catch (err) {
    systemNotificationsError.value = readableError(err);
  } finally {
    systemNotificationsSubmitting.value = false;
  }
}

async function loadAtelierNotificationsUnreadCount({ syncGlobalError = false } = {}) {
  if (!canOpenAtelierNotifications.value) {
    atelierNotificationsUnreadCount.value = 0;
    return;
  }
  try {
    const payload = await atelierApi.countUnreadNotifications();
    atelierNotificationsUnreadCount.value = Math.max(0, Number(payload?.total || 0));
  } catch (err) {
    atelierNotificationsUnreadCount.value = 0;
    if (syncGlobalError) appendError(err);
  }
}

async function loadAtelierNotifications({ syncGlobalError = false } = {}) {
  if (!canOpenAtelierNotifications.value) {
    atelierNotifications.value = [];
    atelierNotificationsError.value = "";
    atelierNotificationsLoading.value = false;
    return;
  }
  atelierNotificationsLoading.value = true;
  atelierNotificationsError.value = "";
  try {
    const payload = await atelierApi.listAtelierNotifications();
    const items = normalizeAtelierNotifications(payload);
    atelierNotifications.value = items;
    atelierNotificationsUnreadCount.value = items.filter((item) => !item.estLue).length;
  } catch (err) {
    atelierNotifications.value = [];
    atelierNotificationsError.value = readableError(err);
    if (syncGlobalError) appendError(err);
  } finally {
    atelierNotificationsLoading.value = false;
  }
}

async function openAtelierNotification(notification) {
  const notificationId = String(notification?.idNotification || "").trim();
  if (!notificationId || atelierNotificationsActiveId.value === notificationId || notification?.estLue) return;
  atelierNotificationsActiveId.value = notificationId;
  try {
    await atelierApi.markNotificationAsRead(notificationId);
    const target = atelierNotifications.value.find((item) => item.idNotification === notificationId);
    if (target) {
      target.estLue = true;
      target.luAt = new Date().toISOString();
    }
    atelierNotificationsUnreadCount.value = Math.max(0, atelierNotificationsUnreadCount.value - 1);
  } catch (err) {
    atelierNotificationsError.value = readableError(err);
  } finally {
    atelierNotificationsActiveId.value = "";
  }
}

function clearAtelierNotificationsState() {
  atelierNotifications.value = [];
  atelierNotificationsLoading.value = false;
  atelierNotificationsError.value = "";
  atelierNotificationsUnreadCount.value = 0;
  atelierNotificationsActiveId.value = "";
}

async function openAtelierNotificationsPage() {
  if (!canOpenAtelierNotifications.value) return;
  await openRoute("notifications");
  await loadAtelierNotifications();
}

async function refreshSystemAteliersList() {
  if (!canReloadSystemAteliers()) return;
  await loadSystemAteliers({ scrollToTop: true });
  await loadSystemDashboard();
}

function updateSystemAteliersSearch(value) {
  systemAteliersSearch.value = String(value || "");
  clearSystemAteliersSearchDebounce();
  systemAteliersSearchTimer = window.setTimeout(() => {
    systemAteliersSearchTimer = null;
    if (!canReloadSystemAteliers()) return;
    void loadSystemAteliers({ page: 1, scrollToTop: true });
  }, 260);
}

function updateSystemAteliersPageSize(value) {
  const nextPageSize = [10, 20, 50].includes(Number(value)) ? Number(value) : 10;
  if (!canReloadSystemAteliers()) {
    systemAteliersPagination.pageSize = nextPageSize;
    systemAteliersPagination.page = 1;
    return;
  }
  void loadSystemAteliers({ page: 1, pageSize: nextPageSize, scrollToTop: true });
}

function clearSystemNotificationsState() {
  systemNotifications.value = [];
  systemNotificationsContacts.value = [];
  systemNotificationsError.value = "";
  systemNotificationsLoading.value = false;
  systemNotificationsSubmitting.value = false;
}

function clearOwnerNotificationsState() {
  clearAtelierNotificationsState();
}

function updateSystemAteliersStatus(value) {
  systemAteliersStatus.value = ["ALL", "ACTIVE", "INACTIVE"].includes(String(value || "").trim().toUpperCase())
    ? String(value || "").trim().toUpperCase()
    : "ALL";
  if (!canReloadSystemAteliers()) return;
  void loadSystemAteliers({ page: 1, scrollToTop: true });
}

function updateSystemAteliersSort(value) {
  systemAteliersSort.value = resolveSystemAteliersSortOption(value).value;
  if (!canReloadSystemAteliers()) return;
  void loadSystemAteliers({ page: 1, scrollToTop: true });
}

function goToPreviousSystemAteliersPage() {
  if (systemAteliersLoading.value || systemAteliersPagination.page <= 1) return;
  void loadSystemAteliers({ page: systemAteliersPagination.page - 1, scrollToTop: true });
}

function goToNextSystemAteliersPage() {
  if (systemAteliersLoading.value || systemAteliersPagination.page >= systemAteliersPages.value) return;
  void loadSystemAteliers({ page: systemAteliersPagination.page + 1, scrollToTop: true });
}

function closeSystemAtelierDetail() {
  systemAtelierDetailRequestId.value += 1;
  systemAtelierDetailId.value = "";
  systemAtelierDetail.value = null;
  systemAtelierDetailSeed.value = null;
  systemAtelierDetailError.value = "";
  systemAtelierDetailLoading.value = false;
  systemOwnerActionKey.value = "";
  systemOwnerActionError.value = "";
  systemRecoveryActionKey.value = "";
  systemRecoveryActionError.value = "";
}

async function loadSystemAtelierDetail(idAtelier, { syncGlobalError = false } = {}) {
  const targetId = String(idAtelier || "").trim();
  if (!targetId) {
    closeSystemAtelierDetail();
    return;
  }
  const requestId = systemAtelierDetailRequestId.value + 1;
  systemAtelierDetailRequestId.value = requestId;
  systemAtelierDetailId.value = targetId;
  systemAtelierDetailLoading.value = true;
  systemAtelierDetailError.value = "";
  systemOwnerActionError.value = "";
  systemRecoveryActionError.value = "";
  try {
    const payload = await atelierApi.getSystemAtelierDetail(targetId);
    if (systemAtelierDetailRequestId.value !== requestId) return;
    systemAtelierDetail.value = normalizeSystemAtelierDetail(payload);
  } catch (err) {
    if (systemAtelierDetailRequestId.value !== requestId) return;
    const errStatus = Number(err?.status || err?.payload?.status || 0);
    if ((err instanceof ApiError && err.status === 404) || errStatus === 404) {
      const fallbackAtelier =
        findSystemAtelierListEntry(targetId) ||
        (systemAtelierDetailSeed.value &&
        [systemAtelierDetailSeed.value.idAtelier, systemAtelierDetailSeed.value.slug].includes(targetId)
          ? systemAtelierDetailSeed.value
          : null);
      if (fallbackAtelier) {
        systemAtelierDetail.value = buildSystemAtelierDetailFallback(fallbackAtelier);
        systemAtelierDetailError.value = "";
        return;
      }
      closeSystemAtelierDetail();
      if (currentRoute.value === "systemAtelierDetail") {
        currentRoute.value = "systemAteliers";
        scrollMainContentToTop();
      }
      systemAteliersError.value = `Le detail de l'atelier ${targetId} n'est plus disponible.`;
      return;
    }
    systemAtelierDetail.value = null;
    systemAtelierDetailError.value = readableError(err);
    if (syncGlobalError) appendError(err);
  } finally {
    if (systemAtelierDetailRequestId.value !== requestId) return;
    systemAtelierDetailLoading.value = false;
  }
}

function refreshSystemAtelierDetail() {
  if (!systemAtelierDetailId.value) return;
  void loadSystemAtelierDetail(systemAtelierDetailId.value);
}

function openSystemAtelierDetail(atelier) {
  const normalizedAtelier = atelier && typeof atelier === "object" ? normalizeSystemAtelier(atelier) : null;
  const targetId = String(
    normalizedAtelier?.idAtelier ||
      normalizedAtelier?.slug ||
      atelier?.id_atelier ||
      atelier?.slug ||
      atelier ||
      ""
  ).trim();
  if (!targetId) return;
  systemAtelierDetailSeed.value = normalizedAtelier;
  currentRoute.value = "systemAtelierDetail";
  scrollMainContentToTop();
  if (systemAtelierDetailId.value === targetId && (systemAtelierDetail.value || systemAtelierDetailLoading.value)) return;
  void loadSystemAtelierDetail(targetId);
}

function returnToSystemAteliers() {
  closeSystemAtelierDetail();
  currentRoute.value = "systemAteliers";
  scrollMainContentToTop();
}

function openSystemAtelierModal() {
  resetSystemAtelierModal();
  systemAtelierModal.open = true;
}

function closeSystemAtelierModal() {
  resetSystemAtelierModal();
}

async function submitSystemAtelierCreate() {
  if (systemAtelierModal.submitting) return;
  systemAtelierModal.error = "";
  systemAtelierModal.nomAtelier = String(systemAtelierModal.nomAtelier || "").trim();
  systemAtelierModal.slug = normalizeAtelierSlugInput(systemAtelierModal.slug);
  systemAtelierModal.proprietaireNom = String(systemAtelierModal.proprietaireNom || "").trim();
  systemAtelierModal.proprietaireEmail = String(systemAtelierModal.proprietaireEmail || "").trim();
  systemAtelierModal.proprietaireTelephone = String(systemAtelierModal.proprietaireTelephone || "").trim();

  if (!systemAtelierModal.nomAtelier) {
    systemAtelierModal.error = "Le nom de l'atelier est obligatoire.";
    return;
  }
  if (!systemAtelierModal.slug || systemAtelierModal.slug.length < 2) {
    systemAtelierModal.error = "Le slug doit contenir au moins 2 caracteres.";
    return;
  }
  if (!systemAtelierModal.proprietaireNom) {
    systemAtelierModal.error = "Le nom du proprietaire est obligatoire.";
    return;
  }
  if (!systemAtelierModal.proprietaireEmail) {
    systemAtelierModal.error = "L'email du proprietaire est obligatoire.";
    return;
  }
  if (!systemAtelierModal.proprietaireTelephone) {
    systemAtelierModal.error = "Le telephone du proprietaire est obligatoire.";
    return;
  }
  const passwordError = getPasswordPolicyError(systemAtelierModal.proprietaireMotDePasse);
  if (passwordError) {
    systemAtelierModal.error = passwordError;
    return;
  }

  systemAtelierModal.submitting = true;
  try {
    const created = await atelierApi.createSystemAtelier({
      nomAtelier: systemAtelierModal.nomAtelier,
      slug: systemAtelierModal.slug,
      proprietaire: {
        nom: systemAtelierModal.proprietaireNom,
        email: systemAtelierModal.proprietaireEmail,
        telephone: systemAtelierModal.proprietaireTelephone,
        motDePasse: systemAtelierModal.proprietaireMotDePasse
      }
    });
    closeSystemAtelierModal();
    await loadSystemAteliers({ page: 1 });
    await loadSystemDashboard();
    await loadSystemNotifications();
    const createdAtelierId = String(created?.atelier?.idAtelier || "");
    if (createdAtelierId) {
      openSystemAtelierDetail(createdAtelierId);
    }
    notify("Atelier cree avec succes.");
  } catch (err) {
    systemAtelierModal.error = readableError(err);
  } finally {
    systemAtelierModal.submitting = false;
  }
}

async function toggleSystemAtelierActivation(atelier) {
  const idAtelier = String(atelier?.idAtelier || "").trim();
  if (!idAtelier || systemAtelierActionId.value) return;
  const nextActif = atelier.actif !== true;
  const confirmed = await openActionModal({
    title: nextActif ? "Reactiver l'atelier" : "Desactiver l'atelier",
    message: nextActif
      ? `Voulez-vous reactiver ${atelier.nom} ?`
      : `Voulez-vous desactiver ${atelier.nom} ? Les sessions actives de cet atelier seront coupees.`,
    confirmLabel: nextActif ? "Reactiver" : "Desactiver",
    cancelLabel: "Annuler",
    tone: nextActif ? "green" : "red"
  });
  if (!confirmed) return;

  systemAtelierActionId.value = idAtelier;
  systemAteliersError.value = "";
  try {
    await atelierApi.setSystemAtelierActivation(idAtelier, nextActif);
    await loadSystemAteliers();
    await loadSystemDashboard();
    await loadSystemNotifications();
    if (systemAtelierDetailId.value === idAtelier) {
      await loadSystemAtelierDetail(idAtelier);
    }
    notify(`Atelier ${nextActif ? "reactive" : "desactive"}: ${atelier.nom}.`);
  } catch (err) {
    systemAteliersError.value = readableError(err);
  } finally {
    systemAtelierActionId.value = "";
  }
}

function canManageSystemAtelierOwner() {
  return Boolean(systemAtelierDetail.value?.idAtelier && systemAtelierDetail.value?.proprietaire?.id);
}

function getSystemAtelierRecoveryUsers() {
  return Array.isArray(systemAtelierDetail.value?.utilisateurs) ? systemAtelierDetail.value.utilisateurs : [];
}

function getSystemAtelierUserOptionLabel(user) {
  const parts = [user?.nom || "Utilisateur"];
  if (user?.email) parts.push(user.email);
  if (user?.roleId) parts.push(user.roleId);
  return parts.join(" / ");
}

async function refreshSystemAtelierRecoveryContext(idAtelier) {
  await loadSystemAteliers();
  await loadSystemDashboard();
  await loadSystemNotifications();
  await loadSystemAtelierDetail(idAtelier);
}

async function toggleSystemAtelierOwnerActivation() {
  if (!canManageSystemAtelierOwner() || systemOwnerActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const owner = atelier?.proprietaire;
  const nextActif = owner?.actif !== true;
  const confirmed = await openActionModal({
    title: nextActif ? "Reactiver le proprietaire" : "Desactiver le proprietaire",
    message: nextActif
      ? `Voulez-vous reactiver ${owner?.nom || "le proprietaire"} pour ${atelier?.nom || "cet atelier"} ?`
      : `Voulez-vous desactiver ${owner?.nom || "le proprietaire"} ? Ses sessions seront revoquees.`,
    confirmLabel: nextActif ? "Reactiver" : "Desactiver",
    cancelLabel: "Annuler",
    tone: nextActif ? "green" : "red"
  });
  if (!confirmed) return;

  systemOwnerActionKey.value = "activation";
  systemOwnerActionError.value = "";
  try {
    await atelierApi.setSystemAtelierOwnerActivation(atelier.idAtelier, nextActif);
    await loadSystemAtelierDetail(atelier.idAtelier);
    await loadSystemDashboard();
    notify(`Proprietaire ${nextActif ? "reactive" : "desactive"} pour ${atelier.nom}.`);
  } catch (err) {
    systemOwnerActionError.value = readableError(err);
  } finally {
    systemOwnerActionKey.value = "";
  }
}

async function promoteSystemAtelierUserToOwner() {
  if (!systemAtelierDetail.value?.idAtelier || systemRecoveryActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const candidates = getSystemAtelierRecoveryUsers().filter((user) => user?.id && user.roleId !== "PROPRIETAIRE");
  if (candidates.length === 0) {
    systemRecoveryActionError.value = "Aucun utilisateur atelier disponible pour une promotion proprietaire.";
    return;
  }

  const payload = await openActionModal({
    title: "Promouvoir en proprietaire",
    message: `Choisis l'utilisateur a promouvoir pour ${atelier.nom}.`,
    confirmLabel: "Promouvoir",
    cancelLabel: "Annuler",
    tone: "blue",
    fields: [
      {
        key: "userId",
        label: "Utilisateur",
        type: "select",
        required: true,
        options: candidates.map((user) => ({
          value: user.id,
          label: getSystemAtelierUserOptionLabel(user)
        }))
      }
    ]
  });
  if (!payload) return;

  const targetUser = candidates.find((user) => user.id === payload.userId);
  systemRecoveryActionKey.value = "promote";
  systemRecoveryActionError.value = "";
  try {
    await atelierApi.setSystemAtelierUserRole(atelier.idAtelier, payload.userId, "PROPRIETAIRE");
    await refreshSystemAtelierRecoveryContext(atelier.idAtelier);
    notify(`${targetUser?.nom || "L'utilisateur"} est maintenant proprietaire de ${atelier.nom}.`);
  } catch (err) {
    systemRecoveryActionError.value = readableError(err);
  } finally {
    systemRecoveryActionKey.value = "";
  }
}

async function reactivateSystemAtelierRecoveryUser() {
  if (!systemAtelierDetail.value?.idAtelier || systemRecoveryActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const candidates = getSystemAtelierRecoveryUsers().filter((user) => user?.id && (user.actif !== true || user.etatCompte !== "ACTIVE"));
  if (candidates.length === 0) {
    systemRecoveryActionError.value = "Aucun utilisateur inactif a reactiver dans cet atelier.";
    return;
  }

  const payload = await openActionModal({
    title: "Reactiver un utilisateur",
    message: `Choisis le compte a reactiver pour ${atelier.nom}.`,
    confirmLabel: "Reactiver",
    cancelLabel: "Annuler",
    tone: "green",
    fields: [
      {
        key: "userId",
        label: "Utilisateur",
        type: "select",
        required: true,
        options: candidates.map((user) => ({
          value: user.id,
          label: getSystemAtelierUserOptionLabel(user)
        }))
      }
    ]
  });
  if (!payload) return;

  const targetUser = candidates.find((user) => user.id === payload.userId);
  systemRecoveryActionKey.value = "reactivate";
  systemRecoveryActionError.value = "";
  try {
    await atelierApi.reactivateSystemAtelierUser(atelier.idAtelier, payload.userId);
    await refreshSystemAtelierRecoveryContext(atelier.idAtelier);
    notify(`${targetUser?.nom || "Le compte"} a ete reactive pour ${atelier.nom}.`);
  } catch (err) {
    systemRecoveryActionError.value = readableError(err);
  } finally {
    systemRecoveryActionKey.value = "";
  }
}

async function createSystemAtelierRecoveryOwner() {
  if (!systemAtelierDetail.value?.idAtelier || systemRecoveryActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const payload = await openActionModal({
    title: "Creer un proprietaire",
    message: `Creer un nouveau proprietaire de secours pour ${atelier.nom}.`,
    confirmLabel: "Creer le proprietaire",
    cancelLabel: "Annuler",
    tone: "blue",
    fields: [
      { key: "nom", label: "Nom", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "motDePasse", label: "Mot de passe", type: "password", required: true }
    ]
  });
  if (!payload) return;

  const passwordError = getPasswordPolicyError(payload.motDePasse);
  if (passwordError) {
    systemRecoveryActionError.value = passwordError;
    return;
  }

  systemRecoveryActionKey.value = "create-owner";
  systemRecoveryActionError.value = "";
  try {
    await atelierApi.createSystemAtelierOwner(atelier.idAtelier, payload);
    await refreshSystemAtelierRecoveryContext(atelier.idAtelier);
    notify(`Nouveau proprietaire cree pour ${atelier.nom}.`);
  } catch (err) {
    systemRecoveryActionError.value = readableError(err);
  } finally {
    systemRecoveryActionKey.value = "";
  }
}

async function demoteSystemAtelierOwner() {
  if (!systemAtelierDetail.value?.idAtelier || systemRecoveryActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const candidates = getSystemAtelierRecoveryUsers().filter((user) => user?.id && user.roleId === "PROPRIETAIRE");
  if (candidates.length === 0) {
    systemRecoveryActionError.value = "Aucun proprietaire atelier disponible pour une retrogradation.";
    return;
  }

  const payload = await openActionModal({
    title: "Retrograder un proprietaire",
    message: "Action sensible. Le dernier proprietaire actif restera bloque par le serveur.",
    confirmLabel: "Retrograder",
    cancelLabel: "Annuler",
    tone: "red",
    fields: [
      {
        key: "userId",
        label: "Proprietaire",
        type: "select",
        required: true,
        options: candidates.map((user) => ({
          value: user.id,
          label: getSystemAtelierUserOptionLabel(user)
        }))
      },
      {
        key: "roleId",
        label: "Nouveau role",
        type: "select",
        required: true,
        defaultValue: "COUTURIER",
        options: [
          { value: "COUTURIER", label: "Couturier" },
          { value: "CAISSIER", label: "Caissier" }
        ]
      }
    ]
  });
  if (!payload) return;

  const targetUser = candidates.find((user) => user.id === payload.userId);
  systemRecoveryActionKey.value = "demote";
  systemRecoveryActionError.value = "";
  try {
    await atelierApi.setSystemAtelierUserRole(atelier.idAtelier, payload.userId, payload.roleId);
    await refreshSystemAtelierRecoveryContext(atelier.idAtelier);
    notify(`${targetUser?.nom || "Le proprietaire"} a ete retrograde pour ${atelier.nom}.`);
  } catch (err) {
    systemRecoveryActionError.value = readableError(err);
  } finally {
    systemRecoveryActionKey.value = "";
  }
}

async function resetSystemAtelierOwnerPassword() {
  if (!canManageSystemAtelierOwner() || systemOwnerActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const owner = atelier?.proprietaire;
  const payload = await openActionModal({
    title: "Reinitialiser le mot de passe",
    message: `Definis un nouveau mot de passe pour ${owner?.nom || "le proprietaire"} de ${atelier?.nom || "cet atelier"}.`,
    confirmLabel: "Reinitialiser",
    cancelLabel: "Annuler",
    tone: "blue",
    fields: [
      {
        key: "motDePasse",
        label: "Nouveau mot de passe",
        type: "password",
        required: true
      }
    ]
  });
  if (!payload) return;

  const passwordError = getPasswordPolicyError(payload.motDePasse);
  if (passwordError) {
    systemOwnerActionError.value = passwordError;
    return;
  }

  systemOwnerActionKey.value = "password";
  systemOwnerActionError.value = "";
  try {
    await atelierApi.resetSystemAtelierOwnerPassword(atelier.idAtelier, payload.motDePasse);
    await loadSystemAtelierDetail(atelier.idAtelier);
    notify(`Mot de passe reinitialise pour ${owner?.nom || "le proprietaire"}.`);
  } catch (err) {
    systemOwnerActionError.value = readableError(err);
  } finally {
    systemOwnerActionKey.value = "";
  }
}

async function revokeSystemAtelierOwnerSessions() {
  if (!canManageSystemAtelierOwner() || systemOwnerActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const owner = atelier?.proprietaire;
  const confirmed = await openActionModal({
    title: "Revoquer les sessions",
    message: `Voulez-vous couper les sessions actives de ${owner?.nom || "le proprietaire"} ?`,
    confirmLabel: "Couper les sessions",
    cancelLabel: "Annuler",
    tone: "red"
  });
  if (!confirmed) return;

  systemOwnerActionKey.value = "sessions";
  systemOwnerActionError.value = "";
  try {
    const payload = await atelierApi.revokeSystemAtelierOwnerSessions(atelier.idAtelier);
    await loadSystemAtelierDetail(atelier.idAtelier);
    notify(`${Number(payload?.revokedSessions || 0)} session(s) revoquee(s) pour ${owner?.nom || "le proprietaire"}.`);
  } catch (err) {
    systemOwnerActionError.value = readableError(err);
  } finally {
    systemOwnerActionKey.value = "";
  }
}

async function reloadAll() {
  loading.value = true;
  clearGlobalErrorMessage();
  commandeActionsById.value = {};
  retoucheActionsById.value = {};

  if (isSystemManager.value) {
    clients.value = [];
    dossiers.value = [];
    commandes.value = [];
    retouches.value = [];
    stockArticles.value = [];
    ventes.value = [];
    factures.value = [];
    caisseJour.value = null;
    dashboardContactBoard.value = createEmptyDashboardContactBoard();
    dashboardContactBoardError.value = "";
    dashboardContactBoardLoading.value = false;
    if (!getNetworkState().online) {
      loading.value = false;
      return;
    }
    await loadSystemAteliers({ syncGlobalError: true });
    await loadSystemDashboard({ syncGlobalError: true });
    await loadSystemNotifications({ syncGlobalError: true });
    if (currentRoute.value === "systemAtelierDetail" && systemAtelierDetailId.value) {
      await loadSystemAtelierDetail(systemAtelierDetailId.value);
    }
    loading.value = false;
    return;
  }

  const shouldLoadClients = canReadClients.value;
  const shouldLoadDossiers = canAccessModule("dossiers");
  const shouldLoadCommandes = canReadCommandes.value;
  const shouldLoadRetouches = canReadRetouches.value;
  const shouldLoadRetoucheTypes = shouldLoadRetouches || canCreateRetouche.value || settingsRoleAllowed.value;
  const shouldLoadStock = canReadStockArticles.value;
  const shouldLoadVentes = canReadVentes.value;
  const shouldLoadFactures = canAccessModule("facturation");
  const shouldLoadCaisse = canAccessModule("caisse");
  const atelierId = currentAtelierId.value;
  if (!atelierId) {
    dossiers.value = [];
    dashboardContactBoard.value = createEmptyDashboardContactBoard();
    dashboardContactBoardError.value = "";
    dashboardContactBoardLoading.value = false;
    clearOwnerNotificationsState();
    loading.value = false;
    return;
  }

  const localFirst = await loadMainListsLocalFirst({
    atelierId,
    loadClients: shouldLoadClients,
    loadCommandes: shouldLoadCommandes,
    loadRetouches: shouldLoadRetouches
  });

  if (shouldLoadClients) applyClientsRows(localFirst.cached.clients);
  if (shouldLoadCommandes) applyCommandesRows(localFirst.cached.commandes);
  if (shouldLoadRetouches) applyRetouchesRows(localFirst.cached.retouches);

  if (!localFirst.online) {
    if (!localFirst.hasCachedData && (shouldLoadClients || shouldLoadCommandes || shouldLoadRetouches)) {
      appendUiMessage(OFFLINE_READ_MESSAGES.NO_LOCAL_DATA);
    }

    dossiers.value = [];
    retoucheTypeDefinitions.value = [];
    stockArticles.value = [];
    ventes.value = [];
    factures.value = [];
    caisseJour.value = null;

    if (shouldLoadRetoucheTypes) appendUiMessage(OFFLINE_READ_MESSAGES.RETOUCHE_TYPES);
    if (shouldLoadStock) appendUiMessage(OFFLINE_READ_MESSAGES.STOCK);
    if (shouldLoadVentes) appendUiMessage(OFFLINE_READ_MESSAGES.VENTES);
    if (shouldLoadFactures) appendUiMessage(OFFLINE_READ_MESSAGES.FACTURES);
    if (shouldLoadCaisse) appendUiMessage(OFFLINE_READ_MESSAGES.CAISSE);
    if (shouldLoadClients && currentRoute.value === "clientsMesures" && selectedClientConsultationId.value) {
      clientConsultation.value = null;
      clientConsultationLoading.value = false;
      clientConsultationError.value = OFFLINE_READ_MESSAGES.CLIENT_CONSULTATION;
    }
    if (currentRoute.value === "dashboard") {
      dashboardContactBoard.value = createEmptyDashboardContactBoard();
      dashboardContactBoardError.value = canAccessContactFollowUpDashboard.value ? "Suivi client indisponible hors ligne." : "";
      dashboardContactBoardLoading.value = false;
    }
    atelierNotificationsUnreadCount.value = 0;
    if (currentRoute.value === "notifications") {
      atelierNotifications.value = [];
      atelierNotificationsError.value = "Notifications indisponibles hors ligne.";
      atelierNotificationsLoading.value = false;
    }

    loading.value = false;
    return;
  }

  const refreshedMain = await localFirst.refreshPromise;
  if (shouldLoadClients) {
    if (refreshedMain?.clients) applyClientsRows(refreshedMain.clients);
    else if (refreshedMain?.errors?.clients) appendError(refreshedMain.errors.clients);
  }
  if (shouldLoadCommandes) {
    if (refreshedMain?.commandes) applyCommandesRows(refreshedMain.commandes);
    else if (refreshedMain?.errors?.commandes) appendError(refreshedMain.errors.commandes);
  }
  if (shouldLoadRetouches) {
    if (refreshedMain?.retouches) applyRetouchesRows(refreshedMain.retouches);
    else if (refreshedMain?.errors?.retouches) appendError(refreshedMain.errors.retouches);
  }

  const [dossiersResult, retoucheTypesResult, stockResult, ventesResult, facturesResult, caisseDaysResult] = await Promise.allSettled([
    shouldLoadDossiers ? atelierApi.listDossiers() : Promise.resolve([]),
    shouldLoadRetoucheTypes ? atelierApi.listRetoucheTypes() : Promise.resolve([]),
    shouldLoadStock ? atelierApi.listStockArticles() : Promise.resolve([]),
    shouldLoadVentes ? atelierApi.listVentes() : Promise.resolve([]),
    shouldLoadFactures ? atelierApi.listFactures() : Promise.resolve([]),
    shouldLoadCaisse ? atelierApi.listCaisseJours() : Promise.resolve([])
  ]);

  if (dossiersResult.status === "fulfilled") applyDossiersRows(dossiersResult.value || []);
  else if (shouldLoadDossiers) appendError(dossiersResult.reason);

  if (retoucheTypesResult.status === "fulfilled") {
    retoucheTypeDefinitions.value = (retoucheTypesResult.value || [])
      .map(normalizeRetoucheTypeDefinition)
      .filter(Boolean)
      .sort((left, right) => {
        if (left.ordreAffichage !== right.ordreAffichage) return left.ordreAffichage - right.ordreAffichage;
        return String(left.libelle || left.code).localeCompare(String(right.libelle || right.code), "fr", {
          sensitivity: "base"
        });
      });
  } else if (shouldLoadRetoucheTypes) appendError(retoucheTypesResult.reason);

  if (stockResult.status === "fulfilled") stockArticles.value = stockResult.value.map(normalizeStockArticle);
  else if (shouldLoadStock) appendError(stockResult.reason);

  if (ventesResult.status === "fulfilled") ventes.value = ventesResult.value.map(normalizeVente);
  else if (shouldLoadVentes) appendError(ventesResult.reason);

  if (facturesResult.status === "fulfilled") factures.value = facturesResult.value.map(normalizeFacture);
  else if (shouldLoadFactures) appendError(facturesResult.reason);

  if (caisseDaysResult.status === "fulfilled") {
    const days = caisseDaysResult.value || [];
    if (days.length > 0) {
      try {
        const detail = await atelierApi.getCaisseJour(days[0].idCaisseJour || days[0].id_caisse_jour);
        caisseJour.value = normalizeCaisse(detail);
      } catch (err) {
        appendError(err);
      }
    } else {
      caisseJour.value = null;
    }
  } else if (shouldLoadCaisse) {
    appendError(caisseDaysResult.reason);
  }

  if (shouldLoadClients && currentRoute.value === "clientsMesures" && selectedClientConsultationId.value) {
    await loadClientConsultation(selectedClientConsultationId.value, true);
  }

  if (currentRoute.value === "dashboard") {
    await loadDashboardContactBoard();
  }

  await loadAtelierNotificationsUnreadCount({ syncGlobalError: true });
  if (currentRoute.value === "notifications") {
    await loadAtelierNotifications({ syncGlobalError: true });
  }

  loading.value = false;
}

async function updateSystemAtelierOwnerContact() {
  if (!systemAtelierDetail.value?.idAtelier || systemOwnerActionKey.value) return;
  const atelier = systemAtelierDetail.value;
  const payload = await openActionModal({
    title: "Modifier le telephone proprietaire",
    message: `Mettre a jour le contact principal de ${atelier.nom}.`,
    confirmLabel: "Enregistrer",
    cancelLabel: "Annuler",
    tone: "blue",
    fields: [
      {
        key: "telephone",
        label: "Telephone",
        type: "text",
        required: true,
        defaultValue: String(atelier.proprietaire?.telephone || "").trim()
      }
    ]
  });
  if (!payload) return;

  systemOwnerActionKey.value = "contact";
  systemOwnerActionError.value = "";
  try {
    await atelierApi.updateSystemAtelierOwnerContact(atelier.idAtelier, payload.telephone);
    await refreshSystemAtelierRecoveryContext(atelier.idAtelier);
    notify(`Telephone proprietaire mis a jour pour ${atelier.nom}.`);
  } catch (err) {
    systemOwnerActionError.value = readableError(err);
  } finally {
    systemOwnerActionKey.value = "";
  }
}

const dossiersFiltered = computed(() => {
  const query = String(dossierFilters.recherche || "").trim().toLowerCase();
  return dossiers.value.filter((dossier) => {
    if (dossierFilters.statut !== "ALL" && dossier.statutDossier !== dossierFilters.statut) return false;
    if (dossierFilters.type !== "ALL" && dossier.typeDossier !== dossierFilters.type) return false;
    if (!query) return true;
    const haystack = [
      dossier.idDossier,
      dossier.responsable?.nomComplet,
      dossier.responsable?.telephone,
      dossier.typeDossier,
      dossier.notes
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(query);
  });
});

const hasActiveDossierFilters = computed(() => {
  return (
    String(dossierFilters.recherche || "").trim().length > 0 ||
    String(dossierFilters.type || "ALL").trim().toUpperCase() !== "ALL" ||
    String(dossierFilters.statut || "ALL").trim().toUpperCase() !== "ALL"
  );
});

const dossierEmptyStateTitle = computed(() => {
  return hasActiveDossierFilters.value ? "Aucun dossier ne correspond" : "Aucun dossier pour le moment";
});

const dossierEmptyStateDescription = computed(() => {
  return hasActiveDossierFilters.value
    ? "Essayez une autre recherche ou reinitialisez les filtres."
    : "Creez votre premier dossier pour commencer.";
});

const dossiersPages = computed(() => Math.max(1, Math.ceil(dossiersFiltered.value.length / dossiersPagination.pageSize)));
const dossiersPaged = computed(() => dossiersFiltered.value.slice(0, dossiersVisibleCount.value));

async function loadDossierDetail(idDossier, { preserveExisting = true } = {}) {
  const requestedId = String(idDossier || "").trim();
  if (!requestedId) {
    detailDossier.value = null;
    detailDossierError.value = "";
    return null;
  }
  if (dossierDetailLoadPromise && dossierDetailLoadTargetId === requestedId) {
    return dossierDetailLoadPromise;
  }

  const requestId = ++dossierDetailLoadRequestId;
  dossierDetailLoadTargetId = requestedId;
  const keepCurrentDetailVisible = preserveExisting && String(detailDossier.value?.idDossier || "").trim() === requestedId;

  dossierDetailLoadPromise = (async () => {
    detailDossierLoading.value = true;
    if (!keepCurrentDetailVisible) {
      detailDossierError.value = "";
    }
    try {
      const payload = await atelierApi.getDossier(requestedId);
      if (requestId !== dossierDetailLoadRequestId) return null;
      detailDossier.value = normalizeDossier(payload);
      detailDossierError.value = "";
      return detailDossier.value;
    } catch (err) {
      if (requestId !== dossierDetailLoadRequestId) return null;
      if (!keepCurrentDetailVisible) {
        detailDossier.value = null;
      }
      detailDossierError.value = readableError(err);
      return null;
    } finally {
      if (requestId === dossierDetailLoadRequestId) {
        detailDossierLoading.value = false;
      }
    }
  })();

  try {
    return await dossierDetailLoadPromise;
  } finally {
    if (requestId === dossierDetailLoadRequestId) {
      dossierDetailLoadPromise = null;
      dossierDetailLoadTargetId = "";
    }
  }
}

async function openDossierDetail(idDossier) {
  selectedDossierId.value = idDossier;
  currentRoute.value = "dossier-detail";
  await loadDossierDetail(idDossier);
}

function openCreateDossierModal() {
  resetDossierDraft();
  dossierModalOpen.value = true;
}

watch(
  () => [dossiersFiltered.value.length, dossierFilters.recherche, dossierFilters.type, dossierFilters.statut],
  () => {
    resetDossierVisibleCount();
    setupDossierInfiniteObserver();
  },
  { deep: true }
);

watch(
  () => currentRoute.value,
  (route) => {
    if (route === "dossiers") {
      resetDossierVisibleCount();
      setupDossierInfiniteObserver();
    }
  },
  { immediate: true }
);

watch(dossierInfiniteSentinel, () => {
  setupDossierInfiniteObserver();
});

onMounted(() => {
  setupDossierInfiniteObserver();
});

onUnmounted(() => {
  if (dossierInfiniteObserver) dossierInfiniteObserver.disconnect();
});

function closeDossierModal() {
  dossierModalOpen.value = false;
}

async function submitDossierCreate() {
  if (dossierSubmitting.value) return;
  dossierSubmitting.value = true;
  try {
    const payload = {
      typeDossier: dossierDraft.typeDossier,
      notes: String(dossierDraft.notes || "").trim()
    };
    if (dossierDraft.mode === "existing") {
      if (!dossierDraft.existingClientId) throw new Error("Selectionnez le responsable du dossier.");
      payload.idResponsableClient = dossierDraft.existingClientId;
    } else {
      const nom = String(dossierDraft.newClient.nom || "").trim();
      const prenom = String(dossierDraft.newClient.prenom || "").trim();
      if (!nom || !prenom) throw new Error("Renseignez le nom et le prenom du responsable.");
      payload.nouveauResponsable = {
        nom,
        prenom,
        telephone: String(dossierDraft.newClient.telephone || "").trim()
      };
      if (dossierDraft.doublonDecisionAction) {
        payload.doublonDecision = {
          action: dossierDraft.doublonDecisionAction,
          idClient: dossierDraft.doublonDecisionId || undefined
        };
      }
    }
    const created = await atelierApi.createDossier(payload);
    const normalized = normalizeDossier(created?.dossier || created);
    applyDossiersRows([normalized, ...dossiers.value]);
    closeDossierModal();
    notify(`Dossier cree: ${normalized.idDossier}`);
    await openDossierDetail(normalized.idDossier);
  } catch (err) {
    notify(readableError(err));
  } finally {
    dossierSubmitting.value = false;
  }
}

function openCommandeWizardFromDossier() {
  if (!detailDossier.value?.idDossier) return;
  resetWizard();
  wizard.dossierId = detailDossier.value.idDossier;
  if (detailDossier.value.responsable?.idClient) {
    wizard.mode = "existing";
    wizard.existingClientId = detailDossier.value.responsable.idClient;
    wizard.resolvedClientId = detailDossier.value.responsable.idClient;
  }
  wizard.open = true;
}

function openRetoucheWizardFromDossier() {
  if (!detailDossier.value?.idDossier) return;
  resetRetoucheWizard();
  retoucheWizard.dossierId = detailDossier.value.idDossier;
  if (detailDossier.value.responsable?.idClient) {
    retoucheWizard.mode = "existing";
    retoucheWizard.existingClientId = detailDossier.value.responsable.idClient;
    retoucheWizard.resolvedClientId = detailDossier.value.responsable.idClient;
  }
  retoucheWizard.open = true;
}

async function loadClientConsultation(idClient, force = false) {
  if (!idClient) {
    clientConsultation.value = null;
    clientConsultationError.value = "";
    resetContactFollowUpState(clientConsultationContactFollowUp);
    return;
  }
  if (!getNetworkState().online || !isRemoteEntityId(idClient)) {
    clientConsultation.value = null;
    clientConsultationLoading.value = false;
    clientConsultationError.value = OFFLINE_READ_MESSAGES.CLIENT_CONSULTATION;
    resetContactFollowUpState(clientConsultationContactFollowUp);
    return;
  }
  if (!force && clientConsultation.value?.client?.idClient === idClient && !clientConsultationError.value) return;

  clientConsultationLoading.value = true;
  clientConsultationError.value = "";
  try {
    const payload = await atelierApi.getClientConsultation(idClient, {
      source: clientHistoryFilters.source,
      typeHabit: clientHistoryFilters.typeHabit,
      periode: clientHistoryFilters.periode,
      size: clientPagination.pageSize,
      pageCommandes: clientPagination.commandesPage,
      pageRetouches: clientPagination.retouchesPage,
      pageMesures: clientPagination.mesuresPage
    });
    const normalized = normalizeClientConsultation(payload);
    clientConsultation.value = normalized;
    void loadClientContactSummaryIntoState(clientConsultationContactFollowUp, normalized?.client?.idClient);
    const pg = normalized.historique?.pagination || {};
    clientPagination.commandesPage = Number(pg.commandes?.page || clientPagination.commandesPage);
    clientPagination.retouchesPage = Number(pg.retouches?.page || clientPagination.retouchesPage);
    clientPagination.mesuresPage = Number(pg.mesures?.page || clientPagination.mesuresPage);
  } catch (err) {
    clientConsultation.value = null;
    clientConsultationError.value = readableError(err);
    resetContactFollowUpState(clientConsultationContactFollowUp);
  } finally {
    clientConsultationLoading.value = false;
  }
}

async function onVoirOrigineMesure(item) {
  if (!item) return;
  if (item.source === "COMMANDE") {
    await openCommandeDetail(item.idOrigine);
    return;
  }
  if (item.source === "RETOUCHE") {
    await openRetoucheDetail(item.idOrigine);
  }
}

async function loadAuditHub() {
  auditError.value = "";
  const [journalierResult, opsResult] = await Promise.allSettled([
    atelierApi.listCaisseAuditJournalier(),
    atelierApi.listCaisseAuditOperations()
  ]);

  if (journalierResult.status === "fulfilled") {
    auditCaisseJournalier.value = journalierResult.value || [];
    const first = auditCaisseJournalier.value[0] || null;
    auditHubMetrics.value.caissesCloturees = auditCaisseJournalier.value.length;
    auditHubMetrics.value.dernierSoldeCloture = Number(first?.solde_cloture || 0);
    auditHubMetrics.value.moisCourant = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } else {
    appendAuditError(readableError(journalierResult.reason));
  }

  if (opsResult.status === "fulfilled") {
    auditOperations.value = opsResult.value || [];
    auditHubMetrics.value.totalOperations = auditOperations.value.length;
    auditHubMetrics.value.montantCumule = auditOperations.value.reduce((sum, row) => sum + Number(row.montant || 0), 0);
  } else {
    appendAuditError(readableError(opsResult.reason));
  }
}

async function loadAuditCaisse() {
  const [journalierResult, hebdoResult, mensuelResult, annuelResult] = await Promise.allSettled([
    atelierApi.listCaisseAuditJournalier(),
    atelierApi.listBilansCaisse("HEBDO", 100),
    atelierApi.listBilansCaisse("MENSUEL", 60),
    atelierApi.listBilansCaisse("ANNUEL", 20)
  ]);

  if (journalierResult.status === "fulfilled") auditCaisseJournalier.value = journalierResult.value || [];
  else appendAuditError(readableError(journalierResult.reason));

  if (hebdoResult.status === "fulfilled") bilanHebdo.value = hebdoResult.value || [];
  else appendAuditError(readableError(hebdoResult.reason));

  if (mensuelResult.status === "fulfilled") bilanMensuel.value = mensuelResult.value || [];
  else appendAuditError(readableError(mensuelResult.reason));

  if (annuelResult.status === "fulfilled") bilanAnnuel.value = annuelResult.value || [];
  else appendAuditError(readableError(annuelResult.reason));
}

async function loadAuditUtilisateurs() {
  const rows = await atelierApi.listAuditUtilisateurs({ limit: 500 });
  auditUtilisateurs.value = (rows || []).map(normalizeAuditUtilisateurEvent);
}

async function loadAuditPage(path = "/audit") {
  auditError.value = "";
  auditLoading.value = true;

  try {
    if (!canAccessAuditPath(path)) {
      if (currentRoute.value === "audit") {
        currentRoute.value = resolveAccessibleRoute();
      }
      return;
    }
    if (path === "/audit") {
      await loadAuditHub();
    } else if (path === "/audit/caisse") {
      await loadAuditCaisse();
    } else if (path === "/audit/annuel") {
      await loadAuditCaisse();
    } else if (path === "/audit/operations") {
      auditOperations.value = await atelierApi.listCaisseAuditOperations();
    } else if (path === "/audit/commandes") {
      auditCommandes.value = await atelierApi.listAuditCommandes();
    } else if (path === "/audit/retouches") {
      auditRetouches.value = await atelierApi.listAuditRetouches();
    } else if (path === "/audit/stock-ventes") {
      auditStockVentes.value = await atelierApi.listAuditStockVentes();
    } else if (path === "/audit/factures") {
      const rows = await atelierApi.listAuditFactures();
      auditFactures.value = (rows || []).map(normalizeFacture);
    } else if (path === "/audit/utilisateurs") {
      await loadAuditUtilisateurs();
    }
  } catch (err) {
    auditError.value = readableError(err);
  } finally {
    auditLoading.value = false;
  }
}

function operationAuditType(row) {
  const motif = String(row?.motif || "");
  if (motif === "PAIEMENT_COMMANDE") return "Paiement commande";
  if (motif === "PAIEMENT_RETOUCHE") return "Paiement retouche";
  if (motif === "VENTE_STOCK") return "Vente stock";
  if (row?.type_operation === "SORTIE") return "Depense atelier";
  return motif || String(row?.type_operation || "-");
}

function depenseTypeLabel(value) {
  const upper = String(value || "QUOTIDIENNE").toUpperCase();
  return upper === "EXCEPTIONNELLE" ? "Exceptionnelle" : "Quotidienne";
}

function formatRoleLabel(value) {
  const key = String(value || "").trim().toUpperCase();
  const labels = {
    PROPRIETAIRE: "Proprietaire",
    MANAGER_SYSTEME: "Manager systeme",
    COUTURIER: "Couturier",
    CAISSIER: "Caissier"
  };
  return labels[key] || (key ? key.replaceAll("_", " ") : "-");
}

function formatAccountStateLabel(value) {
  const key = String(value || "").trim().toUpperCase();
  if (key === "ACTIVE") return "Actif";
  if (key === "SUSPENDED") return "Suspendu";
  if (key === "DISABLED") return "Desactive";
  return key || "-";
}

function formatAuditCodeLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return raw
    .split(/[_/]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function baseAuditEntityLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "auth/users") return "Gestion des utilisateurs";
  if (key === "auth/users/activation") return "Activation des comptes";
  if (key === "auth/role-permissions") return "Permissions des roles";
  if (key === "/auth/logout") return "Deconnexion";
  if (key === "auth") return "Authentification";
  if (key.startsWith("system/ateliers")) return "Atelier";
  return "Autre action de securite";
}

function auditUserFieldLabel(key) {
  const map = {
    id: "ID",
    email: "Email",
    roleId: "Role",
    etatCompte: "Etat du compte",
    actif: "Actif",
    tokenVersion: "Version token"
  };
  return map[key] || key;
}

function auditDetailValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.map((item) => auditDetailValue(item)).join(", ");
  if (typeof value === "string") {
    if (keyLooksLikeRole(value)) return formatRoleLabel(value);
    if (keyLooksLikeAccountState(value)) return formatAccountStateLabel(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function keyLooksLikeRole(value) {
  const key = String(value || "").trim().toUpperCase();
  return ["PROPRIETAIRE", "MANAGER_SYSTEME", "COUTURIER", "CAISSIER"].includes(key);
}

function keyLooksLikeAccountState(value) {
  const key = String(value || "").trim().toUpperCase();
  return ["ACTIVE", "SUSPENDED", "DISABLED"].includes(key);
}

function normalizeAuditUtilisateurEvent(raw) {
  const payload = raw?.payload && typeof raw.payload === "object" ? raw.payload : {};
  return {
    idEvenement: raw?.idEvenement || raw?.id_evenement || "",
    atelierId: String(raw?.atelierId || raw?.atelier_id || "").trim(),
    userId: String(raw?.userId || raw?.utilisateurId || raw?.utilisateur_id || "").trim(),
    userName: String(raw?.userName || raw?.utilisateurNom || raw?.utilisateur_nom || "").trim(),
    userEmail: String(raw?.userEmail || raw?.utilisateurEmail || raw?.utilisateur_email || "").trim(),
    role: String(raw?.role || "").trim(),
    actionType: String(raw?.actionType || raw?.action || "").trim().toUpperCase(),
    entityType: String(raw?.entityType || raw?.entite || "").trim(),
    entityId: String(raw?.entityId || raw?.entiteId || raw?.entite_id || "").trim(),
    entityLabel: String(raw?.entityLabel || raw?.entiteLabel || "").trim(),
    success: raw?.success === true || payload?.succes === true,
    reason: String(raw?.reason || payload?.raison || "").trim() || null,
    createdAt: raw?.createdAt || raw?.dateEvenement || raw?.date_evenement || "",
    metadata: raw?.metadata !== undefined ? raw.metadata : payload?.details || null,
    payload
  };
}

function formatAuditEntity(event) {
  if (!event) return "-";
  if (event.entityLabel) return event.entityLabel;
  const entityType = String(event.entityType || "").trim().toLowerCase();
  const entityId = String(event.entityId || "").trim();
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
  if (entityType === "auth/role-permissions") {
    const roleValue = String(metadata.role || entityId || "").trim();
    return roleValue ? `Role : ${formatRoleLabel(roleValue)}` : "Permissions des roles";
  }
  if (entityType === "auth/users" || entityType === "auth/users/activation") {
    const userLabel = metadata?.createdUser?.email || metadata?.after?.email || metadata?.before?.email || event.userEmail || entityId;
    return userLabel ? `Utilisateur : ${userLabel}` : "Compte utilisateur";
  }
  if (entityType === "/auth/logout") return "Session utilisateur";
  if (entityType === "auth") return "Authentification";
  if (entityType.startsWith("system/ateliers")) {
    const atelierLabel = String(metadata.atelierNom || entityId || "").trim();
    return atelierLabel ? `Atelier : ${atelierLabel}` : "Atelier";
  }
  const base = baseAuditEntityLabel(entityType);
  return entityId ? `${base} : ${entityId}` : base;
}

function formatAuditAction(event) {
  const actionType = String(event?.actionType || "").trim().toUpperCase();
  const metadata = event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const roleValue = String(metadata.role || event?.entityId || "").trim();
  if (actionType === "ROLE_PERMISSIONS_UPDATED") {
    return roleValue ? `Modification des permissions du role '${formatRoleLabel(roleValue)}'` : "Modification des permissions d'un role";
  }
  if (actionType === "ROLE_PERMISSIONS_UPDATE_FAILED") {
    return roleValue ? `Echec de modification des permissions du role '${formatRoleLabel(roleValue)}'` : "Echec de modification des permissions d'un role";
  }
  if (actionType === "USER_CREATED") return "Creation d'un compte utilisateur";
  if (actionType === "USER_CREATE_FAILED") return "Echec de creation d'un compte utilisateur";
  if (actionType === "USER_UPDATED") return "Mise a jour du compte utilisateur";
  if (actionType === "USER_UPDATE_FAILED") return "Echec de mise a jour du compte utilisateur";
  if (actionType === "USER_ACTIVATION_UPDATED") {
    const nextState = String(metadata?.after?.etatCompte || "").trim().toUpperCase();
    return nextState === "DISABLED" ? "Desactivation du compte utilisateur" : "Activation du compte utilisateur";
  }
  if (actionType === "USER_ACTIVATION_UPDATE_FAILED") return "Echec de mise a jour du statut du compte utilisateur";
  if (actionType === "AUTH_REFUS" || actionType === "TOKEN_REVOQUE_REFUS" || actionType === "UTILISATEUR_INTROUVABLE_REFUS") {
    return "Tentative de connexion echouee";
  }
  if (actionType === "COMPTE_INACTIF_REFUS") return "Connexion refusee: compte utilisateur inactif";
  if (actionType === "ATELIER_INACTIF_REFUS") return "Connexion refusee: atelier desactive";
  if (actionType === "PERMISSION_REFUS") return "Tentative d'acces refusee";
  if (actionType === "PERMISSION_AUTORISEE") return "Acces autorise apres controle des permissions";
  if (actionType === "SYSTEM_MANAGER_REFUS") return "Tentative d'acces a l'administration systeme refusee";
  if (actionType === "LOGOUT") return "Deconnexion du compte utilisateur";
  if (actionType === "SYSTEM_OWNER_ACTIVATED") return "Reactivation du compte proprietaire de l'atelier";
  if (actionType === "SYSTEM_OWNER_DEACTIVATED") return "Desactivation du compte proprietaire de l'atelier";
  if (actionType === "SYSTEM_OWNER_PASSWORD_RESET") return "Reinitialisation du mot de passe du proprietaire";
  if (actionType === "SYSTEM_OWNER_SESSIONS_REVOKED") return "Revocation des sessions du proprietaire";
  return formatAuditCodeLabel(actionType);
}

function formatAuditStatus(event) {
  return event?.success ? "✔ Succes" : "❌ Echec";
}

function hasAuditMetadata(event) {
  return event?.metadata !== null && event?.metadata !== undefined && event?.metadata !== "";
}

function auditMetadataJson(event) {
  if (!hasAuditMetadata(event)) return "";
  return JSON.stringify(event.metadata, null, 2);
}

function auditUserDiffRows(details) {
  const before = details?.before && typeof details.before === "object" ? details.before : {};
  const after = details?.after && typeof details.after === "object" ? details.after : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys.map((key) => ({
    key,
    label: auditUserFieldLabel(key),
    before: auditDetailValue(before[key]),
    after: auditDetailValue(after[key])
  }));
}

async function loadAudit() {
  auditError.value = "";
  await loadAuditPage(auditSubRoute.value);
}

function appendError(err) {
  const msg = readableError(err);
  if (!msg) return;
  setGlobalErrorMessage(msg);
}

function appendUiMessage(message) {
  const normalized = String(message || "").trim();
  if (!normalized) return;
  appendError(new Error(normalized));
}

function clearGlobalErrorMessage() {
  if (globalErrorClearTimer) {
    window.clearTimeout(globalErrorClearTimer);
    globalErrorClearTimer = null;
  }
  errorMessage.value = "";
}

function setGlobalErrorMessage(message, timeoutMs = 7000) {
  const normalized = String(message || "").trim();
  if (!normalized) {
    clearGlobalErrorMessage();
    return;
  }

  if (globalErrorClearTimer) {
    window.clearTimeout(globalErrorClearTimer);
    globalErrorClearTimer = null;
  }

  errorMessage.value = normalized;

  if (timeoutMs > 0 && typeof window !== "undefined") {
    globalErrorClearTimer = window.setTimeout(() => {
      globalErrorClearTimer = null;
      if (errorMessage.value === normalized) {
        errorMessage.value = "";
      }
    }, timeoutMs);
  }
}

function applyClientsRows(rows = []) {
  clients.value = (rows || []).map(normalizeClient);
  if (!selectedClientConsultationId.value && clients.value.length > 0) {
    selectedClientConsultationId.value = clients.value[0].idClient;
  }
  if (selectedClientConsultationId.value && !clients.value.some((item) => item.idClient === selectedClientConsultationId.value)) {
    selectedClientConsultationId.value = clients.value[0]?.idClient || "";
    clientConsultation.value = null;
  }
}

function applyDossiersRows(rows = []) {
  dossiers.value = (rows || []).map(normalizeDossier);
}

function applyCommandesRows(rows = []) {
  commandes.value = (rows || []).map(normalizeCommande);
}

function applyRetouchesRows(rows = []) {
  retouches.value = (rows || []).map(normalizeRetouche);
}

function upsertClientRow(row) {
  const normalized = normalizeClient(row);
  clients.value = [...clients.value.filter((item) => item.idClient !== normalized.idClient), normalized];
}

function prependCommandeRow(row) {
  const normalized = normalizeCommande(row);
  commandes.value = [normalized, ...commandes.value.filter((item) => item.idCommande !== normalized.idCommande)];
}

function prependRetoucheRow(row) {
  const normalized = normalizeRetouche(row);
  retouches.value = [normalized, ...retouches.value.filter((item) => item.idRetouche !== normalized.idRetouche)];
}

function mediaActionKey(item) {
  return String(item?.localId || item?.idMedia || item?.serverId || "").trim();
}

async function buildCommandeMediaUiRows(rows = [], commande = detailCommande.value) {
  const commandeServerId = String(
    commande?.serverId || commande?.idCommandeServerId || (isRemoteEntityId(commande?.idCommande) ? commande.idCommande : "")
  ).trim();
  const canHydrateRemoteMedia = getNetworkState().online && Boolean(commandeServerId);
  const nextRows = [];

  for (const item of Array.isArray(rows) ? rows : []) {
    const nextItem = {
      ...item,
      thumbnailBlobUrl: "",
      fileBlobUrl: ""
    };

    if (item?.blob instanceof Blob) {
      const objectUrl = URL.createObjectURL(item.blob);
      nextItem.thumbnailBlobUrl = objectUrl;
      nextItem.fileBlobUrl = objectUrl;
      nextRows.push(nextItem);
      continue;
    }

    const mediaServerId = String(item?.serverId || item?.idMedia || "").trim();
    if (canHydrateRemoteMedia && mediaServerId) {
      try {
        const thumbnailBlob = await atelierApi.getCommandeMediaThumbnailBlob(commandeServerId, mediaServerId);
        nextItem.thumbnailBlobUrl = URL.createObjectURL(thumbnailBlob);
      } catch {
        nextItem.thumbnailBlobUrl = "";
      }
    }

    nextRows.push(nextItem);
  }

  return nextRows;
}

async function setDetailCommandeMediaRows(rows = [], commande = detailCommande.value) {
  const renderToken = ++commandeMediaRenderSequence;
  const nextRows = await buildCommandeMediaUiRows(rows, commande);
  if (renderToken !== commandeMediaRenderSequence) {
    revokeCommandeMediaObjectUrls(nextRows);
    return;
  }

  revokeCommandeMediaObjectUrls(detailCommandeMedia.value);
  detailCommandeMedia.value = nextRows;
}

function isSameCommandeDetailTarget(idCommande) {
  return String(detailCommande.value?.idCommande || "").trim() === String(idCommande || "").trim();
}

function isSameRetoucheDetailTarget(idRetouche) {
  return String(detailRetouche.value?.idRetouche || "").trim() === String(idRetouche || "").trim();
}

async function refreshCommandeMediaForDetail({
  atelierId = currentAtelierId.value,
  commande = detailCommande.value,
  idCommande = "",
  preserveExisting = true
} = {}) {
  const activeCommandeId = String(idCommande || commande?.idCommande || "").trim();
  const targetCommande = commande || (activeCommandeId ? { idCommande: activeCommandeId } : null);
  if (!atelierId || !activeCommandeId || !targetCommande) {
    if (!preserveExisting) {
      await setDetailCommandeMediaRows([], targetCommande || detailCommande.value);
    }
    detailCommandeMediaLoading.value = false;
    return;
  }

  detailCommandeMediaLoading.value = true;
  detailCommandeMediaError.value = "";
  try {
    const mediaLocalFirst = await loadCommandeMediaLocalFirst({
      atelierId,
      commande: targetCommande
    });

    if (Array.isArray(mediaLocalFirst.cached) && (mediaLocalFirst.cached.length > 0 || !preserveExisting || detailCommandeMedia.value.length === 0)) {
      await setDetailCommandeMediaRows(mediaLocalFirst.cached || [], targetCommande);
    }

    if (mediaLocalFirst.online && isRemoteEntityId(activeCommandeId) && mediaLocalFirst.refreshPromise) {
      const mediaRows = await atelierApi.listCommandeMedia(activeCommandeId);
      const normalizedMedia = (mediaRows || []).map(normalizeCommandeMedia).sort((a, b) => a.position - b.position);
      await setDetailCommandeMediaRows(normalizedMedia, targetCommande);
    } else if (!mediaLocalFirst.hasCachedData && !mediaLocalFirst.online && isRemoteEntityId(activeCommandeId)) {
      detailCommandeMediaError.value = OFFLINE_READ_MESSAGES.COMMANDE_MEDIA;
    }
  } catch (err) {
    if (!preserveExisting) {
      await setDetailCommandeMediaRows([], targetCommande);
    }
    detailCommandeMediaError.value = readableError(err);
  } finally {
    detailCommandeMediaLoading.value = false;
  }
}

function isLocalEntity(id) {
  const normalized = String(id || "").trim();
  return Boolean(normalized) && normalized.startsWith("loc_");
}

function notifyEntityRequiresSync(label = "Cette entite") {
  notify(`${label} doit d'abord etre synchronisee avant cette action.`);
}

function isRemoteEntityId(value) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && !isLocalEntity(normalized) && !normalized.startsWith("cache_");
}

async function refreshVisibleDataAfterReconnect() {
  if (reconnectRefreshPromise) return reconnectRefreshPromise;
  if (!authReady.value || !isAuthenticated.value || isSystemManager.value || !currentAtelierId.value) return null;

  reconnectRefreshPromise = (async () => {
    await loadAtelierRuntimeSettings();
    if (["dossier-detail", "commande-detail", "retouche-detail"].includes(String(currentRoute.value || "").trim())) {
      return true;
    }
    await reloadAll();
  })();

  try {
    return await reconnectRefreshPromise;
  } finally {
    reconnectRefreshPromise = null;
  }
}

function scheduleSyncUiRefresh() {
  if (syncUiRefreshTimer) {
    window.clearTimeout(syncUiRefreshTimer);
  }
  syncUiRefreshTimer = window.setTimeout(() => {
    syncUiRefreshTimer = null;
    void refreshVisibleDataAfterReconnect();
  }, 250);
}

const CROSS_DEVICE_REFRESH_ROUTES = new Set(["dashboard", "dossiers", "commandes", "retouches", "caisse"]);
const CROSS_DEVICE_REFRESH_MIN_INTERVAL_MS = 2500;

function getCrossDeviceRefreshInterval(routeName = currentRoute.value) {
  if (routeName === "caisse") return 10000;
  if (routeName === "dashboard" || routeName === "dossiers" || routeName === "commandes" || routeName === "retouches") return 15000;
  return 0;
}

function hasBlockingUiStateForCrossDeviceRefresh() {
  return (
    wizard.open ||
    retoucheWizard.open ||
    factureEmission.open ||
    systemAtelierModal.open ||
    settingsConfirmModal.open ||
    actionModal.open ||
    commandeMediaViewer.open ||
    commandeItemPhotoDialog.open
  );
}

function isEditableElementActive() {
  if (typeof document === "undefined") return false;
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;
  if (activeElement.isContentEditable) return true;
  const tagName = String(activeElement.tagName || "").trim().toUpperCase();
  if (tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (tagName !== "INPUT") return false;
  const inputType = String(activeElement.getAttribute("type") || "text").trim().toLowerCase();
  return !["button", "submit", "reset", "checkbox", "radio", "range", "file", "color", "hidden"].includes(inputType);
}

function shouldMaintainCrossDeviceRefreshTimer() {
  if (!authReady.value || !isAuthenticated.value || isSystemManager.value || !currentAtelierId.value) return false;
  if (!networkIsOnline.value) return false;
  if (!CROSS_DEVICE_REFRESH_ROUTES.has(String(currentRoute.value || "").trim())) return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  return true;
}

function canRunCrossDeviceRefreshNow() {
  if (!shouldMaintainCrossDeviceRefreshTimer()) return false;
  if (
    loading.value ||
    detailLoading.value ||
    detailRetoucheLoading.value ||
    detailCommandeMediaLoading.value ||
    detailPaiementsLoading.value ||
    detailCommandeEventsLoading.value ||
    detailRetouchePaiementsLoading.value ||
    detailRetoucheEventsLoading.value ||
    dashboardContactBoardLoading.value ||
    syncInProgress.value ||
    detailCommandeMediaUploading.value ||
    Boolean(detailCommandeMediaActionId.value) ||
    reconnectRefreshPromise ||
    commandeDetailLoadPromise ||
    retoucheDetailLoadPromise
  ) {
    return false;
  }
  if (hasBlockingUiStateForCrossDeviceRefresh()) return false;
  if (isEditableElementActive()) return false;
  return true;
}

function clearCrossDeviceRefreshTimer() {
  if (crossDeviceRefreshTimer) {
    window.clearTimeout(crossDeviceRefreshTimer);
    crossDeviceRefreshTimer = null;
  }
}

async function refreshMainListsInBackground({ loadClients = false, loadCommandes = false, loadRetouches = false } = {}) {
  const atelierId = currentAtelierId.value;
  if (!atelierId || !getNetworkState().online) return false;

  try {
    const localFirst = await loadMainListsLocalFirst({
      atelierId,
      loadClients,
      loadCommandes,
      loadRetouches
    });

    if (!localFirst.online || !localFirst.refreshPromise) return false;

    const refreshedMain = await localFirst.refreshPromise;
    if (loadClients && refreshedMain?.clients) applyClientsRows(refreshedMain.clients);
    if (loadCommandes && refreshedMain?.commandes) applyCommandesRows(refreshedMain.commandes);
    if (loadRetouches && refreshedMain?.retouches) applyRetouchesRows(refreshedMain.retouches);
    return true;
  } catch {
    return false;
  }
}

async function refreshDashboardContactBoardInBackground() {
  if (!canAccessContactFollowUpDashboard.value || !networkIsOnline.value) return false;
  try {
    const payload = await atelierApi.getClientContactDashboard(5);
    dashboardContactBoard.value = normalizeDashboardContactBoard(payload);
    dashboardContactBoardError.value = "";
    return true;
  } catch {
    return false;
  }
}

async function refreshLatestCaisseDayInBackground() {
  if (!canAccessModule("caisse") || !networkIsOnline.value) return false;
  try {
    const days = await atelierApi.listCaisseJours();
    if (!Array.isArray(days) || days.length === 0) {
      caisseJour.value = null;
      return true;
    }
    const detail = await atelierApi.getCaisseJour(days[0].idCaisseJour || days[0].id_caisse_jour);
    caisseJour.value = normalizeCaisse(detail);
    return true;
  } catch {
    return false;
  }
}

async function refreshVisibleRouteInBackground({ force = false } = {}) {
  if (crossDeviceRefreshPromise) return crossDeviceRefreshPromise;
  if (!force && Date.now() - lastCrossDeviceRefreshAt < CROSS_DEVICE_REFRESH_MIN_INTERVAL_MS) return null;
  if (!canRunCrossDeviceRefreshNow()) return null;

  const routeName = String(currentRoute.value || "").trim();
  crossDeviceRefreshPromise = (async () => {
    lastCrossDeviceRefreshAt = Date.now();

    if (routeName === "commandes") {
      await loadAtelierRuntimeSettings();
      await refreshMainListsInBackground({
        loadClients: canReadClients.value,
        loadCommandes: canReadCommandes.value
      });
      return true;
    }

    if (routeName === "retouches") {
      await loadAtelierRuntimeSettings();
      await refreshMainListsInBackground({
        loadClients: canReadClients.value,
        loadRetouches: canReadRetouches.value
      });
      return true;
    }

    if (routeName === "dossiers") {
      await loadAtelierRuntimeSettings();
      try {
        applyDossiersRows(await atelierApi.listDossiers());
      } catch {
        // Keep the current dossier list if the background refresh fails.
      }
      return true;
    }

    if (routeName === "caisse") {
      await loadAtelierRuntimeSettings();
      await refreshLatestCaisseDayInBackground();
      return true;
    }

    if (routeName === "dashboard") {
      await loadAtelierRuntimeSettings();
      await refreshMainListsInBackground({
        loadClients: canReadClients.value,
        loadCommandes: canReadCommandes.value,
        loadRetouches: canReadRetouches.value
      });
      if (canReadVentes.value && networkIsOnline.value) {
        try {
          ventes.value = (await atelierApi.listVentes()).map(normalizeVente);
        } catch {
          // Keep the existing dashboard sales snapshot when the background refresh fails.
        }
      }
      await refreshLatestCaisseDayInBackground();
      await refreshDashboardContactBoardInBackground();
      return true;
    }

    return false;
  })();

  try {
    return await crossDeviceRefreshPromise;
  } finally {
    crossDeviceRefreshPromise = null;
  }
}

function scheduleCrossDeviceRefresh() {
  clearCrossDeviceRefreshTimer();
  const interval = getCrossDeviceRefreshInterval();
  if (!interval || !shouldMaintainCrossDeviceRefreshTimer()) return;

  crossDeviceRefreshTimer = window.setTimeout(async () => {
    crossDeviceRefreshTimer = null;
    await refreshVisibleRouteInBackground();
    scheduleCrossDeviceRefresh();
  }, interval);
}

function handleCrossDeviceFocus() {
  if (!shouldMaintainCrossDeviceRefreshTimer()) return;
  void refreshVisibleRouteInBackground({ force: true });
  scheduleCrossDeviceRefresh();
}

function handleCrossDeviceVisibilityChange() {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    if (shouldMaintainCrossDeviceRefreshTimer()) {
      void refreshVisibleRouteInBackground({ force: true });
    }
    scheduleCrossDeviceRefresh();
    return;
  }
  clearCrossDeviceRefreshTimer();
}

function appendAuditError(message) {
  if (!message) return;
  const parts = auditError.value
    ? auditError.value.split("|").map((item) => item.trim()).filter(Boolean)
    : [];
  if (parts.includes(message)) return;
  parts.push(message);
  auditError.value = parts.join(" | ");
}

function readableError(err) {
  const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err || "");
  const lowered = String(message || "").toLowerCase();
  if (!getNetworkState().online) {
    return "Connexion indisponible. Verifiez votre reseau puis reessayez.";
  }
  if (
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror") ||
    lowered.includes("load failed") ||
    lowered.includes("offline")
  ) {
    return "Connexion indisponible. Verifiez votre reseau puis reessayez.";
  }
  if (isTechnicalErrorMessage(message)) {
    return "Une erreur est survenue. Veuillez reessayer.";
  }
  if (message) {
    const translated = translateErrorMessage(message);
    if (translated) return translated;
  }
  return "Une erreur est survenue. Reessayez.";
}

function translateErrorMessage(message) {
  const value = String(message || "").trim();
  if (!value) return "";

  return value
    .split(";")
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (isTechnicalErrorMessage(part)) return "Une erreur est survenue. Veuillez reessayer.";
      if (lower.includes("string must contain at least 1 character")) return "Ce champ est obligatoire.";
      if (lower.includes("invalid email")) return "Adresse email invalide.";
      if (lower.includes("string must contain at least 8 character")) return "Le mot de passe doit contenir au moins 8 caracteres.";
      if (lower.includes("mot de passe trop court")) return "Le mot de passe doit contenir au moins 8 caracteres.";
      if (lower.includes("majuscule requise")) return "Le mot de passe doit contenir au moins une majuscule.";
      if (lower.includes("minuscule requise")) return "Le mot de passe doit contenir au moins une minuscule.";
      if (lower.includes("un chiffre requis")) return "Le mot de passe doit contenir au moins un chiffre.";
      if (lower.includes("caract")) return 'Le mot de passe doit contenir au moins un caractere special (!@#$%^&*(),.?":{}|<>).';
      if (lower.includes("caisse is closed")) return "Operation impossible: la caisse est cloturee.";
      if (lower.includes("la caisse est cloturee")) return "Operation impossible: la caisse est cloturee.";
      if (lower.includes("must be non-empty")) return "Ce champ ne doit pas etre vide.";
      if (lower.includes("must be a number")) return "Ce champ doit etre un nombre.";
      if (lower.includes("must be > 0")) return "Cette valeur doit etre superieure a 0.";
      if (lower.includes("must be >= 0")) return "Cette valeur doit etre superieure ou egale a 0.";
      if (lower.includes("required")) return "Ce champ est requis.";
      if (lower.includes("invalid")) return "Valeur invalide.";
      if (lower.includes("not allowed")) return "Action non autorisee.";
      if (lower.includes("acces non autorise") || lower.includes("acces refuse")) return "Action non autorisee pour votre compte.";
      if (lower.includes("permissions insuffisantes")) return "Action non autorisee pour votre compte.";
      if (lower.includes("exceeds total")) return "Le paiement depasse le montant total.";
      if (lower.includes("insufficient balance")) return "Solde insuffisant.";
      if (lower.includes("operation not found")) return "Operation introuvable.";
      if (lower.includes("operation already cancelled")) return "Operation deja annulee.";
      if (lower.includes("advance is insufficient")) return "L'avance est insuffisante pour demarrer le travail.";
      if (lower.includes("erreur api")) return "Operation impossible pour le moment.";
      if (lower.startsWith("missing fields:")) {
        const fields = part.split(":")[1] || "";
        return `Champs obligatoires manquants: ${fields.trim()}`;
      }
      return part;
    })
    .join(" ");
}

function isTechnicalErrorMessage(message) {
  const normalized = String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return false;

  return [
    /syntax error at or near/i,
    /\bcolumn\b.+\bdoes not exist\b/i,
    /\brelation\b.+\bdoes not exist\b/i,
    /\btable\b.+\bdoes not exist\b/i,
    /\bschema\b.+\bdoes not exist\b/i,
    /\bduplicate key value violates\b/i,
    /\bviolates\b.+\bconstraint\b/i,
    /\bnull value in column\b/i,
    /\binvalid input syntax\b/i,
    /\balter table\b/i,
    /\bcreate table\b/i,
    /\bcreate index\b/i,
    /\binsert into\b/i,
    /\bupdate\b.+\bset\b/i,
    /\bdelete from\b/i,
    /\bselect\b.+\bfrom\b/i,
    /\binternal_error\b/i,
    /\bpostgres\b/i,
    /\bpg_/i
  ].some((pattern) => pattern.test(normalized));
}

function loginErrorMessage(err) {
  if (authMode.value === "atelier-inactive" || authAtelierContext.value?.actif === false) {
    return AUTH_DISABLED_ATELIER_MESSAGE;
  }
  const rawMessage = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "";
  const loweredRaw = String(rawMessage || "").toLowerCase();
  const message = readableError(err);
  const lowered = message.toLowerCase();
  if (lowered.includes("adresse email invalide") || loweredRaw.includes("invalid email")) return "Adresse email invalide.";
  if (
    lowered.includes("utilisateur inexistant") ||
    lowered.includes("mot de passe incorrect") ||
    lowered.includes("identifiants invalides") ||
    lowered === "valeur invalide." ||
    loweredRaw.includes("identifiants invalides")
  ) {
    return AUTH_INVALID_CREDENTIALS_MESSAGE;
  }
  if (lowered.includes("atelier desactive")) return AUTH_DISABLED_ATELIER_MESSAGE;
  if (lowered.includes("compte inactif")) return "Votre compte est désactivé. Veuillez contacter l’administrateur.";
  return message;
}

function normalizeSystemAtelier(raw) {
  return {
    idAtelier: raw?.idAtelier || raw?.id_atelier || "",
    nom: String(raw?.nom || "").trim(),
    slug: String(raw?.slug || "").trim(),
    actif: raw?.actif !== false,
    createdAt: raw?.createdAt || raw?.created_at || "",
    updatedAt: raw?.updatedAt || raw?.updated_at || "",
    proprietaire: raw?.proprietaire
      ? {
          id: raw.proprietaire.id || "",
          nom: String(raw.proprietaire.nom || "").trim(),
          email: String(raw.proprietaire.email || "").trim()
        }
      : null,
    nombreUtilisateurs: Number(raw?.nombreUtilisateurs ?? raw?.nombre_utilisateurs ?? 0)
  };
}

function normalizeSystemAtelierDetail(raw) {
  return {
    idAtelier: raw?.idAtelier || raw?.id_atelier || "",
    nom: String(raw?.nom || "").trim(),
    slug: String(raw?.slug || "").trim(),
    actif: raw?.actif !== false,
    createdAt: raw?.createdAt || raw?.created_at || "",
    updatedAt: raw?.updatedAt || raw?.updated_at || "",
    proprietaire: raw?.proprietaire
      ? {
          id: raw.proprietaire.id || "",
          nom: String(raw.proprietaire.nom || "").trim(),
          email: String(raw.proprietaire.email || "").trim(),
          telephone: String(raw.proprietaire.telephone || "").trim(),
          actif: raw.proprietaire.actif !== false,
          etatCompte: String(raw.proprietaire.etatCompte || raw.proprietaire.etat_compte || "ACTIVE").trim().toUpperCase(),
          sessions: {
            totalActives: Number(raw?.proprietaire?.sessions?.totalActives ?? raw?.proprietaire?.sessions?.total_actives ?? 0),
            lastSessionAt: raw?.proprietaire?.sessions?.lastSessionAt || raw?.proprietaire?.sessions?.last_session_at || "",
            recentSessions: Array.isArray(raw?.proprietaire?.sessions?.recentSessions)
              ? raw.proprietaire.sessions.recentSessions.map((session) => ({
                  createdAt: session?.createdAt || session?.created_at || "",
                  expiresAt: session?.expiresAt || session?.expire_at || ""
                }))
              : []
          }
        }
      : null,
    stats: {
      totalUtilisateurs: Number(raw?.stats?.totalUtilisateurs ?? raw?.stats?.total_utilisateurs ?? 0),
      utilisateursActifs: Number(raw?.stats?.utilisateursActifs ?? raw?.stats?.utilisateurs_actifs ?? 0),
      utilisateursInactifs: Number(raw?.stats?.utilisateursInactifs ?? raw?.stats?.utilisateurs_inactifs ?? 0)
    },
    utilisateurs: Array.isArray(raw?.utilisateurs)
      ? raw.utilisateurs.map((user) => ({
          id: user?.id || user?.id_utilisateur || "",
          nom: String(user?.nom || "").trim(),
          email: String(user?.email || "").trim(),
          roleId: String(user?.roleId || user?.role_id || "").trim().toUpperCase(),
          actif: user?.actif !== false,
          etatCompte: String(user?.etatCompte || user?.etat_compte || (user?.actif === false ? "DISABLED" : "ACTIVE"))
            .trim()
            .toUpperCase(),
          tokenVersion: Number(user?.tokenVersion ?? user?.token_version ?? 1)
        }))
      : [],
    health: {
      signal: String(raw?.health?.signal || "idle").trim().toLowerCase(),
      message: String(raw?.health?.message || "").trim(),
      lastEventAt: raw?.health?.lastEventAt || raw?.health?.last_event_at || "",
      eventsLast7Days: Number(raw?.health?.eventsLast7Days ?? raw?.health?.events_last_7_days ?? 0),
      eventsLast30Days: Number(raw?.health?.eventsLast30Days ?? raw?.health?.events_last_30_days ?? 0)
    },
    recentActivity: Array.isArray(raw?.recentActivity)
      ? raw.recentActivity.map((item) => ({
          idEvenement: item?.idEvenement || item?.id_evenement || "",
          utilisateurId: item?.utilisateurId || item?.utilisateur_id || "",
          utilisateurNom: String(item?.utilisateurNom || item?.utilisateur_nom || item?.payload?.utilisateurNom || "").trim(),
          utilisateurEmail: String(item?.utilisateurEmail || item?.utilisateur_email || "").trim(),
          role: String(item?.role || "").trim(),
          action: String(item?.action || "").trim(),
          entite: String(item?.entite || "").trim(),
          entiteId: item?.entiteId || item?.entite_id || "",
          payload: item?.payload && typeof item.payload === "object" ? item.payload : {},
          dateEvenement: item?.dateEvenement || item?.date_evenement || ""
        }))
      : []
  };
}

function normalizeSystemNotification(raw) {
  return {
    idNotification: raw?.idNotification || raw?.id_notification || "",
    portee: String(raw?.portee || "").trim().toUpperCase(),
    atelierId: String(raw?.atelierId || raw?.atelier_id || "").trim(),
    atelierNom: String(raw?.atelierNom || raw?.atelier_nom || "").trim(),
    titre: String(raw?.titre || "").trim(),
    message: String(raw?.message || "").trim(),
    creeParNom: String(raw?.creeParNom || raw?.cree_par_nom || "").trim(),
    dateCreation: raw?.dateCreation || raw?.date_creation || "",
    dateEnvoi: raw?.dateEnvoi || raw?.date_envoi || ""
  };
}

function normalizeSystemNotifications(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.items;
  return Array.isArray(rows) ? rows.map(normalizeSystemNotification) : [];
}

function normalizeAtelierNotification(raw) {
  const base = normalizeSystemNotification(raw);
  return {
    ...base,
    estLue: raw?.estLue === true || raw?.est_lue === true,
    luAt: raw?.luAt || raw?.lu_at || ""
  };
}

function normalizeAtelierNotifications(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.items;
  return Array.isArray(rows) ? rows.map(normalizeAtelierNotification) : [];
}

function normalizeSystemAtelierContact(raw) {
  return {
    idAtelier: raw?.idAtelier || raw?.id_atelier || "",
    nomAtelier: String(raw?.nomAtelier || raw?.nom || "").trim(),
    slug: String(raw?.slug || "").trim(),
    actif: raw?.actif !== false,
    proprietaire: raw?.proprietaire
      ? {
          id: raw.proprietaire.id || "",
          nom: String(raw.proprietaire.nom || "").trim(),
          email: String(raw.proprietaire.email || "").trim(),
          telephone: String(raw.proprietaire.telephone || "").trim()
        }
      : null
  };
}

function normalizeSystemAtelierContacts(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.items;
  return Array.isArray(rows) ? rows.map(normalizeSystemAtelierContact) : [];
}

function matchesSystemAtelierSearch(atelier, rawSearch = "") {
  const query = String(rawSearch || "").trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    atelier?.nom || "",
    atelier?.slug || "",
    atelier?.idAtelier || "",
    atelier?.proprietaire?.nom || "",
    atelier?.proprietaire?.email || ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function matchesSystemAtelierStatus(atelier, rawStatus = "ALL") {
  const status = String(rawStatus || "ALL").trim().toUpperCase();
  if (status === "ACTIVE") return atelier?.actif === true;
  if (status === "INACTIVE") return atelier?.actif === false;
  return true;
}

function compareSystemAteliers(left, right, sortBy = "createdAt", sortDir = "desc") {
  const direction = String(sortDir || "desc").trim().toLowerCase() === "asc" ? 1 : -1;
  const compareText = (a, b) => String(a || "").localeCompare(String(b || ""), "fr", { sensitivity: "base" });
  const compareDate = (a, b) => String(a || "").localeCompare(String(b || ""));
  const compareNumber = (a, b) => Number(a || 0) - Number(b || 0);

  let value = 0;
  if (sortBy === "nom") value = compareText(left?.nom, right?.nom);
  else if (sortBy === "slug") value = compareText(left?.slug, right?.slug);
  else if (sortBy === "utilisateurs") value = compareNumber(left?.nombreUtilisateurs, right?.nombreUtilisateurs);
  else value = compareDate(left?.createdAt, right?.createdAt);

  if (value !== 0) return value * direction;
  return compareDate(right?.createdAt, left?.createdAt);
}

function buildSystemAtelierDetailFallback(raw) {
  const atelier = normalizeSystemAtelier(raw);
  const totalUtilisateurs = Number(atelier?.nombreUtilisateurs || 0);
  return {
    idAtelier: atelier.idAtelier,
    nom: atelier.nom,
    slug: atelier.slug,
    actif: atelier.actif,
    createdAt: atelier.createdAt,
    updatedAt: atelier.updatedAt,
    proprietaire: atelier.proprietaire
      ? {
          id: atelier.proprietaire.id || "",
          nom: atelier.proprietaire.nom || "",
          email: atelier.proprietaire.email || "",
          telephone: atelier.proprietaire.telephone || "",
          actif: true,
          etatCompte: "ACTIVE",
          sessions: {
            totalActives: 0,
            lastSessionAt: "",
            recentSessions: []
          }
        }
      : null,
    stats: {
      totalUtilisateurs,
      utilisateursActifs: atelier.actif ? totalUtilisateurs : 0,
      utilisateursInactifs: atelier.actif ? 0 : totalUtilisateurs
    },
    utilisateurs: atelier.proprietaire
      ? [
          {
            id: atelier.proprietaire.id || "",
            nom: atelier.proprietaire.nom || "",
            email: atelier.proprietaire.email || "",
            roleId: "PROPRIETAIRE",
            actif: true,
            etatCompte: "ACTIVE",
            tokenVersion: 1
          }
        ]
      : [],
    health: {
      signal: atelier.actif ? "idle" : "warning",
      message: "Details avances indisponibles sur ce serveur. Affichage du resume atelier.",
      lastEventAt: "",
      eventsLast7Days: 0,
      eventsLast30Days: 0
    },
    recentActivity: []
  };
}

function findSystemAtelierListEntry(targetId = "") {
  const resolvedTargetId = String(targetId || "").trim();
  if (!resolvedTargetId) return null;
  return (
    systemAteliers.value.find((atelier) => {
      const atelierId = String(atelier?.idAtelier || "").trim();
      const atelierSlug = String(atelier?.slug || "").trim();
      return atelierId === resolvedTargetId || atelierSlug === resolvedTargetId;
    }) || null
  );
}

function buildSystemDashboardFallback(rows, summary = null) {
  const items = Array.isArray(rows) ? rows.map(normalizeSystemAtelier) : [];
  const baseSummary = summary
    ? {
        total: Number(summary.total || items.length),
        actifs: Number(summary.actifs || 0),
        inactifs: Number(summary.inactifs || 0),
        utilisateurs: Number(summary.utilisateurs || 0)
      }
    : summarizeSystemAteliers(items);
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const alerts = items
    .flatMap((atelier) => {
      const list = [];
      if (!atelier.proprietaire) {
        list.push({
          code: "ATELIER_SANS_PROPRIETAIRE",
          severity: "warning",
          title: "Atelier sans proprietaire",
          description: `${atelier.nom} n'a aucun proprietaire initialise.`,
          atelierId: atelier.idAtelier,
          atelierNom: atelier.nom,
          createdAt: atelier.createdAt || ""
        });
      }
      if (!atelier.actif) {
        list.push({
          code: "ATELIER_INACTIF",
          severity: "info",
          title: "Atelier desactive",
          description: `${atelier.nom} est actuellement inactif.`,
          atelierId: atelier.idAtelier,
          atelierNom: atelier.nom,
          createdAt: atelier.createdAt || ""
        });
      }
      if (Number(atelier.nombreUtilisateurs || 0) === 0) {
        list.push({
          code: "ATELIER_SANS_UTILISATEUR",
          severity: "info",
          title: "Aucun utilisateur",
          description: `${atelier.nom} n'a encore aucun utilisateur rattache.`,
          atelierId: atelier.idAtelier,
          atelierNom: atelier.nom,
          createdAt: atelier.createdAt || ""
        });
      }
      return list;
    })
    .slice(0, 8);

  return {
    summary: {
      total: baseSummary.total,
      actifs: baseSummary.actifs,
      inactifs: baseSummary.inactifs,
      utilisateurs: baseSummary.utilisateurs,
      sansProprietaire: items.filter((atelier) => !atelier.proprietaire).length,
      proprietairesInactifs: 0,
      sansUtilisateur: items.filter((atelier) => Number(atelier.nombreUtilisateurs || 0) === 0).length,
      nouveaux7J: items.filter((atelier) => {
        const value = new Date(atelier.createdAt || "").getTime();
        return Number.isFinite(value) && value >= sevenDaysAgo;
      }).length,
      nouveaux30J: items.filter((atelier) => {
        const value = new Date(atelier.createdAt || "").getTime();
        return Number.isFinite(value) && value >= thirtyDaysAgo;
      }).length,
      ateliersActifsAvecActivite7J: 0
    },
    alerts,
    recentAteliers: items.slice(0, 6).map((atelier) => ({
      idAtelier: atelier.idAtelier,
      nom: atelier.nom,
      slug: atelier.slug,
      actif: atelier.actif,
      createdAt: atelier.createdAt || "",
      proprietaire: atelier.proprietaire
        ? {
            nom: atelier.proprietaire.nom || "",
            email: atelier.proprietaire.email || ""
          }
        : null,
      nombreUtilisateurs: Number(atelier.nombreUtilisateurs || 0),
      lastEventAt: "",
      eventsLast7Days: 0
    }))
  };
}

function summarizeSystemAteliers(rows) {
  const items = Array.isArray(rows) ? rows : [];
  return {
    total: items.length,
    actifs: items.filter((atelier) => atelier.actif).length,
    inactifs: items.filter((atelier) => !atelier.actif).length,
    utilisateurs: items.reduce((sum, atelier) => sum + Number(atelier.nombreUtilisateurs || 0), 0)
  };
}

function normalizeSystemDashboard(payload) {
  const fallback = createEmptySystemDashboard();
  return {
    summary: {
      total: Number(payload?.summary?.total || fallback.summary.total),
      actifs: Number(payload?.summary?.actifs || fallback.summary.actifs),
      inactifs: Number(payload?.summary?.inactifs || fallback.summary.inactifs),
      utilisateurs: Number(payload?.summary?.utilisateurs || fallback.summary.utilisateurs),
      sansProprietaire: Number(payload?.summary?.sansProprietaire || fallback.summary.sansProprietaire),
      proprietairesInactifs: Number(payload?.summary?.proprietairesInactifs || fallback.summary.proprietairesInactifs),
      sansUtilisateur: Number(payload?.summary?.sansUtilisateur || fallback.summary.sansUtilisateur),
      nouveaux7J: Number(payload?.summary?.nouveaux7J || fallback.summary.nouveaux7J),
      nouveaux30J: Number(payload?.summary?.nouveaux30J || fallback.summary.nouveaux30J),
      ateliersActifsAvecActivite7J: Number(
        payload?.summary?.ateliersActifsAvecActivite7J || fallback.summary.ateliersActifsAvecActivite7J
      )
    },
    alerts: Array.isArray(payload?.alerts)
      ? payload.alerts.map((alert, index) => ({
          code: String(alert?.code || `alert-${index}`).trim(),
          severity: String(alert?.severity || "info").trim().toLowerCase(),
          title: String(alert?.title || "Alerte systeme").trim(),
          description: String(alert?.description || "").trim(),
          atelierId: String(alert?.atelierId || "").trim(),
          atelierNom: String(alert?.atelierNom || "").trim(),
          createdAt: alert?.createdAt || ""
        }))
      : [],
    recentAteliers: Array.isArray(payload?.recentAteliers)
      ? payload.recentAteliers.map((atelier) => ({
          idAtelier: String(atelier?.idAtelier || "").trim(),
          nom: String(atelier?.nom || "").trim(),
          slug: String(atelier?.slug || "").trim(),
          actif: atelier?.actif !== false,
          createdAt: atelier?.createdAt || "",
          proprietaire: atelier?.proprietaire
            ? {
                nom: String(atelier.proprietaire.nom || "").trim(),
                email: String(atelier.proprietaire.email || "").trim()
              }
            : null,
          nombreUtilisateurs: Number(atelier?.nombreUtilisateurs || 0),
          lastEventAt: atelier?.lastEventAt || "",
          eventsLast7Days: Number(atelier?.eventsLast7Days || 0)
        }))
      : []
  };
}

function normalizeSystemAtelierListPayload(payload, { page, pageSize, search = "", status = "ALL", sortBy = "createdAt", sortDir = "desc" } = {}) {
  if (Array.isArray(payload)) {
    const allItems = payload.map(normalizeSystemAtelier);
    const filteredItems = allItems
      .filter((atelier) => matchesSystemAtelierSearch(atelier, search))
      .filter((atelier) => matchesSystemAtelierStatus(atelier, status))
      .sort((left, right) => compareSystemAteliers(left, right, sortBy, sortDir));
    const requestedPageSize = Math.max(1, Number(pageSize || 10));
    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
    const currentPage = Math.min(Math.max(1, Number(page || 1)), totalPages);
    const start = (currentPage - 1) * requestedPageSize;
    const items = filteredItems.slice(start, start + requestedPageSize);
    return {
      items,
      pagination: {
        page: currentPage,
        pageSize: requestedPageSize,
        total,
        totalPages
      },
      summary: summarizeSystemAteliers(allItems)
    };
  }

  const items = (payload?.items || []).map(normalizeSystemAtelier);
  const fallbackSummary = summarizeSystemAteliers(items);
  return {
    items,
    pagination: {
      page: Number(payload?.pagination?.page || page || 1),
      pageSize: Number(payload?.pagination?.pageSize || pageSize || 10),
      total: Number(payload?.pagination?.total || items.length),
      totalPages: Number(payload?.pagination?.totalPages || Math.max(1, Math.ceil(items.length / Math.max(1, Number(pageSize || 10)))))
    },
    summary: {
      total: Number(payload?.summary?.total || fallbackSummary.total),
      actifs: Number(payload?.summary?.actifs || fallbackSummary.actifs),
      inactifs: Number(payload?.summary?.inactifs || fallbackSummary.inactifs),
      utilisateurs: Number(payload?.summary?.utilisateurs || fallbackSummary.utilisateurs)
    }
  };
}

function normalizeClient(raw) {
  const idClient = raw.idClient || raw.id_client || raw.id || raw.localId || raw.local_id || "";
  return {
    localId: raw.localId || raw.local_id || (isRemoteEntityId(idClient) ? "" : idClient),
    serverId: raw.serverId || raw.server_id || (isRemoteEntityId(idClient) ? idClient : ""),
    syncStatus: raw.syncStatus || raw.sync_status || "synced",
    updatedAt: raw.updatedAt || raw.updated_at || "",
    lastSyncedAt: raw.lastSyncedAt || raw.last_synced_at || "",
    idClient,
    nom: raw.nom || "",
    prenom: raw.prenom || "",
    telephone: raw.telephone || "",
    actif: raw.actif !== false
  };
}

function normalizeClientConsultation(raw) {
  const source = raw || {};
  return {
    client: {
      idClient: source.client?.idClient || source.client?.id_client || "",
      nomComplet: source.client?.nomComplet || source.client?.nom_complet || "",
      telephone: source.client?.telephone || "",
      datePremierPassage: toIsoDate(source.client?.datePremierPassage || source.client?.date_premier_passage),
      dateDernierPassage: toIsoDate(source.client?.dateDernierPassage || source.client?.date_dernier_passage || source.synthese?.dateDerniereActivite || source.synthese?.date_derniere_activite),
      statutVisuel: source.client?.statutVisuel || source.client?.statut_visuel || "Client occasionnel"
    },
    synthese: {
      totalCommandes: Number(source.synthese?.totalCommandes ?? source.synthese?.total_commandes ?? 0),
      totalRetouches: Number(source.synthese?.totalRetouches ?? source.synthese?.total_retouches ?? 0),
      dateDerniereActivite: toIsoDate(source.synthese?.dateDerniereActivite || source.synthese?.date_derniere_activite),
      montantTotalDepense: Number(source.synthese?.montantTotalDepense ?? source.synthese?.montant_total_depense ?? 0)
    },
    historique: {
      commandes: (source.historique?.commandes || []).map((row) => ({
        idCommande: row.idCommande || row.id_commande,
        date: toIsoDate(row.date || row.date_creation),
        typeHabit: row.typeHabit || row.type_habit || "",
        statut: row.statut || "",
        montant: Number(row.montant ?? row.montant_total ?? 0)
      })),
      retouches: (source.historique?.retouches || []).map((row) => ({
        idRetouche: row.idRetouche || row.id_retouche,
        date: toIsoDate(row.date || row.date_depot),
        typeHabit: row.typeHabit || row.type_habit || "",
        typeRetouche: row.typeRetouche || row.type_retouche || "",
        statut: row.statut || "",
        montant: Number(row.montant ?? row.montant_total ?? 0)
      })),
      mesures: (source.historique?.mesures || []).map((row) => ({
        datePrise: toIsoDate(row.datePrise || row.date_prise),
        typeHabit: row.typeHabit || row.type_habit || "",
        mesures: row.mesures || {},
        unite: row.unite || "cm",
        source: row.source || "",
        idOrigine: row.idOrigine || row.id_origine || ""
      })),
      pagination: {
        commandes: {
          page: Number(source.historique?.pagination?.commandes?.page || 1),
          size: Number(source.historique?.pagination?.commandes?.size || 0),
          total: Number(source.historique?.pagination?.commandes?.total || 0),
          totalPages: Number(source.historique?.pagination?.commandes?.totalPages || 1)
        },
        retouches: {
          page: Number(source.historique?.pagination?.retouches?.page || 1),
          size: Number(source.historique?.pagination?.retouches?.size || 0),
          total: Number(source.historique?.pagination?.retouches?.total || 0),
          totalPages: Number(source.historique?.pagination?.retouches?.totalPages || 1)
        },
        mesures: {
          page: Number(source.historique?.pagination?.mesures?.page || 1),
          size: Number(source.historique?.pagination?.mesures?.size || 0),
          total: Number(source.historique?.pagination?.mesures?.total || 0),
          totalPages: Number(source.historique?.pagination?.mesures?.totalPages || 1)
        }
      },
      resultats: {
        commandes: Number(source.historique?.resultats?.commandes ?? source.historique?.commandes?.length ?? 0),
        retouches: Number(source.historique?.resultats?.retouches ?? source.historique?.retouches?.length ?? 0),
        mesures: Number(source.historique?.resultats?.mesures ?? source.historique?.mesures?.length ?? 0)
      },
      filtres: source.historique?.filtres || {
        source: "ALL",
        typeHabit: "ALL",
        periode: "ALL"
      }
    }
  };
}

function normalizeCommande(raw) {
  const idCommande = raw.idCommande || raw.id_commande || raw.id || raw.localId || raw.local_id || "";
  const idClient = raw.clientPayeurId || raw.client_payeur_id || raw.idClient || raw.id_client || raw.clientId || raw.client_id || "";
  const items = Array.isArray(raw.items || raw.commandeItems || raw.commande_items)
    ? (raw.items || raw.commandeItems || raw.commande_items).map((item, index) => ({
        idItem: item.idItem || item.id_item || `local-cmd-item-${index + 1}`,
        idCommande: item.idCommande || item.id_commande || idCommande,
        typeHabit: item.typeHabit || item.type_habit || "",
        description: item.description || "",
        prix: Number(item.prix ?? 0),
        montantPaye: Number(item.montantPaye ?? item.montant_paye ?? 0),
        ordreAffichage: Number(item.ordreAffichage ?? item.ordre_affichage ?? index + 1),
        mesures: item.mesures || item.mesuresSnapshot || item.mesures_snapshot_json || null,
        dateCreation: item.dateCreation || item.date_creation || ""
      }))
    : [];
  const lignesCommande = Array.isArray(raw.lignesCommande || raw.lignes_commande)
    ? (raw.lignesCommande || raw.lignes_commande).map((ligne) => ({
        idLigne: ligne.idLigne || ligne.id_ligne || "",
        idCommande: ligne.idCommande || ligne.id_commande || idCommande,
        idClient: ligne.idClient || ligne.id_client || "",
        role: ligne.role || "BENEFICIAIRE",
        nomAffiche: ligne.nomAffiche || ligne.nom_affiche || "",
        prenomAffiche: ligne.prenomAffiche || ligne.prenom_affiche || "",
        typeHabit: ligne.typeHabit || ligne.type_habit || "",
        mesuresHabit: ligne.mesuresHabit || ligne.mesures_habit_snapshot || null,
        ordreAffichage: Number(ligne.ordreAffichage ?? ligne.ordre_affichage ?? 1),
        dateCreation: ligne.dateCreation || ligne.date_creation || ""
      }))
    : [];
  const resolvedItems =
    items.length > 0
      ? items
      : (raw.typeHabit || raw.type_habit)
        ? [
            {
              idItem: `legacy-${idCommande || "commande"}`,
              idCommande,
              typeHabit: raw.typeHabit || raw.type_habit || "",
              description: raw.descriptionCommande || raw.description || "",
              prix: Number(raw.montantTotal ?? raw.montant_total ?? 0),
              montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
              ordreAffichage: 1,
              mesures: raw.mesuresHabit || raw.mesures_habit_snapshot || null,
              dateCreation: raw.dateCreation || raw.date_creation || ""
            }
          ]
        : [];
  const primaryItem = resolvedItems[0] || null;
  return {
    localId: raw.localId || raw.local_id || (isRemoteEntityId(idCommande) ? "" : idCommande),
    serverId: raw.serverId || raw.server_id || (isRemoteEntityId(idCommande) ? idCommande : ""),
    syncStatus: raw.syncStatus || raw.sync_status || "synced",
    updatedAt: raw.updatedAt || raw.updated_at || "",
    lastSyncedAt: raw.lastSyncedAt || raw.last_synced_at || "",
    idCommande,
    dossierId: raw.dossierId || raw.idDossier || raw.id_dossier || "",
    idClient,
    clientPayeurId: idClient,
    clientLocalId: raw.clientLocalId || raw.client_local_id || "",
    clientServerId: raw.clientServerId || raw.client_server_id || (isRemoteEntityId(idClient) ? idClient : ""),
    descriptionCommande: raw.descriptionCommande || raw.description || "",
    montantTotal: Number(raw.montantTotal ?? raw.montant_total ?? resolvedItems.reduce((sum, item) => sum + Number(item.prix || 0), 0)),
    montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
    typeHabit: raw.typeHabit || raw.type_habit || primaryItem?.typeHabit || "",
    mesuresHabit: raw.mesuresHabit || raw.mesures_habit_snapshot || null,
    items: resolvedItems,
    lignesCommande,
    statutCommande: raw.statutCommande || raw.statut || "CREEE",
    dateCreation: toIsoDate(raw.dateCreation || raw.date_creation),
    datePrevue: toIsoDate(raw.datePrevue || raw.date_prevue || raw.dateLivraison),
    clientNom: raw.clientNom || raw.client_nom || "",
    soldeRestant: Number(raw.soldeRestant ?? raw.solde_restant ?? Math.max(0, Number(raw.montantTotal ?? raw.montant_total ?? 0) - Number(raw.montantPaye ?? raw.montant_paye ?? 0))),
    nombreLignes: Number(raw.nombreLignes ?? raw.nombre_lignes ?? resolvedItems.length ?? 0),
    nombreBeneficiaires: Number(raw.nombreBeneficiaires ?? raw.nombre_beneficiaires ?? lignesCommande.length ?? 0),
    beneficiairesResume: Array.isArray(raw.beneficiairesResume || raw.beneficiaires_resume)
      ? (raw.beneficiairesResume || raw.beneficiaires_resume).map((row) => normalizeDossierBeneficiaire(row))
      : [],
    flagsMetier: normalizeDossierFlags(raw.flagsMetier || raw.flags_metier || {})
  };
}

function normalizeCommandeMedia(raw) {
  const idMedia = raw.idMedia || raw.id_media || raw.id || raw.localId || raw.local_id || "";
  const idCommande = raw.idCommande || raw.id_commande || raw.idCommandeServerId || raw.idCommandeLocalId || "";
  return {
    localId: raw.localId || raw.local_id || (isRemoteEntityId(idMedia) ? "" : idMedia),
    serverId: raw.serverId || raw.server_id || (isRemoteEntityId(idMedia) ? idMedia : ""),
    syncStatus: raw.syncStatus || raw.sync_status || "synced",
    updatedAt: raw.updatedAt || raw.updated_at || "",
    lastSyncedAt: raw.lastSyncedAt || raw.last_synced_at || "",
    pendingDelete: raw.pendingDelete === true || raw.pending_delete === true,
    idMedia,
    idCommande,
    idItem: raw.idItem || raw.id_item || "",
    idCommandeLocalId: raw.idCommandeLocalId || raw.id_commande_local_id || "",
    idCommandeServerId: raw.idCommandeServerId || raw.id_commande_server_id || (isRemoteEntityId(idCommande) ? idCommande : ""),
    typeMedia: raw.typeMedia || raw.type_media || "IMAGE",
    sourceType: raw.sourceType || raw.source_type || "UPLOAD",
    nomFichierOriginal: raw.nomFichierOriginal || raw.nom_fichier_original || "",
    mimeType: raw.mimeType || raw.mime_type || "image/webp",
    extensionStockage: raw.extensionStockage || raw.extension_stockage || "webp",
    tailleOriginaleBytes: Number(raw.tailleOriginaleBytes ?? raw.taille_originale_bytes ?? 0),
    largeur: raw.largeur === null || raw.largeur === undefined ? null : Number(raw.largeur),
    hauteur: raw.hauteur === null || raw.hauteur === undefined ? null : Number(raw.hauteur),
    note: raw.note || "",
    position: Number(raw.position || 1),
    isPrimary: raw.isPrimary === true || raw.is_primary === true,
    dateCreation: raw.dateCreation || raw.date_creation || "",
    thumbnailBlobUrl: "",
    fileBlobUrl: ""
  };
}

function normalizeRetouche(raw) {
  const idRetouche = raw.idRetouche || raw.id_retouche || raw.id || raw.localId || raw.local_id || "";
  const idClient = raw.idClient || raw.id_client || "";
  const items = Array.isArray(raw.items || raw.retoucheItems || raw.retouche_items)
    ? (raw.items || raw.retoucheItems || raw.retouche_items).map((item, index) => ({
        idItem: item.idItem || item.id_item || `local-ret-item-${index + 1}`,
        idRetouche: item.idRetouche || item.id_retouche || idRetouche,
        typeRetouche: item.typeRetouche || item.type_retouche || "",
        typeHabit: item.typeHabit || item.type_habit || "",
        description: item.description || "",
        prix: Number(item.prix ?? 0),
        montantPaye: Number(item.montantPaye ?? item.montant_paye ?? 0),
        ordreAffichage: Number(item.ordreAffichage ?? item.ordre_affichage ?? index + 1),
        mesures: item.mesures || item.mesuresHabit || item.mesures_habit_snapshot || item.mesures_snapshot_json || null,
        dateCreation: item.dateCreation || item.date_creation || ""
      }))
    : [];
  const resolvedItems =
    items.length > 0
      ? items
      : (raw.typeRetouche || raw.type_retouche)
        ? [
            {
              idItem: `legacy-${idRetouche || "retouche"}`,
              idRetouche,
              typeRetouche: raw.typeRetouche || raw.type_retouche || "",
              typeHabit: raw.typeHabit || raw.type_habit || "",
              description: raw.descriptionRetouche || raw.description || "",
              prix: Number(raw.montantTotal ?? raw.montant_total ?? 0),
              montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
              ordreAffichage: 1,
              mesures: raw.mesuresHabit || raw.mesures_habit_snapshot || null,
              dateCreation: raw.dateDepot || raw.date_depot || ""
            }
          ]
        : [];
  const primaryItem = resolvedItems[0] || null;
  return {
    localId: raw.localId || raw.local_id || (isRemoteEntityId(idRetouche) ? "" : idRetouche),
    serverId: raw.serverId || raw.server_id || (isRemoteEntityId(idRetouche) ? idRetouche : ""),
    syncStatus: raw.syncStatus || raw.sync_status || "synced",
    updatedAt: raw.updatedAt || raw.updated_at || "",
    lastSyncedAt: raw.lastSyncedAt || raw.last_synced_at || "",
    idRetouche,
    dossierId: raw.dossierId || raw.idDossier || raw.id_dossier || "",
    idClient,
    clientLocalId: raw.clientLocalId || raw.client_local_id || "",
    clientServerId: raw.clientServerId || raw.client_server_id || (isRemoteEntityId(idClient) ? idClient : ""),
    descriptionRetouche: raw.descriptionRetouche || raw.description || "",
    typeRetouche: raw.typeRetouche || raw.type_retouche || primaryItem?.typeRetouche || "",
    montantTotal: Number(raw.montantTotal ?? raw.montant_total ?? resolvedItems.reduce((sum, item) => sum + Number(item.prix || 0), 0)),
    montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
    typeHabit: raw.typeHabit || raw.type_habit || "",
    mesuresHabit: raw.mesuresHabit || raw.mesures_habit_snapshot || null,
    items: resolvedItems,
    statutRetouche: raw.statutRetouche || raw.statut || "DEPOSEE",
    dateDepot: toIsoDate(raw.dateDepot || raw.date_depot),
    datePrevue: toIsoDate(raw.datePrevue || raw.date_prevue),
    clientNom: raw.clientNom || raw.client_nom || "",
    soldeRestant: Number(raw.soldeRestant ?? raw.solde_restant ?? Math.max(0, Number(raw.montantTotal ?? raw.montant_total ?? 0) - Number(raw.montantPaye ?? raw.montant_paye ?? 0))),
    beneficiaire: normalizeDossierBeneficiaire(raw.beneficiaire || {}),
    flagsMetier: normalizeDossierFlags(raw.flagsMetier || raw.flags_metier || {})
  };
}

function normalizeStockArticle(raw) {
  return {
    idArticle: raw.idArticle || raw.id_article,
    nomArticle: raw.nomArticle || raw.nom_article,
    quantiteDisponible: Number(raw.quantiteDisponible ?? raw.quantite_disponible ?? 0),
    prixAchatMoyen: Number(raw.prixAchatMoyen ?? raw.prix_achat_moyen ?? 0),
    prixVenteUnitaire: Number(raw.prixVenteUnitaire ?? raw.prix_vente_unitaire ?? 0),
    seuilAlerte: Number(raw.seuilAlerte ?? raw.seuil_alerte ?? 0),
    actif: raw.actif !== false
  };
}

function normalizeVente(raw) {
  return {
    idVente: raw.idVente || raw.id_vente || raw.id,
    date: raw.date || raw.date_vente,
    total: Number(raw.total ?? 0),
    totalPrixAchat: Number(raw.totalPrixAchat ?? raw.total_prix_achat ?? 0),
    beneficeTotal: Number(raw.beneficeTotal ?? raw.benefice_total ?? 0),
    statut: raw.statut || "BROUILLON",
    referenceCaisse: raw.referenceCaisse || raw.reference_caisse || null,
    motifAnnulation: raw.motifAnnulation || raw.motif_annulation || null,
    lignesVente: raw.lignesVente || raw.lignes_vente || []
  };
}

function normalizeFacture(raw) {
  return {
    idFacture: raw.idFacture || raw.id_facture || raw.id,
    numeroFacture: raw.numeroFacture || raw.numero_facture || "",
    typeOrigine: raw.typeOrigine || raw.type_origine || "",
    idOrigine: raw.idOrigine || raw.id_origine || "",
    client: raw.client || raw.client_snapshot || { nom: "", contact: "" },
    dateEmission: raw.dateEmission || raw.date_emission || "",
    montantTotal: Number(raw.montantTotal ?? raw.montant_total ?? 0),
    montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
    solde: Number(raw.solde ?? 0),
    statut: raw.statut || "EMISE",
    referenceCaisse: raw.referenceCaisse || raw.reference_caisse || null,
    lignes: raw.lignes || raw.lignes_json || []
  };
}

function normalizeCaisse(raw) {
  return {
    idCaisseJour: raw.idCaisseJour || raw.id_caisse_jour,
    date: raw.date || raw.date_jour,
    statutCaisse: raw.statutCaisse || raw.statut,
    soldeOuverture: Number(raw.soldeOuverture ?? raw.solde_ouverture ?? 0),
    soldeCloture: raw.soldeCloture === null || raw.solde_cloture === null ? null : Number(raw.soldeCloture ?? raw.solde_cloture ?? 0),
    soldeCourant: Number(raw.soldeCourant ?? raw.solde_courant ?? 0),
    totalEntreesJour: Number(raw.totalEntreesJour ?? raw.total_entrees_jour ?? 0),
    totalSortiesQuotidiennesJour: Number(raw.totalSortiesQuotidiennesJour ?? raw.total_sorties_quotidiennes_jour ?? 0),
    resultatJournalier: Number(raw.resultatJournalier ?? raw.resultat_journalier ?? 0),
    soldeJournalierRestant: Number(raw.soldeJournalierRestant ?? raw.solde_journalier_restant ?? 0),
    ouvertePar: raw.ouvertePar || raw.ouverte_par || "",
    clotureePar: raw.clotureePar || raw.cloturee_par || "",
    dateOuverture: raw.dateOuverture || raw.date_ouverture || "",
    dateCloture: raw.dateCloture || raw.date_cloture || "",
    ouvertureAnticipee: raw.ouvertureAnticipee === true || raw.ouverture_anticipee === true,
    motifOuvertureAnticipee: raw.motifOuvertureAnticipee || raw.motif_ouverture_anticipee || "",
    autoriseePar: raw.autoriseePar || raw.autorisee_par || "",
    operations: (raw.operations || []).map((op) => ({
      idOperation: op.idOperation || op.id_operation,
      typeOperation: op.typeOperation || op.type_operation,
      montant: Number(op.montant || 0),
      motif: op.motif || "",
      dateOperation: op.dateOperation || op.date_operation || "",
      statutOperation: op.statutOperation || op.statut_operation || "VALIDE",
      typeDepense: op.typeDepense || op.type_depense || "QUOTIDIENNE",
      justification: op.justification || "",
      impactJournalier: op.impactJournalier ?? op.impact_journalier ?? null,
      impactGlobal: op.impactGlobal ?? op.impact_global ?? null,
      effectuePar: op.effectuePar || op.effectue_par || "",
      referenceMetier: op.referenceMetier || op.reference_metier || "",
      modePaiement: op.modePaiement || op.mode_paiement || ""
    }))
  };
}

function normalizePaiement(raw) {
  return {
    idOperation: raw.idOperation || raw.id_operation || raw.id,
    idCaisseJour: raw.idCaisseJour || raw.id_caisse_jour,
    typeOperation: raw.typeOperation || raw.type_operation || "",
    montant: Number(raw.montant ?? 0),
    modePaiement: raw.modePaiement || raw.mode_paiement || "",
    motif: raw.motif || "",
    referenceMetier: raw.referenceMetier || raw.reference_metier || "",
    dateOperation: raw.dateOperation || raw.date_operation || "",
    dateJour: raw.dateJour || raw.date_jour || "",
    effectuePar: raw.effectuePar || raw.effectue_par || "",
    statutOperation: raw.statutOperation || raw.statut_operation || ""
  };
}

function splitUserAndRole(value) {
  const source = String(value || "").trim();
  if (!source) return { nom: "", role: "" };
  const match = source.match(/^(.*)\(([^()]+)\)\s*$/);
  if (!match) return { nom: source, role: "" };
  return {
    nom: String(match[1] || "").trim(),
    role: String(match[2] || "").trim().toUpperCase()
  };
}

function formatWorkflowStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!status) return "-";
  if (status === "CREEE") return "Creee";
  if (status === "DEPOSEE") return "Deposee";
  if (status === "EN_COURS") return "En cours";
  if (status === "TERMINEE") return "Terminee";
  if (status === "LIVREE") return "Livree";
  if (status === "ANNULEE") return "Annulee";
  return status;
}

function formatWeekdayFr(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized.startsWith("monday")) return "Lundi";
  if (normalized.startsWith("tuesday")) return "Mardi";
  if (normalized.startsWith("wednesday")) return "Mercredi";
  if (normalized.startsWith("thursday")) return "Jeudi";
  if (normalized.startsWith("friday")) return "Vendredi";
  if (normalized.startsWith("saturday")) return "Samedi";
  if (normalized.startsWith("sunday")) return "Dimanche";
  return String(value || "").trim() || "-";
}

function formatWorkflowEventType(value) {
  const type = String(value || "").trim().toUpperCase();
  const labels = {
    COMMANDE_CREEE: "Commande creee",
    RETOUCHE_DEPOSEE: "Retouche deposee",
    TRAVAIL_DEMARRE: "Travail demarre",
    TRAVAIL_TERMINE: "Travail termine",
    PAIEMENT_ENREGISTRE: "Paiement enregistre",
    PAIEMENT_CAISSE_ENREGISTRE: "Paiement enregistre via caisse",
    COMMANDE_LIVREE: "Commande livree",
    RETOUCHE_LIVREE: "Retouche livree",
    COMMANDE_ANNULEE: "Commande annulee",
    RETOUCHE_ANNULEE: "Retouche annulee",
    REMBOURSEMENT_COMMANDE_ANNULEE: "Remboursement commande annulee",
    MEDIA_COMMANDE_AJOUTEE: "Photo ajoutee",
    MEDIA_COMMANDE_SUPPRIMEE: "Photo supprimee",
    MEDIA_COMMANDE_PRINCIPALE_DEFINIE: "Photo principale definie",
    MEDIA_COMMANDE_MISE_A_JOUR: "Photo mise a jour"
  };
  return labels[type] || type || "-";
}

function normalizeWorkflowEvent(raw) {
  const payload = raw && typeof raw.payload === "object" && raw.payload ? raw.payload : {};
  const legacyActor = splitUserAndRole(payload.utilisateur);
  const utilisateurNom = String(payload.utilisateurNom || "").trim() || legacyActor.nom;
  const role = String(payload.role || "").trim().toUpperCase() || legacyActor.role;
  const ancienStatut = String(payload.ancienStatut || "").trim().toUpperCase();
  const nouveauStatut = String(payload.nouveauStatut || "").trim().toUpperCase();
  const dateEvent = raw?.dateEvent || raw?.date_event || "";
  return {
    idEvent: raw?.idEvent || raw?.id_event || "",
    dateEvent,
    typeEvent: String(raw?.typeEvent || raw?.type_event || "").trim().toUpperCase(),
    typeEventLabel: formatWorkflowEventType(raw?.typeEvent || raw?.type_event),
    ancienStatut,
    nouveauStatut,
    ancienStatutLabel: formatWorkflowStatus(ancienStatut),
    nouveauStatutLabel: formatWorkflowStatus(nouveauStatut),
    utilisateurNom: utilisateurNom || "Systeme",
    role: role || "-"
  };
}

function revokeCommandeMediaObjectUrls(items = []) {
  for (const item of items || []) {
    const urls = new Set([item?.thumbnailBlobUrl, item?.fileBlobUrl].filter(Boolean));
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }
  }
}

function toIsoDate(input) {
  if (!input) return "";
  const raw = String(input).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function setClientPage(section, next) {
  if (section === "commandes") {
    clientPagination.commandesPage = Math.max(1, Math.min(clientCommandesPages.value, next));
    return;
  }
  if (section === "retouches") {
    clientPagination.retouchesPage = Math.max(1, Math.min(clientRetouchesPages.value, next));
    return;
  }
  if (section === "mesures") {
    clientPagination.mesuresPage = Math.max(1, Math.min(clientMesuresPages.value, next));
  }
}

async function openBlobPdfInNewTab(loadBlobUrl) {
  const popup = window.open("", "_blank");
  try {
    const blobUrl = await loadBlobUrl();
    if (popup) popup.location.href = blobUrl;
    else window.open(blobUrl, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    if (popup) popup.close();
    notify(readableError(err));
  }
}

function buildDocumentDownloadName(baseName, extension = "html") {
  const safeBaseName = String(baseName || "document")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeExtension = String(extension || "html")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return `${safeBaseName || "document"}.${safeExtension || "html"}`;
}

function triggerBlobDocumentDownload(blobUrl, fileName) {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName || "document.html";
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function openDocumentForCurrentViewport(loadBlobUrl, { mobileFileName, mobileSuccessMessage } = {}) {
  if (!isMobileViewport.value) {
    await openBlobPdfInNewTab(loadBlobUrl);
    return;
  }
  try {
    const blobUrl = await loadBlobUrl();
    triggerBlobDocumentDownload(blobUrl, mobileFileName || "document.html");
    notify(mobileSuccessMessage || "Document telecharge. Ouvrez-le depuis vos telechargements si besoin.");
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    notify(readableError(err));
  }
}

async function exportClientConsultationPdf() {
  if (!clientConsultationClient.value?.idClient) return;
  const clientName = clientConsultationClient.value.nomComplet || clientConsultationClient.value.telephone || clientConsultationClient.value.idClient;
  await openDocumentForCurrentViewport(() =>
    atelierApi.getClientConsultationPdfBlobUrl(clientConsultationClient.value.idClient, {
      source: clientHistoryFilters.source,
      typeHabit: clientHistoryFilters.typeHabit,
      periode: clientHistoryFilters.periode,
      size: 200,
      autoprint: isMobileViewport.value ? 0 : 1
    })
  , {
    mobileFileName: buildDocumentDownloadName(`fiche-client-${clientName}`),
    mobileSuccessMessage: "Fiche client telechargee. Ouvrez-la depuis vos telechargements si besoin."
  }
  );
}

function formatDateTime(input) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function isCaisseClosedMessage(message) {
  const lower = String(message || "").toLowerCase();
  return lower.includes("caisse is closed") || lower.includes("caisse cloturee");
}

function isCaisseRefundUnavailableMessage(message) {
  const lower = String(message || "").toLowerCase();
  return (
    isCaisseClosedMessage(message) ||
    lower.includes("idcaissejour requis pour remboursement") ||
    lower.includes("caisse du jour est fermee")
  );
}

function isCaisseInsufficientMessage(message) {
  const lower = String(message || "").toLowerCase();
  return lower.includes("solde insuffisant") || lower.includes("solde journalier insuffisant");
}

function buildCancellationConfirmationMessage(entityLabel, entityId, montantPaye = 0) {
  const label = String(entityLabel || "element").trim();
  const id = String(entityId || "").trim();
  const paid = Number(montantPaye || 0);
  if (paid > 0) {
    return `Cette action va annuler ${label} ${id} et enregistrer un remboursement via la caisse. Voulez-vous continuer ?`;
  }
  return `Cette action va annuler ${label} ${id}. Voulez-vous continuer ?`;
}

function getCancellationPayload(entity) {
  const montantPaye = Number(entity?.montantPaye || 0);
  if (montantPaye <= 0) return {};
  const idCaisseJour = String(caisseJour.value?.idCaisseJour || "").trim();
  if (!caisseOuverte.value || !idCaisseJour) {
    notify("Impossible d'annuler pour le moment : la caisse du jour est fermee ou indisponible pour enregistrer le remboursement.");
    return null;
  }
  return { idCaisseJour };
}

function notifyCancellationError(err) {
  const message = readableError(err);
  if (isCaisseRefundUnavailableMessage(message)) {
    notify("Impossible d'annuler pour le moment : la caisse du jour est fermee ou indisponible pour enregistrer le remboursement.");
    return;
  }
  if (isCaisseInsufficientMessage(message)) {
    notify("Impossible d'annuler pour le moment : le solde de caisse est insuffisant pour rembourser ce paiement.");
    return;
  }
  notify(message);
}

function formatCaisseOuvertePar(caisse) {
  const value = String(caisse?.ouvertePar || "").trim();
  if (!value) return "-";
  const lower = value.toLowerCase();
  if (lower.includes("system") || lower.includes("auto")) return "Systeme (ouverture automatique)";
  return value;
}

function formatCaisseClotureePar(caisse) {
  const value = String(caisse?.clotureePar || "").trim();
  if (!value) return "-";
  return value;
}

function formatDateShort(input) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const moisFr = [
    "janvier",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "decembre"
  ];
  const jour = String(date.getDate()).padStart(2, "0");
  const mois = moisFr[date.getMonth()] || "";
  const annee = date.getFullYear();
  return `${jour} ${mois} ${annee}`;
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function todayLabel() {
  const date = new Date();
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
  const year = new Intl.DateTimeFormat("fr-FR", { year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${capitalize(weekday)} le ${day}/${month}/${year} • ${time}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat("fr-FR").format(Number(value || 0))} ${atelierDevise.value}`;
}

function formatFactureCurrency(value) {
  const amount = new Intl.NumberFormat("fr-FR").format(Number(value || 0));
  return factureAtelierProfile.value.devise ? `${amount} ${factureAtelierProfile.value.devise}` : amount;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(Number(value || 0))} %`;
}

function findFactureByOrigine(typeOrigine, idOrigine) {
  return (
    facturesView.value.find(
      (facture) => String(facture.typeOrigine || "") === String(typeOrigine || "") && String(facture.idOrigine || "") === String(idOrigine || "")
    ) || null
  );
}

function resetMesuresModel(model) {
  model.typeManches = "";
}

function mesureInputType(field) {
  if (field && typeof field === "object") {
    return field.inputType || (field.key === "typeManches" ? "select" : "number");
  }
  return field === "typeManches" ? "select" : "number";
}

function mesurePlaceholder(field) {
  const inputType = mesureInputType(field);
  if (inputType === "select") return "Choisir";
  if (inputType === "text") return "Saisir une valeur";
  return "cm";
}

function mesureDisplayLabel(field) {
  if (field && typeof field === "object") return field.label || mesureLabels[field.key] || field.key;
  return mesureLabels[field] || field;
}

function parseMesureValue(raw, label) {
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) throw new Error(`Mesure invalide: ${label}`);
  if (n > 400) throw new Error(`Mesure aberrante: ${label}`);
  return n;
}

function parseMesureTextValue(raw, label) {
  const value = String(raw || "").trim();
  if (!value) throw new Error(`Mesure invalide: ${label}`);
  return value;
}

function collectMesuresSnapshot({ typeHabit, mesuresModel, requireComplete, requireAtLeastOne = !requireComplete }) {
  const def = resolveHabitUiDefinition(typeHabit);
  if (!def) throw new Error("Type d'habit requis.");
  const out = {};

  for (const field of def.required) {
    const fieldType = def.fieldTypes?.[field] || (field === "typeManches" ? "select" : "number");
    if (field === "typeManches") {
      const manches = String(mesuresModel.typeManches || "").trim().toLowerCase();
      if (requireComplete && !manches) throw new Error("Type manches requis.");
      if (manches) {
        if (manches !== "courtes" && manches !== "longues") throw new Error("Type manches invalide.");
        out.typeManches = manches;
      }
      continue;
    }
    const raw = mesuresModel[field];
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete) throw new Error(`Mesure obligatoire: ${mesureDisplayLabel(field)}`);
      continue;
    }
    out[field] = fieldType === "number" ? parseMesureValue(raw, mesureDisplayLabel(field)) : parseMesureTextValue(raw, mesureDisplayLabel(field));
  }

  for (const field of def.optional) {
    const fieldType = def.fieldTypes?.[field] || (field === "typeManches" ? "select" : "number");
    if (field === "typeManches") continue;
    const raw = mesuresModel[field];
    if (raw === undefined || raw === null || raw === "") continue;
    out[field] = fieldType === "number" ? parseMesureValue(raw, mesureDisplayLabel(field)) : parseMesureTextValue(raw, mesureDisplayLabel(field));
  }

  if (out.typeManches === "longues") {
    const raw = mesuresModel.longueurManches;
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete) throw new Error("Longueur manches requise si manches longues.");
    } else {
      out.longueurManches = parseMesureValue(raw, mesureDisplayLabel("longueurManches"));
    }
  }

  if (requireAtLeastOne && Object.keys(out).length === 0) {
    throw new Error("Saisir au moins une mesure pour la retouche.");
  }

  return out;
}

function collectRetoucheMesuresSnapshot({ mesuresModel, fields, requireAtLeastOne = true, requireComplete = false }) {
  const out = {};
  for (const field of fields) {
    const raw = mesuresModel[field.key];
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete && field.required) throw new Error(`Mesure obligatoire: ${mesureDisplayLabel(field)}`);
      continue;
    }
    out[field.key] =
      mesureInputType(field) === "number" ? parseMesureValue(raw, mesureDisplayLabel(field)) : parseMesureTextValue(raw, mesureDisplayLabel(field));
  }
  if (requireAtLeastOne && Object.keys(out).length === 0) {
    throw new Error("Saisir au moins une mesure pour la retouche.");
  }
  return {
    unite: fields.find((field) => field.unite)?.unite || "cm",
    valeurs: out,
    definitions: fields.map((field, index) => ({
      code: field.key,
      label: field.label,
      unite: field.unite || (mesureInputType(field) === "number" ? "cm" : ""),
      typeChamp: mesureInputType(field),
      obligatoire: field.required === true,
      ordre: index + 1
    }))
  };
}

function formatMesuresLines(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const valeurs = snapshot.valeurs && typeof snapshot.valeurs === "object" ? snapshot.valeurs : snapshot;
  const definitions = Array.isArray(snapshot.definitions) ? snapshot.definitions : [];
  const byCode = new Map(definitions.map((row) => [row.code, row]));
  return Object.entries(valeurs).map(([key, value]) => {
    const definition = byCode.get(key);
    const label = definition?.label || mesureDisplayLabel(key);
    const unit = definition?.unite || "cm";
    if (typeof value === "string" && !Number.isFinite(Number(value))) return `${label}: ${String(value)}`;
    return `${label}: ${Number(value)}${unit ? ` ${unit}` : ""}`;
  });
}

function soldeRestant(commande) {
  if (!commande) return 0;
  return Math.max(0, Number(commande.montantTotal || 0) - Number(commande.montantPaye || 0));
}

function canPayer(commande) {
  if (!commande) return false;
  const id = String(commande.idCommande || "");
  if (isLocalEntity(id)) return false;
  const fromApi = readActionEntry(commandeActionsById, id);
  if (fromApi && typeof fromApi.payer === "boolean") return fromApi.payer;
  if (commande.statutCommande === "LIVREE" || commande.statutCommande === "ANNULEE") return false;
  return soldeRestant(commande) > 0;
}

function canLivrer(commande) {
  if (!commande) return false;
  const id = String(commande.idCommande || "");
  if (!hasActionEntry(commandeActionsById, id)) return false;
  const fromApi = readActionEntry(commandeActionsById, id);
  return Boolean(fromApi?.livrer);
}

function canTerminer(commande) {
  if (!commande) return false;
  const id = String(commande.idCommande || "");
  if (!hasActionEntry(commandeActionsById, id)) return false;
  const fromApi = readActionEntry(commandeActionsById, id);
  return Boolean(fromApi?.terminer);
}

function canAnnuler(commande) {
  if (!commande) return false;
  if (commande.statutCommande === "TERMINEE") return false;
  const id = String(commande.idCommande || "");
  if (!hasActionEntry(commandeActionsById, id)) return false;
  const fromApi = readActionEntry(commandeActionsById, id);
  return Boolean(fromApi?.annuler);
}

function canPayerRetouche(retouche) {
  if (!retouche) return false;
  const id = String(retouche.idRetouche || "");
  if (isLocalEntity(id)) return false;
  const fromApi = readActionEntry(retoucheActionsById, id);
  if (fromApi && typeof fromApi.payer === "boolean") return fromApi.payer;
  if (retouche.statutRetouche === "LIVREE" || retouche.statutRetouche === "ANNULEE") return false;
  return soldeRestant(retouche) > 0;
}

function canLivrerRetouche(retouche) {
  if (!retouche) return false;
  const id = String(retouche.idRetouche || "");
  if (!hasActionEntry(retoucheActionsById, id)) return false;
  const fromApi = readActionEntry(retoucheActionsById, id);
  return Boolean(fromApi?.livrer);
}

function canTerminerRetouche(retouche) {
  if (!retouche) return false;
  const id = String(retouche.idRetouche || "");
  if (!hasActionEntry(retoucheActionsById, id)) return false;
  const fromApi = readActionEntry(retoucheActionsById, id);
  return Boolean(fromApi?.terminer);
}

function canAnnulerRetouche(retouche) {
  if (!retouche) return false;
  if (retouche.statutRetouche === "TERMINEE") return false;
  const id = String(retouche.idRetouche || "");
  if (!hasActionEntry(retoucheActionsById, id)) return false;
  const fromApi = readActionEntry(retoucheActionsById, id);
  return Boolean(fromApi?.annuler);
}

async function onAnnulerCommande(commande) {
  const payload = getCancellationPayload(commande);
  if (payload === null) return;
  const confirmed = await openActionModal({
    title: "Annuler la commande",
    message: buildCancellationConfirmationMessage("la commande", commande.idCommande, commande.montantPaye),
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerCommande(commande.idCommande, payload);
    await reloadAll();
    notify(`Commande annulee: ${commande.idCommande}`);
  } catch (err) {
    notifyCancellationError(err);
  }
}

function resetWizard() {
  wizard.step = 1;
  wizard.mode = "existing";
  wizard.dossierId = "";
  wizard.existingClientId = "";
  wizard.resolvedClientId = "";
  wizard.requestCommandeId = "";
  wizard.requestNewClientId = "";
  wizard.createdCommandeId = "";
  wizard.createdFactureId = "";
  wizard.submitting = false;
  clearWizardDuplicateDecision();
  wizard.newClient.nom = "";
  wizard.newClient.prenom = "";
  wizard.newClient.telephone = "";
  wizard.commande.descriptionCommande = "";
  wizard.commande.montantTotal = "";
  wizard.commande.datePrevue = "";
  wizard.commande.emettreFacture = true;
  wizard.commande.typeHabit = "";
  wizard.commande.items = [createCommandeItemDraft()];
  wizard.commande.mesuresHabit = {};
  wizard.commande.prefillLoading = false;
  wizard.commande.prefill = null;
  wizard.commande.prefillDecision = "idle";
  wizardClientSearchQuery.value = "";
  wizardClientSearchOpen.value = false;
  wizardClientSearchIndex.value = -1;
  resetWizardClientInsight();
}

async function openNouvelleCommande() {
  if (!canCreateCommande.value) return;
  await loadAtelierRuntimeSettings();
  resetWizard();
  wizard.open = true;
}

function closeWizard() {
  wizard.open = false;
}

function resetRetoucheWizard() {
  retoucheWizard.step = 1;
  retoucheWizard.mode = "existing";
  retoucheWizard.dossierId = "";
  retoucheWizard.existingClientId = "";
  retoucheWizard.resolvedClientId = "";
  retoucheWizard.requestRetoucheId = "";
  retoucheWizard.requestNewClientId = "";
  retoucheWizard.createdRetoucheId = "";
  retoucheWizard.createdFactureId = "";
  retoucheWizard.submitting = false;
  retoucheWizard.newClient.nom = "";
  retoucheWizard.newClient.prenom = "";
  retoucheWizard.newClient.telephone = "";
  retoucheWizard.retouche.descriptionRetouche = "";
  retoucheWizard.retouche.typeRetouche = "";
  retoucheWizard.retouche.montantTotal = "";
  retoucheWizard.retouche.datePrevue = "";
  retoucheWizard.retouche.emettreFacture = true;
  retoucheWizard.retouche.typeHabit = "";
  retoucheWizard.retouche.items = [createRetoucheItemDraft()];
  retoucheWizard.retouche.mesuresHabit = {};
  resetMesuresModel(retoucheWizard.retouche.mesuresHabit);
  wizardRetoucheMeasureIndex.value = 0;
  retoucheClientSearchQueryWizard.value = "";
  retoucheClientSearchOpen.value = false;
  retoucheClientSearchIndex.value = -1;
  resetRetoucheClientInsight();
}

async function openNouvelleRetouche() {
  if (!canCreateRetouche.value) return;
  await loadAtelierRuntimeSettings();
  resetRetoucheWizard();
  retoucheWizard.open = true;
}

function closeRetoucheWizard() {
  retoucheWizard.open = false;
}

function selectWizardExistingClient(result) {
  if (!result?.client?.idClient) return;
  wizard.existingClientId = result.client.idClient;
  wizard.resolvedClientId = result.client.idClient;
  wizardClientSearchQuery.value = `${result.nomComplet} — ${result.telephone}`;
  wizardClientSearchOpen.value = false;
  wizardClientSearchIndex.value = -1;
  void loadWizardClientInsight(result.client.idClient);
  void refreshCommandePrefill();
}

function applyWizardExistingClient(client) {
  if (!client?.idClient) return;
  wizard.mode = "existing";
  clearWizardDuplicateDecision();
  selectWizardExistingClient({
    client,
    nomComplet: formatClientDisplayName(client),
    telephone: String(client.telephone || "").trim()
  });
}

function selectDossierExistingClient(result) {
  if (!result?.client?.idClient) return;
  dossierDraft.existingClientId = result.client.idClient;
  dossierClientSearchQuery.value = `${result.nomComplet} — ${result.telephone}`;
  dossierClientSearchOpen.value = false;
  dossierClientSearchIndex.value = -1;
}

function applyRetoucheExistingClient(client) {
  if (!client?.idClient) return;
  retoucheWizard.mode = "existing";
  selectRetoucheExistingClient({
    client,
    nomComplet: formatClientDisplayName(client),
    telephone: String(client.telephone || "").trim()
  });
  retoucheWizard.resolvedClientId = client.idClient;
}

function normalizeWizardDuplicateClient(raw) {
  const normalized = normalizeClient(raw || {});
  return normalized.idClient ? normalized : null;
}

async function resolveCommandeClientDuplicate(err, payload) {
  if (!(err instanceof ApiError) || Number(err.status || 0) !== 409) return undefined;

  const code = String(err.payload?.code || "").trim().toUpperCase();
  if (code === "CLIENT_DUPLICATE_PHONE") {
    const existingClient = normalizeWizardDuplicateClient(err.payload?.existingClient);
    if (!existingClient) return undefined;
    const choice = await openActionModal({
      title: "Numero deja utilise",
      message: `Ce numero appartient deja a ${formatClientDisplayName(existingClient)}. Vous pouvez reutiliser ce client ou confirmer un nouveau client.`,
      confirmLabel: "Continuer",
      cancelLabel: "Annuler",
      tone: "blue",
      fields: [
        {
          key: "decision",
          label: "Action a appliquer",
          type: "select",
          defaultValue: "USE_EXISTING",
          options: [
            { value: "USE_EXISTING", label: "Utiliser ce client" },
            { value: "CONFIRM_NEW", label: "Creer quand meme un nouveau client" }
          ]
        }
      ]
    });
    if (!choice) return null;
    const decision = String(choice.decision || "USE_EXISTING").trim().toUpperCase();
    if (decision === "CONFIRM_NEW") {
      return {
        ...payload,
        doublonDecision: {
          action: "CONFIRM_NEW",
          idClient: existingClient.idClient
        }
      };
    }
    applyWizardExistingClient(existingClient);
    return {
      ...payload,
      clientPayeurId: existingClient.idClient,
      idClient: existingClient.idClient,
      nouveauClient: undefined,
      doublonDecision: undefined
    };
  }

  if (code === "CLIENT_DUPLICATE_POSSIBLE") {
    const duplicates = (Array.isArray(err.payload?.probableDuplicates) ? err.payload.probableDuplicates : [])
      .map((row) => normalizeWizardDuplicateClient(row))
      .filter(Boolean);
    if (duplicates.length === 0) return undefined;

    const modalFields = [];
    if (duplicates.length > 1) {
      modalFields.push({
        key: "targetClientId",
        label: "Client a examiner",
        type: "select",
        defaultValue: duplicates[0].idClient,
        options: duplicates.map((client) => ({
          value: client.idClient,
          label: `${formatClientDisplayName(client)} — ${client.telephone || "Sans numero"}`
        }))
      });
    }
    modalFields.push({
      key: "decision",
      label: "Action a appliquer",
      type: "select",
      defaultValue: "USE_EXISTING",
      options: [
        { value: "USE_EXISTING", label: "Utiliser le client existant" },
        { value: "UPDATE_EXISTING_PHONE", label: "Mettre a jour son numero" },
        { value: "CONFIRM_NEW", label: "Confirmer un nouveau client" }
      ]
    });

    const modalPayload = await openActionModal({
      title: "Doublon client probable",
      message:
        "Un client au nom similaire existe deja. Vous pouvez reutiliser le client existant, mettre a jour son numero ou confirmer la creation d'un nouveau client.",
      confirmLabel: "Continuer",
      cancelLabel: "Annuler",
      tone: "blue",
      fields: modalFields
    });
    if (!modalPayload) return null;

    const targetClientId = String(modalPayload.targetClientId || duplicates[0].idClient || "").trim();
    const targetClient = duplicates.find((client) => client.idClient === targetClientId) || duplicates[0];
    const decision = String(modalPayload.decision || "USE_EXISTING").trim().toUpperCase();

    if (decision === "USE_EXISTING") {
      applyWizardExistingClient(targetClient);
      return {
        ...payload,
        idClient: targetClient.idClient,
        nouveauClient: undefined,
        doublonDecision: undefined
      };
    }

    if (decision === "UPDATE_EXISTING_PHONE") {
      return {
        ...payload,
        doublonDecision: {
          action: "UPDATE_EXISTING_PHONE",
          idClient: targetClient.idClient
        }
      };
    }

    return {
      ...payload,
      doublonDecision: {
        action: "CONFIRM_NEW",
        idClient: targetClient.idClient
      }
    };
  }

  return undefined;
}

async function resolveRetoucheClientDuplicate(err, payload) {
  if (!(err instanceof ApiError) || Number(err.status || 0) !== 409) return undefined;

  const code = String(err.payload?.code || "").trim().toUpperCase();
  if (code === "CLIENT_DUPLICATE_PHONE") {
    const existingClient = normalizeWizardDuplicateClient(err.payload?.existingClient);
    if (!existingClient) return undefined;
    const choice = await openActionModal({
      title: "Numero deja utilise",
      message: `Ce numero appartient deja a ${formatClientDisplayName(existingClient)}. Vous pouvez reutiliser ce client ou confirmer un nouveau client.`,
      confirmLabel: "Continuer",
      cancelLabel: "Annuler",
      tone: "blue",
      fields: [
        {
          key: "decision",
          label: "Action a appliquer",
          type: "select",
          defaultValue: "USE_EXISTING",
          options: [
            { value: "USE_EXISTING", label: "Utiliser ce client" },
            { value: "CONFIRM_NEW", label: "Creer quand meme un nouveau client" }
          ]
        }
      ]
    });
    if (!choice) return null;
    const decision = String(choice.decision || "USE_EXISTING").trim().toUpperCase();
    if (decision === "CONFIRM_NEW") {
      return {
        ...payload,
        doublonDecision: {
          action: "CONFIRM_NEW",
          idClient: existingClient.idClient
        }
      };
    }
    applyRetoucheExistingClient(existingClient);
    return {
      ...payload,
      idClient: existingClient.idClient,
      nouveauClient: undefined,
      doublonDecision: undefined
    };
  }

  if (code === "CLIENT_DUPLICATE_POSSIBLE") {
    const duplicates = (Array.isArray(err.payload?.probableDuplicates) ? err.payload.probableDuplicates : [])
      .map((row) => normalizeWizardDuplicateClient(row))
      .filter(Boolean);
    if (duplicates.length === 0) return undefined;

    const modalFields = [];
    if (duplicates.length > 1) {
      modalFields.push({
        key: "targetClientId",
        label: "Client a examiner",
        type: "select",
        defaultValue: duplicates[0].idClient,
        options: duplicates.map((client) => ({
          value: client.idClient,
          label: `${formatClientDisplayName(client)} — ${client.telephone || "Sans numero"}`
        }))
      });
    }
    modalFields.push({
      key: "decision",
      label: "Action a appliquer",
      type: "select",
      defaultValue: "USE_EXISTING",
      options: [
        { value: "USE_EXISTING", label: "Utiliser le client existant" },
        { value: "UPDATE_EXISTING_PHONE", label: "Mettre a jour son numero" },
        { value: "CONFIRM_NEW", label: "Confirmer un nouveau client" }
      ]
    });

    const modalPayload = await openActionModal({
      title: "Doublon client probable",
      message:
        "Un client au nom similaire existe deja. Vous pouvez reutiliser le client existant, mettre a jour son numero ou confirmer la creation d'un nouveau client.",
      confirmLabel: "Continuer",
      cancelLabel: "Annuler",
      tone: "blue",
      fields: modalFields
    });
    if (!modalPayload) return null;

    const targetClientId = String(modalPayload.targetClientId || duplicates[0].idClient || "").trim();
    const targetClient = duplicates.find((client) => client.idClient === targetClientId) || duplicates[0];
    const decision = String(modalPayload.decision || "USE_EXISTING").trim().toUpperCase();

    if (decision === "USE_EXISTING") {
      applyRetoucheExistingClient(targetClient);
      return {
        ...payload,
        idClient: targetClient.idClient,
        nouveauClient: undefined,
        doublonDecision: undefined
      };
    }

    if (decision === "UPDATE_EXISTING_PHONE") {
      return {
        ...payload,
        doublonDecision: {
          action: "UPDATE_EXISTING_PHONE",
          idClient: targetClient.idClient
        }
      };
    }

    return {
      ...payload,
      doublonDecision: {
        action: "CONFIRM_NEW",
        idClient: targetClient.idClient
      }
    };
  }

  return undefined;
}

async function submitCommandeWithDuplicateHandling(payload) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await atelierApi.createCommande(currentPayload);
    } catch (err) {
      const resolvedPayload = await resolveCommandeClientDuplicate(err, currentPayload);
      if (resolvedPayload === undefined) throw err;
      if (resolvedPayload === null) return null;
      currentPayload = resolvedPayload;
    }
  }

  throw new Error("Creation de commande interrompue apres plusieurs tentatives.");
}

async function submitRetoucheWithDuplicateHandling(payload) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await atelierApi.createRetoucheWizard(currentPayload);
    } catch (err) {
      const resolvedPayload = await resolveRetoucheClientDuplicate(err, currentPayload);
      if (resolvedPayload === undefined) throw err;
      if (resolvedPayload === null) return null;
      currentPayload = resolvedPayload;
    }
  }

  throw new Error("Creation de retouche interrompue apres plusieurs tentatives.");
}

function onWizardClientSearchInput(event) {
  wizardClientSearchQuery.value = event.target.value;
  wizard.existingClientId = "";
  wizardClientSearchOpen.value = true;
  resetWizardClientInsight();
}

function onDossierClientSearchInput(event) {
  dossierClientSearchQuery.value = event.target.value;
  dossierDraft.existingClientId = "";
  dossierClientSearchOpen.value = true;
}

function onWizardClientSearchBlur() {
  window.setTimeout(() => {
    wizardClientSearchOpen.value = false;
    wizardClientSearchIndex.value = -1;
  }, 120);
}

function onDossierClientSearchBlur() {
  window.setTimeout(() => {
    dossierClientSearchOpen.value = false;
    dossierClientSearchIndex.value = -1;
  }, 120);
}

function onWizardClientSearchKeydown(event) {
  const results = wizardClientSearchResults.value;
  if (event.key === "Escape") {
    wizardClientSearchOpen.value = false;
    wizardClientSearchIndex.value = -1;
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    wizardClientSearchOpen.value = true;
    if (results.length === 0) return;
    const next = wizardClientSearchIndex.value + 1;
    wizardClientSearchIndex.value = next >= results.length ? 0 : next;
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    wizardClientSearchOpen.value = true;
    if (results.length === 0) return;
    const prev = wizardClientSearchIndex.value - 1;
    wizardClientSearchIndex.value = prev < 0 ? results.length - 1 : prev;
    return;
  }
  if (event.key === "Enter" && wizardClientSearchOpen.value && results.length > 0) {
    event.preventDefault();
    const index = wizardClientSearchIndex.value >= 0 ? wizardClientSearchIndex.value : 0;
    selectWizardExistingClient(results[index]);
  }
}

function onDossierClientSearchKeydown(event) {
  const results = dossierClientSearchResults.value;
  if (event.key === "Escape") {
    dossierClientSearchOpen.value = false;
    dossierClientSearchIndex.value = -1;
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    dossierClientSearchOpen.value = true;
    if (results.length === 0) return;
    const next = dossierClientSearchIndex.value + 1;
    dossierClientSearchIndex.value = next >= results.length ? 0 : next;
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    dossierClientSearchOpen.value = true;
    if (results.length === 0) return;
    const prev = dossierClientSearchIndex.value - 1;
    dossierClientSearchIndex.value = prev < 0 ? results.length - 1 : prev;
    return;
  }
  if (event.key === "Enter" && results.length > 0) {
    event.preventDefault();
    const index = dossierClientSearchIndex.value >= 0 ? dossierClientSearchIndex.value : 0;
    selectDossierExistingClient(results[index]);
  }
}

function selectRetoucheExistingClient(result) {
  if (!result?.client?.idClient) return;
  retoucheWizard.existingClientId = result.client.idClient;
  retoucheClientSearchQueryWizard.value = `${result.nomComplet} — ${result.telephone}`;
  retoucheClientSearchOpen.value = false;
  retoucheClientSearchIndex.value = -1;
  void loadRetoucheClientInsight(result.client.idClient);
}

function onRetoucheClientSearchInput(event) {
  retoucheClientSearchQueryWizard.value = event.target.value;
  retoucheWizard.existingClientId = "";
  retoucheClientSearchOpen.value = true;
  resetRetoucheClientInsight();
}

function onRetoucheClientSearchBlur() {
  window.setTimeout(() => {
    retoucheClientSearchOpen.value = false;
    retoucheClientSearchIndex.value = -1;
  }, 120);
}

function onRetoucheClientSearchKeydown(event) {
  const results = retoucheClientSearchResultsWizard.value;
  if (event.key === "Escape") {
    retoucheClientSearchOpen.value = false;
    retoucheClientSearchIndex.value = -1;
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    retoucheClientSearchOpen.value = true;
    if (results.length === 0) return;
    const next = retoucheClientSearchIndex.value + 1;
    retoucheClientSearchIndex.value = next >= results.length ? 0 : next;
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    retoucheClientSearchOpen.value = true;
    if (results.length === 0) return;
    const prev = retoucheClientSearchIndex.value - 1;
    retoucheClientSearchIndex.value = prev < 0 ? results.length - 1 : prev;
    return;
  }
  if (event.key === "Enter" && retoucheClientSearchOpen.value && results.length > 0) {
    event.preventDefault();
    const index = retoucheClientSearchIndex.value >= 0 ? retoucheClientSearchIndex.value : 0;
    selectRetoucheExistingClient(results[index]);
  }
}

async function onWizardStep1() {
  if (wizard.submitting) return;
  wizard.submitting = true;
  try {
    if (wizard.mode === "existing") {
      if (!wizard.existingClientId) throw new Error("Selectionnez un client existant.");
      wizard.resolvedClientId = wizard.existingClientId;
    } else {
      if (!canCreateWizardClient.value) throw new Error("Creation de client non autorisee.");
      const payload = {
        nom: String(wizard.newClient.nom || "").trim(),
        prenom: String(wizard.newClient.prenom || "").trim(),
        telephone: String(wizard.newClient.telephone || "").trim()
      };
      if (!payload.nom || !payload.prenom) throw new Error("Completez au minimum le nom et le prenom.");
      wizard.resolvedClientId = "";
    }

    wizard.step = 2;
    await refreshCommandePrefill();
  } catch (err) {
    notify(readableError(err));
  } finally {
    wizard.submitting = false;
  }
}

async function onWizardStep2() {
  if (wizard.submitting) return;
  wizard.submitting = true;
  try {
    if (!canCreateCommande.value) throw new Error("Creation de commande non autorisee.");
    syncCommandePrimaryTypeFromItems();
    const items = (wizard.commande.items || []).filter((item) => String(item.typeHabit || "").trim());
    const montant = Number(wizard.commande.montantTotal);
    if (!String(wizard.commande.descriptionCommande || "").trim() || Number.isNaN(montant) || montant <= 0) {
      throw new Error("Description et montant valide sont obligatoires.");
    }
    if (items.length === 0) throw new Error("Ajoutez au moins un habit.");
    wizard.step = 3;
    setWizardCommandeMeasureIndex(0);
  } catch (err) {
    notify(readableError(err));
  } finally {
    wizard.submitting = false;
  }
}

async function onWizardStep3() {
  if (wizard.submitting) return;
  wizard.submitting = true;
  try {
    if (!canCreateCommande.value) throw new Error("Creation de commande non autorisee.");
    const items = (wizard.commande.items || []).filter((item) => String(item.typeHabit || "").trim());
    if (items.length === 0) throw new Error("Ajoutez au moins un habit.");
    const commandesConfig = wizardCommandesSettings.value || {};
    const mesuresObligatoires = commandesConfig.mesuresObligatoires !== false;
    const interdictionSansMesures = commandesConfig.interdictionSansMesures !== false;
    for (const item of items) {
      collectMesuresSnapshot({
        typeHabit: item.typeHabit,
        mesuresModel: item.mesures || {},
        requireComplete: mesuresObligatoires && interdictionSansMesures,
        requireAtLeastOne: mesuresObligatoires
      });
    }
    wizard.step = 4;
  } catch (err) {
    notify(readableError(err));
  } finally {
    wizard.submitting = false;
  }
}

async function onWizardStep4() {
  if (wizard.submitting) return;
  wizard.submitting = true;
  try {
    if (!canCreateCommande.value) throw new Error("Creation de commande non autorisee.");
    syncCommandePrimaryTypeFromItems();
    const atelierId = currentAtelierId.value;
    if (!atelierId) throw new Error("Atelier offline introuvable.");

    const items = (wizard.commande.items || [])
      .map((item) => ({
        idItem: item.idItem,
        typeHabit: String(item.typeHabit || "").trim().toUpperCase(),
        description: String(item.description || "").trim(),
        prix: Number(item.prix || 0)
      }))
      .filter((item) => item.typeHabit && Number.isFinite(item.prix) && item.prix >= 0);
    const montant = Number(wizard.commande.montantTotal);
    if (!wizard.commande.descriptionCommande || Number.isNaN(montant) || montant <= 0) {
      throw new Error("Description et montant valide sont obligatoires.");
    }
    if (items.length === 0) throw new Error("Ajoutez au moins un habit.");

    const commandesConfig = wizardCommandesSettings.value || {};
    const mesuresObligatoires = commandesConfig.mesuresObligatoires !== false;
    const interdictionSansMesures = commandesConfig.interdictionSansMesures !== false;
    const itemsWithMeasures = items.map((item) => {
      const sourceItem = (wizard.commande.items || []).find((row) => row.idItem === item.idItem) || null;
      return {
        ...item,
        mesures: collectMesuresSnapshot({
          typeHabit: item.typeHabit,
          mesuresModel: sourceItem?.mesures || {},
          requireComplete: mesuresObligatoires && interdictionSansMesures,
          requireAtLeastOne: mesuresObligatoires
        })
      };
    });
    const primaryMeasuredItem = itemsWithMeasures.find((item) => item.mesures) || itemsWithMeasures[0] || null;

    const payload = {
      idCommande: wizard.requestCommandeId || createServerCommandeId(),
      descriptionCommande: wizard.commande.descriptionCommande,
      montantTotal: montant,
      typeHabit: primaryMeasuredItem?.typeHabit || wizard.commande.typeHabit,
      mesuresHabit: primaryMeasuredItem?.mesures || {},
      items: itemsWithMeasures
    };
    if (wizard.dossierId) payload.idDossier = wizard.dossierId;

    if (wizard.mode === "existing") {
      if (!wizard.resolvedClientId) throw new Error("Client non resolu.");
      payload.clientPayeurId = wizard.resolvedClientId;
    } else {
      const requestedClientId = wizard.requestNewClientId || createServerClientId();
      wizard.requestNewClientId = requestedClientId;
      payload.nouveauClient = {
        idClient: requestedClientId,
        nom: String(wizard.newClient.nom || "").trim(),
        prenom: String(wizard.newClient.prenom || "").trim(),
        telephone: String(wizard.newClient.telephone || "").trim()
      };
      const doublonDecision = getWizardDuplicateDecision();
      if (doublonDecision) payload.doublonDecision = doublonDecision;
    }

    if (wizard.commande.datePrevue) payload.datePrevue = `${wizard.commande.datePrevue}T00:00:00.000Z`;
    wizard.requestCommandeId = payload.idCommande;

    const useOfflinePath =
      !getNetworkState().online || (wizard.mode === "existing" && !isRemoteEntityId(wizard.resolvedClientId));
    let normalized = null;
    if (useOfflinePath) {
      const created = await createOfflineCommande({
        atelierId,
        clientId: wizard.mode === "existing" ? wizard.resolvedClientId : "",
        newClient: wizard.mode === "new" ? payload.nouveauClient : null,
        commande: payload
      });
      if (created?.client) {
        const normalizedClient = normalizeClient(created.client);
        upsertClientRow(normalizedClient);
        wizard.resolvedClientId = normalizedClient.idClient;
      }
      for (const relatedClient of created?.relatedClients || []) {
        upsertClientRow(normalizeClient(relatedClient));
      }
      normalized = normalizeCommande(created.commande);
      void requestSync(atelierId);
    } else {
      const created = await submitCommandeWithDuplicateHandling(payload);
      if (!created) return;
      if (created?.client) {
        const normalizedClient = normalizeClient(created.client);
        upsertClientRow(normalizedClient);
        wizard.resolvedClientId = normalizedClient.idClient;
      }
      for (const relatedClient of created?.clientsAssocies || []) {
        upsertClientRow(normalizeClient(relatedClient));
      }
      normalized = normalizeCommande(created?.commande || created);
    }
    wizard.createdCommandeId = normalized.idCommande;
    wizard.createdFactureId = "";
    prependCommandeRow(normalized);
    closeWizard();
    await openCommandeDetail(normalized.idCommande);

    if (useOfflinePath && wizard.commande.emettreFacture === true) {
      notify("Commande creee avec succes. La facture sera disponible apres la synchronisation.");
      return;
    }

    if (wizard.commande.emettreFacture === true) {
      try {
        const facture = await emettreFactureDepuisOrigine("COMMANDE", normalized.idCommande, { ouvrirDetail: false });
        wizard.createdFactureId = facture.idFacture || facture.id_facture || "";
        notify("Commande creee avec succes. Facture emise.");
      } catch {
        notify("Commande creee avec succes, mais impossible de creer la facture.");
      }
      return;
    }

    notify(useOfflinePath ? "Commande creee hors ligne avec succes." : "Commande creee avec succes.");
  } catch (err) {
    notify(readableError(err));
  } finally {
    wizard.submitting = false;
  }
}

async function onRetoucheWizardStep1() {
  if (retoucheWizard.submitting) return;
  retoucheWizard.submitting = true;
  try {
    if (retoucheWizard.mode === "existing") {
      if (!retoucheWizard.existingClientId) throw new Error("Selectionnez un client existant.");
      retoucheWizard.resolvedClientId = retoucheWizard.existingClientId;
    } else {
      if (!canCreateWizardClient.value) throw new Error("Creation de client non autorisee.");
      const payload = {
        nom: String(retoucheWizard.newClient.nom || "").trim(),
        prenom: String(retoucheWizard.newClient.prenom || "").trim(),
        telephone: String(retoucheWizard.newClient.telephone || "").trim()
      };
      if (!payload.nom || !payload.prenom) throw new Error("Completez au minimum le nom et le prenom.");
      retoucheWizard.resolvedClientId = "";
    }

    retoucheWizard.step = 2;
  } catch (err) {
    notify(readableError(err));
  } finally {
    retoucheWizard.submitting = false;
  }
}

async function onRetoucheWizardStep2() {
  if (retoucheWizard.submitting) return;
  retoucheWizard.submitting = true;
  try {
    const items = (retoucheWizard.retouche.items || [])
      .map((item) => ({
        idItem: item.idItem,
        typeRetouche: String(item.typeRetouche || "").trim().toUpperCase(),
        description: String(item.description || "").trim(),
        prix: Number(item.prix || 0)
      }))
      .filter((item) => item.typeRetouche && Number.isFinite(item.prix) && item.prix >= 0);
    const montant = Number(retoucheWizard.retouche.montantTotal);
    if (Number.isNaN(montant) || montant <= 0) throw new Error("Montant total invalide.");
    if (items.length === 0) throw new Error("Ajoutez au moins une retouche.");
    retoucheWizard.step = 3;
  } catch (err) {
    notify(readableError(err));
  } finally {
    retoucheWizard.submitting = false;
  }
}

async function onRetoucheWizardStep3() {
  if (retoucheWizard.submitting) return;
  retoucheWizard.submitting = true;
  try {
    if (!canCreateRetouche.value) throw new Error("Creation de retouche non autorisee.");
    syncRetouchePrimaryTypeFromItems();
    const items = (retoucheWizard.retouche.items || []).filter((item) => String(item?.typeRetouche || "").trim());
    if (items.length === 0) throw new Error("Ajoutez au moins une retouche.");
    for (const item of items) {
      if (!String(item.typeHabit || "").trim()) {
        throw new Error(`Type d'habit obligatoire pour ${humanizeContactLabel(item.typeRetouche) || item.typeRetouche || "la retouche"}.`);
      }
      const progress = getRetoucheItemMeasureProgress(item);
      if (progress.total > 0) {
        const snapshot = collectRetoucheMesuresSnapshot({
          mesuresModel: item.mesures || {},
          fields: getRetoucheItemMeasureFields(item),
          requireComplete: wizardRetouchesSettings.value?.saisiePartielle !== true,
          requireAtLeastOne: true
        });
        const hasMeasures = Object.keys(snapshot?.valeurs || snapshot || {}).length > 0;
        if (!hasMeasures) {
          throw new Error(`Mesures requises pour ${humanizeContactLabel(item.typeRetouche) || item.typeRetouche || "cette retouche"}.`);
        }
      }
    }
    if (wizardRetoucheDescriptionRequired.value && !String(retoucheWizard.retouche.descriptionRetouche || "").trim()) {
      throw new Error("Description retouche obligatoire.");
    }
    retoucheWizard.step = 4;
  } catch (err) {
    notify(readableError(err));
  } finally {
    retoucheWizard.submitting = false;
  }
}

async function onRetoucheWizardStep4() {
  if (retoucheWizard.submitting) return;
  retoucheWizard.submitting = true;
  try {
    if (!canCreateRetouche.value) throw new Error("Creation de retouche non autorisee.");
    syncRetouchePrimaryTypeFromItems();
    const atelierId = currentAtelierId.value;
    if (!atelierId) throw new Error("Atelier offline introuvable.");
    const items = (retoucheWizard.retouche.items || [])
      .map((item) => ({
        idItem: item.idItem,
        typeRetouche: String(item.typeRetouche || "").trim().toUpperCase(),
        typeHabit: String(item.typeHabit || "").trim().toUpperCase(),
        description: String(item.description || "").trim(),
        prix: Number(item.prix || 0),
        mesures:
          getRetoucheItemMeasureFields(item).length > 0
            ? collectRetoucheMesuresSnapshot({
                mesuresModel: item.mesures || {},
                fields: getRetoucheItemMeasureFields(item),
                requireComplete: wizardRetouchesSettings.value?.saisiePartielle !== true,
                requireAtLeastOne: true
              })
            : {}
      }))
      .filter((item) => item.typeRetouche && Number.isFinite(item.prix) && item.prix >= 0);
    const montant = Number(retoucheWizard.retouche.montantTotal);
    if (Number.isNaN(montant) || montant <= 0) throw new Error("Montant total invalide.");
    if (items.length === 0) throw new Error("Ajoutez au moins une retouche.");
    if (items.some((item) => !item.typeHabit)) throw new Error("Chaque retouche doit avoir un type d'habit.");
    if (wizardRetoucheDescriptionRequired.value && !String(retoucheWizard.retouche.descriptionRetouche || "").trim()) {
      throw new Error("Description retouche obligatoire.");
    }
    const primaryItem = items.find((item) => item.typeRetouche) || items[0];
    const primaryMeasures = primaryItem?.mesures || {};

    const payload = {
      idRetouche: retoucheWizard.requestRetoucheId || createServerRetoucheId(),
      descriptionRetouche: String(retoucheWizard.retouche.descriptionRetouche || "").trim(),
      typeRetouche: primaryItem?.typeRetouche || retoucheWizard.retouche.typeRetouche,
      montantTotal: montant,
      typeHabit: primaryItem?.typeHabit || retoucheWizard.retouche.typeHabit,
      mesuresHabit: primaryMeasures,
      items
    };
    if (retoucheWizard.dossierId) payload.idDossier = retoucheWizard.dossierId;
    if (retoucheWizard.mode === "existing") {
      if (!retoucheWizard.resolvedClientId) throw new Error("Client non resolu.");
      payload.idClient = retoucheWizard.resolvedClientId;
    } else {
      const requestedClientId = retoucheWizard.requestNewClientId || createServerClientId();
      retoucheWizard.requestNewClientId = requestedClientId;
      payload.nouveauClient = {
        idClient: requestedClientId,
        nom: String(retoucheWizard.newClient.nom || "").trim(),
        prenom: String(retoucheWizard.newClient.prenom || "").trim(),
        telephone: String(retoucheWizard.newClient.telephone || "").trim()
      };
    }

    if (retoucheWizard.retouche.datePrevue) payload.datePrevue = `${retoucheWizard.retouche.datePrevue}T00:00:00.000Z`;
    retoucheWizard.requestRetoucheId = payload.idRetouche;

    const useOfflinePath =
      !getNetworkState().online || (retoucheWizard.mode === "existing" && !isRemoteEntityId(retoucheWizard.resolvedClientId));

    let normalized = null;
    if (useOfflinePath) {
      const created = await createOfflineRetouche({
        atelierId,
        clientId: retoucheWizard.mode === "existing" ? retoucheWizard.resolvedClientId : "",
        newClient: retoucheWizard.mode === "new" ? payload.nouveauClient : null,
        retouche: payload
      });
      if (created?.client) {
        const normalizedClient = normalizeClient(created.client);
        upsertClientRow(normalizedClient);
        retoucheWizard.resolvedClientId = normalizedClient.idClient;
      }
      normalized = normalizeRetouche(created.retouche);
      void requestSync(atelierId);
    } else {
      const created = await submitRetoucheWithDuplicateHandling(payload);
      if (!created) return;
      if (created?.client) {
        const normalizedClient = normalizeClient(created.client);
        upsertClientRow(normalizedClient);
        retoucheWizard.resolvedClientId = normalizedClient.idClient;
      }
      normalized = normalizeRetouche(created.retouche || created);
    }
    retoucheWizard.createdRetoucheId = normalized.idRetouche;
    retoucheWizard.createdFactureId = "";
    prependRetoucheRow(normalized);
    closeRetoucheWizard();
    await openRetoucheDetail(normalized.idRetouche);

    if (useOfflinePath && retoucheWizard.retouche.emettreFacture === true) {
      notify("Retouche creee avec succes. La facture sera disponible apres la synchronisation.");
      return;
    }

    if (retoucheWizard.retouche.emettreFacture === true) {
      try {
        const facture = await emettreFactureDepuisOrigine("RETOUCHE", normalized.idRetouche, { ouvrirDetail: false });
        retoucheWizard.createdFactureId = facture.idFacture || facture.id_facture || "";
        notify("Retouche creee avec succes. Facture emise.");
      } catch {
        notify("Retouche creee avec succes, mais impossible de creer la facture.");
      }
      return;
    }

    notify(useOfflinePath ? "Retouche creee hors ligne avec succes." : "Retouche creee avec succes.");
  } catch (err) {
    notify(readableError(err));
  } finally {
    retoucheWizard.submitting = false;
  }
}

function resetVenteDraft() {
  venteDraft.lignes.splice(0);
  venteDraft.current.idArticle = "";
  venteDraft.current.quantite = "";
}

function resetNewArticle() {
  newArticle.nomArticle = "";
  newArticle.categorieArticle = "TISSU";
  newArticle.uniteStock = "METRE";
  newArticle.quantiteDisponible = "";
  newArticle.prixAchatInitial = "";
  newArticle.prixVenteUnitaire = "";
  newArticle.seuilAlerte = "";
}

function scrollToStockList() {
  if (stockVentesTab.value !== "stock") {
    stockVentesTab.value = "stock";
  }
  const el = stockListRef.value;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function onCreateArticle() {
  if (!canManageStockArticles.value) {
    notify("Acces refuse: gestion de stock reservee.");
    return;
  }
  const quantite = Number(newArticle.quantiteDisponible || 0);
  const prixAchatInitial = Number(newArticle.prixAchatInitial || 0);
  const prix = Number(newArticle.prixVenteUnitaire || 0);
  const seuil = Number(newArticle.seuilAlerte || 0);

  if (!newArticle.nomArticle) {
    notify("Nom article requis.");
    return;
  }
  if (Number.isNaN(quantite) || quantite < 0) {
    notify("Quantite invalide.");
    return;
  }
  if (Number.isNaN(prix) || prix < 0) {
    notify("Prix unitaire invalide.");
    return;
  }
  if (Number.isNaN(prixAchatInitial) || prixAchatInitial < 0) {
    notify("Prix d'achat initial invalide.");
    return;
  }
  if (Number.isNaN(seuil) || seuil < 0) {
    notify("Seuil invalide.");
    return;
  }

  try {
    const payload = {
      nomArticle: newArticle.nomArticle,
      categorieArticle: newArticle.categorieArticle,
      uniteStock: newArticle.uniteStock,
      quantiteDisponible: quantite,
      prixAchatInitial,
      prixVenteUnitaire: prix,
      seuilAlerte: seuil
    };
    const created = await atelierApi.createArticle(payload);
    stockArticles.value.unshift(normalizeStockArticle(created));
    resetNewArticle();
    notify("Article cree.");
  } catch (err) {
    notify(readableError(err));
  }
}

function addVenteLigne() {
  const idArticle = venteDraft.current.idArticle;
  const quantite = Number(venteDraft.current.quantite);
  if (!idArticle) {
    notify("Selectionnez un article.");
    return;
  }
  if (Number.isNaN(quantite) || quantite <= 0) {
    notify("Quantite invalide.");
    return;
  }
  venteDraft.lignes.push({ idArticle, quantite });
  venteDraft.current.idArticle = "";
  venteDraft.current.quantite = "";
}

function removeVenteLigne(index) {
  venteDraft.lignes.splice(index, 1);
}

async function onCreerVente() {
  if (venteDraft.lignes.length === 0) {
    notify("Ajoutez au moins une ligne.");
    return;
  }
  venteSubmitting.value = true;
  try {
    const created = await atelierApi.createVente(venteDraft.lignes);
    const normalized = normalizeVente(created);
    ventes.value.unshift(normalized);
    resetVenteDraft();
    notify(`Vente creee: ${normalized.idVente}`);
  } catch (err) {
    notify(readableError(err));
  } finally {
    venteSubmitting.value = false;
  }
}

async function onValiderVente(vente, { emettreFacture = false } = {}) {
  if (!vente || vente.statut === "VALIDEE") return;
  try {
    if (emettreFacture) {
      const result = await atelierApi.validerVenteEtFacturer({ idVente: vente.idVente });
      if (result?.facture) {
        upsertFacture(normalizeFacture(result.facture));
      }
      await reloadAll();
      if (currentRoute.value === "vente-detail" && detailVente.value?.idVente === vente.idVente) {
        await loadVenteDetail(vente.idVente);
      }
      notify(`Vente validee + facture emise: ${vente.idVente}`);
      return;
    }
    await atelierApi.validerVente({ idVente: vente.idVente });
    await reloadAll();
    if (currentRoute.value === "vente-detail" && detailVente.value?.idVente === vente.idVente) {
      await loadVenteDetail(vente.idVente);
    }
    notify(`Vente validee: ${vente.idVente}`);
  } catch (err) {
    const message = readableError(err);
    if (message.toLowerCase().includes("stock insuffisant")) {
      notify("Stock insuffisant pour valider la vente.");
      return;
    }
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer cette vente : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onValiderVenteEtFacturer(vente) {
  await onValiderVente(vente, { emettreFacture: true });
}

async function onAnnulerVente(vente) {
  if (!vente || vente.statut !== "BROUILLON") return;
  const payload = await openActionModal({
    title: "Annuler la vente",
    message: `La vente ${vente.idVente} sera annulee.`,
    confirmLabel: "Confirmer l'annulation",
    tone: "red",
    fields: [{ key: "motif", label: "Motif (optionnel)", type: "textarea", defaultValue: "" }]
  });
  if (!payload) return;
  try {
    await atelierApi.annulerVente(vente.idVente, String(payload.motif || ""));
    await reloadAll();
    if (currentRoute.value === "vente-detail" && detailVente.value?.idVente === vente.idVente) {
      await loadVenteDetail(vente.idVente);
    }
    notify(`Vente annulee: ${vente.idVente}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function openVenteDetail(idVente) {
  selectedVenteId.value = idVente;
  currentRoute.value = "vente-detail";
  await loadVenteDetail(idVente);
}

async function onVoirVente(vente) {
  await openVenteDetail(vente.idVente);
}

async function loadVenteDetail(idVente) {
  detailVenteLoading.value = true;
  detailVenteError.value = "";
  try {
    const detail = await atelierApi.getVente(idVente);
    detailVente.value = normalizeVente(detail);
  } catch (err) {
    detailVenteError.value = readableError(err);
  } finally {
    detailVenteLoading.value = false;
  }
}

function ensureStockInput(idArticle) {
  if (!stockInputs[idArticle]) {
    stockInputs[idArticle] = { quantite: "", motif: SIMPLE_STOCK_ENTRY_DEFAULT_MOTIF };
  }
  return stockInputs[idArticle];
}

async function onApprovisionnerStock(article) {
  if (!canManageStockAdjustments.value) {
    notify("Acces refuse: ajustement de stock reserve.");
    return;
  }
  const input = ensureStockInput(article.idArticle);
  const quantite = Number(input.quantite);
  if (Number.isNaN(quantite) || quantite <= 0) {
    notify("Quantite invalide.");
    return;
  }
  if (!input.motif) {
    notify("Motif requis.");
    return;
  }
  try {
    await atelierApi.entrerStockArticle(article.idArticle, { quantite, motif: input.motif });
    input.quantite = "";
    input.motif = SIMPLE_STOCK_ENTRY_DEFAULT_MOTIF;
    await reloadAll();
    notify(`Stock approvisionne: ${article.nomArticle}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onAcheterStock(article) {
  if (!canManageStockPurchases.value) {
    notify("Acces refuse: achat de stock reserve.");
    return;
  }
  const payload = await openActionModal({
    title: "Acheter du stock",
    message: `Cet achat augmentera le stock de ${article.nomArticle} et enregistrera une sortie de caisse.`,
    confirmLabel: "Confirmer l'achat",
    fields: [
      { key: "quantite", label: "Quantite", type: "number", required: true, min: 1, defaultValue: 1 },
      { key: "prixAchatUnitaire", label: "Prix d'achat unitaire", type: "number", required: true, min: 0, defaultValue: 0 },
      { key: "fournisseur", label: "Fournisseur (optionnel)", type: "text", defaultValue: "" },
      { key: "referenceAchat", label: "Reference achat (optionnel)", type: "text", defaultValue: "" }
    ]
  });
  if (!payload) return;

  const quantite = Number(payload.quantite);
  const prixAchatUnitaire = Number(payload.prixAchatUnitaire);
  if (Number.isNaN(quantite) || quantite <= 0) {
    notify("Quantite invalide.");
    return;
  }
  if (Number.isNaN(prixAchatUnitaire) || prixAchatUnitaire < 0) {
    notify("Prix d'achat invalide.");
    return;
  }

  try {
    await atelierApi.entrerStockArticle(article.idArticle, {
      quantite,
      motif: "ACHAT",
      prixAchatUnitaire,
      fournisseur: String(payload.fournisseur || "").trim() || null,
      referenceAchat: String(payload.referenceAchat || "").trim() || null
    });
    await reloadAll();
    notify(`Achat enregistre: ${article.nomArticle}`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'enregistrer cet achat : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onModifierArticleStock(article) {
  if (!canManageStockArticles.value) {
    notify("Acces refuse: gestion de stock reservee.");
    return;
  }
  const payload = await openActionModal({
    title: "Modifier l'article",
    message: `Mettre a jour le prix de vente et le seuil d'alerte pour ${article.nomArticle}.`,
    confirmLabel: "Enregistrer",
    fields: [
      { key: "prixVenteUnitaire", label: "Prix de vente unitaire", type: "number", required: true, min: 0, defaultValue: Number(article.prixVenteUnitaire || 0) },
      { key: "seuilAlerte", label: "Seuil d'alerte", type: "number", required: true, min: 0, defaultValue: Number(article.seuilAlerte || 0) }
    ]
  });
  if (!payload) return;

  const prixVenteUnitaire = Number(payload.prixVenteUnitaire);
  const seuilAlerte = Number(payload.seuilAlerte);
  if (Number.isNaN(prixVenteUnitaire) || prixVenteUnitaire < 0) {
    notify("Prix de vente invalide.");
    return;
  }
  if (Number.isNaN(seuilAlerte) || seuilAlerte < 0) {
    notify("Seuil d'alerte invalide.");
    return;
  }

  try {
    await atelierApi.updateStockArticle(article.idArticle, { prixVenteUnitaire, seuilAlerte });
    await reloadAll();
    notify(`Article mis a jour: ${article.nomArticle}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onPaiementCommande(commande) {
  if (isLocalEntity(commande?.idCommande)) {
    notifyEntityRequiresSync("Cette commande");
    return;
  }
  const payload = await openActionModal({
    title: "Confirmer le paiement",
    message: `Enregistrer un paiement pour la commande ${commande.idCommande}.`,
    confirmLabel: "Confirmer le paiement",
    fields: [{ key: "montant", label: "Montant (FC)", type: "number", required: true, min: 1, defaultValue: 25000 }]
  });
  if (!payload) return;
  const montant = Number(payload.montant);

  try {
    await atelierApi.enregistrerPaiementViaCaisse({ idCommande: commande.idCommande, montant, utilisateur: "frontend" });
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${commande.idCommande}`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer ce paiement : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onPaiementDetail() {
  if (!detailCommande.value) return;
  if (isLocalEntity(detailCommande.value.idCommande)) {
    notifyEntityRequiresSync("Cette commande");
    return;
  }
  const payload = await openActionModal({
    title: "Confirmer le paiement",
    message: `Enregistrer un paiement pour la commande ${detailCommande.value.idCommande}.`,
    confirmLabel: "Confirmer le paiement",
    fields: [{ key: "montant", label: "Montant (FC)", type: "number", required: true, min: 1, defaultValue: 25000 }]
  });
  if (!payload) return;
  const montant = Number(payload.montant);

  try {
    await atelierApi.enregistrerPaiementViaCaisse({ idCommande: detailCommande.value.idCommande, montant, utilisateur: "frontend" });
    await loadCommandeDetail(detailCommande.value.idCommande);
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${detailCommande.value.idCommande}`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer ce paiement : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onPaiementDetailItem(itemCard) {
  if (!detailCommande.value || !itemCard?.id) return;
  if (isLocalEntity(detailCommande.value.idCommande)) {
    notifyEntityRequiresSync("Cette commande");
    return;
  }
  const payload = await openActionModal({
    title: "Confirmer le paiement",
    message: `Enregistrer un paiement pour ${itemCard.title || "cet habit"}.`,
    confirmLabel: "Confirmer le paiement",
    fields: [{
      key: "montant",
      label: "Montant (FC)",
      type: "number",
      required: true,
      min: 1,
      defaultValue: Math.max(1, Math.min(Number(itemCard.reste || 0), Number(itemCard.prix || 0)))
    }]
  });
  if (!payload) return;

  try {
    await atelierApi.enregistrerPaiementViaCaisse({
      idCommande: detailCommande.value.idCommande,
      idItem: itemCard.id,
      montant: Number(payload.montant),
      utilisateur: "frontend"
    });
    await loadCommandeDetail(detailCommande.value.idCommande, { preserveExisting: true });
    await reloadAll();
    notify(`Paiement enregistre pour ${itemCard.title || "cet habit"}.`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer ce paiement : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onLivrerCommande(commande) {
  try {
    await atelierApi.livrerCommande(commande.idCommande);
    await reloadAll();
    notify(`Commande livree: ${commande.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onTerminerCommande(commande) {
  if (!commande?.idCommande) return;
  try {
    await atelierApi.terminerCommande(commande.idCommande);
    await reloadAll();
    notify(`Commande terminee: ${commande.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onLivrerDetail() {
  if (!detailCommande.value) return;
  try {
    await atelierApi.livrerCommande(detailCommande.value.idCommande);
    await loadCommandeDetail(detailCommande.value.idCommande);
    await reloadAll();
    notify(`Commande livree: ${detailCommande.value.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onTerminerDetail() {
  if (!detailCommande.value) return;
  try {
    await atelierApi.terminerCommande(detailCommande.value.idCommande);
    await loadCommandeDetail(detailCommande.value.idCommande);
    await reloadAll();
    notify(`Commande terminee: ${detailCommande.value.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onAnnulerDetail() {
  if (!detailCommande.value) return;
  const payload = getCancellationPayload(detailCommande.value);
  if (payload === null) return;
  const confirmed = await openActionModal({
    title: "Annuler la commande",
    message: buildCancellationConfirmationMessage("la commande", detailCommande.value.idCommande, detailCommande.value.montantPaye),
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerCommande(detailCommande.value.idCommande, payload);
    await loadCommandeDetail(detailCommande.value.idCommande);
    await reloadAll();
    notify(`Commande annulee: ${detailCommande.value.idCommande}`);
  } catch (err) {
    notifyCancellationError(err);
  }
}

async function onPaiementRetouche(retouche) {
  if (isLocalEntity(retouche?.idRetouche)) {
    notifyEntityRequiresSync("Cette retouche");
    return;
  }
  const payload = await openActionModal({
    title: "Confirmer le paiement",
    message: `Enregistrer un paiement pour la retouche ${retouche.idRetouche}.`,
    confirmLabel: "Confirmer le paiement",
    fields: [{ key: "montant", label: "Montant (FC)", type: "number", required: true, min: 1, defaultValue: 10000 }]
  });
  if (!payload) return;
  const montant = Number(payload.montant);

  try {
    await atelierApi.enregistrerPaiementRetoucheViaCaisse({ idRetouche: retouche.idRetouche, montant, utilisateur: "frontend" });
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${retouche.idRetouche}`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer ce paiement : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onPaiementRetoucheDetail() {
  if (!detailRetouche.value) return;
  if (isLocalEntity(detailRetouche.value.idRetouche)) {
    notifyEntityRequiresSync("Cette retouche");
    return;
  }
  const payload = await openActionModal({
    title: "Confirmer le paiement",
    message: `Enregistrer un paiement pour la retouche ${detailRetouche.value.idRetouche}.`,
    confirmLabel: "Confirmer le paiement",
    fields: [{ key: "montant", label: "Montant (FC)", type: "number", required: true, min: 1, defaultValue: 10000 }]
  });
  if (!payload) return;
  const montant = Number(payload.montant);

  try {
    await atelierApi.enregistrerPaiementRetoucheViaCaisse({ idRetouche: detailRetouche.value.idRetouche, montant, utilisateur: "frontend" });
    await loadRetoucheDetail(detailRetouche.value.idRetouche);
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${detailRetouche.value.idRetouche}`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer ce paiement : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onPaiementRetoucheDetailItem(itemCard) {
  if (!detailRetouche.value || !itemCard?.id) return;
  if (isLocalEntity(detailRetouche.value.idRetouche)) {
    notifyEntityRequiresSync("Cette retouche");
    return;
  }
  const payload = await openActionModal({
    title: "Confirmer le paiement",
    message: `Enregistrer un paiement pour ${itemCard.title || "cette intervention"}.`,
    confirmLabel: "Confirmer le paiement",
    fields: [{
      key: "montant",
      label: "Montant (FC)",
      type: "number",
      required: true,
      min: 1,
      defaultValue: Math.max(1, Math.min(Number(itemCard.reste || 0), Number(itemCard.prix || 0)))
    }]
  });
  if (!payload) return;

  try {
    await atelierApi.enregistrerPaiementRetoucheViaCaisse({
      idRetouche: detailRetouche.value.idRetouche,
      idItem: itemCard.id,
      montant: Number(payload.montant),
      utilisateur: "frontend"
    });
    await loadRetoucheDetail(detailRetouche.value.idRetouche, { preserveExisting: true });
    await reloadAll();
    notify(`Paiement enregistre pour ${itemCard.title || "cette intervention"}.`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'effectuer ce paiement : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onLivrerRetouche(retouche) {
  try {
    await atelierApi.livrerRetouche(retouche.idRetouche);
    await reloadAll();
    notify(`Retouche livree: ${retouche.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onTerminerRetouche(retouche) {
  if (!retouche?.idRetouche) return;
  try {
    await atelierApi.terminerRetouche(retouche.idRetouche);
    await reloadAll();
    notify(`Retouche terminee: ${retouche.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onLivrerRetoucheDetail() {
  if (!detailRetouche.value) return;
  try {
    await atelierApi.livrerRetouche(detailRetouche.value.idRetouche);
    await loadRetoucheDetail(detailRetouche.value.idRetouche);
    await reloadAll();
    notify(`Retouche livree: ${detailRetouche.value.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onTerminerRetoucheDetail() {
  if (!detailRetouche.value) return;
  try {
    await atelierApi.terminerRetouche(detailRetouche.value.idRetouche);
    await loadRetoucheDetail(detailRetouche.value.idRetouche);
    await reloadAll();
    notify(`Retouche terminee: ${detailRetouche.value.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onAnnulerRetouche(retouche) {
  const payload = getCancellationPayload(retouche);
  if (payload === null) return;
  const confirmed = await openActionModal({
    title: "Annuler la retouche",
    message: buildCancellationConfirmationMessage("la retouche", retouche.idRetouche, retouche.montantPaye),
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerRetouche(retouche.idRetouche, payload);
    await reloadAll();
    notify(`Retouche annulee: ${retouche.idRetouche}`);
  } catch (err) {
    notifyCancellationError(err);
  }
}

async function onAnnulerRetoucheDetail() {
  if (!detailRetouche.value) return;
  const payload = getCancellationPayload(detailRetouche.value);
  if (payload === null) return;
  const confirmed = await openActionModal({
    title: "Annuler la retouche",
    message: buildCancellationConfirmationMessage("la retouche", detailRetouche.value.idRetouche, detailRetouche.value.montantPaye),
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerRetouche(detailRetouche.value.idRetouche, payload);
    await loadRetoucheDetail(detailRetouche.value.idRetouche);
    await reloadAll();
    notify(`Retouche annulee: ${detailRetouche.value.idRetouche}`);
  } catch (err) {
    notifyCancellationError(err);
  }
}

async function onDepenseCaisse() {
  if (!canRecordCaisseExpense.value) return;
  if (!caisseJour.value) return;
  if (!caisseOuverte.value) {
    notify("Caisse cloturee. Depense interdite.");
    return;
  }

  const payload = await openActionModal({
    title: "Enregistrer une depense",
    message: "Verifier le type de depense avant confirmation.",
    confirmLabel: "Confirmer la depense",
    tone: "amber",
    fields: [
      { key: "motif", label: "Motif", type: "text", required: true, defaultValue: "" },
      { key: "montant", label: "Montant (FC)", type: "number", required: true, min: 1, defaultValue: 5000 },
      {
        key: "typeDepense",
        label: "Type de depense",
        type: "select",
        required: true,
        defaultValue: "QUOTIDIENNE",
        options: [
          { value: "QUOTIDIENNE", label: "Quotidienne" },
          { value: "EXCEPTIONNELLE", label: "Exceptionnelle" }
        ]
      },
      { key: "justification", label: "Justification (obligatoire si exceptionnelle)", type: "textarea", defaultValue: "" }
    ]
  });
  if (!payload) return;
  const montant = Number(payload.montant);
  const typeDepense = String(payload.typeDepense || "QUOTIDIENNE").toUpperCase();
  const justification = String(payload.justification || "").trim();
  if (typeDepense === "EXCEPTIONNELLE" && !justification) {
    notify("Justification obligatoire pour depense exceptionnelle.");
    return;
  }

  try {
    await atelierApi.enregistrerDepenseCaisse({
      idCaisseJour: caisseJour.value.idCaisseJour,
      montant,
      motif: String(payload.motif || "").trim(),
      typeDepense,
      justification,
      role: currentRole.value
    });
    await reloadAll();
    notify(`Depense ${depenseTypeLabel(typeDepense).toLowerCase()} enregistree.`);
  } catch (err) {
    const message = readableError(err);
    if (isCaisseClosedMessage(message)) {
      notify("Impossible d'enregistrer cet achat : la caisse est cloturee.");
      return;
    }
    notify(message);
  }
}

async function onCloturerCaisse() {
  if (!canCloseCaisse.value) return;
  if (!caisseJour.value) return;
  if (!caisseOuverte.value) {
    notify("Caisse deja cloturee.");
    return;
  }

  const confirmed = await openActionModal({
    title: "Cloturer la caisse",
    message: "Cette action bloque toute nouvelle ecriture sur la caisse du jour.",
    confirmLabel: "Confirmer la cloture",
    tone: "red"
  });
  if (!confirmed) return;

  try {
    await atelierApi.cloturerCaisse(caisseJour.value.idCaisseJour);
    await reloadAll();
    notify("Caisse cloturee.");
  } catch (err) {
    notify(readableError(err));
  }
}

async function onOuvrirCaisseDuJour() {
  if (!canOpenCaisse.value) return;
  try {
    const info = await atelierApi.getOuvertureCaisseInfo();
    let soldeOuverture = 0;
    if (info.source === "INITIAL_REQUIRED") {
      const payload = await openActionModal({
        title: "Ouvrir la caisse",
        message: "Renseigne le solde d'ouverture initial.",
        confirmLabel: "Ouvrir",
        fields: [{ key: "soldeOuverture", label: "Solde d'ouverture (FC)", type: "number", required: true, min: 0, defaultValue: 0 }]
      });
      if (!payload) return;
      soldeOuverture = Number(payload.soldeOuverture);
    }

    await atelierApi.ouvrirCaisseDuJour({ soldeOuverture });
    await reloadAll();
    notify("Caisse du jour ouverte.");
  } catch (err) {
    notify(readableError(err));
  }
}

async function onOuvrirCaisseAnticipee() {
  if (!canOpenCaisse.value) return;
  const ouverturePayload = await openActionModal({
    title: "Ouverture anticipee",
    message: "Cette action est reservee au manager.",
    confirmLabel: "Continuer",
    fields: [{ key: "motif", label: "Motif ouverture anticipee", type: "text", required: true, defaultValue: "" }]
  });
  if (!ouverturePayload) return;
  const motif = String(ouverturePayload.motif || "").trim();

  try {
    const info = await atelierApi.getOuvertureCaisseInfo({
      overrideHeureOuverture: true,
      role: "manager",
      motifOverride: motif
    });
    let soldeOuverture = 0;
    if (info.source === "INITIAL_REQUIRED") {
      const payload = await openActionModal({
        title: "Ouverture anticipee",
        message: "Renseigne le solde d'ouverture initial.",
        confirmLabel: "Ouvrir",
        fields: [{ key: "soldeOuverture", label: "Solde d'ouverture (FC)", type: "number", required: true, min: 0, defaultValue: 0 }]
      });
      if (!payload) return;
      soldeOuverture = Number(payload.soldeOuverture);
    }

    await atelierApi.ouvrirCaisseDuJour({
      soldeOuverture,
      overrideHeureOuverture: true,
      role: "manager",
      motifOverride: motif
    });
    await reloadAll();
    notify("Caisse ouverte (exception manager).");
  } catch (err) {
    notify(readableError(err));
  }
}

async function openCommandeDetail(idCommande) {
  selectedCommandeId.value = idCommande;
  currentRoute.value = "commande-detail";
  await loadCommandeDetail(idCommande);
  notify(`Detail ouvert: ${idCommande}`);
}

function onVoirCommande(commande) {
  openCommandeDetail(commande.idCommande);
}

async function openRetoucheDetail(idRetouche) {
  selectedRetoucheId.value = idRetouche;
  currentRoute.value = "retouche-detail";
  await loadRetoucheDetail(idRetouche);
  notify(`Detail retouche ouvert: ${idRetouche}`);
}

function onVoirRetouche(retouche) {
  openRetoucheDetail(retouche.idRetouche);
}

async function openFactureDetail(idFacture) {
  selectedFactureId.value = idFacture;
  currentRoute.value = "facture-detail";
  await loadFactureDetail(idFacture);
  notify(`Detail facture ouvert: ${idFacture}`);
}

function onVoirFacture(facture) {
  openFactureDetail(facture.idFacture);
}

function onOuvrirOrigineFacture(facture) {
  if (!facture) return;
  if (facture.typeOrigine === "COMMANDE") {
    openCommandeDetail(facture.idOrigine);
    return;
  }
  if (facture.typeOrigine === "RETOUCHE") {
    openRetoucheDetail(facture.idOrigine);
    return;
  }
  if (facture.typeOrigine === "VENTE") {
    openVenteDetail(facture.idOrigine);
  }
}

async function loadFactureDetail(idFacture) {
  if (!idFacture) return;
  detailFactureLoading.value = true;
  detailFactureError.value = "";
  try {
    const detail = await atelierApi.getFacture(idFacture);
    detailFacture.value = normalizeFacture(detail);
  } catch (err) {
    detailFacture.value = null;
    detailFactureError.value = readableError(err);
  } finally {
    detailFactureLoading.value = false;
  }
}

async function onGenererPdfFacture(facture) {
  if (!facture?.idFacture) return;
  await openDocumentForCurrentViewport(() => atelierApi.getFacturePdfBlobUrl(facture.idFacture, { autoPrint: false }), {
    mobileFileName: buildDocumentDownloadName(`facture-${facture.numeroFacture || facture.idFacture}`),
    mobileSuccessMessage: `Facture telechargee: ${facture.numeroFacture || facture.idFacture}`
  });
  if (!isMobileViewport.value) {
    notify(`PDF pret: ${facture.numeroFacture}`);
  }
}

async function onImprimerFacture(facture) {
  if (!facture?.idFacture) return;
  await openDocumentForCurrentViewport(() => atelierApi.getFacturePdfBlobUrl(facture.idFacture, { autoPrint: true }), {
    mobileFileName: buildDocumentDownloadName(`facture-impression-${facture.numeroFacture || facture.idFacture}`),
    mobileSuccessMessage: `Document d'impression telecharge: ${facture.numeroFacture || facture.idFacture}`
  });
}

function onVoirFactureParOrigine(typeOrigine, idOrigine) {
  const facture = findFactureByOrigine(typeOrigine, idOrigine);
  if (!facture) return;
  openFactureDetail(facture.idFacture);
}

function onImprimerFactureParOrigine(typeOrigine, idOrigine) {
  const facture = findFactureByOrigine(typeOrigine, idOrigine);
  if (!facture) return;
  onImprimerFacture(facture);
}

async function emettreFactureDepuisOrigine(typeOrigine, idOrigine, { ouvrirDetail = true, message = "" } = {}) {
  const facture = await atelierApi.emettreFacture({ typeOrigine, idOrigine });
  await reloadAll();
  if (ouvrirDetail) await openFactureDetail(facture.idFacture || facture.id_facture);
  if (message) notify(message);
  return facture;
}

async function onEmettreFactureCommandeDetail() {
  if (!detailCommande.value?.idCommande) return;
  try {
    await emettreFactureDepuisOrigine("COMMANDE", detailCommande.value.idCommande, {
      ouvrirDetail: false,
      message: `Facture emise pour ${detailCommande.value.idCommande}`
    });
  } catch (err) {
    notify(readableError(err));
  }
}

async function onEmettreFactureRetoucheDetail() {
  if (!detailRetouche.value?.idRetouche) return;
  try {
    await emettreFactureDepuisOrigine("RETOUCHE", detailRetouche.value.idRetouche, {
      ouvrirDetail: false,
      message: `Facture emise pour ${detailRetouche.value.idRetouche}`
    });
  } catch (err) {
    notify(readableError(err));
  }
}

async function onEmettreFactureVenteDetail() {
  if (!detailVente.value?.idVente) return;
  try {
    await emettreFactureDepuisOrigine("VENTE", detailVente.value.idVente, {
      ouvrirDetail: false,
      message: `Facture emise pour ${detailVente.value.idVente}`
    });
  } catch (err) {
    notify(readableError(err));
  }
}

async function onEmettreFacture() {
  factureEmission.open = true;
  factureEmission.typeOrigine = "COMMANDE";
  factureEmission.idOrigine = "";
  factureEmission.submitting = false;
  factureEmission.idOrigine = facturesCandidates.value[0]?.id || "";
}

function closeFactureEmission() {
  factureEmission.open = false;
}

async function confirmerEmissionFacture() {
  if (factureEmission.submitting) return;
  if (!factureEmission.idOrigine) {
    notify("Selectionne une origine.");
    return;
  }
  factureEmission.submitting = true;
  try {
    const facture = await emettreFactureDepuisOrigine(factureEmission.typeOrigine, factureEmission.idOrigine, { ouvrirDetail: false });
    closeFactureEmission();
    await openFactureDetail(facture.idFacture || facture.id_facture);
    notify(`Facture emise: ${facture.numeroFacture || facture.numero_facture}`);
  } catch (err) {
    notify(readableError(err));
  } finally {
    factureEmission.submitting = false;
  }
}

function onWizardStep3Redirect() {
  wizard.open = false;
  openCommandeDetail(wizard.createdCommandeId);
}

function onWizardStep3FactureRedirect() {
  if (!wizard.createdFactureId) return;
  wizard.open = false;
  openFactureDetail(wizard.createdFactureId);
}

function onRetoucheWizardStep3Redirect() {
  retoucheWizard.open = false;
  openRetoucheDetail(retoucheWizard.createdRetoucheId);
}

function onRetoucheWizardStep3FactureRedirect() {
  if (!retoucheWizard.createdFactureId) return;
  retoucheWizard.open = false;
  openFactureDetail(retoucheWizard.createdFactureId);
}

function placeholderAction(label) {
  notify(`Action: ${label}`);
}

async function loadCommandeDetail(idCommande, { preserveExisting = true } = {}) {
  const requestedId = String(idCommande || "").trim();
  if (!requestedId) return null;
  if (commandeDetailLoadPromise && commandeDetailLoadTargetId === requestedId) {
    return commandeDetailLoadPromise;
  }

  const requestId = ++commandeDetailLoadRequestId;
  commandeDetailLoadTargetId = requestedId;
  const keepCurrentDetailVisible = preserveExisting && isSameCommandeDetailTarget(requestedId);

  commandeDetailLoadPromise = (async () => {
    detailLoading.value = true;
    if (!keepCurrentDetailVisible) {
      detailError.value = "";
      detailCommandeActions.value = null;
      detailCommandeMediaLoading.value = true;
      detailCommandeMediaError.value = "";
      await setDetailCommandeMediaRows([]);
    }

    const atelierId = currentAtelierId.value;
    if (!atelierId) {
      detailCommande.value = null;
      resetReactiveRecord(detailCommandeItemStatuses);
      detailPaiements.value = [];
      detailCommandeEvents.value = [];
      detailPaiementsLoading.value = false;
      detailCommandeEventsLoading.value = false;
      detailError.value = OFFLINE_READ_MESSAGES.COMMANDE_DETAIL;
      detailCommandeMediaLoading.value = false;
      detailLoading.value = false;
      resetContactFollowUpState(detailCommandeContactFollowUp);
      return null;
    }

    let activeCommandeId = requestedId;
    let hasCachedDetail = false;

    const localFirst = await loadCommandeDetailLocalFirst({
      atelierId,
      idCommande: activeCommandeId
    });
    if (requestId !== commandeDetailLoadRequestId) return null;

    if (localFirst.cached) {
      detailCommande.value = normalizeCommande(localFirst.cached);
      syncDetailItemStatuses(detailCommandeItemStatuses, detailCommande.value?.items, detailCommande.value?.statutCommande || "");
      activeCommandeId = detailCommande.value?.idCommande || activeCommandeId;
      hasCachedDetail = true;
    }

    if (!localFirst.online) {
      if (!hasCachedDetail) {
        detailCommande.value = null;
        resetReactiveRecord(detailCommandeItemStatuses);
        detailCommandeActions.value = null;
        await setDetailCommandeMediaRows([]);
        detailCommandeMediaError.value = "";
        detailPaiements.value = [];
        detailCommandeEvents.value = [];
        detailPaiementsLoading.value = false;
        detailCommandeEventsLoading.value = false;
        detailError.value = OFFLINE_READ_MESSAGES.COMMANDE_DETAIL;
        detailCommandeMediaLoading.value = false;
        detailLoading.value = false;
        resetContactFollowUpState(detailCommandeContactFollowUp);
        return null;
      }

      detailPaiements.value = [];
      detailCommandeEvents.value = [];
      detailPaiementsLoading.value = false;
      detailCommandeEventsLoading.value = false;
      detailError.value = OFFLINE_READ_MESSAGES.COMMANDE_SUPPLEMENTAL;
    } else {
      try {
        const refreshed = await localFirst.refreshPromise;
        if (requestId !== commandeDetailLoadRequestId) return null;
        if (refreshed?.row) {
          detailCommande.value = normalizeCommande(refreshed.row);
          syncDetailItemStatuses(detailCommandeItemStatuses, detailCommande.value?.items, detailCommande.value?.statutCommande || "");
          activeCommandeId = detailCommande.value?.idCommande || activeCommandeId;
        } else if (!hasCachedDetail) {
          throw new Error("Commande introuvable");
        }
        if (isRemoteEntityId(activeCommandeId)) {
          void loadCommandeActionsForId(activeCommandeId, { force: true, detail: true });
        }
      } catch (err) {
        if (requestId !== commandeDetailLoadRequestId) return null;
        if (hasCachedDetail) {
          detailError.value = readableError(err);
        } else {
          detailCommande.value = null;
          resetReactiveRecord(detailCommandeItemStatuses);
          detailCommandeActions.value = null;
          await setDetailCommandeMediaRows([]);
          detailCommandeMediaError.value = "";
          detailCommandeMediaLoading.value = false;
          detailPaiements.value = [];
          detailCommandeEvents.value = [];
          detailPaiementsLoading.value = false;
          detailCommandeEventsLoading.value = false;
          detailError.value = readableError(err);
          detailLoading.value = false;
          return null;
        }
      }
    }

    if (requestId !== commandeDetailLoadRequestId) return null;
    detailLoading.value = false;
    void loadClientContactSummaryIntoState(detailCommandeContactFollowUp, detailCommande.value?.idClient);

    await refreshCommandeMediaForDetail({
      atelierId,
      idCommande: activeCommandeId,
      commande: detailCommande.value || { idCommande: activeCommandeId },
      preserveExisting: keepCurrentDetailVisible || hasCachedDetail
    });
    if (requestId !== commandeDetailLoadRequestId) return null;

    if (!localFirst.online || !isRemoteEntityId(activeCommandeId)) {
      detailPaiements.value = [];
      detailCommandeEvents.value = [];
      detailPaiementsLoading.value = false;
      detailCommandeEventsLoading.value = false;
      if (!String(detailError.value || "").includes(OFFLINE_READ_MESSAGES.COMMANDE_SUPPLEMENTAL)) {
        detailError.value = detailError.value
          ? `${detailError.value} | ${OFFLINE_READ_MESSAGES.COMMANDE_SUPPLEMENTAL}`
          : OFFLINE_READ_MESSAGES.COMMANDE_SUPPLEMENTAL;
      }
      resetContactFollowUpState(detailCommandeContactFollowUp);
      return detailCommande.value;
    }

    detailPaiementsLoading.value = true;
    try {
      const paiements = await atelierApi.listPaiementsCommande(activeCommandeId);
      detailPaiements.value = (paiements || []).map(normalizePaiement);
    } catch (err) {
      detailPaiements.value = [];
      detailError.value = detailError.value ? `${detailError.value} | ${readableError(err)}` : readableError(err);
    } finally {
      detailPaiementsLoading.value = false;
    }

    detailCommandeEventsLoading.value = true;
    try {
      const events = await atelierApi.listCommandeEvents(activeCommandeId);
      detailCommandeEvents.value = (events || [])
        .map(normalizeWorkflowEvent)
        .sort((a, b) => new Date(b.dateEvent).getTime() - new Date(a.dateEvent).getTime());
    } catch (err) {
      detailCommandeEvents.value = [];
      detailError.value = detailError.value ? `${detailError.value} | ${readableError(err)}` : readableError(err);
    } finally {
      detailCommandeEventsLoading.value = false;
    }

    return detailCommande.value;
  })();

  try {
    return await commandeDetailLoadPromise;
  } finally {
    if (commandeDetailLoadRequestId === requestId) {
      commandeDetailLoadPromise = null;
      commandeDetailLoadTargetId = "";
    }
  }
}

function closeCommandeMediaViewer() {
  commandeMediaViewer.open = false;
  commandeMediaViewer.items = [];
  commandeMediaViewer.index = -1;
  commandeMediaViewer.currentMediaId = "";
  commandeMediaViewer.currentBlobUrl = "";
}

async function ensureCommandeMediaViewerBlobForItem(item) {
  const viewerItem = item || commandeMediaViewerCurrentItem.value;
  const viewerMediaId = viewerItem ? mediaActionKey(viewerItem) : "";
  if (!commandeMediaViewer.open || !viewerItem || !viewerMediaId) {
    commandeMediaViewer.currentBlobUrl = "";
    return;
  }

  if (viewerItem.fileBlobUrl) {
    commandeMediaViewer.currentBlobUrl = viewerItem.fileBlobUrl;
    return;
  }

  if (!detailCommande.value?.idCommande || !getNetworkState().online || !isRemoteEntityId(detailCommande.value.idCommande)) {
    commandeMediaViewer.currentBlobUrl = "";
    return;
  }

  const mediaServerId = String(viewerItem.serverId || viewerItem.idMedia || "").trim();
  if (!mediaServerId) {
    commandeMediaViewer.currentBlobUrl = "";
    return;
  }

  const requestId = ++commandeMediaViewerRequestId;
  detailCommandeMediaActionId.value = viewerMediaId;
  try {
    const fileBlob = await atelierApi.getCommandeMediaFileBlob(detailCommande.value.idCommande, mediaServerId);
    const blobUrl = URL.createObjectURL(fileBlob);
    const isStillCurrent =
      requestId === commandeMediaViewerRequestId &&
      commandeMediaViewer.open &&
      commandeMediaViewer.currentMediaId === viewerMediaId;

    if (!isStillCurrent) {
      URL.revokeObjectURL(blobUrl);
      return;
    }

    const index = detailCommandeMedia.value.findIndex((row) => mediaActionKey(row) === viewerMediaId);
    if (index >= 0) {
      detailCommandeMedia.value[index] = {
        ...detailCommandeMedia.value[index],
        fileBlobUrl: blobUrl
      };
    }
    commandeMediaViewer.currentBlobUrl = blobUrl;
  } catch (err) {
    if (requestId === commandeMediaViewerRequestId && commandeMediaViewer.currentMediaId === viewerMediaId) {
      commandeMediaViewer.currentBlobUrl = "";
      notify(readableError(err));
    }
  } finally {
    if (requestId === commandeMediaViewerRequestId && detailCommandeMediaActionId.value === viewerMediaId) {
      detailCommandeMediaActionId.value = "";
    }
  }
}

function showPreviousCommandeMediaInViewer() {
  if (!commandeMediaViewerCanPrev.value) return;
  commandeMediaViewer.index -= 1;
  commandeMediaViewer.currentBlobUrl = "";
  const nextItem = commandeMediaViewer.items[commandeMediaViewer.index] || null;
  commandeMediaViewer.currentMediaId = nextItem ? mediaActionKey(nextItem) : "";
  void ensureCommandeMediaViewerBlobForItem(nextItem);
}

function showNextCommandeMediaInViewer() {
  if (!commandeMediaViewerCanNext.value) return;
  commandeMediaViewer.index += 1;
  commandeMediaViewer.currentBlobUrl = "";
  const nextItem = commandeMediaViewer.items[commandeMediaViewer.index] || null;
  commandeMediaViewer.currentMediaId = nextItem ? mediaActionKey(nextItem) : "";
  void ensureCommandeMediaViewerBlobForItem(nextItem);
}

function downloadCommandeMediaFromViewer() {
  if (!commandeMediaViewerImageUrl.value) return;
  triggerBlobDocumentDownload(
    commandeMediaViewerImageUrl.value,
    buildDocumentDownloadName(commandeMediaViewerTitle.value || "photo-commande", "jpg")
  );
}

function openCommandeMediaInViewer(item, blobUrl = "") {
  const rows = Array.isArray(detailCommandeMedia.value) ? detailCommandeMedia.value : [];
  const nextIndex = rows.findIndex((row) => mediaActionKey(row) === mediaActionKey(item));
  commandeMediaViewer.items = rows;
  commandeMediaViewer.index = nextIndex >= 0 ? nextIndex : 0;
  commandeMediaViewer.currentMediaId = mediaActionKey(item);
  commandeMediaViewer.currentBlobUrl = blobUrl || item?.fileBlobUrl || "";
  commandeMediaViewer.open = true;
  if (!commandeMediaViewer.currentBlobUrl) {
    void ensureCommandeMediaViewerBlobForItem(item);
  }
}

async function openCommandeMedia(item) {
  if (!detailCommande.value?.idCommande || !item?.idMedia) return;
  if (item?.fileBlobUrl) {
    if (isMobileViewport.value) {
      openCommandeMediaInViewer(item, item.fileBlobUrl);
      return;
    }
    window.open(item.fileBlobUrl, "_blank");
    return;
  }

  if (!getNetworkState().online || !isRemoteEntityId(detailCommande.value.idCommande) || !String(item?.serverId || item?.idMedia || "").trim()) {
    notify("Cette photo sera disponible une fois la connexion retablie.");
    return;
  }

  let blobUrl = item.fileBlobUrl || "";
  try {
    if (!blobUrl) {
      detailCommandeMediaActionId.value = mediaActionKey(item);
      const fileBlob = await atelierApi.getCommandeMediaFileBlob(detailCommande.value.idCommande, item.serverId || item.idMedia);
      blobUrl = URL.createObjectURL(fileBlob);
      const index = detailCommandeMedia.value.findIndex((row) => mediaActionKey(row) === mediaActionKey(item));
      if (index >= 0) {
        detailCommandeMedia.value[index] = {
          ...detailCommandeMedia.value[index],
          fileBlobUrl: blobUrl
        };
      }
    }
    if (isMobileViewport.value) {
      openCommandeMediaInViewer(item, blobUrl);
      return;
    }
    window.open(blobUrl, "_blank");
  } catch (err) {
    notify(readableError(err));
  } finally {
    detailCommandeMediaActionId.value = "";
  }
}

async function uploadCommandeMedia({ file, note = "", sourceType = "UPLOAD", idItem = "" }) {
  if (!detailCommande.value?.idCommande || !file) return;
  detailCommandeMediaUploading.value = true;
  detailCommandeMediaError.value = "";
  try {
    const useOfflinePath = !getNetworkState().online || !isRemoteEntityId(detailCommande.value.idCommande);
    if (useOfflinePath) {
      const atelierId = currentAtelierId.value;
      if (!atelierId) {
        throw new Error("Atelier courant introuvable pour l'ajout offline de photo.");
      }
      await addCommandePhotoOffline({
        atelierId,
        commande: detailCommande.value,
        file,
        note,
        sourceType,
        idItem,
        existingCount: detailCommandeMedia.value.length
      });
      const refreshed = await loadCommandeMediaLocalFirst({
        atelierId,
        commande: detailCommande.value
      });
      await setDetailCommandeMediaRows(refreshed.cached || [], detailCommande.value);
      detailCommandeMediaError.value = "";
      void requestSync(atelierId);
      notify(`Photo enregistree hors ligne pour ${detailCommande.value.idCommande}`);
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);
    if (note) formData.append("note", note);
    if (idItem) formData.append("idItem", idItem);
    if (sourceType) formData.append("sourceType", sourceType);
    await atelierApi.uploadCommandeMedia(detailCommande.value.idCommande, formData);
    await refreshCommandeMediaForDetail({
      commande: detailCommande.value,
      idCommande: detailCommande.value.idCommande,
      preserveExisting: true
    });
    notify(`Photo ajoutee a ${detailCommande.value.idCommande}`);
  } catch (err) {
    detailCommandeMediaError.value = readableError(err);
  } finally {
    detailCommandeMediaUploading.value = false;
  }
}

function uploadCommandeMediaForCurrentItem(payload = {}) {
  return uploadCommandeMedia({
    ...payload,
    idItem: String(commandeItemPhotoDialog.itemId || "").trim()
  });
}

async function setCommandeMediaPrimary(item) {
  if (!detailCommande.value?.idCommande || !item?.idMedia) return;
  detailCommandeMediaActionId.value = mediaActionKey(item);
  detailCommandeMediaError.value = "";
  try {
    const useOfflinePath =
      !getNetworkState().online ||
      !isRemoteEntityId(detailCommande.value.idCommande) ||
      isLocalEntity(mediaActionKey(item)) ||
      item?.syncStatus === "pending" ||
      item?.syncStatus === "blocked";

    if (useOfflinePath) {
      const atelierId = currentAtelierId.value;
      if (!atelierId) {
        throw new Error("Atelier courant introuvable pour la photo offline.");
      }
      const items = await setCommandePhotoPrimaryOffline({
        atelierId,
        commande: detailCommande.value,
        media: item
      });
      await setDetailCommandeMediaRows(items || [], detailCommande.value);
      detailCommandeMediaError.value = "";
      void requestSync(atelierId);
      notify("Photo principale mise a jour hors ligne");
      return;
    }

    await atelierApi.updateCommandeMedia(detailCommande.value.idCommande, item.serverId || item.idMedia, { isPrimary: true });
    await refreshCommandeMediaForDetail({
      commande: detailCommande.value,
      idCommande: detailCommande.value.idCommande,
      preserveExisting: true
    });
    notify("Photo principale mise a jour");
  } catch (err) {
    detailCommandeMediaError.value = readableError(err);
  } finally {
    detailCommandeMediaActionId.value = "";
  }
}

async function moveCommandeMedia({ media, direction = 0 }) {
  if (!detailCommande.value?.idCommande || !media?.idMedia || !direction) return;
  const nextPosition = Number(media.position || 1) + Number(direction || 0);
  detailCommandeMediaActionId.value = mediaActionKey(media);
  detailCommandeMediaError.value = "";
  try {
    const useOfflinePath =
      !getNetworkState().online ||
      !isRemoteEntityId(detailCommande.value.idCommande) ||
      isLocalEntity(mediaActionKey(media)) ||
      media?.syncStatus === "pending" ||
      media?.syncStatus === "blocked";

    if (useOfflinePath) {
      const atelierId = currentAtelierId.value;
      if (!atelierId) {
        throw new Error("Atelier courant introuvable pour le reordonnancement offline.");
      }
      const items = await moveCommandePhotoOffline({
        atelierId,
        commande: detailCommande.value,
        media,
        direction
      });
      await setDetailCommandeMediaRows(items || [], detailCommande.value);
      detailCommandeMediaError.value = "";
      void requestSync(atelierId);
      return;
    }

    await atelierApi.updateCommandeMedia(detailCommande.value.idCommande, media.serverId || media.idMedia, { position: nextPosition });
    await refreshCommandeMediaForDetail({
      commande: detailCommande.value,
      idCommande: detailCommande.value.idCommande,
      preserveExisting: true
    });
  } catch (err) {
    detailCommandeMediaError.value = readableError(err);
  } finally {
    detailCommandeMediaActionId.value = "";
  }
}

async function saveCommandeMediaNote({ media, note = "" }) {
  if (!detailCommande.value?.idCommande || !media?.idMedia) return;
  detailCommandeMediaActionId.value = mediaActionKey(media);
  detailCommandeMediaError.value = "";
  try {
    const useOfflinePath =
      !getNetworkState().online ||
      !isRemoteEntityId(detailCommande.value.idCommande) ||
      isLocalEntity(mediaActionKey(media)) ||
      media?.syncStatus === "pending" ||
      media?.syncStatus === "blocked";

    if (useOfflinePath) {
      const atelierId = currentAtelierId.value;
      if (!atelierId) {
        throw new Error("Atelier courant introuvable pour la note photo offline.");
      }
      const items = await saveCommandePhotoNoteOffline({
        atelierId,
        commande: detailCommande.value,
        media,
        note
      });
      await setDetailCommandeMediaRows(items || [], detailCommande.value);
      detailCommandeMediaError.value = "";
      void requestSync(atelierId);
      notify("Note photo enregistree hors ligne");
      return;
    }

    await atelierApi.updateCommandeMedia(detailCommande.value.idCommande, media.serverId || media.idMedia, { note });
    await refreshCommandeMediaForDetail({
      commande: detailCommande.value,
      idCommande: detailCommande.value.idCommande,
      preserveExisting: true
    });
    notify("Note photo enregistree");
  } catch (err) {
    detailCommandeMediaError.value = readableError(err);
  } finally {
    detailCommandeMediaActionId.value = "";
  }
}

async function deleteCommandeMedia(item) {
  if (!detailCommande.value?.idCommande || !item?.idMedia) return;
  const confirmed = await openActionModal({
    title: "Supprimer la photo",
    message: "Cette photo de reference sera retiree de la commande. Confirmer la suppression ?",
    confirmLabel: "Supprimer",
    cancelLabel: "Annuler",
    tone: "red",
    stacked: commandeItemPhotoDialog.open
  });
  if (!confirmed) return;
  detailCommandeMediaActionId.value = mediaActionKey(item);
  detailCommandeMediaError.value = "";
  try {
    const useOfflinePath =
      !getNetworkState().online ||
      !isRemoteEntityId(detailCommande.value.idCommande) ||
      isLocalEntity(mediaActionKey(item)) ||
      item?.syncStatus === "pending" ||
      item?.syncStatus === "blocked";

    if (useOfflinePath) {
      const atelierId = currentAtelierId.value;
      if (!atelierId) {
        throw new Error("Atelier courant introuvable pour la suppression photo offline.");
      }
      const items = await deleteCommandePhotoOffline({
        atelierId,
        commande: detailCommande.value,
        media: item
      });
      await setDetailCommandeMediaRows(items || [], detailCommande.value);
      detailCommandeMediaError.value = "";
      void requestSync(atelierId);
      notify("Photo supprimee hors ligne");
      return;
    }

    await atelierApi.deleteCommandeMedia(detailCommande.value.idCommande, item.serverId || item.idMedia);
    await refreshCommandeMediaForDetail({
      commande: detailCommande.value,
      idCommande: detailCommande.value.idCommande,
      preserveExisting: true
    });
    notify("Photo supprimee");
  } catch (err) {
    detailCommandeMediaError.value = readableError(err);
  } finally {
    detailCommandeMediaActionId.value = "";
  }
}

async function loadRetoucheDetail(idRetouche, { preserveExisting = true } = {}) {
  const requestedId = String(idRetouche || "").trim();
  if (!requestedId) return null;
  if (retoucheDetailLoadPromise && retoucheDetailLoadTargetId === requestedId) {
    return retoucheDetailLoadPromise;
  }

  const requestId = ++retoucheDetailLoadRequestId;
  retoucheDetailLoadTargetId = requestedId;
  const keepCurrentDetailVisible = preserveExisting && isSameRetoucheDetailTarget(requestedId);

  retoucheDetailLoadPromise = (async () => {
    detailRetoucheLoading.value = true;
    if (!keepCurrentDetailVisible) {
      detailRetoucheError.value = "";
      detailRetoucheActions.value = null;
    }

    const atelierId = currentAtelierId.value;
    if (!atelierId) {
      detailRetouche.value = null;
      resetReactiveRecord(detailRetoucheItemStatuses);
      detailRetouchePaiements.value = [];
      detailRetoucheEvents.value = [];
      detailRetouchePaiementsLoading.value = false;
      detailRetoucheEventsLoading.value = false;
      detailRetoucheError.value = OFFLINE_READ_MESSAGES.RETOUCHE_DETAIL;
      detailRetoucheLoading.value = false;
      resetContactFollowUpState(detailRetoucheContactFollowUp);
      return null;
    }

    let activeRetoucheId = requestedId;
    let hasCachedDetail = false;

    const localFirst = await loadRetoucheDetailLocalFirst({
      atelierId,
      idRetouche: activeRetoucheId
    });
    if (requestId !== retoucheDetailLoadRequestId) return null;

    if (localFirst.cached) {
      detailRetouche.value = normalizeRetouche(localFirst.cached);
      syncDetailItemStatuses(detailRetoucheItemStatuses, detailRetouche.value?.items, detailRetouche.value?.statutRetouche || "");
      activeRetoucheId = detailRetouche.value?.idRetouche || activeRetoucheId;
      hasCachedDetail = true;
    }

    if (!localFirst.online) {
      if (!hasCachedDetail) {
        detailRetouche.value = null;
        resetReactiveRecord(detailRetoucheItemStatuses);
        detailRetoucheActions.value = null;
        detailRetouchePaiements.value = [];
        detailRetoucheEvents.value = [];
        detailRetouchePaiementsLoading.value = false;
        detailRetoucheEventsLoading.value = false;
        detailRetoucheError.value = OFFLINE_READ_MESSAGES.RETOUCHE_DETAIL;
        detailRetoucheLoading.value = false;
        resetContactFollowUpState(detailRetoucheContactFollowUp);
        return null;
      }

      detailRetouchePaiements.value = [];
      detailRetoucheEvents.value = [];
      detailRetouchePaiementsLoading.value = false;
      detailRetoucheEventsLoading.value = false;
      detailRetoucheError.value = OFFLINE_READ_MESSAGES.RETOUCHE_SUPPLEMENTAL;
      detailRetoucheLoading.value = false;
      return detailRetouche.value;
    }

    try {
      const refreshed = await localFirst.refreshPromise;
      if (requestId !== retoucheDetailLoadRequestId) return null;
      if (refreshed?.row) {
        detailRetouche.value = normalizeRetouche(refreshed.row);
        syncDetailItemStatuses(detailRetoucheItemStatuses, detailRetouche.value?.items, detailRetouche.value?.statutRetouche || "");
        activeRetoucheId = detailRetouche.value?.idRetouche || activeRetoucheId;
      } else if (!hasCachedDetail) {
        throw new Error("Retouche introuvable");
      }
      if (isRemoteEntityId(activeRetoucheId)) {
        void loadRetoucheActionsForId(activeRetoucheId, { force: true, detail: true });
      }
    } catch (err) {
      if (requestId !== retoucheDetailLoadRequestId) return null;
      if (hasCachedDetail) {
        detailRetoucheError.value = readableError(err);
      } else {
        detailRetouche.value = null;
        resetReactiveRecord(detailRetoucheItemStatuses);
        detailRetoucheActions.value = null;
        detailRetouchePaiements.value = [];
        detailRetoucheEvents.value = [];
        detailRetouchePaiementsLoading.value = false;
        detailRetoucheEventsLoading.value = false;
        detailRetoucheError.value = readableError(err);
        detailRetoucheLoading.value = false;
        return null;
      }
    }

    if (requestId !== retoucheDetailLoadRequestId) return null;
    detailRetoucheLoading.value = false;
    void loadClientContactSummaryIntoState(detailRetoucheContactFollowUp, detailRetouche.value?.idClient);

    if (!isRemoteEntityId(activeRetoucheId)) {
      detailRetouchePaiements.value = [];
      detailRetoucheEvents.value = [];
      detailRetouchePaiementsLoading.value = false;
      detailRetoucheEventsLoading.value = false;
      detailRetoucheError.value = detailRetoucheError.value
        ? `${detailRetoucheError.value} | ${OFFLINE_READ_MESSAGES.RETOUCHE_SUPPLEMENTAL}`
        : OFFLINE_READ_MESSAGES.RETOUCHE_SUPPLEMENTAL;
      resetContactFollowUpState(detailRetoucheContactFollowUp);
      return detailRetouche.value;
    }

    detailRetouchePaiementsLoading.value = true;
    try {
      const paiements = await atelierApi.listPaiementsRetouche(activeRetoucheId);
      detailRetouchePaiements.value = (paiements || []).map(normalizePaiement);
    } catch (err) {
      detailRetouchePaiements.value = [];
      detailRetoucheError.value = detailRetoucheError.value ? `${detailRetoucheError.value} | ${readableError(err)}` : readableError(err);
    } finally {
      detailRetouchePaiementsLoading.value = false;
    }

    detailRetoucheEventsLoading.value = true;
    try {
      const events = await atelierApi.listRetoucheEvents(activeRetoucheId);
      detailRetoucheEvents.value = (events || [])
        .map(normalizeWorkflowEvent)
        .sort((a, b) => new Date(b.dateEvent).getTime() - new Date(a.dateEvent).getTime());
    } catch (err) {
      detailRetoucheEvents.value = [];
      detailRetoucheError.value = detailRetoucheError.value ? `${detailRetoucheError.value} | ${readableError(err)}` : readableError(err);
    } finally {
      detailRetoucheEventsLoading.value = false;
    }

    return detailRetouche.value;
  })();

  try {
    return await retoucheDetailLoadPromise;
  } finally {
    if (retoucheDetailLoadRequestId === requestId) {
      retoucheDetailLoadPromise = null;
      retoucheDetailLoadTargetId = "";
    }
  }
}
</script>

<template>
  <OfflineBanner />
  <GlobalToastHost :message="toast" :offset-for-offline-banner="!networkIsOnline" />

  <div v-if="!authReady" class="auth-shell">
    <article class="auth-card auth-loading-card">
      <header class="auth-card-head">
        <div class="auth-logo auth-logo-app">AP</div>
        <h2>AtelierPro</h2>
        <div class="auth-loading-spinner" aria-hidden="true"></div>
        <p>Chargement...</p>
      </header>
    </article>
  </div>

  <div v-else-if="!isAuthenticated" class="auth-shell">
    <article class="auth-card">
      <header class="auth-card-head">
        <div class="auth-logo">
          <img v-if="atelierLogoUrl && authPortal === 'atelier'" :src="atelierLogoUrl" alt="Logo atelier" />
          <span v-else>{{ workspaceLogoText }}</span>
        </div>
        <h2>{{ atelierNomConnexion }}</h2>
        <p>{{ authCardSubtitle }}</p>
      </header>
      <div class="segmented auth-portal-switch" role="tablist" aria-label="Type de connexion">
        <button class="mini-btn auth-portal-btn" :class="{ active: authPortal === 'atelier' }" type="button" @click="setAuthPortal('atelier')">
          Atelier
        </button>
        <button class="mini-btn auth-portal-btn" :class="{ active: authPortal === 'system' }" type="button" @click="setAuthPortal('system')">
          Administration systeme
        </button>
      </div>
      <div v-if="authPortal === 'atelier'" class="auth-form auth-slug-form">
        <label for="login-atelier-slug">Slug atelier</label>
        <input
          id="login-atelier-slug"
          v-model.trim="authAtelierSlug"
          type="text"
          inputmode="text"
          autocomplete="organization"
          placeholder="ex: atelier-kintambo"
        />
        <p v-if="authAtelierContext?.nom" class="helper auth-helper">
          Atelier detecte: <strong>{{ authAtelierContext.nom }}</strong>
          <span v-if="authAtelierContext.slug"> · {{ authAtelierContext.slug }}</span>
        </p>
      </div>
      <p v-if="authError" class="auth-error">{{ authError }}</p>
      <div v-if="authMode === 'checking'" class="auth-message">
        <p>{{ authPortal === 'system' ? "Verification de la console systeme..." : "Verification de la configuration de l'atelier..." }}</p>
      </div>
      <div v-else-if="authMode === 'slug-required'" class="auth-message">
        <p>Renseigne le slug de l'atelier pour charger la bonne instance.</p>
      </div>
      <div v-else-if="authMode === 'atelier-not-found'" class="auth-message">
        <p>Aucun atelier ne correspond a ce slug.</p>
      </div>
      <div v-else-if="authMode === 'atelier-inactive'" class="auth-message">
        <p>{{ AUTH_DISABLED_ATELIER_MESSAGE }}</p>
      </div>
      <div v-else-if="authMode === 'bootstrap'" class="auth-message">
        <p>Aucun compte proprietaire n'existe encore pour cet atelier.</p>
        <button class="action-btn blue auth-submit" type="button" :disabled="bootstrapInitializing" @click="bootstrapAtelier">
          {{ bootstrapInitializing ? "Initialisation..." : "Initialiser l'atelier" }}
        </button>
      </div>
      <div v-else-if="authMode === 'system-bootstrap'" class="auth-message">
        <p>Aucun manager systeme n'existe encore pour cette application.</p>
        <button class="action-btn blue auth-submit" type="button" :disabled="bootstrapInitializing" @click="bootstrapSystemManager">
          {{ bootstrapInitializing ? "Initialisation..." : "Initialiser le manager systeme" }}
        </button>
      </div>
      <form v-else class="auth-form" @submit.prevent="submitLogin">
        <label for="login-email">Email</label>
        <input id="login-email" v-model="loginForm.email" type="email" required autocomplete="username" />
        <label for="login-password">Mot de passe</label>
        <div class="auth-password-field">
          <input
            id="login-password"
            v-model="loginForm.motDePasse"
            :type="showPassword ? 'text' : 'password'"
            required
            autocomplete="current-password"
          />
          <button class="auth-password-toggle" type="button" @click="showPassword = !showPassword">{{ showPassword ? "Masquer" : "Voir" }}</button>
        </div>
        <button class="action-btn blue auth-submit" type="submit" :disabled="authenticating">
          {{ authenticating ? "Connexion..." : "Se connecter" }}
        </button>
        <button type="button" class="auth-link-btn auth-link-inline" @click="sendForgotPassword">Mot de passe oublie ?</button>
      </form>
    </article>
  </div>

  <div v-else class="workspace classic" :class="{ 'sidebar-open': isSidebarDrawerOpen }" :style="mobileLayoutStyle">
    <div v-if="isMobileViewport && isSidebarDrawerOpen" class="sidebar-backdrop" @click="closeSidebarDrawer" />

    <Sidebar
      :menu-items="visibleMenuItems"
      :current-route="currentRoute"
      :icon-paths="iconPaths"
      :workspace-name="workspaceName"
      :workspace-subtitle="workspaceSubtitle"
      :workspace-logo-text="workspaceLogoText"
      :atelier-logo-url="atelierLogoUrl"
      :is-system-manager="isSystemManager"
      :auth-user="authUser"
      @navigate="handlePrimaryNavigation"
      @logout="handleSidebarLogout"
    />

    <main class="main">
      <MobileHeader
        v-if="isMobileViewport"
        :title="currentTitle"
        :show-notifications="canOpenAtelierNotifications"
        :unread-count="atelierNotificationsUnreadCount"
        @toggle-menu="toggleSidebarDrawer"
        @open-notifications="openAtelierNotificationsPage"
      />

      <header class="topbar classic-topbar">
        <div>
          <p class="date-label">{{ todayLabel() }}</p>
          <h2>{{ currentTitle }}</h2>
          <p class="date-label">{{ workspaceName }}</p>
        </div>
        <div class="topbar-actions">
          <span class="status-pill" :data-tone="networkIsOnline ? 'ok' : 'due'">
            {{ networkIsOnline ? "ONLINE" : "OFFLINE" }}
          </span>
          <span class="status-pill" :data-tone="syncStatusTone">
            {{ syncStatusLabel }}
          </span>
          <button
            v-if="canOpenAtelierNotifications"
            class="mini-btn topbar-notification-btn"
            type="button"
            @click="openAtelierNotificationsPage"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path v-for="(path, i) in iconPaths.bell" :key="`topbar-notif-${i}`" :d="path" />
            </svg>
            <span>Notifications</span>
            <span v-if="atelierNotificationsUnreadCount > 0" class="topbar-notification-badge">
              {{ atelierNotificationsUnreadCount > 99 ? "99+" : atelierNotificationsUnreadCount }}
            </span>
          </button>
          <button v-if="isPwaInstallAvailable" class="mini-btn pwa-topbar-btn" @click="installApplication">
            Installer l'application
          </button>
          <button v-if="isPwaUpdateAvailable" class="mini-btn pwa-topbar-btn pwa-topbar-btn-update" @click="reloadApplicationForUpdate">
            Mettre a jour
          </button>
          <button class="mini-btn" @click="reloadAll" :disabled="loading">Actualiser</button>
        </div>
      </header>

      <div ref="contentScrollRef" class="content-scroll">
        <div v-if="errorMessage" class="panel error-panel">
          <strong>Information</strong>
          <p>{{ errorMessage }}</p>
        </div>

        <SystemDashboardPage
          v-if="currentRoute === 'systemDashboard'"
          :loading="systemDashboardLoading"
          :error="systemDashboardError"
          :overview="systemDashboard"
          :stats="systemAteliersStats"
          :format-date-time="formatDateTime"
          @refresh="refreshSystemAteliersList"
        />

        <SystemAteliersPage
          v-if="currentRoute === 'systemAteliers'"
          :loading="systemAteliersLoading"
          :error="systemAteliersError"
          :search="systemAteliersSearch"
          :status-filter="systemAteliersStatus"
          :sort-option="systemAteliersSort"
          :stats="systemAteliersStats"
          :ateliers="systemAteliers"
          :filtered-count="systemAteliersFilteredCount"
          :action-id="systemAtelierActionId"
          :selected-atelier-id="systemAtelierDetailId"
          :page="systemAteliersPagination.page"
          :pages="systemAteliersPages"
          :page-size="systemAteliersPagination.pageSize"
          :format-date-time="formatDateTime"
          @refresh="refreshSystemAteliersList"
          @open-create="openSystemAtelierModal"
          @toggle-activation="toggleSystemAtelierActivation"
          @open-detail="openSystemAtelierDetail"
          @update-search="updateSystemAteliersSearch"
          @update-status-filter="updateSystemAteliersStatus"
          @update-sort-option="updateSystemAteliersSort"
          @update-page-size="updateSystemAteliersPageSize"
          @prev-page="goToPreviousSystemAteliersPage"
          @next-page="goToNextSystemAteliersPage"
        />

        <SystemNotificationsPage
          v-if="currentRoute === 'systemNotifications'"
          :loading="systemNotificationsLoading"
          :submitting="systemNotificationsSubmitting"
          :error="systemNotificationsError"
          :notifications="systemNotifications"
          :contacts="systemNotificationsContacts"
          :format-date-time="formatDateTime"
          :build-phone-href="buildPhoneDialHref"
          :build-whatsapp-href="(telephone) => buildPreferredWhatsAppHref(telephone, 'Bonjour, ici l administration systeme AtelierPro.')"
          @refresh="loadSystemNotifications"
          @submit-notification="submitSystemNotification"
        />

        <AtelierNotificationsPage
          v-else-if="currentRoute === 'notifications'"
          :loading="atelierNotificationsLoading"
          :error="atelierNotificationsError"
          :notifications="atelierNotifications"
          :unread-count="atelierNotificationsUnreadCount"
          :active-notification-id="atelierNotificationsActiveId"
          :format-date-time="formatDateTime"
          @refresh="loadAtelierNotifications"
          @open-notification="openAtelierNotification"
        />

        <SystemAtelierDetailPage
          v-if="currentRoute === 'systemAtelierDetail'"
          :selected-atelier-id="systemAtelierDetailId"
          :detail="systemAtelierDetail"
          :detail-loading="systemAtelierDetailLoading"
          :detail-error="systemAtelierDetailError"
          :action-id="systemAtelierActionId"
          :owner-action-key="systemOwnerActionKey"
          :owner-action-error="systemOwnerActionError"
          :recovery-action-key="systemRecoveryActionKey"
          :recovery-action-error="systemRecoveryActionError"
          :format-date-time="formatDateTime"
          :build-phone-href="buildPhoneDialHref"
          :build-whatsapp-href="(telephone) => buildPreferredWhatsAppHref(telephone, 'Bonjour, ici l administration systeme AtelierPro.')"
          @back="returnToSystemAteliers"
          @refresh="refreshSystemAtelierDetail"
          @toggle-activation="toggleSystemAtelierActivation"
          @toggle-owner-activation="toggleSystemAtelierOwnerActivation"
          @update-owner-contact="updateSystemAtelierOwnerContact"
          @reset-owner-password="resetSystemAtelierOwnerPassword"
          @revoke-owner-sessions="revokeSystemAtelierOwnerSessions"
          @promote-user-to-owner="promoteSystemAtelierUserToOwner"
          @reactivate-user="reactivateSystemAtelierRecoveryUser"
          @create-owner="createSystemAtelierRecoveryOwner"
          @demote-owner="demoteSystemAtelierOwner"
        />

        <section v-if="currentRoute === 'dashboard'" class="dashboard classic-dashboard">
        <MobilePageLayout :has-action="isMobileViewport && (canCreateCommande || canCreateRetouche)">
        <article class="panel dashboard-filter">
          <MobileSectionHeader
            eyebrow="Vue globale"
            title="Dashboard atelier"
            subtitle="Suivez rapidement l'activite, la caisse et les alertes."
          />
          <div class="row-actions">
            <p v-if="dashboardClientsActifs" class="helper"><strong>Clients actifs:</strong> {{ dashboardClientsActifs.value }}</p>
            <select v-model="dashboardPeriod">
              <option v-for="option in dashboardPeriodOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </article>

        <ResponsiveDataContainer :mobile="isMobileViewport">
          <template #mobile>
            <article class="panel">
              <MobileSectionHeader
                title="Indicateurs cles"
                subtitle="Les indicateurs prioritaires pour piloter la journee."
              />
              <DashboardMetricCardGrid :items="dashboardPrimaryMobileCards" />
            </article>

            <article class="panel">
              <MobileSectionHeader
                title="Caisse et encaissements"
                subtitle="Lecture rapide de la situation financiere."
              />
              <DashboardMetricCardGrid :items="dashboardFinanceMobileCards" />
            </article>

            <article class="panel">
              <MobileSectionHeader
                title="Ventes stock"
                subtitle="Performance recente des ventes atelier."
              />
              <DashboardMetricCardGrid :items="dashboardSalesMobileCards" />
            </article>

            <article class="panel">
              <MobileSectionHeader
                title="Activite recente"
                subtitle="Les derniers mouvements les plus utiles."
              />
              <DashboardRecentWorkMobileList
                v-if="recentWorkRows.length > 0"
                :items="recentWorkRows"
                :format-currency="formatCurrency"
              />
              <MobileStateEmpty
                v-else
                title="Aucune activite recente"
                description="Aucune commande, retouche ou vente recente sur la periode choisie."
              />
            </article>

            <article class="panel">
              <MobileSectionHeader
                title="Activite caisse recente"
                subtitle="Les dernieres operations de caisse enregistrees."
              />
              <DashboardActivityMobileList
                :items="recentCaisseActivity"
                title="Activite caisse"
                empty-label="Aucune operation recente"
                tone="info"
                :value-formatter="formatCurrency"
              />
            </article>

            <article class="panel alerts">
              <MobileSectionHeader
                title="Alertes"
                subtitle="Points d'attention a traiter rapidement."
              />
              <DashboardActivityMobileList
                :items="alerts"
                title="Alertes"
                empty-label="Aucune alerte active"
                tone="warning"
                badge-label="Alerte"
              />
            </article>

            <article v-if="canAccessContactFollowUpDashboard" class="panel">
              <MobileSectionHeader
                title="Suivi client"
                subtitle="Relances et notifications a traiter rapidement."
              />
              <DashboardMetricCardGrid :items="dashboardFollowUpCards" />
              <p v-if="dashboardContactBoardLoading" class="helper">Chargement du suivi client...</p>
              <p v-else-if="dashboardContactBoardError" class="helper">{{ dashboardContactBoardError }}</p>
            </article>

            <article v-if="canAccessContactFollowUpDashboard" class="panel">
              <MobileSectionHeader
                title="Clients a relancer"
                subtitle="Clients avec relance encore ouverte."
              />
              <DashboardActivityMobileList
                :items="dashboardClientsToFollowUpMobileItems"
                title="Relance client"
                empty-label="Aucun client a relancer"
                tone="warning"
                badge-label="Relance"
              />
            </article>

            <article v-if="canAccessContactFollowUpDashboard" class="panel">
              <MobileSectionHeader
                title="Commandes pretes a signaler"
                subtitle="Commandes terminees sans suivi client enregistre."
              />
              <DashboardActivityMobileList
                :items="dashboardCommandesToNotifyMobileItems"
                title="Commande prete"
                empty-label="Aucune commande en attente de signalement"
                tone="info"
                badge-label="Commande"
              />
            </article>

            <article v-if="canAccessContactFollowUpDashboard" class="panel">
              <MobileSectionHeader
                title="Retouches pretes a signaler"
                subtitle="Retouches terminees sans suivi client enregistre."
              />
              <DashboardActivityMobileList
                :items="dashboardRetouchesToNotifyMobileItems"
                title="Retouche prete"
                empty-label="Aucune retouche en attente de signalement"
                tone="info"
                badge-label="Retouche"
              />
            </article>
          </template>

          <template #desktop>
            <div class="kpi-grid legacy-kpi-grid">
              <article v-for="card in dashboardCommandesCards" :key="card.label" class="kpi-card legacy-kpi" :data-tone="card.tone">
                <div class="kpi-head"><span>{{ card.label }}</span></div>
                <strong>{{ card.value }}</strong>
              </article>
            </div>

            <div class="kpi-grid legacy-kpi-grid">
              <article v-for="card in dashboardRetouchesCards" :key="card.label" class="kpi-card legacy-kpi" :data-tone="card.tone">
                <div class="kpi-head"><span>{{ card.label }}</span></div>
                <strong>{{ card.value }}</strong>
              </article>
            </div>

            <article class="panel finance-band">
              <div class="money-item">
                <p>Solde Caisse</p>
                <strong>{{ formatCurrency(financeMetrics.soldeCaisse) }}</strong>
              </div>
              <div class="money-item green">
                <p>Total Encaissement</p>
                <strong>{{ formatCurrency(financeMetrics.totalEncaissement) }}</strong>
              </div>
              <div class="money-item red">
                <p>Depenses du Jour</p>
                <strong>{{ formatCurrency(financeMetrics.depensesJour) }}</strong>
              </div>
              <div class="money-item red">
                <p>Acomptes encaisses</p>
                <strong>{{ formatCurrency(financeMetrics.acomptesEncaisses) }}</strong>
              </div>
            </article>

            <article class="panel finance-band">
              <div class="money-item">
                <p>Ventes stock</p>
                <strong>{{ dashboardSalesMetrics.nombreVentes }}</strong>
              </div>
              <div class="money-item blue">
                <p>CA ventes stock</p>
                <strong>{{ formatCurrency(dashboardSalesMetrics.chiffreAffaires) }}</strong>
              </div>
              <div class="money-item green">
                <p>Benefice brut</p>
                <strong>{{ formatCurrency(dashboardSalesMetrics.beneficeBrut) }}</strong>
              </div>
              <div class="money-item teal">
                <p>Taux de marge</p>
                <strong>{{ formatPercent(dashboardSalesMetrics.margeMoyenne) }}</strong>
              </div>
            </article>

            <div class="split-grid legacy-split">
              <article class="panel">
                <h3>Dernieres Commandes</h3>
                <table class="data-table mobile-stack-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Montant</th>
                      <th>Avance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in recentWorkRows" :key="row.id">
                      <td data-label="Client">{{ row.clientNom }}</td>
                      <td data-label="Type">{{ row.type }}</td>
                      <td data-label="Statut">{{ row.statut }}</td>
                      <td data-label="Montant">{{ formatCurrency(row.montantTotal) }}</td>
                      <td data-label="Avance">{{ formatCurrency(row.avancePayee) }}</td>
                    </tr>
                    <tr v-if="recentWorkRows.length === 0">
                      <td colspan="5">Aucune activite recente.</td>
                    </tr>
                  </tbody>
                </table>
                <div class="quick-inline">
                  <button class="action-btn blue" @click="openNouvelleCommande">Nouvelle Commande</button>
                  <button class="action-btn green" @click="openNouvelleRetouche">Nouvelle Retouche</button>
                </div>
              </article>

              <div class="stack">
                <article class="panel">
                  <h3>Activite Caisse Recente</h3>
                  <ul class="activity-list">
                    <li v-for="item in recentCaisseActivity" :key="item.id">
                      <span>{{ item.libelle }}</span>
                      <strong>{{ formatCurrency(item.montant) }}</strong>
                    </li>
                    <li v-if="recentCaisseActivity.length === 0">
                      <span>Aucune operation recente.</span>
                    </li>
                  </ul>
                </article>

                <article class="panel alerts">
                  <h3>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path v-for="(path, i) in iconPaths.alert" :key="`alert-${i}`" :d="path" />
                    </svg>
                    Alertes
                  </h3>
                  <ul class="activity-list">
                    <li v-for="alert in alerts" :key="alert.label">
                      <span class="status-pill" :data-tone="alert.tone">Alerte</span>
                      <span>{{ alert.label }}</span>
                    </li>
                    <li v-if="alerts.length === 0">
                      <span>Aucune alerte active.</span>
                    </li>
                  </ul>
                </article>
              </div>
            </div>

            <article v-if="canAccessContactFollowUpDashboard" class="panel">
              <h3>Suivi client</h3>
              <DashboardMetricCardGrid :items="dashboardFollowUpCards" :columns="4" compact />
              <p v-if="dashboardContactBoardLoading" class="helper">Chargement du suivi client...</p>
              <p v-else-if="dashboardContactBoardError" class="helper">{{ dashboardContactBoardError }}</p>
            </article>

            <div v-if="canAccessContactFollowUpDashboard" class="stack">
              <article class="panel">
                <h3>Clients a relancer</h3>
                <ul class="activity-list activity-list--stacked">
                  <li v-for="item in dashboardContactBoard.clientsARelancer.items" :key="item.idClient">
                    <div class="activity-copy">
                      <strong>{{ item.nomClient || item.telephone || item.idClient }}</strong>
                      <small>{{ formatDashboardClientFollowUpDescription(item) }}</small>
                    </div>
                  </li>
                  <li v-if="dashboardContactBoard.clientsARelancer.items.length === 0">
                    <span>Aucun client a relancer.</span>
                  </li>
                </ul>
              </article>

              <article class="panel">
                <h3>Commandes pretes a signaler</h3>
                <ul class="activity-list activity-list--stacked">
                  <li v-for="item in dashboardContactBoard.commandesPretesNonSignalees.items" :key="item.idCommande">
                    <div class="activity-copy">
                      <strong>{{ `${item.idCommande} - ${item.clientNom || item.idClient}` }}</strong>
                      <small>{{ formatDashboardPendingCommandeDescription(item) }}</small>
                    </div>
                  </li>
                  <li v-if="dashboardContactBoard.commandesPretesNonSignalees.items.length === 0">
                    <span>Aucune commande en attente de signalement.</span>
                  </li>
                </ul>
              </article>

              <article class="panel">
                <h3>Retouches pretes a signaler</h3>
                <ul class="activity-list activity-list--stacked">
                  <li v-for="item in dashboardContactBoard.retouchesPretesNonSignalees.items" :key="item.idRetouche">
                    <div class="activity-copy">
                      <strong>{{ `${item.idRetouche} - ${item.clientNom || item.idClient}` }}</strong>
                      <small>{{ formatDashboardPendingRetoucheDescription(item) }}</small>
                    </div>
                  </li>
                  <li v-if="dashboardContactBoard.retouchesPretesNonSignalees.items.length === 0">
                    <span>Aucune retouche en attente de signalement.</span>
                  </li>
                </ul>
              </article>
            </div>
          </template>
        </ResponsiveDataContainer>

        <template #action>
          <MobilePrimaryActionBar
            v-if="isMobileViewport && canCreateCommande"
            title="Action principale"
            subtitle="Commencez rapidement une nouvelle commande."
          >
            <button class="action-btn blue" @click="openNouvelleCommande">Nouvelle commande</button>
          </MobilePrimaryActionBar>
          <MobilePrimaryActionBar
            v-else-if="isMobileViewport && canCreateRetouche"
            title="Action principale"
            subtitle="Commencez rapidement une nouvelle retouche."
          >
            <button class="action-btn green" @click="openNouvelleRetouche">Nouvelle retouche</button>
          </MobilePrimaryActionBar>
        </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'dossiers'" class="commandes-page">
          <ResponsiveDataContainer :mobile="isMobileViewport">
            <template #mobile>
              <article class="panel panel-header">
                <MobileSectionHeader
                  eyebrow="Dossiers"
                  title="Centre des operations atelier"
                  subtitle="Familles, groupes et operations mixtes commandes + retouches."
                >
                  <template #actions>
                    <button class="action-btn blue" @click="openCreateDossierModal">Nouveau dossier</button>
                  </template>
                </MobileSectionHeader>
              </article>

              <article class="panel stack-form">
                <input v-model="dossierFilters.recherche" type="search" placeholder="Rechercher un responsable, un telephone ou un dossier" />
                <div class="grid-2 dossier-filter-grid">
                  <select v-model="dossierFilters.type">
                    <option value="ALL">Tous les types</option>
                    <option value="INDIVIDUEL">Individuel</option>
                    <option value="FAMILLE">Famille</option>
                    <option value="GROUPE">Groupe</option>
                  </select>
                  <select v-model="dossierFilters.statut">
                    <option value="ALL">Tous les statuts</option>
                    <option value="ACTIF">Actif</option>
                    <option value="SOLDE">Solde</option>
                    <option value="CLOTURE">Cloture</option>
                  </select>
                </div>
                <div class="row-between dossier-filter-summary">
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
                    <span class="status-chip">{{ dossier.statutDossier }}</span>
                  </div>
                  <div class="dossier-card-signal" :data-tone="dossierPrimarySignal(dossier).tone">
                    <strong>{{ dossierPrimarySignal(dossier).label }}</strong>
                    <span>{{ dossierPrimarySignal(dossier).detail }}</span>
                  </div>
                  <p class="helper dossier-card-summary">{{ dossierSummaryLine(dossier) }}</p>
                  <div class="mobile-kpi-grid dossier-kpis">
                    <div class="mobile-kpi dossier-mobile-kpi-card">
                      <span>Commandes</span>
                      <strong>{{ dossier.totalCommandes }}</strong>
                    </div>
                    <div class="mobile-kpi dossier-mobile-kpi-card">
                      <span>Retouches</span>
                      <strong>{{ dossier.totalRetouches }}</strong>
                    </div>
                    <div class="mobile-kpi dossier-mobile-kpi-card">
                      <span>Total</span>
                      <strong class="dossier-value-blue">{{ formatCurrency(dossier.totalMontant) }}</strong>
                    </div>
                    <div class="mobile-kpi dossier-mobile-kpi-card">
                      <span>Total paye</span>
                      <strong class="dossier-value-green">{{ formatCurrency(dossier.totalPaye) }}</strong>
                    </div>
                    <div class="mobile-kpi dossier-mobile-kpi-card">
                      <span>Reste</span>
                      <strong class="dossier-value-red">{{ formatCurrency(dossier.soldeRestant) }}</strong>
                    </div>
                  </div>
                  <div class="row-between dossier-card-footer">
                    <p class="helper">Activite : {{ formatDossierLastActivity(dossier) }}</p>
                    <span class="mini-btn gray">Ouvrir</span>
                  </div>
                </article>
              </div>
              <div v-if="dossiersPaged.length > 0 && dossiersPaged.length < dossiersFiltered.length" ref="dossierInfiniteSentinel" class="dossier-infinite-sentinel">
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
                    <button class="action-btn blue" @click="openCreateDossierModal">Nouveau dossier</button>
                  </template>
                </MobileSectionHeader>
              </article>

              <article class="panel">
                <div class="grid-3 dossier-filter-grid">
                  <input v-model="dossierFilters.recherche" type="search" placeholder="Rechercher un responsable, un telephone ou un dossier" />
                  <select v-model="dossierFilters.type">
                    <option value="ALL">Tous les types</option>
                    <option value="INDIVIDUEL">Individuel</option>
                    <option value="FAMILLE">Famille</option>
                    <option value="GROUPE">Groupe</option>
                  </select>
                  <select v-model="dossierFilters.statut">
                    <option value="ALL">Tous les statuts</option>
                    <option value="ACTIF">Actif</option>
                    <option value="SOLDE">Solde</option>
                    <option value="CLOTURE">Cloture</option>
                  </select>
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
                      <span class="status-pill" data-tone="ok">{{ dossier.typeDossier }}</span>
                      <span class="status-chip">{{ dossier.statutDossier }}</span>
                    </div>
                  </div>
                  <div class="dossier-card-signal" :data-tone="dossierPrimarySignal(dossier).tone">
                    <strong>{{ dossierPrimarySignal(dossier).label }}</strong>
                    <span>{{ dossierPrimarySignal(dossier).detail }}</span>
                  </div>
                  <p class="helper dossier-card-summary">{{ dossierSummaryLine(dossier) }}</p>
                  <div class="dossier-workspace-kpi-grid dossier-kpis-desktop">
                    <article class="dossier-kpi-card">
                      <span>Commandes</span>
                      <strong>{{ dossier.totalCommandes }}</strong>
                    </article>
                    <article class="dossier-kpi-card">
                      <span>Retouches</span>
                      <strong>{{ dossier.totalRetouches }}</strong>
                    </article>
                    <article class="dossier-kpi-card">
                      <span>Total</span>
                      <strong class="dossier-value-blue">{{ formatCurrency(dossier.totalMontant) }}</strong>
                    </article>
                    <article class="dossier-kpi-card">
                      <span>Total paye</span>
                      <strong class="dossier-value-green">{{ formatCurrency(dossier.totalPaye) }}</strong>
                    </article>
                    <article class="dossier-kpi-card">
                      <span>Reste</span>
                      <strong class="dossier-value-red">{{ formatCurrency(dossier.soldeRestant) }}</strong>
                    </article>
                  </div>
                  <div class="row-between dossier-card-footer">
                    <p class="helper">Activite : {{ formatDossierLastActivity(dossier) }}</p>
                    <button class="mini-btn" @click.stop="openDossierDetail(dossier.idDossier)">Ouvrir</button>
                  </div>
                </article>
              </div>
              <div v-if="dossiersPaged.length > 0 && dossiersPaged.length < dossiersFiltered.length" ref="dossierInfiniteSentinel" class="dossier-infinite-sentinel">
                <span class="helper">Chargement des dossiers suivants...</span>
              </div>
              <article v-else-if="dossiersFiltered.length === 0" class="panel empty-state">
                <h3>{{ dossierEmptyStateTitle }}</h3>
                <p>{{ dossierEmptyStateDescription }}</p>
              </article>
            </template>
          </ResponsiveDataContainer>
        </section>

        <section v-else-if="currentRoute === 'commandes'" class="commandes-page">
        <MobilePageLayout :has-action="isMobileViewport && canCreateCommande && commandeSection === 'liste'">
          <template #header>
            <article class="panel panel-header">
              <MobileSectionHeader
                eyebrow="Activite atelier"
                title="Page centrale des commandes"
                subtitle="Pilotage, suivi et priorisation des commandes en cours."
              >
                <template #actions>
                  <button v-if="canCreateCommande && !isMobileViewport" class="action-btn blue" @click="openNouvelleCommande">
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
                <button class="mini-btn" :class="{ active: commandeSection === 'liste' }" @click="commandeSection = 'liste'">Liste</button>
                <button class="mini-btn" :class="{ active: commandeSection === 'indicateurs' }" @click="commandeSection = 'indicateurs'">Indicateurs</button>
                <button class="mini-btn" :class="{ active: commandeSection === 'actions' }" @click="commandeSection = 'actions'">Actions rapides</button>
              </div>
            </article>

            <MobileFilterBlock
              v-if="isMobileViewport && commandeSection === 'liste'"
              title="Filtres commandes"
              :summary="commandeFilterSummary"
              :open="commandeMobileFiltersOpen"
              @toggle="commandeMobileFiltersOpen = !commandeMobileFiltersOpen"
            >
              <div class="filters compact">
                <select v-model="filters.statut">
                  <option v-for="status in statusOptions" :key="status" :value="status">
                    {{ status === "ALL" ? "Tous statuts" : status }}
                  </option>
                </select>
                <div class="commande-client-picker">
                  <input v-model.trim="commandeClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" />
                  <select v-model="filters.client">
                    <option value="ALL">Tous clients</option>
                    <option value="" v-if="commandeClientOptions.length === 0">Aucun resultat</option>
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
                <button class="mini-btn" @click="resetCommandeFilters">Reinitialiser filtres</button>
              </div>
              <p class="helper" v-if="commandeClientQuery.trim() || filters.recherche.trim()">
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
                  <input v-model.trim="commandeClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" />
                  <select v-model="filters.client">
                    <option value="ALL">Tous clients</option>
                    <option value="" v-if="commandeClientOptions.length === 0">Aucun resultat</option>
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
                <button class="mini-btn" @click="resetCommandeFilters">Reinitialiser filtres</button>
              </div>
              <p class="helper" v-if="commandeClientQuery.trim() || filters.recherche.trim()">
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
              <button v-if="canCreateCommande" class="action-btn blue" @click="openNouvelleCommande">Nouvelle commande</button>
              <button class="action-btn gray" @click="commandeSection = 'liste'">Voir la liste</button>
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
                  <button v-if="canCreateCommande" class="action-btn blue" @click="openNouvelleCommande">Nouvelle commande</button>
                </template>
              </MobileStateEmpty>

              <CommandeMobileList
                v-else-if="isMobile"
                :items="commandesPaged"
                :selected-id="selectedCommandeId"
                :format-currency="formatCurrency"
                :format-date="formatDateShort"
                @view="onVoirCommande"
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
                        <button class="mini-btn" @click="onVoirCommande(commande)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.eye" :key="`see-${commande.idCommande}-${i}`" :d="path" />
                          </svg>
                          Voir
                        </button>
                        <button class="mini-btn green" v-if="canPayer(commande)" @click="onPaiementCommande(commande)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.cash" :key="`cash-${commande.idCommande}-${i}`" :d="path" />
                          </svg>
                          Paiement
                        </button>
                        <button class="mini-btn blue" v-if="canLivrer(commande)" @click="onLivrerCommande(commande)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.check" :key="`liv-${commande.idCommande}-${i}`" :d="path" />
                          </svg>
                          Livrer
                        </button>
                        <button class="mini-btn blue" v-if="canTerminer(commande)" @click="onTerminerCommande(commande)">
                          Terminer
                        </button>
                        <button class="mini-btn red" v-if="canAnnuler(commande)" @click="onAnnulerCommande(commande)">
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
              <button class="action-btn blue" @click="openNouvelleCommande">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path v-for="(path, i) in iconPaths.plus" :key="`new-cmd-mobile-${i}`" :d="path" />
                </svg>
                Nouvelle commande
              </button>
            </MobilePrimaryActionBar>
          </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'retouches'" class="commandes-page">
        <MobilePageLayout :has-action="isMobileViewport && canCreateRetouche && retoucheSection === 'liste'">
          <template #header>
            <article class="panel panel-header">
              <MobileSectionHeader
                eyebrow="Activite atelier"
                title="Page centrale des retouches"
                subtitle="Suivi rapide des retouches, delais et soldes en attente."
              >
                <template #actions>
                  <button v-if="canCreateRetouche && !isMobileViewport" class="action-btn blue" @click="openNouvelleRetouche">
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
                <button class="mini-btn" :class="{ active: retoucheSection === 'liste' }" @click="retoucheSection = 'liste'">Liste</button>
                <button class="mini-btn" :class="{ active: retoucheSection === 'kpi' }" @click="retoucheSection = 'kpi'">Indicateurs</button>
                <button class="mini-btn" :class="{ active: retoucheSection === 'actions' }" @click="retoucheSection = 'actions'">Actions rapides</button>
              </div>
            </article>

            <MobileFilterBlock
              v-if="isMobileViewport && retoucheSection === 'liste'"
              title="Filtres retouches"
              :summary="retoucheFilterSummary"
              :open="retoucheMobileFiltersOpen"
              @toggle="retoucheMobileFiltersOpen = !retoucheMobileFiltersOpen"
            >
              <div class="filters compact">
                <select v-model="retoucheFilters.statut">
                  <option v-for="status in retoucheStatusOptions" :key="status" :value="status">
                    {{ status === "ALL" ? "Tous statuts" : status }}
                  </option>
                </select>
                <div class="retouche-client-picker">
                  <input v-model.trim="retoucheClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" />
                  <select v-model="retoucheFilters.client">
                    <option value="ALL">Tous clients</option>
                    <option value="" v-if="retoucheClientOptions.length === 0">Aucun resultat</option>
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
                <button class="mini-btn" @click="resetRetoucheFilters">Reinitialiser filtres</button>
              </div>
              <p class="helper" v-if="retoucheClientQuery.trim() || retoucheFilters.recherche.trim()">
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
                  <input v-model.trim="retoucheClientQuery" type="text" placeholder="Rechercher client (nom, telephone...)" />
                  <select v-model="retoucheFilters.client">
                    <option value="ALL">Tous clients</option>
                    <option value="" v-if="retoucheClientOptions.length === 0">Aucun resultat</option>
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
                <button class="mini-btn" @click="resetRetoucheFilters">Reinitialiser filtres</button>
              </div>
              <p class="helper" v-if="retoucheClientQuery.trim() || retoucheFilters.recherche.trim()">
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
              <button v-if="canCreateRetouche" class="action-btn blue" @click="openNouvelleRetouche">Nouvelle retouche</button>
              <button class="action-btn gray" @click="retoucheSection = 'liste'">Voir la liste</button>
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
                  <button v-if="canCreateRetouche" class="action-btn blue" @click="openNouvelleRetouche">Nouvelle retouche</button>
                </template>
              </MobileStateEmpty>

              <RetoucheMobileList
                v-else-if="isMobile"
                :items="retouchesPaged"
                :selected-id="selectedRetoucheId"
                :format-currency="formatCurrency"
                :format-date="formatDateShort"
                @view="onVoirRetouche"
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
                        <button class="mini-btn" @click="onVoirRetouche(retouche)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.eye" :key="`see-ret-${retouche.idRetouche}-${i}`" :d="path" />
                          </svg>
                          Voir
                        </button>
                        <button class="mini-btn green" v-if="canPayerRetouche(retouche)" @click="onPaiementRetouche(retouche)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.cash" :key="`cash-ret-${retouche.idRetouche}-${i}`" :d="path" />
                          </svg>
                          Paiement
                        </button>
                        <button class="mini-btn blue" v-if="canLivrerRetouche(retouche)" @click="onLivrerRetouche(retouche)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.check" :key="`liv-ret-${retouche.idRetouche}-${i}`" :d="path" />
                          </svg>
                          Livrer
                        </button>
                        <button class="mini-btn blue" v-if="canTerminerRetouche(retouche)" @click="onTerminerRetouche(retouche)">
                          Terminer
                        </button>
                        <button class="mini-btn red" v-if="canAnnulerRetouche(retouche)" @click="onAnnulerRetouche(retouche)">
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
              ref="retoucheInfiniteSentinel"
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
              <button class="action-btn blue" @click="openNouvelleRetouche">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path v-for="(path, i) in iconPaths.plus" :key="`new-ret-mobile-${i}`" :d="path" />
                </svg>
                Nouvelle retouche
              </button>
            </MobilePrimaryActionBar>
          </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'clientsMesures'" class="commandes-page">
        <MobilePageLayout compact>
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Memoire atelier"
            title="Fiche client - Consultation"
            subtitle="Consultez l'historique, les mesures et les passages d'un client."
          >
            <template #actions>
              <button class="mini-btn" @click="exportClientConsultationPdf" :disabled="!clientConsultationClient">
                {{ isMobileViewport ? "Telecharger la fiche" : "Exporter PDF" }}
              </button>
            </template>
          </MobileSectionHeader>
          <div class="filters compact client-consultation-picker">
            <input v-model.trim="clientConsultationQuery" type="text" placeholder="Rechercher client (nom, telephone...)" />
            <select v-model="selectedClientConsultationId">
              <option value="" v-if="clients.length === 0">{{ networkIsOnline ? "Aucun client disponible" : "Aucun client disponible hors ligne" }}</option>
              <option value="" v-else-if="clientConsultationClientOptions.length === 0">Aucun resultat</option>
              <option v-for="client in clientConsultationClientOptions" :key="`consult-${client.idClient}`" :value="client.idClient">
                {{ `${client.nom} ${client.prenom}`.trim() }} - {{ client.telephone }}
              </option>
            </select>
          </div>
        </article>

        <ResponsiveDataContainer v-if="clientConsultationLoading" :mobile="isMobileViewport">
          <template #mobile>
            <MobileStateLoading
              title="Chargement de l'historique client"
              description="Preparation de la fiche, des mesures et des passages de l'atelier."
              :blocks="3"
            />
          </template>
          <template #desktop>
            <article class="panel">
              <p>Chargement de l'historique client...</p>
            </article>
          </template>
        </ResponsiveDataContainer>

        <ResponsiveDataContainer v-else-if="clientConsultationError" :mobile="isMobileViewport">
          <template #mobile>
            <MobileStateError
              title="Impossible d'afficher la consultation client"
              :description="clientConsultationError"
            />
          </template>
          <template #desktop>
            <article class="panel error-panel">
              <strong>Consultation client</strong>
              <p>{{ clientConsultationError }}</p>
            </article>
          </template>
        </ResponsiveDataContainer>

        <template v-else-if="clientConsultationClient">
          <ResponsiveDataContainer :mobile="isMobileViewport">
            <template #mobile>
              <ClientConsultationOverviewCards
                :client="clientConsultationClient"
                :synthese="clientConsultationSynthese"
                :format-date="formatDateShort"
                :format-currency="formatCurrency"
              />

              <MobileFilterBlock
                title="Filtres consultation"
                :summary="clientHistoryFilterSummary"
                :open="clientMobileFiltersOpen"
                @toggle="clientMobileFiltersOpen = !clientMobileFiltersOpen"
              >
                <div class="filters compact">
                  <select v-model="clientHistoryFilters.source">
                    <option value="ALL">Toutes sources</option>
                    <option value="COMMANDE">Commande</option>
                    <option value="RETOUCHE">Retouche</option>
                  </select>
                  <select v-model="clientHistoryFilters.typeHabit">
                    <option value="ALL">Tous types d'habit</option>
                    <option v-for="type in clientTypeHabitOptions" :key="`flt-th-mobile-${type}`" :value="type">{{ type }}</option>
                  </select>
                  <select v-model="clientHistoryFilters.periode">
                    <option value="ALL">Toute periode</option>
                    <option value="30J">30 derniers jours</option>
                    <option value="90J">90 derniers jours</option>
                    <option value="365J">12 derniers mois</option>
                  </select>
                </div>
              </MobileFilterBlock>

              <article class="panel">
                <MobileSectionHeader
                  eyebrow="Historique"
                  title="Historique client"
                  :subtitle="`Resultats: ${clientConsultationResultats.commandes} commandes, ${clientConsultationResultats.retouches} retouches, ${clientConsultationResultats.mesures} mesures.`"
                />
                <div class="segmented">
                  <button class="mini-btn" :class="{ active: clientConsultationSection === 'commandes' }" @click="clientConsultationSection = 'commandes'">
                    Commandes ({{ clientConsultationResultats.commandes }})
                  </button>
                  <button class="mini-btn" :class="{ active: clientConsultationSection === 'retouches' }" @click="clientConsultationSection = 'retouches'">
                    Retouches ({{ clientConsultationResultats.retouches }})
                  </button>
                  <button class="mini-btn" :class="{ active: clientConsultationSection === 'mesures' }" @click="clientConsultationSection = 'mesures'">
                    Mesures ({{ clientConsultationResultats.mesures }})
                  </button>
                </div>
              </article>

              <article v-show="clientConsultationSection === 'commandes'" class="panel">
                <MobileSectionHeader
                  title="Historique des commandes"
                  :subtitle="`${clientConsultationResultats.commandes} element(s)`"
                />

                <MobileStateEmpty
                  v-if="clientFilteredCommandes.length === 0"
                  title="Aucune commande"
                  description="Aucune commande ne correspond aux filtres selectionnes."
                />

                <ClientCommandeHistoryMobileList
                  v-else
                  :items="clientCommandesPaged"
                  :format-currency="formatCurrency"
                  :format-date="formatDateShort"
                  @view="openCommandeDetail"
                />

                <ResponsivePagination
                  :page="clientPagination.commandesPage"
                  :pages="clientCommandesPages"
                  :show-page-size="false"
                  :prev-disabled="clientPagination.commandesPage <= 1"
                  :next-disabled="clientPagination.commandesPage >= clientCommandesPages"
                  @prev="setClientPage('commandes', clientPagination.commandesPage - 1)"
                  @next="setClientPage('commandes', clientPagination.commandesPage + 1)"
                />
              </article>

              <article v-show="clientConsultationSection === 'retouches'" class="panel">
                <MobileSectionHeader
                  title="Historique des retouches"
                  :subtitle="`${clientConsultationResultats.retouches} element(s)`"
                />

                <MobileStateEmpty
                  v-if="clientFilteredRetouches.length === 0"
                  title="Aucune retouche"
                  description="Aucune retouche ne correspond aux filtres selectionnes."
                />

                <ClientRetoucheHistoryMobileList
                  v-else
                  :items="clientRetouchesPaged"
                  :format-currency="formatCurrency"
                  :format-date="formatDateShort"
                  @view="openRetoucheDetail"
                />

                <ResponsivePagination
                  :page="clientPagination.retouchesPage"
                  :pages="clientRetouchesPages"
                  :show-page-size="false"
                  :prev-disabled="clientPagination.retouchesPage <= 1"
                  :next-disabled="clientPagination.retouchesPage >= clientRetouchesPages"
                  @prev="setClientPage('retouches', clientPagination.retouchesPage - 1)"
                  @next="setClientPage('retouches', clientPagination.retouchesPage + 1)"
                />
              </article>

              <article v-show="clientConsultationSection === 'mesures'" class="panel">
                <MobileSectionHeader
                  title="Historique des mesures"
                  :subtitle="`${clientConsultationResultats.mesures} element(s)`"
                />

                <MobileStateEmpty
                  v-if="clientFilteredMesures.length === 0"
                  title="Aucune mesure"
                  description="Aucun snapshot de mesures ne correspond aux filtres selectionnes."
                />

                <ClientMesureHistoryMobileList
                  v-else
                  :items="clientMesuresPaged"
                  :format-date="formatDateShort"
                  :format-mesures-lines="formatMesuresLines"
                  @view="onVoirOrigineMesure"
                />

                <ResponsivePagination
                  :page="clientPagination.mesuresPage"
                  :pages="clientMesuresPages"
                  :show-page-size="false"
                  :prev-disabled="clientPagination.mesuresPage <= 1"
                  :next-disabled="clientPagination.mesuresPage >= clientMesuresPages"
                  @prev="setClientPage('mesures', clientPagination.mesuresPage - 1)"
                  @next="setClientPage('mesures', clientPagination.mesuresPage + 1)"
                />
              </article>
            </template>

            <template #desktop>
          <article class="panel">
            <h3>Identite client</h3>
            <p><strong>Nom complet:</strong> {{ clientConsultationClient.nomComplet || "-" }}</p>
            <p><strong>Contact:</strong> {{ clientConsultationClient.telephone || "-" }}</p>
            <p><strong>Premier passage:</strong> {{ formatDateShort(clientConsultationClient.datePremierPassage) }}</p>
            <p><strong>Dernier passage:</strong> {{ formatDateShort(clientConsultationClient.dateDernierPassage || clientConsultationSynthese.dateDerniereActivite) }}</p>
            <p>
              <strong>Statut:</strong>
              <span
                class="status-pill"
                :data-tone="clientConsultationClient.statutVisuel === 'Client fidele' ? 'ok' : (clientConsultationClient.statutVisuel === 'Client regulier' ? 'blue' : 'slate')"
              >
                {{ clientConsultationClient.statutVisuel }}
              </span>
            </p>
          </article>

          <article class="panel">
            <h3>Synthese client</h3>
            <div class="kpi-grid legacy-kpi-grid">
              <div class="kpi-card legacy-kpi" data-tone="blue">
                <div class="kpi-head"><span>Commandes</span></div>
                <strong>{{ clientConsultationSynthese.totalCommandes }}</strong>
              </div>
              <div class="kpi-card legacy-kpi" data-tone="teal">
                <div class="kpi-head"><span>Retouches</span></div>
                <strong>{{ clientConsultationSynthese.totalRetouches }}</strong>
              </div>
              <div class="kpi-card legacy-kpi" data-tone="slate">
                <div class="kpi-head"><span>Derniere activite</span></div>
                <strong>{{ formatDateShort(clientConsultationSynthese.dateDerniereActivite) }}</strong>
              </div>
              <div class="kpi-card legacy-kpi" data-tone="amber">
                <div class="kpi-head"><span>Total depense</span></div>
                <strong>{{ formatCurrency(clientConsultationSynthese.montantTotalDepense) }}</strong>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h3>Filtres consultation</h3>
              <div class="filters compact" style="gap: 8px;">
                <select v-model="clientHistoryFilters.source">
                  <option value="ALL">Toutes sources</option>
                  <option value="COMMANDE">Commande</option>
                  <option value="RETOUCHE">Retouche</option>
                </select>
                <select v-model="clientHistoryFilters.typeHabit">
                  <option value="ALL">Tous types d'habit</option>
                  <option v-for="type in clientTypeHabitOptions" :key="`flt-th-${type}`" :value="type">{{ type }}</option>
                </select>
                <select v-model="clientHistoryFilters.periode">
                  <option value="ALL">Toute periode</option>
                  <option value="30J">30 derniers jours</option>
                  <option value="90J">90 derniers jours</option>
                  <option value="365J">12 derniers mois</option>
                </select>
                <select v-model.number="clientPagination.pageSize">
                  <option :value="5">5 / page</option>
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                </select>
              </div>
            </div>
            <p class="helper">
              Resultats: {{ clientConsultationResultats.commandes }} commandes, {{ clientConsultationResultats.retouches }} retouches, {{ clientConsultationResultats.mesures }} mesures.
            </p>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h3>Historique client</h3>
              <div class="segmented">
                <button class="mini-btn" :class="{ active: clientConsultationSection === 'commandes' }" @click="clientConsultationSection = 'commandes'">
                  Commandes ({{ clientConsultationResultats.commandes }})
                </button>
                <button class="mini-btn" :class="{ active: clientConsultationSection === 'retouches' }" @click="clientConsultationSection = 'retouches'">
                  Retouches ({{ clientConsultationResultats.retouches }})
                </button>
                <button class="mini-btn" :class="{ active: clientConsultationSection === 'mesures' }" @click="clientConsultationSection = 'mesures'">
                  Mesures ({{ clientConsultationResultats.mesures }})
                </button>
              </div>
            </div>
            <p class="helper">Affichage par section pour reduire la densite visuelle.</p>
          </article>

          <article v-show="clientConsultationSection === 'commandes'" class="panel">
            <h3>Historique des commandes ({{ clientConsultationResultats.commandes }})</h3>
            <div class="table-scroll-x">
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type d'habit</th>
                    <th>Statut</th>
                    <th>Montant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in clientCommandesPaged" :key="`cc-${row.idCommande}`">
                    <td data-label="Date">{{ formatDateShort(row.date) }}</td>
                    <td data-label="Type habit">{{ row.typeHabit || "-" }}</td>
                    <td data-label="Statut">{{ row.statut || "-" }}</td>
                    <td data-label="Montant">{{ formatCurrency(row.montant) }}</td>
                    <td class="actions-cell"><button class="mini-btn" @click="openCommandeDetail(row.idCommande)">Voir</button></td>
                  </tr>
                  <tr v-if="clientFilteredCommandes.length === 0">
                    <td colspan="5">Aucune commande pour les filtres selectionnes.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="panel-footer">
              <button class="mini-btn" :disabled="clientPagination.commandesPage <= 1" @click="setClientPage('commandes', clientPagination.commandesPage - 1)">Precedent</button>
              <span>Page {{ clientPagination.commandesPage }} / {{ clientCommandesPages }}</span>
              <button class="mini-btn" :disabled="clientPagination.commandesPage >= clientCommandesPages" @click="setClientPage('commandes', clientPagination.commandesPage + 1)">Suivant</button>
            </div>
          </article>

          <article v-show="clientConsultationSection === 'retouches'" class="panel">
            <h3>Historique des retouches ({{ clientConsultationResultats.retouches }})</h3>
            <div class="table-scroll-x">
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type d'habit</th>
                    <th>Type retouche</th>
                    <th>Statut</th>
                    <th>Montant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in clientRetouchesPaged" :key="`cr-${row.idRetouche}`">
                    <td data-label="Date">{{ formatDateShort(row.date) }}</td>
                    <td data-label="Type habit">{{ row.typeHabit || "-" }}</td>
                    <td data-label="Type retouche">{{ row.typeRetouche || "-" }}</td>
                    <td data-label="Statut">{{ row.statut || "-" }}</td>
                    <td data-label="Montant">{{ formatCurrency(row.montant) }}</td>
                    <td class="actions-cell"><button class="mini-btn" @click="openRetoucheDetail(row.idRetouche)">Voir</button></td>
                  </tr>
                  <tr v-if="clientFilteredRetouches.length === 0">
                    <td colspan="6">Aucune retouche pour les filtres selectionnes.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="panel-footer">
              <button class="mini-btn" :disabled="clientPagination.retouchesPage <= 1" @click="setClientPage('retouches', clientPagination.retouchesPage - 1)">Precedent</button>
              <span>Page {{ clientPagination.retouchesPage }} / {{ clientRetouchesPages }}</span>
              <button class="mini-btn" :disabled="clientPagination.retouchesPage >= clientRetouchesPages" @click="setClientPage('retouches', clientPagination.retouchesPage + 1)">Suivant</button>
            </div>
          </article>

          <article v-show="clientConsultationSection === 'mesures'" class="panel">
            <h3>Historique des mesures ({{ clientConsultationResultats.mesures }})</h3>
            <div class="table-scroll-x">
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Date de prise</th>
                    <th>Type d'habit</th>
                    <th>Source</th>
                    <th>Mesures</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in clientMesuresPaged" :key="`cm-${row.source}-${row.idOrigine}-${index}`">
                    <td data-label="Date">{{ formatDateShort(row.datePrise) }}</td>
                    <td data-label="Type habit">{{ row.typeHabit || "-" }}</td>
                    <td data-label="Source">{{ row.source || "-" }}</td>
                    <td data-label="Mesures">
                      <template v-for="(line, idx) in formatMesuresLines(row.mesures)" :key="`cm-line-${index}-${idx}`">
                        <div>{{ line }}</div>
                      </template>
                      <div v-if="formatMesuresLines(row.mesures).length === 0">Aucune mesure</div>
                    </td>
                    <td class="actions-cell"><button class="mini-btn" @click="onVoirOrigineMesure(row)">Voir</button></td>
                  </tr>
                  <tr v-if="clientFilteredMesures.length === 0">
                    <td colspan="5">Aucun snapshot de mesures pour les filtres selectionnes.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="panel-footer">
              <button class="mini-btn" :disabled="clientPagination.mesuresPage <= 1" @click="setClientPage('mesures', clientPagination.mesuresPage - 1)">Precedent</button>
              <span>Page {{ clientPagination.mesuresPage }} / {{ clientMesuresPages }}</span>
              <button class="mini-btn" :disabled="clientPagination.mesuresPage >= clientMesuresPages" @click="setClientPage('mesures', clientPagination.mesuresPage + 1)">Suivant</button>
            </div>
          </article>
            </template>
          </ResponsiveDataContainer>
        </template>

        <ResponsiveDataContainer v-else :mobile="isMobileViewport">
          <template #mobile>
            <MobileStateEmpty
              title="Selectionnez un client"
              description="Choisissez un client pour consulter sa memoire atelier."
            />
          </template>
          <template #desktop>
            <article class="panel">
              <p>Selectionnez un client pour consulter sa memoire atelier.</p>
            </article>
          </template>
        </ResponsiveDataContainer>
        </MobilePageLayout>
      </section>
        <section v-else-if="currentRoute === 'stockVentes'" class="commandes-page">
        <MobilePageLayout :has-action="isMobileViewport && ((stockVentesTab === 'stock' && canManageStockArticles) || (stockVentesTab === 'ventes' && canCreateVente && venteDraft.lignes.length > 0))">
        <article class="panel panel-header">
          <MobileSectionHeader
            eyebrow="Stock atelier"
            title="Stock & Ventes"
            subtitle="Suivez vos articles, enregistrez une vente et consultez l'historique."
          />
          <div class="segmented">
            <button class="mini-btn" :class="{ active: stockVentesTab === 'stock' }" @click="stockVentesTab = 'stock'">Stock</button>
            <button class="mini-btn" :class="{ active: stockVentesTab === 'ventes' }" @click="stockVentesTab = 'ventes'">Ventes</button>
          </div>
        </article>

        <template v-if="stockVentesTab === 'stock'">
          <article v-if="lowStockArticles.length > 0" class="panel alert-banner">
            <div>
              <strong>Alerte stock faible</strong>
              <p class="helper">Articles en dessous du seuil: {{ lowStockArticles.map((a) => a.nomArticle).join(", ") }}</p>
            </div>
            <button class="mini-btn" @click="scrollToStockList">Voir la liste</button>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h3>Gestion articles</h3>
              <button v-if="canManageStockArticles && !isMobileViewport" class="action-btn blue" @click="showNewArticle = !showNewArticle">
                {{ showNewArticle ? "Fermer" : "Ajouter article" }}
              </button>
            </div>
            <div v-if="showNewArticle && canManageStockArticles" class="stack">
              <div class="form-grid">
                <div class="form-row">
                  <label>Nom</label>
                  <input v-model="newArticle.nomArticle" type="text" />
                </div>
                <div class="form-row">
                  <label>Categorie</label>
                  <select v-model="newArticle.categorieArticle">
                    <option value="TISSU">TISSU</option>
                    <option value="FIL">FIL</option>
                    <option value="BOUTON">BOUTON</option>
                    <option value="FERMETURE">FERMETURE</option>
                    <option value="ACCESSOIRE">ACCESSOIRE</option>
                  </select>
                </div>
                <div class="form-row">
                  <label>Unite</label>
                  <select v-model="newArticle.uniteStock">
                    <option value="METRE">METRE</option>
                    <option value="PIECE">PIECE</option>
                    <option value="BOBINE">BOBINE</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>
                <div class="form-row">
                  <label>Quantite initiale</label>
                  <input v-model="newArticle.quantiteDisponible" type="number" min="0" />
                </div>
                <div class="form-row">
                  <label>Prix d'achat initial</label>
                  <input v-model="newArticle.prixAchatInitial" type="number" min="0" step="0.01" />
                </div>
                <div class="form-row">
                  <label>Prix de vente unitaire</label>
                  <input v-model="newArticle.prixVenteUnitaire" type="number" min="0" />
                </div>
                <div class="form-row">
                  <label>Seuil alerte</label>
                  <input v-model="newArticle.seuilAlerte" type="number" min="0" />
                </div>
              </div>
              <div class="panel-footer">
                <button class="action-btn blue" @click="onCreateArticle">Creer article</button>
              </div>
            </div>
          </article>

          <article class="panel" ref="stockListRef">
            <MobileSectionHeader
              title="Liste des articles"
              :subtitle="`${stockArticles.length} article(s) en stock`"
            />

            <ResponsiveDataContainer :mobile="isMobileViewport">
              <template #mobile>
                <MobileStateEmpty
                  v-if="stockArticles.length === 0"
                  title="Aucun article"
                  :description="networkIsOnline ? 'Aucun article en stock.' : 'Aucun article disponible hors ligne.'"
                />

                <StockArticleMobileList
                  v-else
                  :items="stockArticles"
                  :format-currency="formatCurrency"
                  :ensure-input="ensureStockInput"
                  :can-manage-stock-adjustments="canManageStockAdjustments"
                  :can-manage-stock-purchases="canManageStockPurchases"
                  :can-manage-stock-articles="canManageStockArticles"
                  @adjust="onApprovisionnerStock"
                  @buy="onAcheterStock"
                  @edit="onModifierArticleStock"
                />
              </template>

              <template #desktop>
                <table class="data-table mobile-stack-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Quantite</th>
                      <th>Prix achat moyen</th>
                      <th>Prix vente</th>
                      <th>Seuil</th>
                      <th>Etat</th>
                      <th>Approvisionnement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="article in stockArticles" :key="article.idArticle">
                      <td data-label="Article">{{ article.nomArticle }}</td>
                      <td data-label="Quantite">{{ article.quantiteDisponible }}</td>
                      <td data-label="Prix achat">{{ formatCurrency(article.prixAchatMoyen) }}</td>
                      <td data-label="Prix vente">{{ formatCurrency(article.prixVenteUnitaire) }}</td>
                      <td data-label="Seuil">{{ article.seuilAlerte }}</td>
                      <td data-label="Etat">
                        <span
                          class="status-pill"
                          :data-tone="Number(article.quantiteDisponible || 0) <= Number(article.seuilAlerte || 0) ? 'due' : 'ok'"
                        >
                          {{
                            !article.actif
                              ? "INACTIF"
                              : Number(article.quantiteDisponible || 0) <= Number(article.seuilAlerte || 0)
                                ? "STOCK FAIBLE"
                                : "OK"
                          }}
                        </span>
                      </td>
                      <td class="row-actions">
                        <template v-if="canManageStockAdjustments || canManageStockPurchases || canManageStockArticles">
                          <input
                            v-if="canManageStockAdjustments"
                            class="inline-input"
                            type="number"
                            min="0"
                            placeholder="Quantite"
                            v-model="ensureStockInput(article.idArticle).quantite"
                          />
                          <input
                            v-if="canManageStockAdjustments"
                            class="inline-input"
                            type="text"
                            placeholder="Motif entree simple"
                            v-model="ensureStockInput(article.idArticle).motif"
                          />
                          <button v-if="canManageStockAdjustments" class="mini-btn" @click="onApprovisionnerStock(article)">Entrer</button>
                          <button v-if="canManageStockPurchases" class="mini-btn" @click="onAcheterStock(article)">Acheter</button>
                          <button v-if="canManageStockArticles" class="mini-btn" @click="onModifierArticleStock(article)">Modifier</button>
                        </template>
                        <span v-else class="helper">Lecture seule</span>
                      </td>
                    </tr>
                    <tr v-if="stockArticles.length === 0">
                      <td colspan="6">{{ networkIsOnline ? "Aucun article en stock." : "Aucun article disponible hors ligne." }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
          </article>
        </template>

        <template v-else>
          <article v-if="canCreateVente" class="panel">
            <MobileSectionHeader
              title="Nouvelle vente"
              subtitle="Ajoutez des lignes au brouillon avant de creer la vente."
            />

            <div class="stack-form">
              <label>Article</label>
              <select v-model="venteDraft.current.idArticle">
                <option value="">Choisir un article</option>
                <option v-for="article in stockArticles" :key="article.idArticle" :value="article.idArticle">
                  {{ article.nomArticle }}
                </option>
              </select>
              <label>Quantite</label>
              <input v-model="venteDraft.current.quantite" type="number" min="0" />
              <button class="mini-btn" @click="addVenteLigne">Ajouter ligne</button>
            </div>

            <ResponsiveDataContainer :mobile="isMobileViewport">
              <template #mobile>
                <MobileStateEmpty
                  v-if="venteDraft.lignes.length === 0"
                  title="Aucune ligne ajoutee"
                  description="Selectionnez un article et une quantite pour commencer la vente."
                />

                <VenteDraftMobileList
                  v-else
                  :items="venteDraft.lignes"
                  :article-label="stockArticleLabel"
                  @remove="removeVenteLigne"
                />
              </template>

              <template #desktop>
                <table class="data-table mobile-stack-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Quantite</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(ligne, index) in venteDraft.lignes" :key="`${ligne.idArticle}-${index}`">
                      <td data-label="Article">{{ stockArticleMap.get(ligne.idArticle) || ligne.idArticle }}</td>
                      <td data-label="Quantite">{{ ligne.quantite }}</td>
                      <td class="row-actions">
                        <button class="mini-btn" @click="removeVenteLigne(index)">Retirer</button>
                      </td>
                    </tr>
                    <tr v-if="venteDraft.lignes.length === 0">
                      <td colspan="3">Aucune ligne ajoutee.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>

            <div v-if="!isMobileViewport" class="panel-footer">
              <button class="action-btn blue" @click="onCreerVente" :disabled="venteSubmitting">Creer la vente</button>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h3>Historique des ventes</h3>
              <span class="status-pill" :data-status="caisseStatus">{{ caisseStatus }}</span>
            </div>

            <ResponsiveDataContainer :mobile="isMobileViewport">
              <template #mobile>
                <MobileStateEmpty
                  v-if="ventesView.length === 0"
                  title="Aucune vente"
                  description="Aucune vente disponible pour le moment."
                />

                <VenteMobileList
                  v-else
                  :items="ventesPaged"
                  :format-currency="formatCurrency"
                  :format-date-time="formatDateTime"
                  @view="onVoirVente"
                />
              </template>

              <template #desktop>
                <table class="data-table mobile-stack-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Total</th>
                      <th>Reference caisse</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="vente in ventesPaged" :key="vente.idVente">
                      <td data-label="ID">{{ vente.idVente }}</td>
                      <td data-label="Date">{{ formatDateTime(vente.date) }}</td>
                      <td data-label="Statut">
                        <span class="status-pill" :data-status="vente.statut">{{ vente.statut }}</span>
                      </td>
                      <td data-label="Total">{{ formatCurrency(vente.total) }}</td>
                      <td data-label="Reference caisse">{{ vente.referenceCaisse || "-" }}</td>
                      <td class="row-actions">
                        <button class="mini-btn" @click="onVoirVente(vente)">
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.eye" :key="`see-vente-${vente.idVente}-${i}`" :d="path" />
                          </svg>
                          Voir
                        </button>
                        <button
                          class="mini-btn"
                          v-if="vente.statut === 'BROUILLON'"
                          :disabled="!caisseOuverte"
                          :title="!caisseOuverte ? 'Caisse cloturee' : ''"
                          @click="onValiderVente(vente)"
                        >
                          <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path v-for="(path, i) in iconPaths.check" :key="`val-vente-${vente.idVente}-${i}`" :d="path" />
                          </svg>
                          Valider
                        </button>
                        <button
                          class="mini-btn"
                          v-if="vente.statut === 'BROUILLON'"
                          :disabled="!caisseOuverte"
                          :title="!caisseOuverte ? 'Caisse cloturee' : ''"
                          @click="onValiderVenteEtFacturer(vente)"
                        >
                          Valider + facture
                        </button>
                        <button class="mini-btn" v-if="vente.statut === 'BROUILLON'" @click="onAnnulerVente(vente)">
                          Annuler
                        </button>
                      </td>
                    </tr>
                    <tr v-if="ventesView.length === 0">
                      <td colspan="6">Aucune vente disponible.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>

            <div
              v-if="ventesPaged.length > 0 && ventesPaged.length < ventesView.length"
              ref="venteInfiniteSentinel"
              class="dossier-infinite-sentinel infinite-list-status"
            >
              <span class="auth-loading-spinner subtle" aria-hidden="true"></span>
              <span class="helper">{{ ventesLoadingMore ? "Chargement..." : "Faites defiler pour charger la suite" }}</span>
            </div>
            <div v-else-if="ventesInfiniteEndReached" class="dossier-infinite-sentinel infinite-list-status">
              <span class="helper">Aucune autre vente</span>
            </div>
          </article>
        </template>

        <template #action>
          <MobilePrimaryActionBar
            v-if="isMobileViewport && stockVentesTab === 'stock' && canManageStockArticles"
            title="Action principale"
            subtitle="Ajoutez rapidement un nouvel article au stock."
          >
            <button class="action-btn blue" @click="showNewArticle = !showNewArticle">
              {{ showNewArticle ? "Fermer le formulaire" : "Ajouter article" }}
            </button>
          </MobilePrimaryActionBar>

          <MobilePrimaryActionBar
            v-else-if="isMobileViewport && stockVentesTab === 'ventes' && canCreateVente && venteDraft.lignes.length > 0"
            title="Action principale"
            subtitle="Validez le brouillon lorsque la vente est prete."
          >
            <button class="action-btn blue" @click="onCreerVente" :disabled="venteSubmitting">
              Creer la vente
            </button>
          </MobilePrimaryActionBar>
        </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'dossier-detail'" class="commande-detail">
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

        <section v-else-if="currentRoute === 'commande-detail'" class="commande-detail">
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
                  Livrer
                </button>
                <button v-show="!isMobileViewport && canTerminerDetail" class="action-btn blue" @click="onTerminerDetail" :disabled="detailLoading">
                  Terminer
                </button>
                <button
                  :class="isMobileViewport ? 'mini-btn' : 'action-btn red'"
                  v-show="canAnnulerDetail"
                  @click="onAnnulerDetail"
                  :disabled="detailLoading"
                >
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
                    <button
                      class="mini-btn"
                      :disabled="detailCommandeMediaLoading"
                      @click="openCommandeItemPhotoDialog(item)"
                    >
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
                  ref="detailPaiementsInfiniteSentinel"
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
                  ref="detailCommandeEventsInfiniteSentinel"
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

        <section v-else-if="currentRoute === 'retouche-detail'" class="commande-detail">
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
                  Livrer
                </button>
                <button v-show="!isMobileViewport && canTerminerRetoucheDetail" class="action-btn blue" @click="onTerminerRetoucheDetail" :disabled="detailRetoucheLoading">
                  Terminer
                </button>
                <button
                  :class="isMobileViewport ? 'mini-btn' : 'action-btn red'"
                  v-show="canAnnulerRetoucheDetail"
                  @click="onAnnulerRetoucheDetail"
                  :disabled="detailRetoucheLoading"
                >
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
                  ref="detailRetouchePaiementsInfiniteSentinel"
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
                  ref="detailRetoucheEventsInfiniteSentinel"
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

        <section v-else-if="currentRoute === 'vente-detail'" class="commande-detail">
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

        <section v-else-if="currentRoute === 'facturation'" class="commandes-page">
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
            <button class="mini-btn" :class="{ active: factureSection === 'liste' }" @click="factureSection = 'liste'">Liste</button>
            <button class="mini-btn" :class="{ active: factureSection === 'indicateurs' }" @click="factureSection = 'indicateurs'">Indicateurs</button>
            <button class="mini-btn" :class="{ active: factureSection === 'actions' }" @click="factureSection = 'actions'">Actions rapides</button>
          </div>
        </article>

        <article v-show="factureSection === 'liste'" class="panel">
          <template v-if="isMobileViewport">
            <MobileFilterBlock
              title="Filtres factures"
              :summary="factureFilterSummary"
              :open="factureMobileFiltersOpen"
              @toggle="factureMobileFiltersOpen = !factureMobileFiltersOpen"
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
          <p class="helper" v-if="factureFilters.recherche.trim()">
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
            <button class="action-btn green" @click="factureSection = 'liste'">Voir la liste</button>
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
            ref="factureInfiniteSentinel"
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

        <section v-else-if="currentRoute === 'parametres'" class="commandes-page parametres-page">
        <MobilePageLayout :has-action="isMobileViewport && settingsCanEdit">
          <template #header>
            <article class="panel panel-header">
              <MobileSectionHeader
                eyebrow="Configuration"
                title="Parametres atelier"
                subtitle="Configuration metier globale. Lecture par les modules, modification rare et securisee."
              />
              <div class="row-actions">
                <p class="helper" v-if="atelierSettings.meta.lastSavedAt">
                  Derniere sauvegarde: {{ formatDateTime(atelierSettings.meta.lastSavedAt) }}
                </p>
                <span class="status-pill" :data-tone="settingsCanEdit ? 'ok' : 'due'">
                  {{ settingsCanEdit ? "Edition active" : "Lecture seule" }}
                </span>
                <button class="mini-btn" :disabled="settingsSaving" @click="toggleSettingsEdit">
                  {{ settingsCanEdit ? "Verrouiller" : "Activer modifications" }}
                </button>
                <button
                  v-if="!isMobileViewport"
                  class="action-btn blue"
                  :disabled="!settingsCanEdit || settingsSaving"
                  @click="saveAtelierSettings"
                >
                  {{ settingsSaving ? "Sauvegarde..." : "Sauvegarder" }}
                </button>
                <button class="mini-btn" :disabled="!settingsCanEdit || settingsSaving" @click="resetAtelierSettings">Reinitialiser</button>
              </div>
            </article>
          </template>

        <article class="panel settings-tabs" role="tablist" aria-label="Sections parametres">
          <button
            v-for="tab in visibleSettingsTabs"
            :key="`settings-tab-${tab.id}`"
            class="mini-btn settings-tab-btn"
            :class="{ active: settingsActiveTab === tab.id }"
            role="tab"
            :aria-selected="settingsActiveTab === tab.id"
            @click="settingsActiveTab = tab.id"
          >
            {{ tab.label }}
            <span v-if="settingsTabIsDirty(tab.id)" class="tab-dirty-dot" aria-hidden="true"></span>
          </button>
          <div class="settings-tabs-right">
            <span v-if="settingsHasUnsavedChanges" class="status-pill" data-tone="due">Non sauvegarde</span>
            <label v-if="atelierSettings.securite.confirmationAvantSauvegarde" class="helper helper-inline-checkbox">
              <input v-model="settingsConfirmSave" type="checkbox" :disabled="!settingsCanEdit || settingsSaving" />
              Confirmer la sauvegarde
            </label>
          </div>
        </article>

        <ResponsiveDataContainer v-if="settingsLoading" :mobile="isMobileViewport">
          <template #mobile>
            <MobileStateLoading title="Chargement des parametres" description="Preparation de la configuration atelier..." />
          </template>
          <template #desktop>
            <article class="panel">
              <p>Chargement des parametres...</p>
            </article>
          </template>
        </ResponsiveDataContainer>

        <article v-if="settingsSaving" class="panel info-panel">
          <p>Sauvegarde des parametres en cours...</p>
        </article>

        <ResponsiveDataContainer v-if="settingsError" :mobile="isMobileViewport">
          <template #mobile>
            <MobileStateError title="Erreur parametres" :description="settingsError" />
          </template>
          <template #desktop>
            <article class="panel error-panel">
              <strong>Erreur parametres</strong>
              <p>{{ settingsError }}</p>
            </article>
          </template>
        </ResponsiveDataContainer>

        <article v-show="settingsActiveTab === 'identite'" id="settings-identite" class="panel settings-section" role="tabpanel">
          <h3>Identite de l'atelier</h3>
          <p class="helper">Utilise pour factures, impressions et exports.</p>
          <div class="settings-grid">
            <div class="stack-form">
              <label>Nom de l'atelier</label>
              <input v-model="atelierSettings.identite.nomAtelier" type="text" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Telephone</label>
              <input v-model="atelierSettings.identite.telephone" type="text" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Adresse (optionnel)</label>
              <input v-model="atelierSettings.identite.adresse" type="text" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Email (optionnel)</label>
              <input v-model="atelierSettings.identite.email" type="email" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Devise</label>
              <select v-model="atelierSettings.identite.devise" :disabled="!settingsCanEdit">
                <option v-for="devise in deviseOptions" :key="devise" :value="devise">{{ devise }}</option>
              </select>
            </div>
            <div class="stack-form">
              <label>Logo atelier</label>
              <input
                ref="settingsLogoInputRef"
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                :disabled="!canUploadAtelierLogo || settingsLogoUploading"
                @change="onAtelierLogoFileChange"
              />
              <small class="helper">PNG ou JPG, 2 MB maximum. Seul le proprietaire peut remplacer le logo.</small>
              <small class="helper" v-if="atelierSettings.identite.logoUrl">Chemin actuel : {{ atelierSettings.identite.logoUrl }}</small>
              <div class="row-actions">
                <button class="mini-btn" type="button" :disabled="!settingsLogoSelectedFile || settingsLogoUploading" @click="clearSelectedAtelierLogo()">
                  Annuler
                </button>
                <button class="action-btn blue" type="button" :disabled="!canUploadAtelierLogo || !settingsLogoSelectedFile || settingsLogoUploading" @click="uploadAtelierLogo">
                  {{ settingsLogoUploading ? "Envoi en cours..." : "Envoyer le logo" }}
                </button>
              </div>
            </div>
            <div class="settings-logo-preview" v-if="settingsDisplayedLogoPreview">
              <label>Previsualisation logo</label>
              <img :src="settingsDisplayedLogoPreview" alt="Logo atelier" />
            </div>
          </div>
        </article>

        <article v-show="settingsActiveTab === 'contact'" id="settings-contact" class="panel settings-section" role="tabpanel">
          <h3>Contact client</h3>
          <p class="helper">Configure les messages prets a envoyer depuis commande, retouche et fiche client.</p>
          <div class="settings-grid">
            <label class="helper">
              <input v-model="atelierSettings.contactClient.signatureAuto" type="checkbox" :disabled="!settingsCanEdit" />
              Ajouter automatiquement la signature atelier a la fin des messages
            </label>
          </div>
          <p class="helper">Variables disponibles : {salutation}, {clientNom}, {reference}, {montantRestant}, {signature}, {atelierNom}, {atelierTelephone}</p>

          <article class="panel">
            <h4>Messages commande</h4>
            <div class="settings-grid">
              <div v-for="field in contactTemplateFieldDefinitions.filter((row) => row.group === 'commandes')" :key="`contact-${field.key}`" class="stack-form">
                <label>{{ field.label }}</label>
                <textarea
                  v-model="atelierSettings.contactClient.templates[field.key]"
                  rows="4"
                  :disabled="!settingsCanEdit"
                />
              </div>
            </div>
          </article>

          <article class="panel">
            <h4>Messages retouche</h4>
            <div class="settings-grid">
              <div v-for="field in contactTemplateFieldDefinitions.filter((row) => row.group === 'retouches')" :key="`contact-${field.key}`" class="stack-form">
                <label>{{ field.label }}</label>
                <textarea
                  v-model="atelierSettings.contactClient.templates[field.key]"
                  rows="4"
                  :disabled="!settingsCanEdit"
                />
              </div>
            </div>
          </article>

          <article class="panel">
            <h4>Messages fiche client</h4>
            <div class="settings-grid">
              <div v-for="field in contactTemplateFieldDefinitions.filter((row) => row.group === 'client')" :key="`contact-${field.key}`" class="stack-form">
                <label>{{ field.label }}</label>
                <textarea
                  v-model="atelierSettings.contactClient.templates[field.key]"
                  rows="4"
                  :disabled="!settingsCanEdit"
                />
              </div>
            </div>
          </article>
        </article>

        <article v-show="settingsActiveTab === 'commandes'" id="settings-commandes" class="panel settings-section" role="tabpanel">
          <h3>Regles de commande</h3>
          <p class="helper">Configuration du workflow de commande, pas de la structure des mesures.</p>
          <div class="settings-grid">
            <div class="stack-form">
              <label>Delai par defaut (jours)</label>
              <input v-model="atelierSettings.commandes.delaiDefautJours" type="number" min="0" :disabled="!settingsCanEdit" />
            </div>
            <label class="helper">
              <input
                v-model="atelierSettings.commandes.passageAutomatiqueEnCoursApresPremierPaiement"
                type="checkbox"
                :disabled="!settingsCanEdit"
              />
              Passer automatiquement une commande en cours apres le premier paiement
            </label>
            <label class="helper">
              <input
                v-model="atelierSettings.commandes.livraisonAutoriseeSeulementSiPaiementTotal"
                type="checkbox"
                :disabled="!settingsCanEdit"
              />
              Autoriser la livraison seulement si le paiement est total
            </label>
            <label class="helper">
              <input
                v-model="atelierSettings.commandes.autoriserModificationMesuresApresCreation"
                type="checkbox"
                :disabled="!settingsCanEdit"
              />
              Autoriser la modification des mesures apres creation
            </label>
            <label class="helper">
              <input
                v-model="atelierSettings.commandes.autoriserAnnulationApresPaiement"
                type="checkbox"
                :disabled="!settingsCanEdit"
              />
              Autoriser l'annulation d'une commande apres paiement
            </label>
          </div>
        </article>

        <article v-show="settingsActiveTab === 'retouches'" id="settings-retouches" class="panel settings-section" role="tabpanel">
          <h3>Regles de retouche</h3>
          <div class="settings-grid">
            <label class="helper">
              <input v-model="atelierSettings.retouches.mesuresOptionnelles" type="checkbox" :disabled="!settingsCanEdit" />
              Mesures optionnelles pour une retouche
            </label>
            <label class="helper">
              <input v-model="atelierSettings.retouches.saisiePartielle" type="checkbox" :disabled="!settingsCanEdit" />
              Autoriser la saisie partielle des mesures concernees
            </label>
            <label class="helper">
              <input v-model="atelierSettings.retouches.descriptionObligatoire" type="checkbox" :disabled="!settingsCanEdit" />
              Description de la retouche obligatoire
            </label>
          </div>
          <div class="row-actions">
            <button class="mini-btn" :disabled="!settingsCanEdit" @click="addRetoucheType">+ Nouveau type de retouche</button>
          </div>
          <div class="measure-layout">
            <article class="panel measure-sidebar">
              <div class="stack-form">
                <label>Rechercher un type de retouche</label>
                <input v-model="settingsRetoucheQuery" type="text" placeholder="Code, libelle, habit ou mesure cible" />
              </div>
              <div class="stack-form">
                <label>Filtrer</label>
                <select v-model="settingsRetoucheStatusFilter">
                  <option value="ALL">Tous les types</option>
                  <option value="ACTIVE">Types actifs</option>
                  <option value="INACTIVE">Types inactifs</option>
                </select>
              </div>
              <div class="measure-preview">
                <strong>{{ filteredSettingsRetoucheTypeEntries.length }} type(s) de retouche</strong>
                <span class="helper">Selectionne un type pour modifier sa logique de creation.</span>
              </div>
              <div class="measure-habit-list">
                <button
                  v-for="row in pagedSettingsRetoucheTypeEntries"
                  :key="`retouche-type-${row.code}`"
                  type="button"
                  class="measure-habit-item"
                  :class="{ active: selectedSettingsRetoucheType?.code === row.code }"
                  @click="selectSettingsRetoucheType(row.code)"
                >
                  <strong>{{ row.libelle }}</strong>
                  <span class="helper">{{ row.code }}</span>
                  <span class="measure-habit-meta" :data-state="row.actif === false ? 'ARCHIVE' : 'ACTIF'">
                    {{ row.actif === false ? "Inactif" : "Actif" }} ·
                    {{ row.necessiteMesures ? "Mesures dediees" : "Sans mesures" }}
                  </span>
                </button>
                <p v-if="filteredSettingsRetoucheTypeEntries.length === 0" class="helper">Aucun type de retouche ne correspond au filtre actuel.</p>
              </div>
              <ResponsivePagination
                :page="settingsRetouchePagination.page"
                :pages="settingsRetouchePages"
                :page-size="settingsRetouchePagination.pageSize"
                :page-size-options="[6, 10, 20]"
                :prev-disabled="settingsRetouchePagination.page <= 1"
                :next-disabled="settingsRetouchePagination.page >= settingsRetouchePages"
                @update:page-size="settingsRetouchePagination.pageSize = $event"
                @prev="settingsRetouchePagination.page -= 1"
                @next="settingsRetouchePagination.page += 1"
              />
            </article>

            <article v-if="selectedSettingsRetoucheType" class="panel measure-editor">
              <div class="panel-header detail-panel-header">
                <div class="stack-form measure-habit-meta">
                  <label>Libelle du type</label>
                  <input v-model="selectedSettingsRetoucheType.libelle" type="text" :disabled="!settingsCanEdit" />
                  <span class="helper">Code: {{ selectedSettingsRetoucheType.code }}</span>
                </div>
                <div class="row-actions">
                  <div class="stack-form measure-order-field">
                    <label>Ordre</label>
                    <input v-model.number="selectedSettingsRetoucheType.ordreAffichage" type="number" min="1" :disabled="!settingsCanEdit" />
                  </div>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="toggleRetoucheTypeActive(selectedSettingsRetoucheType.code)">
                    {{ selectedSettingsRetoucheType.actif === false ? "Activer" : "Desactiver" }}
                  </button>
                  <button
                    v-if="!settingsUsedRetoucheTypes.has(String(selectedSettingsRetoucheType.code || '').trim().toUpperCase())"
                    class="mini-btn danger"
                    :disabled="!settingsCanEdit"
                    @click="removeRetoucheType(selectedSettingsRetoucheType.code)"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              <div class="settings-grid">
                <label class="helper">
                  <input v-model="selectedSettingsRetoucheType.necessiteMesures" type="checkbox" :disabled="!settingsCanEdit" />
                  Cette retouche necessite des mesures
                </label>
                <label class="helper">
                  <input v-model="selectedSettingsRetoucheType.descriptionObligatoire" type="checkbox" :disabled="!settingsCanEdit" />
                  Description obligatoire pour ce type
                </label>
              </div>

              <div class="stack-form">
                <label>Habits compatibles</label>
                <select v-model="selectedSettingsRetoucheType.habitsCompatibles" multiple size="6" :disabled="!settingsCanEdit">
                  <option :value="wildcardHabitOption.value">{{ wildcardHabitOption.label }}</option>
                  <option v-for="option in availableHabitTypeOptions" :key="`rt-habit-${option.value}`" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <span class="helper">Choisis un ou plusieurs habits. `*` signifie tous les habits.</span>
              </div>

              <div class="panel-header detail-panel-header">
                <div class="measure-preview">
                  <strong>Mesures de retouche</strong>
                  <span class="helper">
                    {{ retoucheMeasureSummary(selectedSettingsRetoucheType).total }} mesure(s) configuree(s),
                    {{ retoucheMeasureSummary(selectedSettingsRetoucheType).active }} active(s),
                    {{ retoucheMeasureSummary(selectedSettingsRetoucheType).required }} obligatoire(s)
                  </span>
                </div>
                <button class="mini-btn" :disabled="!settingsCanEdit || !selectedSettingsRetoucheType.necessiteMesures" @click="addMesureToRetoucheType(selectedSettingsRetoucheType.code)">
                  Ajouter mesure
                </button>
              </div>

              <div v-if="selectedSettingsRetoucheType.necessiteMesures" class="table-scroll-x">
                <table class="data-table compact measure-table">
                  <thead>
                    <tr>
                      <th>Ordre</th>
                      <th>Mesure</th>
                      <th>Code</th>
                      <th>Unite</th>
                      <th>Type</th>
                      <th>Obligatoire</th>
                      <th>Active</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(mesure, index) in retoucheMeasuresForEditor(selectedSettingsRetoucheType)"
                      :key="`${selectedSettingsRetoucheType.code}-${mesure.code}-${index}`"
                    >
                      <td><input v-model.number="mesure.ordre" type="number" min="1" :disabled="!settingsCanEdit" /></td>
                      <td><input v-model="mesure.label" type="text" :disabled="!settingsCanEdit" /></td>
                      <td>{{ mesure.code }}</td>
                      <td><input v-model="mesure.unite" type="text" :disabled="!settingsCanEdit" /></td>
                      <td>
                        <select v-model="mesure.typeChamp" :disabled="!settingsCanEdit">
                          <option v-for="option in mesureTypeOptions" :key="`${selectedSettingsRetoucheType.code}-${mesure.code}-${option.value}`" :value="option.value">
                            {{ option.label }}
                          </option>
                        </select>
                      </td>
                      <td><input v-model="mesure.obligatoire" type="checkbox" :disabled="!settingsCanEdit" /></td>
                      <td><input v-model="mesure.actif" type="checkbox" :disabled="!settingsCanEdit" /></td>
                      <td>
                        <button class="mini-btn" :disabled="!settingsCanEdit" @click="removeMesureFromRetoucheType(selectedSettingsRetoucheType.code, mesure.code)">
                          Retirer
                        </button>
                      </td>
                    </tr>
                    <tr v-if="retoucheMeasuresForEditor(selectedSettingsRetoucheType).length === 0">
                      <td colspan="8">Aucune mesure configuree.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="helper">Aucune mesure ne sera demandee pour ce type de retouche.</p>
            </article>

            <article v-else class="panel measure-editor">
              <div class="measure-preview">
                <strong>Aucun type selectionne</strong>
                <span class="helper">Cree ou selectionne un type de retouche pour commencer.</span>
              </div>
            </article>
          </div>
        </article>

        <article v-show="settingsActiveTab === 'mesures'" id="settings-mesures" class="panel settings-section" role="tabpanel">
          <h3>Types d'habits & structure des mesures</h3>
          <p class="helper">Configuration des champs attendus, des regles de saisie et des types d'habits.</p>
          <div class="row-actions">
            <button class="mini-btn" :disabled="!settingsCanEdit" @click="addHabitType">+ Nouveau type d'habit</button>
          </div>
          <div class="settings-grid">
            <label class="helper">
              <input v-model="atelierSettings.commandes.mesuresObligatoires" type="checkbox" :disabled="!settingsCanEdit" />
              Mesures obligatoires pour une commande
            </label>
            <label class="helper">
              <input v-model="atelierSettings.commandes.interdictionSansMesures" type="checkbox" :disabled="!settingsCanEdit" />
              Interdiction d'enregistrer sans toutes les mesures requises
            </label>
            <div class="stack-form">
              <label>Unite de mesure</label>
              <input v-model="atelierSettings.commandes.uniteMesure" type="text" disabled />
            </div>
            <label class="helper">
              <input v-model="atelierSettings.commandes.decimalesAutorisees" type="checkbox" :disabled="!settingsCanEdit" />
              Valeurs decimales autorisees
            </label>
          </div>
          <div class="measure-layout">
            <article class="panel measure-sidebar">
              <div class="stack-form">
                <label>Rechercher un type ou une mesure</label>
                <input v-model="settingsMeasureQuery" type="text" placeholder="Code, type d'habit ou mesure" />
              </div>
              <div class="stack-form">
                <label>Filtrer</label>
                <select v-model="settingsMeasureStatusFilter">
                  <option value="ALL">Tous les types</option>
                  <option value="ACTIVE">Types actifs</option>
                  <option value="INACTIVE">Types inactifs</option>
                </select>
              </div>
              <div class="measure-preview">
                <strong>{{ filteredHabitConfigEntries.length }} type(s) d'habit</strong>
                <span class="helper">Selectionne un type pour modifier sa structure de mesures.</span>
              </div>
              <div class="measure-habit-list">
                <button
                  v-for="habit in pagedHabitConfigEntries"
                  :key="`habit-picker-${habit.key}`"
                  type="button"
                  class="measure-habit-item"
                  :class="{ active: selectedHabitConfigEntry?.key === habit.key }"
                  @click="selectSettingsHabit(habit.key)"
                >
                  <strong>{{ habit.config.label }}</strong>
                  <span class="helper">{{ habit.key }}</span>
                  <span class="measure-habit-meta" :data-state="habit.config.actif === false ? 'ARCHIVE' : 'ACTIF'">
                    {{ habit.config.actif === false ? "Inactif" : "Actif" }} · {{ habitMeasureSummary(habit.config).active }} mesure(s) active(s) · {{ habitMeasureSummary(habit.config).required }} obligatoire(s)
                  </span>
                </button>
                <p v-if="filteredHabitConfigEntries.length === 0" class="helper">Aucun type d'habit ne correspond au filtre actuel.</p>
              </div>
              <ResponsivePagination
                :page="settingsMeasurePagination.page"
                :pages="settingsMeasurePages"
                :page-size="settingsMeasurePagination.pageSize"
                :page-size-options="[8, 12, 20]"
                :prev-disabled="settingsMeasurePagination.page <= 1"
                :next-disabled="settingsMeasurePagination.page >= settingsMeasurePages"
                @update:page-size="settingsMeasurePagination.pageSize = $event"
                @prev="settingsMeasurePagination.page -= 1"
                @next="settingsMeasurePagination.page += 1"
              />
            </article>

            <article v-if="selectedHabitConfigEntry" class="panel measure-editor">
              <div class="panel-header detail-panel-header">
                <div class="stack-form measure-habit-meta">
                  <label>Type d'habit</label>
                  <input v-model="selectedHabitConfigEntry.config.label" type="text" :disabled="!settingsCanEdit" />
                  <span class="helper">Code: {{ selectedHabitConfigEntry.key }}</span>
                </div>
                <div class="row-actions">
                  <div class="measure-inline-fields">
                    <div class="stack-form measure-order-field">
                      <label>Ordre</label>
                      <input v-model.number="selectedHabitConfigEntry.config.ordre" type="number" min="0" :disabled="!settingsCanEdit" />
                    </div>
                  </div>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="toggleHabitTypeActive(selectedHabitConfigEntry.key)">
                    {{ selectedHabitConfigEntry.config.actif === false ? "Activer" : "Desactiver" }}
                  </button>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="duplicateHabitType(selectedHabitConfigEntry.key)">
                    Dupliquer
                  </button>
                  <button
                    v-if="!isHabitTypeUsed(selectedHabitConfigEntry.key)"
                    class="mini-btn danger"
                    :disabled="!settingsCanEdit"
                    @click="removeHabitType(selectedHabitConfigEntry.key)"
                  >
                    Supprimer
                  </button>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="addMesureToHabit(selectedHabitConfigEntry.key)">
                    Ajouter mesure
                  </button>
                </div>
              </div>

              <div class="measure-preview">
                <strong>{{ selectedHabitConfigEntry.config.label }}</strong>
                <span class="helper">
                  {{ habitMeasureSummary(selectedHabitConfigEntry.config).total }} mesure(s) configuree(s),
                  {{ habitMeasureSummary(selectedHabitConfigEntry.config).active }} active(s),
                  {{ habitMeasureSummary(selectedHabitConfigEntry.config).required }} obligatoire(s)
                </span>
              </div>

              <div class="table-scroll-x">
                <table class="data-table compact measure-table">
                  <thead>
                    <tr>
                      <th>Ordre</th>
                      <th>Mesure</th>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Obligatoire</th>
                      <th>Active</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(mesure, index) in habitMesuresForEditor(selectedHabitConfigEntry.config)"
                      :key="`${selectedHabitConfigEntry.key}-${mesure.code}-${index}`"
                    >
                      <td>
                        <input v-model.number="mesure.ordre" type="number" min="0" :disabled="!settingsCanEdit" />
                      </td>
                      <td>
                        <input v-model="mesure.label" type="text" :disabled="!settingsCanEdit" />
                      </td>
                      <td>{{ mesure.code }}</td>
                      <td>
                        <select v-model="mesure.typeChamp" :disabled="!settingsCanEdit">
                          <option
                            v-for="option in mesureTypeOptions"
                            :key="`${selectedHabitConfigEntry.key}-${mesure.code}-${option.value}`"
                            :value="option.value"
                          >
                            {{ option.label }}
                          </option>
                        </select>
                      </td>
                      <td>
                        <input v-model="mesure.obligatoire" type="checkbox" :disabled="!settingsCanEdit" />
                      </td>
                      <td>
                        <input v-model="mesure.actif" type="checkbox" :disabled="!settingsCanEdit" />
                      </td>
                      <td>
                        <button class="mini-btn" :disabled="!settingsCanEdit" @click="removeMesureFromHabit(selectedHabitConfigEntry.key, mesure.code)">
                          Retirer
                        </button>
                      </td>
                    </tr>
                    <tr v-if="selectedHabitConfigEntry.config.mesures.length === 0">
                      <td colspan="7">Aucune mesure configuree.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="measure-cards">
                <article
                  v-for="(mesure, index) in habitMesuresForEditor(selectedHabitConfigEntry.config)"
                  :key="`card-${selectedHabitConfigEntry.key}-${mesure.code}-${index}`"
                  class="measure-card"
                >
                  <div class="measure-card-head">
                    <strong>{{ mesure.label }}</strong>
                    <span class="helper">{{ mesure.code }}</span>
                  </div>
                  <div class="stack-form">
                    <label>Libelle</label>
                    <input v-model="mesure.label" type="text" :disabled="!settingsCanEdit" />
                  </div>
                  <label class="helper">
                    <input v-model="mesure.obligatoire" type="checkbox" :disabled="!settingsCanEdit" />
                    Mesure obligatoire
                  </label>
                  <label class="helper">
                    <input v-model="mesure.actif" type="checkbox" :disabled="!settingsCanEdit" />
                    Mesure active
                  </label>
                  <div class="stack-form">
                    <label>Type de champ</label>
                    <select v-model="mesure.typeChamp" :disabled="!settingsCanEdit">
                      <option
                        v-for="option in mesureTypeOptions"
                        :key="`card-${selectedHabitConfigEntry.key}-${mesure.code}-${option.value}`"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                  <div class="stack-form">
                    <label>Ordre</label>
                    <input v-model.number="mesure.ordre" type="number" min="0" :disabled="!settingsCanEdit" />
                  </div>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="removeMesureFromHabit(selectedHabitConfigEntry.key, mesure.code)">
                    Retirer
                  </button>
                </article>
                <p v-if="selectedHabitConfigEntry.config.mesures.length === 0" class="helper">Aucune mesure configuree.</p>
              </div>
            </article>

            <article v-else class="panel measure-editor">
              <div class="measure-preview">
                <strong>Aucun type selectionne</strong>
                <span class="helper">Ajuste le filtre ou cree un nouveau type d'habit pour commencer.</span>
              </div>
            </article>
          </div>
        </article>

        <article v-show="settingsActiveTab === 'caisse'" id="settings-caisse" class="panel settings-section" role="tabpanel">
          <h3>Regles de caisse (configuration)</h3>
          <div class="settings-grid">
            <div class="stack-form">
              <label>Heure ouverture automatique</label>
              <input v-model="atelierSettings.caisse.ouvertureAuto" type="time" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Heure ouverture dimanche</label>
              <input v-model="atelierSettings.caisse.ouvertureDimanche" type="time" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Fin de semaine comptable</label>
              <select v-model="atelierSettings.caisse.finSemaineComptable" :disabled="!settingsCanEdit">
                <option value="DIMANCHE">Dimanche</option>
                <option value="SAMEDI">Samedi</option>
              </select>
            </div>
            <label class="helper">
              <input v-model="atelierSettings.caisse.clotureAutoActive" type="checkbox" :disabled="!settingsCanEdit" />
              Activer la cloture automatique
            </label>
            <div class="stack-form">
              <label>Heure cloture automatique</label>
              <input v-model="atelierSettings.caisse.heureClotureAuto" type="time" :disabled="!settingsCanEdit || !atelierSettings.caisse.clotureAutoActive" />
            </div>
          </div>
          <p class="helper">
            Les horaires d'ouverture et de cloture automatique sont geres ici. Les regles de livraison restent pilotees dans les modules metier
            Commandes et Retouches. La fin de semaine comptable pilote la generation du bilan hebdomadaire selon votre atelier.
          </p>
        </article>

        <article v-show="settingsActiveTab === 'facturation'" id="settings-facturation" class="panel settings-section" role="tabpanel">
          <h3>Facturation</h3>
          <div class="settings-grid">
            <div class="stack-form">
              <label>Prefixe numerotation</label>
              <input v-model="atelierSettings.facturation.prefixeNumero" type="text" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Mentions standards</label>
              <textarea v-model="atelierSettings.facturation.mentions" rows="4" :disabled="!settingsCanEdit"></textarea>
            </div>
            <label class="helper">
              <input v-model="atelierSettings.facturation.afficherLogo" type="checkbox" :disabled="!settingsCanEdit" />
              Afficher le logo sur la facture
            </label>
          </div>
        </article>

        <article v-show="settingsActiveTab === 'securite'" id="settings-securite" class="panel settings-section" role="tabpanel">
          <h3>Module Securite</h3>
          <p class="helper">Gestion dynamique des utilisateurs, roles et permissions.</p>
          <p v-if="!canAccessSecurityModule" class="helper">Acces reserve aux comptes avec permission de gestion des utilisateurs.</p>
          <p v-if="securityError" class="auth-error">{{ securityError }}</p>

          <template v-if="canAccessSecurityModule">
            <article class="panel nested-panel">
              <div class="panel-header detail-panel-header">
                <h4>Creer un utilisateur</h4>
              </div>
              <div class="settings-grid">
                <div class="stack-form">
                  <label>Nom complet</label>
                  <input v-model="securityNewUser.nom" type="text" />
                </div>
                <div class="stack-form">
                  <label>Email</label>
                  <input v-model="securityNewUser.email" type="email" />
                </div>
                <div class="stack-form">
                  <label>Mot de passe</label>
                  <input v-model="securityNewUser.motDePasse" type="password" />
                </div>
                <div class="stack-form">
                  <label>Role</label>
                  <select v-model="securityNewUser.roleId">
                    <option v-for="role in securityRoleOptions" :key="`new-role-${role.value}`" :value="role.value">{{ role.label }}</option>
                  </select>
                </div>
                <label class="helper">
                  <input v-model="securityNewUser.actif" type="checkbox" />
                  Compte actif
                </label>
              </div>
              <div class="row-actions">
                <button class="action-btn blue" :disabled="securitySaving" @click="createSecurityUser">
                  {{ securitySaving ? "Traitement..." : "Creer utilisateur" }}
                </button>
              </div>
            </article>

            <article class="panel nested-panel">
              <div class="panel-header detail-panel-header">
                <h4>Utilisateurs</h4>
                <button class="mini-btn" :disabled="securityLoading" @click="loadSecurityModule">Actualiser</button>
              </div>
              <div class="settings-grid security-users-filters">
                <div class="stack-form">
                  <label>Recherche</label>
                  <input v-model="securityUserQuery" type="text" placeholder="Nom, email, role..." />
                </div>
                <div class="stack-form">
                  <label>Role</label>
                  <select v-model="securityUserRoleFilter">
                    <option value="ALL">Tous les roles</option>
                    <option v-for="role in securityRoleOptions" :key="`filter-role-${role.value}`" :value="role.value">{{ role.label }}</option>
                  </select>
                </div>
                <div class="stack-form">
                  <label>Statut</label>
                  <select v-model="securityUserStatusFilter">
                    <option value="ALL">Tous les statuts</option>
                    <option value="ACTIVE">Actifs</option>
                    <option value="DISABLED">Desactives</option>
                  </select>
                </div>
              </div>
              <div class="table-scroll-x">
                <table class="data-table compact">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Statut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in securityUsersPaged" :key="user.id">
                      <td><input v-model="user.nom" type="text" /></td>
                      <td>{{ user.email }}</td>
                      <td>
                        <select v-model="user.roleId">
                          <option v-for="role in securityRoleOptions" :key="`user-role-${user.id}-${role.value}`" :value="role.value">
                            {{ role.label }}
                          </option>
                        </select>
                      </td>
                      <td>
                        <span class="status-pill" :data-tone="user.actif ? 'ok' : 'due'">
                          {{ user.actif ? "ACTIF" : "DESACTIVE" }}
                        </span>
                      </td>
                      <td>
                        <button class="mini-btn" :disabled="securitySaving" @click="saveSecurityUser(user)">Sauver</button>
                        <button class="mini-btn" :disabled="securitySaving || user.id === authUser?.id" @click="toggleSecurityUserActivation(user)">
                          {{ user.actif ? "Desactiver" : "Activer" }}
                        </button>
                      </td>
                    </tr>
                    <tr v-if="securityUsersFiltered.length === 0">
                      <td colspan="5">Aucun utilisateur.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ResponsivePagination
                :page="securityUsersPagination.page"
                :pages="securityUsersPages"
                :page-size="securityUsersPagination.pageSize"
                :page-size-options="[5, 10, 20, 50]"
                :prev-disabled="securityUsersPagination.page <= 1"
                :next-disabled="securityUsersPagination.page >= securityUsersPages"
                :desktop-summary="`Page ${securityUsersPagination.page} / ${securityUsersPages} · ${securityUsersFiltered.length} utilisateur(s)`"
                @update:page-size="securityUsersPagination.pageSize = $event"
                @prev="securityUsersPagination.page -= 1"
                @next="securityUsersPagination.page += 1"
              />
            </article>

            <article class="panel nested-panel">
              <div class="panel-header detail-panel-header">
                <h4>Permissions par role</h4>
              </div>
              <div class="settings-grid">
                <article class="panel nested-panel" v-for="role in securityRoleOptions" :key="`role-perm-${role.value}`">
                  <h4>{{ role.label }}</h4>
                  <p v-if="role.value === 'PROPRIETAIRE'" class="helper">
                    Les permissions critiques restent verrouillees pour garantir la reprise en main de l'atelier.
                  </p>
                  <div class="settings-roles">
                    <label class="helper" v-for="perm in securityPermissionOptions" :key="`perm-${role.value}-${perm}`">
                      <input
                        type="checkbox"
                        :checked="roleHasPermission(role.value, perm)"
                        :disabled="securitySaving || isRolePermissionLocked(role.value, perm)"
                        @change="setRolePermission(role.value, perm, $event.target.checked)"
                      />
                      {{ securityPermissionLabels[perm] }}{{ isRolePermissionLocked(role.value, perm) ? " (critique verrouillee)" : "" }}
                    </label>
                  </div>
                  <div class="row-actions">
                    <button class="mini-btn" :disabled="securitySaving" @click="saveRolePermissions(role.value)">Enregistrer permissions</button>
                  </div>
                </article>
              </div>
            </article>
          </template>
        </article>

        <article v-if="!isMobileViewport" class="panel settings-sticky-actions">
          <span class="helper">Fin de page</span>
          <div class="row-actions">
            <span class="status-pill" :data-tone="settingsCanEdit ? 'ok' : 'due'">
              {{ settingsCanEdit ? "Edition active" : "Lecture seule" }}
            </span>
            <button class="mini-btn" :disabled="settingsSaving" @click="toggleSettingsEdit">
              {{ settingsCanEdit ? "Verrouiller" : "Activer modifications" }}
            </button>
            <button class="action-btn blue" :disabled="!settingsCanEdit || settingsSaving" @click="saveAtelierSettings">
              {{ settingsSaving ? "Sauvegarde..." : "Sauvegarder" }}
            </button>
          </div>
        </article>
        <template #action>
          <MobilePrimaryActionBar
            v-if="isMobileViewport && settingsCanEdit"
            title="Action principale"
            subtitle="Enregistrez les changements de configuration de l'atelier."
          >
            <button class="action-btn blue" :disabled="settingsSaving" @click="saveAtelierSettings">
              {{ settingsSaving ? "Sauvegarde..." : "Sauvegarder" }}
            </button>
          </MobilePrimaryActionBar>
        </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'facture-detail'" class="commande-detail">
        <MobilePageLayout :has-action="isMobileViewport && !!factureDetailPrimaryAction">
          <template #header>
            <article class="panel panel-header detail-header">
              <MobileSectionHeader
                eyebrow="Facture"
                title="Detail facture"
                :subtitle="detailFacture ? `N${detailFacture.numeroFacture}` : 'Consultez la facture et ses lignes en lecture seule.'"
              />
              <div class="row-actions">
                <button class="mini-btn" @click="openRoute('facturation')">Retour</button>
                <button class="mini-btn" v-if="detailFacture" @click="onOuvrirOrigineFacture(detailFacture)">Voir origine</button>
                <button v-if="!isMobileViewport && detailFacture" class="action-btn blue" @click="onGenererPdfFacture(detailFacture)">Generer PDF</button>
                <button
                  :class="isMobileViewport ? 'mini-btn' : 'action-btn green'"
                  v-if="detailFacture"
                  @click="onImprimerFacture(detailFacture)"
                >
                  {{ isMobileViewport ? "Telecharger impression" : "Imprimer" }}
                </button>
              </div>
            </article>
          </template>

          <ResponsiveDataContainer v-if="detailFactureError" :mobile="isMobileViewport">
            <template #mobile>
              <MobileStateError title="Erreur detail facture" :description="detailFactureError" />
            </template>
            <template #desktop>
              <article class="panel error-panel">
                <strong>Erreur detail facture</strong>
                <p>{{ detailFactureError }}</p>
              </article>
            </template>
          </ResponsiveDataContainer>

          <ResponsiveDataContainer v-else-if="detailFactureLoading" :mobile="isMobileViewport">
            <template #mobile>
              <MobileStateLoading title="Chargement de la facture" description="Preparation des informations detaillees..." />
            </template>
            <template #desktop>
              <article class="panel">
                <p>Chargement de la facture...</p>
              </article>
            </template>
          </ResponsiveDataContainer>

          <template v-else-if="detailFacture">
            <ResponsiveDataContainer :mobile="isMobileViewport">
              <template #mobile>
                <FactureDetailOverviewCards
                  :facture="detailFacture"
                  :atelier-profile="factureAtelierProfile"
                  :atelier-contact-line="factureAtelierContactLine"
                  :format-currency="formatFactureCurrency"
                  :format-date="formatDateShort"
                />
              </template>
              <template #desktop>
                <article class="panel detail-grid">
                  <div>
                    <h4>Atelier</h4>
                    <img
                      v-if="factureAtelierProfile.afficherLogo && factureAtelierProfile.logo"
                      :src="factureAtelierProfile.logo"
                      alt="Logo atelier"
                      class="facture-atelier-logo"
                    />
                    <p><strong>{{ factureAtelierProfile.nomAtelier || "-" }}</strong></p>
                    <p v-if="factureAtelierProfile.adresse">{{ factureAtelierProfile.adresse }}</p>
                    <p v-if="factureAtelierContactLine">{{ factureAtelierContactLine }}</p>
                    <p><strong>Devise:</strong> {{ factureAtelierProfile.devise || "-" }}</p>
                    <p v-if="factureAtelierProfile.mentions"><strong>Mentions:</strong> {{ factureAtelierProfile.mentions }}</p>
                  </div>
                  <div>
                    <h4>En-tete</h4>
                    <p><strong>Numero:</strong> {{ detailFacture.numeroFacture }}</p>
                    <p><strong>Date emission:</strong> {{ formatDateShort(detailFacture.dateEmission) }}</p>
                    <p><strong>Client:</strong> {{ detailFacture.client?.nom || "-" }}</p>
                    <p><strong>Contact:</strong> {{ detailFacture.client?.contact || "-" }}</p>
                    <p><strong>Origine:</strong> {{ detailFacture.typeOrigine }} / {{ detailFacture.idOrigine }}</p>
                    <p><strong>Reference caisse:</strong> {{ detailFacture.referenceCaisse || "-" }}</p>
                  </div>
                  <div>
                    <h4>Resume financier</h4>
                    <p><strong>Total:</strong> {{ formatFactureCurrency(detailFacture.montantTotal) }}</p>
                    <p><strong>Paye:</strong> {{ formatFactureCurrency(detailFacture.montantPaye) }}</p>
                    <p><strong>Solde:</strong> {{ formatFactureCurrency(detailFacture.solde) }}</p>
                    <p><strong>Statut:</strong> {{ detailFacture.statut }}</p>
                  </div>
                </article>
              </template>
            </ResponsiveDataContainer>

            <ResponsiveDataContainer :mobile="isMobileViewport">
              <template #mobile>
                <article class="panel">
                  <MobileSectionHeader
                    title="Lignes facture"
                    subtitle="Lecture detaillee des lignes de facturation."
                  />
                  <FactureDetailLinesMobileList
                    :items="detailFacture.lignes"
                    :format-currency="formatFactureCurrency"
                  />
                </article>
              </template>
              <template #desktop>
                <article class="panel">
                  <div class="panel-header detail-panel-header">
                    <h4>Lignes facture</h4>
                    <span class="helper">Lecture seule</span>
                  </div>
                  <table class="data-table mobile-stack-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Quantite</th>
                        <th>Prix</th>
                        <th>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(ligne, index) in detailFacture.lignes" :key="`${detailFacture.idFacture}-${index}`">
                        <td data-label="Description">{{ ligne.description }}</td>
                        <td data-label="Quantite">{{ ligne.quantite }}</td>
                        <td data-label="Prix">{{ formatFactureCurrency(ligne.prix) }}</td>
                        <td data-label="Montant">{{ formatFactureCurrency(ligne.montant) }}</td>
                      </tr>
                      <tr v-if="detailFacture.lignes.length === 0">
                        <td colspan="4">Aucune ligne.</td>
                      </tr>
                    </tbody>
                  </table>
                </article>
              </template>
            </ResponsiveDataContainer>
          </template>

          <template #action>
            <MobilePrimaryActionBar
              v-if="isMobileViewport && factureDetailPrimaryAction"
              title="Action principale"
              :subtitle="factureDetailPrimaryAction.subtitle"
            >
              <button class="action-btn blue" @click="factureDetailPrimaryAction.handler">
                {{ factureDetailPrimaryAction.label }}
              </button>
            </MobilePrimaryActionBar>
          </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'caisse'" class="commande-detail">
        <MobilePageLayout :has-action="isMobileViewport && ((!caisseOuverte && canOpenCaisse) || (caisseOuverte && canRecordCaisseExpense) || (caisseOuverte && !canRecordCaisseExpense && canCloseCaisse))">
        <article class="panel panel-header detail-header" :class="{ 'caisse-header-closed': !caisseOuverte }">
          <div>
            <h3>Caisse du jour</h3>
            <p class="helper" v-if="caisseJour">ID: {{ caisseJour.idCaisseJour }} · Date: {{ caisseJour.date }}</p>
          </div>
          <div class="row-actions">
            <span class="status-pill" :data-status="caisseStatus">
              <svg v-if="!caisseOuverte" class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path v-for="(path, i) in iconPaths.lock" :key="`lock-${i}`" :d="path" />
              </svg>
              {{ caisseStatus }}
            </span>
            <button class="action-btn green" v-if="!isMobileViewport && !caisseOuverte && canOpenCaisse" @click="onOuvrirCaisseDuJour">Ouvrir la caisse</button>
            <button class="action-btn amber" v-if="!isMobileViewport && caisseOuverte && canRecordCaisseExpense" @click="onDepenseCaisse">Enregistrer depense</button>
            <button class="action-btn red" v-if="!isMobileViewport && caisseOuverte && canCloseCaisse" @click="onCloturerCaisse">Cloturer la caisse</button>
            <button class="mini-btn" v-if="isMobileViewport && caisseOuverte && canCloseCaisse" @click="onCloturerCaisse">Cloturer</button>
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
            <button class="action-btn green" @click="onOuvrirCaisseDuJour">Ouvrir la caisse</button>
          </MobilePrimaryActionBar>

          <MobilePrimaryActionBar
            v-else-if="isMobileViewport && caisseOuverte && canRecordCaisseExpense"
            title="Action principale"
            subtitle="Enregistrez rapidement une depense sur la caisse ouverte."
          >
            <button class="action-btn amber" @click="onDepenseCaisse">Enregistrer depense</button>
          </MobilePrimaryActionBar>

          <MobilePrimaryActionBar
            v-else-if="isMobileViewport && caisseOuverte && !canRecordCaisseExpense && canCloseCaisse"
            title="Action principale"
            subtitle="Cloturez la caisse lorsque les operations sont terminees."
          >
            <button class="action-btn red" @click="onCloturerCaisse">Cloturer la caisse</button>
          </MobilePrimaryActionBar>
        </template>
        </MobilePageLayout>
      </section>

        <section v-else-if="currentRoute === 'audit'" class="commande-detail">
        <article class="panel panel-header detail-header">
          <div>
            <h3>{{ currentAuditRoute.title }}</h3>
            <p class="helper">Lecture seule - {{ currentAuditRoute.subtitle }}</p>
          </div>
          <div class="row-actions">
            <button v-if="auditSubRoute !== '/audit'" class="mini-btn" @click="navigateAudit('/audit')">Retour au hub</button>
            <span class="status-pill" data-tone="ok">Audit</span>
          </div>

        </article>

        <article v-if="auditError" class="panel error-panel">
          <strong>Erreur audit</strong>
          <p>{{ auditError }}</p>
        </article>

        <article v-if="auditLoading" class="panel">
          <p>Chargement de l'audit...</p>
        </article>

        <template v-else-if="auditSubRoute === '/audit'">
          <div class="audit-hub-grid">
            <article v-if="canAccessAuditPath('/audit/caisse')" class="panel audit-hub-card">
              <h4>Audit de la Caisse</h4>
              <p class="helper">Bilans financiers - Journaliers - Hebdomadaires - Mensuels</p>
              <div class="audit-metrics">
                <p><strong>Caisses cloturees:</strong> {{ auditHubMetrics.caissesCloturees }}</p>
                <p><strong>Dernier solde cloture:</strong> {{ formatCurrency(auditHubMetrics.dernierSoldeCloture) }}</p>
                <p><strong>Mois courant:</strong> {{ auditHubMetrics.moisCourant }}</p>
              </div>
              <button class="action-btn blue" @click="navigateAudit('/audit/caisse')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/operations')" class="panel audit-hub-card">
              <h4>Audit des Operations</h4>
              <p class="helper">Journal global de toutes les operations financieres</p>
              <div class="audit-metrics">
                <p><strong>Total operations:</strong> {{ auditHubMetrics.totalOperations }}</p>
                <p><strong>Montant cumule:</strong> {{ formatCurrency(auditHubMetrics.montantCumule) }}</p>
              </div>
              <button class="action-btn blue" @click="navigateAudit('/audit/operations')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/commandes')" class="panel audit-hub-card">
              <h4>Audit des Commandes</h4>
              <p class="helper">Historique des commandes, paiements, livraisons et annulations</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/commandes')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/retouches')" class="panel audit-hub-card">
              <h4>Audit des Retouches</h4>
              <p class="helper">Historique des retouches, paiements et livraisons</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/retouches')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/stock-ventes')" class="panel audit-hub-card">
              <h4>Audit Stock & Ventes</h4>
              <p class="helper">Ventes, sorties stock et liens avec la caisse</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/stock-ventes')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/factures')" class="panel audit-hub-card">
              <h4>Audit Factures</h4>
              <p class="helper">Factures emises, lecture seule et statut derive des paiements caisse</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/factures')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/utilisateurs')" class="panel audit-hub-card">
              <h4>Audit Utilisateurs</h4>
              <p class="helper">Actions de securite: comptes, activations, roles et permissions</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/utilisateurs')">Voir</button>
            </article>

            <article v-if="canAccessAuditPath('/audit/annuel')" class="panel audit-hub-card">
              <h4>Audit Annuel (prevu)</h4>
              <p class="helper">Consolidation annuelle et comparaison des bilans</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/annuel')">Voir</button>
            </article>
          </div>
        </template>

        <template v-else-if="auditSubRoute === '/audit/caisse'">
          <article class="panel">
            <template v-if="isMobileViewport">
              <MobileSectionHeader
                title="Bilans journaliers"
                subtitle="Lecture rapide des ouvertures, clotures et soldes journaliers."
              />
              <AuditCaisseDailyMobileList
                :items="auditCaisseJournalierPaged"
                :format-currency="formatCurrency"
                :format-weekday="formatWeekdayFr"
              />
            </template>
            <template v-else>
              <h3>Bilans journaliers</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date ouverture</th>
                    <th>Heure ouverture</th>
                    <th>Date cloture</th>
                    <th>Heure cloture</th>
                    <th>Jour</th>
                    <th>Solde ouverture</th>
                    <th>Total entrees</th>
                    <th>Total sorties</th>
                    <th>Resultat journalier</th>
                    <th>Solde journalier restant</th>
                    <th>Solde cloture</th>
                    <th>Nb operations</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in auditCaisseJournalierPaged" :key="row.id_caisse_jour">
                    <td>{{ row.date_ouverture ? row.date_ouverture.slice(0, 10) : "-" }}</td>
                    <td>{{ row.heure_ouverture || "-" }}</td>
                    <td>{{ row.date_cloture ? row.date_cloture.slice(0, 10) : "-" }}</td>
                    <td>{{ row.heure_cloture || "-" }}</td>
                    <td>{{ formatWeekdayFr(row.jour_semaine) }}</td>
                    <td>{{ formatCurrency(row.solde_ouverture) }}</td>
                    <td>{{ formatCurrency(row.total_entrees) }}</td>
                    <td>{{ formatCurrency(row.total_sorties) }}</td>
                    <td>{{ formatCurrency(row.resultat_journalier) }}</td>
                    <td>{{ formatCurrency(row.solde_journalier_restant) }}</td>
                    <td>{{ formatCurrency(row.solde_cloture) }}</td>
                    <td>{{ row.nombre_operations }}</td>
                  </tr>
                  <tr v-if="auditCaisseJournalier.length === 0">
                    <td colspan="12">Aucune caisse cloturee.</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <ResponsivePagination
              :page="auditCaisseJournalierPagination.page"
              :pages="auditCaisseJournalierPages"
              :page-size="auditCaisseJournalierPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="auditCaisseJournalierPagination.page <= 1"
              :next-disabled="auditCaisseJournalierPagination.page >= auditCaisseJournalierPages"
              @update:page-size="auditCaisseJournalierPagination.pageSize = $event"
              @prev="auditCaisseJournalierPagination.page -= 1"
              @next="auditCaisseJournalierPagination.page += 1"
            />
          </article>

          <article class="panel">
            <template v-if="isMobileViewport">
              <MobileSectionHeader
                title="Bilans hebdomadaires"
                subtitle="Vision compacte des soldes et mouvements par semaine."
              />
              <AuditCaissePeriodMobileList
                :items="bilanHebdoPaged"
                :format-currency="formatCurrency"
                mode="weekly"
              />
            </template>
            <template v-else>
              <h3>Bilans hebdomadaires</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Semaine</th>
                    <th>Solde debut</th>
                    <th>Total entrees</th>
                    <th>Total sorties</th>
                    <th>Solde fin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in bilanHebdoPaged" :key="row.id_bilan">
                    <td>{{ row.date_debut }} -> {{ row.date_fin }}</td>
                    <td>{{ formatCurrency(row.solde_ouverture) }}</td>
                    <td>{{ formatCurrency(row.total_entrees) }}</td>
                    <td>{{ formatCurrency(row.total_sorties) }}</td>
                    <td>{{ formatCurrency(row.solde_cloture) }}</td>
                  </tr>
                  <tr v-if="bilanHebdo.length === 0">
                    <td colspan="5">Aucun bilan hebdomadaire.</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <ResponsivePagination
              :page="bilanHebdoPagination.page"
              :pages="bilanHebdoPages"
              :page-size="bilanHebdoPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="bilanHebdoPagination.page <= 1"
              :next-disabled="bilanHebdoPagination.page >= bilanHebdoPages"
              @update:page-size="bilanHebdoPagination.pageSize = $event"
              @prev="bilanHebdoPagination.page -= 1"
              @next="bilanHebdoPagination.page += 1"
            />
          </article>

          <article class="panel">
            <template v-if="isMobileViewport">
              <MobileSectionHeader
                title="Bilans mensuels"
                subtitle="Lecture compacte des soldes et flux par mois."
              />
              <AuditCaissePeriodMobileList
                :items="bilanMensuelPaged"
                :format-currency="formatCurrency"
                mode="monthly"
              />
            </template>
            <template v-else>
              <h3>Bilans mensuels</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Mois / Annee</th>
                    <th>Solde debut</th>
                    <th>Entrees</th>
                    <th>Sorties</th>
                    <th>Solde fin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in bilanMensuelPaged" :key="row.id_bilan">
                    <td>{{ row.date_debut }} -> {{ row.date_fin }}</td>
                    <td>{{ formatCurrency(row.solde_ouverture) }}</td>
                    <td>{{ formatCurrency(row.total_entrees) }}</td>
                    <td>{{ formatCurrency(row.total_sorties) }}</td>
                    <td>{{ formatCurrency(row.solde_cloture) }}</td>
                  </tr>
                  <tr v-if="bilanMensuel.length === 0">
                    <td colspan="5">Aucun bilan mensuel.</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <ResponsivePagination
              :page="bilanMensuelPagination.page"
              :pages="bilanMensuelPages"
              :page-size="bilanMensuelPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="bilanMensuelPagination.page <= 1"
              :next-disabled="bilanMensuelPagination.page >= bilanMensuelPages"
              @update:page-size="bilanMensuelPagination.pageSize = $event"
              @prev="bilanMensuelPagination.page -= 1"
              @next="bilanMensuelPagination.page += 1"
            />
          </article>

          <article class="panel">
            <template v-if="isMobileViewport">
              <MobileSectionHeader
                title="Bilans annuels"
                subtitle="Synthese annuelle des entrees, sorties et soldes de cloture."
              />
              <AuditCaissePeriodMobileList
                :items="bilanAnnuelPaged"
                :format-currency="formatCurrency"
                mode="annual"
              />
            </template>
            <template v-else>
              <h3>Bilans annuels</h3>
              <table class="data-table mobile-stack-table">
                <thead>
                  <tr>
                    <th>Annee</th>
                    <th>Periode</th>
                    <th>Solde debut</th>
                    <th>Entrees</th>
                    <th>Sorties</th>
                    <th>Solde fin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in bilanAnnuelPaged" :key="row.id_bilan">
                    <td data-label="Annee">{{ row.annee || "-" }}</td>
                    <td data-label="Periode">{{ row.date_debut }} -> {{ row.date_fin }}</td>
                    <td data-label="Solde debut">{{ formatCurrency(row.solde_ouverture) }}</td>
                    <td data-label="Entrees">{{ formatCurrency(row.total_entrees) }}</td>
                    <td data-label="Sorties">{{ formatCurrency(row.total_sorties) }}</td>
                    <td data-label="Solde fin">{{ formatCurrency(row.solde_cloture) }}</td>
                  </tr>
                  <tr v-if="bilanAnnuel.length === 0">
                    <td colspan="6">Aucun bilan annuel.</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <ResponsivePagination
              :page="bilanAnnuelPagination.page"
              :pages="bilanAnnuelPages"
              :page-size="bilanAnnuelPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="bilanAnnuelPagination.page <= 1"
              :next-disabled="bilanAnnuelPagination.page >= bilanAnnuelPages"
              @update:page-size="bilanAnnuelPagination.pageSize = $event"
              @prev="bilanAnnuelPagination.page -= 1"
              @next="bilanAnnuelPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/operations'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Journal financier global"
                  :subtitle="`${auditOperations.length} operation(s) enregistree(s)`"
                />
                <AuditOperationMobileList
                  :items="auditOperationsPaged"
                  :format-currency="formatCurrency"
                  :format-date-time="formatDateTime"
                  :operation-audit-type="operationAuditType"
                  :depense-type-label="depenseTypeLabel"
                />
              </template>

              <template #desktop>
                <h3>Journal financier global</h3>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date & heure</th>
                      <th>Type d'operation</th>
                      <th>Montant</th>
                      <th>Type depense</th>
                      <th>Mode de paiement</th>
                      <th>Justification</th>
                      <th>Impact journalier</th>
                      <th>Impact global</th>
                      <th>Utilisateur</th>
                      <th>Reference metier</th>
                      <th>Reference caisse</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="op in auditOperationsPaged" :key="op.id_operation">
                      <td>{{ formatDateTime(op.date_operation) }}</td>
                      <td>{{ operationAuditType(op) }}</td>
                      <td>{{ formatCurrency(op.montant) }}</td>
                      <td>
                        <span v-if="op.type_operation === 'SORTIE'" class="status-pill" :data-tone="op.type_depense === 'EXCEPTIONNELLE' ? 'amber' : 'blue'">
                          {{ depenseTypeLabel(op.type_depense) }}
                        </span>
                        <span v-else>-</span>
                      </td>
                      <td>{{ op.mode_paiement || "-" }}</td>
                      <td>{{ op.justification || "-" }}</td>
                      <td>{{ op.impact_journalier === true ? "Oui" : "Non" }}</td>
                      <td>{{ op.impact_global === false ? "Non" : "Oui" }}</td>
                      <td>{{ op.effectue_par || "-" }}</td>
                      <td>{{ op.reference_metier || "-" }}</td>
                      <td>{{ op.id_caisse_jour || "-" }}</td>
                    </tr>
                    <tr v-if="auditOperations.length === 0">
                      <td colspan="11">Aucune operation.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="auditOperationsPagination.page"
              :pages="auditOperationsPages"
              :page-size="auditOperationsPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="auditOperationsPagination.page <= 1"
              :next-disabled="auditOperationsPagination.page >= auditOperationsPages"
              @update:page-size="auditOperationsPagination.pageSize = $event"
              @prev="auditOperationsPagination.page -= 1"
              @next="auditOperationsPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/commandes'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Historique commandes"
                  :subtitle="`${auditCommandes.length} commande(s) dans l'audit`"
                />
                <AuditCommandeMobileList
                  :items="auditCommandesPaged"
                  :format-currency="formatCurrency"
                  @view="openCommandeDetail($event.idCommande)"
                />
              </template>

              <template #desktop>
                <h3>Historique commandes</h3>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Client</th>
                      <th>Description</th>
                      <th>Statut</th>
                      <th>Montant total</th>
                      <th>Montant paye</th>
                      <th>Total paiements</th>
                      <th>Nb paiements</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in auditCommandesPaged" :key="row.idCommande">
                      <td>{{ row.idCommande }}</td>
                      <td>{{ row.clientNom || row.idClient }}</td>
                      <td>{{ row.descriptionCommande }}</td>
                      <td>{{ row.statutCommande }}</td>
                      <td>{{ formatCurrency(row.montantTotal) }}</td>
                      <td>{{ formatCurrency(row.montantPaye) }}</td>
                      <td>{{ formatCurrency(row.totalPaiements) }}</td>
                      <td>{{ row.nombrePaiements }}</td>
                      <td><button class="mini-btn" @click="openCommandeDetail(row.idCommande)">Voir detail</button></td>
                    </tr>
                    <tr v-if="auditCommandes.length === 0">
                      <td colspan="9">Aucune commande.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="auditCommandesPagination.page"
              :pages="auditCommandesPages"
              :page-size="auditCommandesPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="auditCommandesPagination.page <= 1"
              :next-disabled="auditCommandesPagination.page >= auditCommandesPages"
              @update:page-size="auditCommandesPagination.pageSize = $event"
              @prev="auditCommandesPagination.page -= 1"
              @next="auditCommandesPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/retouches'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Historique retouches"
                  :subtitle="`${auditRetouches.length} retouche(s) dans l'audit`"
                />
                <AuditRetoucheMobileList
                  :items="auditRetouchesPaged"
                  :format-currency="formatCurrency"
                  @view="openRetoucheDetail($event.idRetouche)"
                />
              </template>

              <template #desktop>
                <h3>Historique retouches</h3>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Client</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Statut</th>
                      <th>Montant total</th>
                      <th>Montant paye</th>
                      <th>Total paiements</th>
                      <th>Nb paiements</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in auditRetouchesPaged" :key="row.idRetouche">
                      <td>{{ row.idRetouche }}</td>
                      <td>{{ row.clientNom || row.idClient }}</td>
                      <td>{{ row.typeRetouche || "-" }}</td>
                      <td>{{ row.descriptionRetouche }}</td>
                      <td>{{ row.statutRetouche }}</td>
                      <td>{{ formatCurrency(row.montantTotal) }}</td>
                      <td>{{ formatCurrency(row.montantPaye) }}</td>
                      <td>{{ formatCurrency(row.totalPaiements) }}</td>
                      <td>{{ row.nombrePaiements }}</td>
                      <td><button class="mini-btn" @click="openRetoucheDetail(row.idRetouche)">Voir detail</button></td>
                    </tr>
                    <tr v-if="auditRetouches.length === 0">
                      <td colspan="10">Aucune retouche.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="auditRetouchesPagination.page"
              :pages="auditRetouchesPages"
              :page-size="auditRetouchesPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="auditRetouchesPagination.page <= 1"
              :next-disabled="auditRetouchesPagination.page >= auditRetouchesPages"
              @update:page-size="auditRetouchesPagination.pageSize = $event"
              @prev="auditRetouchesPagination.page -= 1"
              @next="auditRetouchesPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/stock-ventes'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Ventes & sorties stock"
                  :subtitle="`${auditStockVentes.length} mouvement(s) dans l'audit`"
                />
                <AuditStockVenteMobileList
                  :items="auditStockVentesPaged"
                  :format-currency="formatCurrency"
                  :format-date-time="formatDateTime"
                  @view="openVenteDetail($event.referenceMetier)"
                />
              </template>

              <template #desktop>
                <h3>Ventes & sorties stock</h3>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Article</th>
                      <th>Quantite</th>
                      <th>Montant</th>
                      <th>Ref caisse</th>
                      <th>Utilisateur</th>
                      <th>Reference metier</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in auditStockVentesPaged" :key="row.idMouvement">
                      <td>{{ formatDateTime(row.dateMouvement) }}</td>
                      <td>{{ row.nomArticle || row.idArticle }}</td>
                      <td>{{ row.quantite }}</td>
                      <td>{{ formatCurrency(row.montantEncaisse === null ? row.montantEstime : row.montantEncaisse) }}</td>
                      <td>{{ row.idCaisseJour || "-" }}</td>
                      <td>{{ row.utilisateur || "-" }}</td>
                      <td>
                        <div class="row-actions">
                          <span class="status-pill" data-tone="ok" v-if="row.referenceMetier && String(row.referenceMetier).startsWith('VTE-')">
                            VENTE
                          </span>
                          <span>{{ row.referenceMetier || "-" }}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          v-if="row.referenceMetier && String(row.referenceMetier).startsWith('VTE-')"
                          class="mini-btn"
                          @click="openVenteDetail(row.referenceMetier)"
                        >
                          Voir vente
                        </button>
                      </td>
                    </tr>
                    <tr v-if="auditStockVentes.length === 0">
                      <td colspan="8">Aucune vente/sortie stock.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="auditStockVentesPagination.page"
              :pages="auditStockVentesPages"
              :page-size="auditStockVentesPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="auditStockVentesPagination.page <= 1"
              :next-disabled="auditStockVentesPagination.page >= auditStockVentesPages"
              @update:page-size="auditStockVentesPagination.pageSize = $event"
              @prev="auditStockVentesPagination.page -= 1"
              @next="auditStockVentesPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/factures'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Historique factures"
                  :subtitle="`${auditFactures.length} facture(s) dans l'audit`"
                />
                <p class="helper">Documents emis, immuables et auditable en lecture seule.</p>
                <AuditFactureMobileList
                  :items="auditFacturesPaged"
                  :format-currency="formatFactureCurrency"
                  :format-date="formatDateShort"
                />
              </template>

              <template #desktop>
                <h3>Historique factures</h3>
                <p class="helper">Documents emis, immuables et auditable en lecture seule.</p>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Client</th>
                      <th>Origine</th>
                      <th>Date emission</th>
                      <th>Total</th>
                      <th>Paye</th>
                      <th>Solde</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in auditFacturesPaged" :key="row.idFacture">
                      <td>{{ row.numeroFacture }}</td>
                      <td>{{ row.client?.nom || "-" }}</td>
                      <td>{{ row.typeOrigine }} / {{ row.idOrigine }}</td>
                      <td>{{ formatDateShort(row.dateEmission) }}</td>
                      <td>{{ formatFactureCurrency(row.montantTotal) }}</td>
                      <td>{{ formatFactureCurrency(row.montantPaye) }}</td>
                      <td>{{ formatFactureCurrency(row.solde) }}</td>
                      <td>{{ row.statut }}</td>
                    </tr>
                    <tr v-if="auditFactures.length === 0">
                      <td colspan="8">Aucune facture.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="auditFacturesPagination.page"
              :pages="auditFacturesPages"
              :page-size="auditFacturesPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="auditFacturesPagination.page <= 1"
              :next-disabled="auditFacturesPagination.page >= auditFacturesPages"
              @update:page-size="auditFacturesPagination.pageSize = $event"
              @prev="auditFacturesPagination.page -= 1"
              @next="auditFacturesPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/utilisateurs'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Audit Utilisateurs"
                  :subtitle="`${auditUtilisateursFiltered.length} evenement(s) utilisateur(s)`"
                />
                <MobileFilterBlock
                  title="Filtres utilisateurs"
                  :summary="auditUtilisateursFilterSummary"
                  :open="auditUtilisateursMobileFiltersOpen"
                  @toggle="auditUtilisateursMobileFiltersOpen = !auditUtilisateursMobileFiltersOpen"
                >
                  <div class="filters compact">
                    <input v-model="auditUtilisateursFiltres.recherche" type="text" placeholder="Utilisateur, action, entite..." />
                    <select v-model="auditUtilisateursFiltres.action">
                      <option v-for="action in auditUtilisateursActions" :key="`audit-user-action-${action}`" :value="action">
                        {{ action === "ALL" ? "Toutes les actions" : formatAuditAction({ actionType: action, entityId: "", metadata: null }) }}
                      </option>
                    </select>
                    <select v-model="auditUtilisateursFiltres.statut">
                      <option value="ALL">Tous</option>
                      <option value="SUCCES">Succes</option>
                      <option value="ECHEC">Echec</option>
                    </select>
                  </div>
                </MobileFilterBlock>
                <AuditUtilisateurMobileList
                  :items="auditUtilisateursPaged"
                  :format-date-time="formatDateTime"
                  :format-audit-action="formatAuditAction"
                  :format-role-label="formatRoleLabel"
                  :format-audit-entity="formatAuditEntity"
                  :format-audit-status="formatAuditStatus"
                  :has-audit-metadata="hasAuditMetadata"
                  :audit-metadata-json="auditMetadataJson"
                  :audit-user-diff-rows="auditUserDiffRows"
                />
              </template>

              <template #desktop>
                <h3>Audit Utilisateurs</h3>
                <div class="settings-grid">
                  <div class="stack-form">
                    <label>Recherche</label>
                    <input v-model="auditUtilisateursFiltres.recherche" type="text" placeholder="Utilisateur, action, entite..." />
                  </div>
                  <div class="stack-form">
                    <label>Action</label>
                    <select v-model="auditUtilisateursFiltres.action">
                      <option v-for="action in auditUtilisateursActions" :key="`audit-user-action-${action}`" :value="action">
                        {{ action === "ALL" ? "Toutes les actions" : formatAuditAction({ actionType: action, entityId: "", metadata: null }) }}
                      </option>
                    </select>
                  </div>
                  <div class="stack-form">
                    <label>Statut</label>
                    <select v-model="auditUtilisateursFiltres.statut">
                      <option value="ALL">Tous</option>
                      <option value="SUCCES">Succes</option>
                      <option value="ECHEC">Echec</option>
                    </select>
                  </div>
                </div>
                <table class="data-table mobile-stack-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Utilisateur</th>
                      <th>Role</th>
                      <th>Cible</th>
                      <th>Statut</th>
                      <th>Raison</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in auditUtilisateursPaged" :key="row.idEvenement">
                      <td data-label="Date">{{ formatDateTime(row.createdAt) }}</td>
                      <td data-label="Description">{{ formatAuditAction(row) }}</td>
                      <td data-label="Utilisateur">
                        <div>{{ row.userName || row.userId || "-" }}</div>
                        <small class="helper" v-if="row.userEmail">{{ row.userEmail }}</small>
                      </td>
                      <td data-label="Role">{{ formatRoleLabel(row.role) }}</td>
                      <td data-label="Cible">
                        <div>{{ formatAuditEntity(row) }}</div>
                        <small class="helper" v-if="row.entityType">{{ row.entityType }}</small>
                      </td>
                      <td data-label="Statut">{{ formatAuditStatus(row) }}</td>
                      <td data-label="Raison">{{ row.success ? "-" : (row.reason || "-") }}</td>
                      <td data-label="Details">
                        <details>
                          <summary>Voir details</summary>
                          <div class="audit-user-details">
                            <template v-if="auditUserDiffRows(row.metadata).length > 0">
                              <table class="data-table compact">
                                <thead>
                                  <tr>
                                    <th>Champ</th>
                                    <th>Avant</th>
                                    <th>Apres</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-for="item in auditUserDiffRows(row.metadata)" :key="`${row.idEvenement}-${item.key}`">
                                    <td>{{ item.label }}</td>
                                    <td>{{ item.before }}</td>
                                    <td>{{ item.after }}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </template>
                            <template v-else-if="hasAuditMetadata(row)">
                              <pre>{{ auditMetadataJson(row) }}</pre>
                            </template>
                            <template v-else>
                              <p class="helper">Aucun detail technique pour cet evenement.</p>
                            </template>
                          </div>
                        </details>
                      </td>
                    </tr>
                    <tr v-if="auditUtilisateursFiltered.length === 0">
                      <td colspan="8">Aucun evenement utilisateur.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="auditUtilisateursPagination.page"
              :pages="auditUtilisateursPages"
              :page-size="auditUtilisateursPagination.pageSize"
              :page-size-options="[10, 20, 50, 100]"
              :prev-disabled="auditUtilisateursPagination.page <= 1"
              :next-disabled="auditUtilisateursPagination.page >= auditUtilisateursPages"
              :desktop-summary="`Page ${auditUtilisateursPagination.page} / ${auditUtilisateursPages} · ${auditUtilisateursFiltered.length} evenement(s)`"
              @update:page-size="auditUtilisateursPagination.pageSize = $event"
              @prev="auditUtilisateursPagination.page -= 1"
              @next="auditUtilisateursPagination.page += 1"
            />
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/annuel'">
          <article class="panel">
            <ResponsiveDataContainer>
              <template #mobile>
                <MobileSectionHeader
                  title="Consolidation annuelle"
                  :subtitle="`${bilanAnnuel.length} bilan(s) annuel(s)`"
                />
                <p class="helper">Vue consolidee des bilans annuels de caisse.</p>
                <AuditAnnualMobileList
                  :items="bilanAnnuelPaged"
                  :format-currency="formatCurrency"
                />
              </template>

              <template #desktop>
                <h3>Consolidation annuelle</h3>
                <p class="helper">Vue consolidee des bilans annuels de caisse.</p>
                <table class="data-table mobile-stack-table">
                  <thead>
                    <tr>
                      <th>Annee</th>
                      <th>Periode</th>
                      <th>Solde debut</th>
                      <th>Total entrees</th>
                      <th>Total sorties</th>
                      <th>Solde fin</th>
                      <th>Jours clotures</th>
                      <th>Operations</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in bilanAnnuelPaged" :key="row.id_bilan">
                      <td data-label="Annee">{{ row.annee || "-" }}</td>
                      <td data-label="Periode">{{ row.date_debut }} -> {{ row.date_fin }}</td>
                      <td data-label="Solde debut">{{ formatCurrency(row.solde_ouverture) }}</td>
                      <td data-label="Total entrees">{{ formatCurrency(row.total_entrees) }}</td>
                      <td data-label="Total sorties">{{ formatCurrency(row.total_sorties) }}</td>
                      <td data-label="Solde fin">{{ formatCurrency(row.solde_cloture) }}</td>
                      <td data-label="Jours clotures">{{ row.nombre_jours || 0 }}</td>
                      <td data-label="Operations">{{ row.nombre_operations || 0 }}</td>
                    </tr>
                    <tr v-if="bilanAnnuel.length === 0">
                      <td colspan="8">Aucun bilan annuel disponible.</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ResponsiveDataContainer>
            <ResponsivePagination
              :page="bilanAnnuelPagination.page"
              :pages="bilanAnnuelPages"
              :page-size="bilanAnnuelPagination.pageSize"
              :page-size-options="[10, 20, 50]"
              :prev-disabled="bilanAnnuelPagination.page <= 1"
              :next-disabled="bilanAnnuelPagination.page >= bilanAnnuelPages"
              @update:page-size="bilanAnnuelPagination.pageSize = $event"
              @prev="bilanAnnuelPagination.page -= 1"
              @next="bilanAnnuelPagination.page += 1"
            />
          </article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'forbidden'" class="placeholder">
          <article class="panel error-panel">
            <h3>Acces refuse (403)</h3>
            <p>{{ forbiddenMessage }}</p>
          </article>
        </section>

      </div>
    </main>

    <BottomNav
      v-if="showMobileBottomNav"
      :items="mobileNavItems"
      :current-route="currentRoute"
      :icon-paths="iconPaths"
      @navigate="handlePrimaryNavigation"
    />

    <ScrollTopButton
      v-if="showMobileScrollTopButton"
      label="Revenir en haut"
      direction="up"
      align="right"
      @click="scrollMainContentToTop('smooth')"
    />

    <ScrollTopButton
      v-else-if="showMobileScrollBottomButton"
      direction="down"
      align="center"
      :icon-only="true"
      aria-label="Aller en bas"
      @click="scrollMainContentToBottom('smooth')"
    />

    <MobileMediaViewer
      :open="commandeMediaViewer.open"
      :image-url="commandeMediaViewerImageUrl"
      :title="commandeMediaViewerTitle"
      :subtitle="commandeMediaViewerSubtitle"
      :loading="commandeMediaViewerLoading"
      :can-prev="commandeMediaViewerCanPrev"
      :can-next="commandeMediaViewerCanNext"
      :can-download="Boolean(commandeMediaViewerImageUrl)"
      @close="closeCommandeMediaViewer"
      @prev="showPreviousCommandeMediaInViewer"
      @next="showNextCommandeMediaInViewer"
      @download="downloadCommandeMediaFromViewer"
    />

  <SystemAtelierCreateModal
      :open="systemAtelierModal.open"
      :submitting="systemAtelierModal.submitting"
      :error="systemAtelierModal.error"
      :nom-atelier="systemAtelierModal.nomAtelier"
      :slug="systemAtelierModal.slug"
      :proprietaire-nom="systemAtelierModal.proprietaireNom"
      :proprietaire-email="systemAtelierModal.proprietaireEmail"
      :proprietaire-telephone="systemAtelierModal.proprietaireTelephone"
      :proprietaire-mot-de-passe="systemAtelierModal.proprietaireMotDePasse"
      @close="closeSystemAtelierModal"
      @submit="submitSystemAtelierCreate"
      @update-nom-atelier="systemAtelierModal.nomAtelier = $event"
      @update-slug="
        systemAtelierModal.slugTouched = true;
        systemAtelierModal.slug = normalizeAtelierSlugInput($event);
      "
      @update-proprietaire-nom="systemAtelierModal.proprietaireNom = $event"
      @update-proprietaire-email="systemAtelierModal.proprietaireEmail = $event"
      @update-proprietaire-telephone="systemAtelierModal.proprietaireTelephone = $event"
      @update-proprietaire-mot-de-passe="systemAtelierModal.proprietaireMotDePasse = $event"
    />

  <div v-if="factureEmission.open" class="modal-backdrop" @click.self="closeFactureEmission">
      <div class="modal-card">
        <header class="modal-header">
          <h3>Emettre une facture</h3>
          <p>Selection guidee sans saisie manuelle d'identifiant</p>
        </header>

        <section class="modal-body stack-form">
          <label>Type d'origine</label>
          <select v-model="factureEmission.typeOrigine">
            <option value="COMMANDE">Commande</option>
            <option value="RETOUCHE">Retouche</option>
            <option value="VENTE">Vente</option>
          </select>

          <label>Origine disponible</label>
          <select v-model="factureEmission.idOrigine">
            <option value="" v-if="facturesCandidates.length === 0">Aucune origine disponible</option>
            <option v-for="item in facturesCandidates" :key="item.id" :value="item.id">
              {{ item.title }}
            </option>
          </select>
          <p class="helper" v-if="factureEmission.idOrigine">
            {{ facturesCandidates.find((item) => item.id === factureEmission.idOrigine)?.subtitle }}
          </p>
        </section>

        <div class="modal-actions">
          <button class="mini-btn" @click="closeFactureEmission">Annuler</button>
          <button
            class="action-btn blue"
            :disabled="factureEmission.submitting || !factureEmission.idOrigine"
            @click="confirmerEmissionFacture"
          >
            Emettre
          </button>
        </div>
      </div>
    </div>

    <div v-if="dossierModalOpen" class="modal-backdrop" @click.self="closeDossierModal">
      <div class="modal-card modal-card-wizard dossier-modal-card">
        <header class="modal-header">
          <div>
            <p class="mobile-overline">Dossier</p>
            <h3>Ouvrir un dossier</h3>
            <p class="helper">Un espace responsable pour centraliser commandes, retouches, paiements et priorites.</p>
          </div>
          <button class="mini-btn" @click="closeDossierModal">Fermer</button>
        </header>

      <section class="modal-body modal-body-wizard stack-form">
        <div class="wizard-stage-head">
          <div>
            <p class="mobile-overline">Responsable</p>
            <h4>Choisir la personne qui porte le dossier</h4>
            <p class="helper">Reprenez un client existant ou creez une fiche minimale sans quitter le flux.</p>
          </div>
        </div>
        <div class="segmented">
          <button class="mini-btn" :class="{ active: dossierDraft.mode === 'existing' }" @click="dossierDraft.mode = 'existing'">Responsable existant</button>
          <button class="mini-btn" :class="{ active: dossierDraft.mode === 'new' }" @click="dossierDraft.mode = 'new'">Nouveau responsable</button>
        </div>

        <div v-if="dossierDraft.mode === 'existing'" class="stack-form">
          <label>🔍 Rechercher un responsable</label>
          <div class="client-search">
            <input
              :value="dossierClientSearchQuery"
              type="text"
              placeholder="Nom ou telephone du responsable"
              autocomplete="off"
              @input="onDossierClientSearchInput"
              @focus="dossierClientSearchOpen = true"
              @blur="onDossierClientSearchBlur"
              @keydown="onDossierClientSearchKeydown"
            />
            <ul v-if="dossierClientSearchOpen && dossierClientSearchQuery.trim()" class="client-search-results">
              <li v-for="(row, index) in dossierClientSearchResults" :key="`dossier-client-${row.client.idClient}`">
                <button
                  type="button"
                  class="client-search-option"
                  :class="{ active: index === dossierClientSearchIndex }"
                  @mousedown.prevent="selectDossierExistingClient(row)"
                >
                  {{ row.nomComplet }} — {{ row.telephone }}
                </button>
              </li>
              <li v-if="dossierClientSearchResults.length === 0" class="client-search-empty">Aucun client trouvé</li>
            </ul>
          </div>
          <button class="mini-btn" type="button" @click="dossierDraft.mode = 'new'">+ Nouveau responsable</button>
          <div v-if="dossierSelectedExistingClient" class="client-insight-card">
            <p class="client-insight-title">Responsable selectionne</p>
            <p class="client-insight-selected">{{ dossierClientSearchQuery }}</p>
            <p class="helper">{{ dossierSelectedExistingClient.telephone || "Telephone non renseigne" }}</p>
          </div>
        </div>
        <div v-else class="stack-form">
          <label>Nom</label>
          <input v-model="dossierDraft.newClient.nom" type="text" placeholder="Nom" />
          <label>Prenom</label>
          <input v-model="dossierDraft.newClient.prenom" type="text" placeholder="Prenom" />
          <label>Telephone <span class="helper">(optionnel)</span></label>
          <input v-model="dossierDraft.newClient.telephone" type="text" placeholder="Telephone (optionnel)" />
          <div class="client-insight-card">
            <p class="client-insight-title">Nouveau responsable</p>
            <p class="client-insight-selected">{{ `${dossierDraft.newClient.nom} ${dossierDraft.newClient.prenom}`.trim() || "Responsable en cours" }}</p>
            <p class="helper">La fiche minimale sera creee en meme temps que le dossier.</p>
          </div>
        </div>

        <div class="grid-2 dossier-filter-grid">
          <select v-model="dossierDraft.typeDossier">
            <option value="INDIVIDUEL">Individuel</option>
            <option value="FAMILLE">Famille</option>
            <option value="GROUPE">Groupe</option>
          </select>
          <input v-model="dossierDraft.notes" type="text" placeholder="Note rapide (optionnel)" />
        </div>
        <div class="dossier-modal-preview-grid">
          <article class="dossier-preview-card">
            <span>Type</span>
            <strong>{{ dossierDraft.typeDossier }}</strong>
          </article>
          <article class="dossier-preview-card">
            <span>Responsable</span>
            <strong>{{ dossierDraft.mode === 'existing' ? (dossierClientSearchQuery || 'A selectionner') : (`${dossierDraft.newClient.nom} ${dossierDraft.newClient.prenom}`.trim() || 'A renseigner') }}</strong>
          </article>
          <article class="dossier-preview-card">
            <span>Note</span>
            <strong>{{ dossierDraft.notes || "Aucune note" }}</strong>
          </article>
        </div>
      </section>

      <footer class="modal-footer dossier-modal-footer">
        <button class="mini-btn" @click="closeDossierModal">Annuler</button>
        <button class="action-btn blue" :disabled="dossierSubmitting" @click="submitDossierCreate">Creer le dossier</button>
      </footer>
    </div>
  </div>

  <div v-if="wizard.open" class="modal-backdrop" @click.self="closeWizard">
      <div class="modal-card modal-card-wizard">
        <header class="modal-header">
          <h3>Nouvelle commande</h3>
          <p>Etape {{ wizard.step }} / 4</p>
        </header>

        <section v-if="wizard.step === 1" class="modal-body modal-body-wizard">
          <div class="wizard-stage-head">
            <div>
              <p class="mobile-overline">Client</p>
              <h4>Choisir la personne concernee</h4>
              <p class="helper">Recherchez rapidement un client existant ou creez une fiche minimale. L'enregistrement final se fait uniquement a la creation de la commande.</p>
            </div>
          </div>

          <div class="segmented">
            <button class="mini-btn" :class="{ active: wizard.mode === 'existing' }" @click="wizard.mode = 'existing'">Client existant</button>
            <button v-if="canCreateWizardClient" class="mini-btn" :class="{ active: wizard.mode === 'new' }" @click="wizard.mode = 'new'">Nouveau client</button>
          </div>

          <div v-if="wizard.mode === 'existing'" class="stack-form">
            <label>🔍 Rechercher un client (nom ou telephone)</label>
            <div class="client-search">
              <input
                :value="wizardClientSearchQuery"
                type="text"
                placeholder="Rechercher un client (nom ou telephone)"
                autocomplete="off"
                @input="onWizardClientSearchInput"
                @focus="wizardClientSearchOpen = true"
                @blur="onWizardClientSearchBlur"
                @keydown="onWizardClientSearchKeydown"
              />
              <ul v-if="wizardClientSearchOpen && wizardClientSearchQuery.trim()" class="client-search-results">
                <li v-for="(row, index) in wizardClientSearchResults" :key="`cmd-client-${row.client.idClient}`">
                  <button
                    type="button"
                    class="client-search-option"
                    :class="{ active: index === wizardClientSearchIndex }"
                    @mousedown.prevent="selectWizardExistingClient(row)"
                  >
                    {{ row.nomComplet }} — {{ row.telephone }}
                  </button>
                </li>
                <li v-if="wizardClientSearchResults.length === 0" class="client-search-empty">Aucun client trouvé</li>
              </ul>
            </div>
            <button v-if="canCreateWizardClient" class="mini-btn" @click="wizard.mode = 'new'">+ Nouveau client</button>

            <div v-if="wizard.existingClientId" class="client-insight-card">
              <p class="client-insight-title">Client selectionne</p>
              <p class="client-insight-selected">{{ wizardClientSearchQuery }}</p>
              <p v-if="wizardClientInsightLoading" class="helper">Chargement de l'historique client...</p>
              <p v-else-if="wizardClientInsightError" class="helper">{{ wizardClientInsightError }}</p>
              <template v-else-if="wizardClientInsight">
                <h4>Historique client</h4>
                <p>Commandes : {{ wizardClientInsight.totalCommandes }}</p>
                <p>Retouches : {{ wizardClientInsight.totalRetouches }}</p>
                <p>Derniere visite : {{ formatDateShort(wizardClientInsight.derniereVisite) }}</p>

                <div v-if="wizardClientInsight.operations.length > 0" class="client-insight-block">
                  <p class="client-insight-subtitle">Dernieres operations</p>
                  <ul class="client-insight-list">
                    <li v-for="row in wizardClientInsight.operations" :key="row.id">
                      {{ row.libelle }} - {{ formatDateShort(row.date) }} - {{ row.statut }}
                    </li>
                  </ul>
                </div>

                <div class="client-insight-block">
                  <p class="client-insight-subtitle">Mesures disponibles</p>
                  <ul v-if="wizardClientInsight.mesuresTypes.length > 0" class="client-insight-list">
                    <li v-for="item in wizardClientInsight.mesuresTypes" :key="`cmd-mes-${item}`">{{ item }}</li>
                  </ul>
                  <p v-else>Aucune mesure enregistree pour ce client</p>
                </div>
              </template>
            </div>
          </div>

          <div v-else class="stack-form">
            <label>Nom</label>
            <input v-model="wizard.newClient.nom" type="text" />
            <label>Prenom</label>
            <input v-model="wizard.newClient.prenom" type="text" />
            <label>Telephone <span class="helper">(optionnel)</span></label>
            <input v-model="wizard.newClient.telephone" type="text" placeholder="Ex: +243..." />

            <div v-if="wizardExactPhoneDuplicateClient || wizardProbableDuplicateClients.length > 0" class="client-insight-card">
              <p class="client-insight-title">Verification doublon</p>
              <template v-if="wizardExactPhoneDuplicateClient">
                <p class="client-insight-selected">
                  Ce numero appartient deja a {{ formatClientDisplayName(wizardExactPhoneDuplicateClient) }}.
                </p>
                <div class="inline-actions">
                  <button class="mini-btn" type="button" @click="applyWizardExistingClient(wizardExactPhoneDuplicateClient)">
                    Reutiliser ce client
                  </button>
                  <button class="mini-btn" type="button" @click="markWizardCreateAnyway(wizardExactPhoneDuplicateClient)">
                    Creer quand meme
                  </button>
                </div>
              </template>
              <template v-else>
                <p>
                  Un client similaire a ete trouve. Vous pouvez reutiliser la fiche existante, mettre a jour son numero ou creer quand meme un nouveau client.
                </p>
                <ul class="client-insight-list">
                  <li v-for="client in wizardProbableDuplicateClients" :key="`cmd-dup-${client.idClient}`">
                    {{ formatClientDisplayName(client) }} - {{ client.telephone || "Sans numero" }}
                    <div class="inline-actions">
                      <button class="mini-btn" type="button" @click="applyWizardExistingClient(client)">Reutiliser</button>
                      <button class="mini-btn" type="button" @click="setWizardDuplicateDecision('UPDATE_EXISTING_PHONE', client)">Mettre a jour le numero</button>
                      <button class="mini-btn" type="button" @click="markWizardCreateAnyway(client)">Creer quand meme</button>
                    </div>
                  </li>
                </ul>
              </template>
            </div>
          </div>

          <div class="modal-actions wizard-modal-actions">
            <button class="mini-btn" @click="closeWizard">Annuler</button>
            <button class="action-btn blue" @click="onWizardStep1" :disabled="wizard.submitting">Continuer</button>
          </div>
        </section>

        <section v-else-if="wizard.step === 2" class="modal-body modal-body-wizard stack-form wizard-form-shell">
          <div class="wizard-stage-head">
            <div>
              <p class="mobile-overline">Articles</p>
              <h4>Definir les habits de la commande</h4>
              <p class="helper">Ajoutez les habits, leur description et leur prix. Les mesures seront renseignees a l'etape suivante.</p>
            </div>
          </div>

          <section class="wizard-form-section">
            <div class="wizard-section-head">
              <div>
                <p class="mobile-overline">Client</p>
                <h5>Client selectionne</h5>
              </div>
              <span class="status-chip">1 personne</span>
            </div>
            <div class="client-insight-card wizard-inline-client-card">
              <p class="client-insight-selected">
                {{ wizard.mode === 'existing' ? wizardClientSearchQuery : `${wizard.newClient.nom} ${wizard.newClient.prenom}`.trim() || "Client en cours" }}
              </p>
              <p class="helper">
                {{ wizard.mode === 'existing' ? "Fiche existante reutilisee." : "Nouveau client cree au moment de l'enregistrement." }}
              </p>
            </div>
          </section>

          <section class="wizard-form-section">
            <div class="wizard-section-head">
              <div>
                <p class="mobile-overline">Items</p>
                <h5>Habits a fabriquer</h5>
                <p class="helper">Ajoutez les habits un par un. Le total se met a jour sans recharger le formulaire.</p>
              </div>
              <button class="mini-btn" type="button" @click="addCommandeItem">Ajouter habit</button>
            </div>
            <div class="wizard-items-stack">
              <article v-for="(item, index) in wizard.commande.items" :key="item.idItem" class="panel subtle-panel wizard-item-card">
                <div class="wizard-item-card-head">
                  <div>
                    <p class="mobile-overline">Habit {{ index + 1 }}</p>
                    <h6>{{ item.description || humanizeContactLabel(item.typeHabit) || item.typeHabit || "Nouvel habit" }}</h6>
                  </div>
                  <button class="mini-btn" type="button" @click="removeCommandeItem(index)" :disabled="wizard.commande.items.length <= 1">
                    Supprimer
                  </button>
                </div>
                <div class="wizard-item-grid">
                  <div class="stack-form">
                    <label>Type d'habit</label>
                    <select v-model="item.typeHabit" @change="onCommandeItemTypeChange(item)">
                      <option value="">Choisir un type d'habit</option>
                      <option v-for="option in wizardAvailableHabitTypeOptions" :key="`cmd-habit-${item.idItem}-${option.value}`" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                  <div class="stack-form">
                    <label>Description item</label>
                    <input v-model="item.description" type="text" placeholder="Ex: Pantalon bleu marine" />
                  </div>
                  <div class="stack-form">
                    <label>Montant (FC)</label>
                    <input v-model="item.prix" type="number" min="0" step="0.01" />
                  </div>
                </div>
                <div class="wizard-item-meta">
                  <span>{{ humanizeContactLabel(item.typeHabit) || item.typeHabit || "Type a definir" }}</span>
                  <strong>{{ formatCurrency(Number(item.prix || 0)) }}</strong>
                </div>
              </article>
            </div>
          </section>

          <section class="wizard-form-section">
            <div class="wizard-section-head">
              <div>
                <p class="mobile-overline">Commande</p>
                <h5>Informations generales</h5>
              </div>
              <span class="status-chip">{{ humanizeContactLabel(wizard.commande.typeHabit) || wizard.commande.typeHabit || "A definir" }}</span>
            </div>
            <label>Description commande</label>
            <input v-model="wizard.commande.descriptionCommande" type="text" placeholder="Ex: Commande mariage" />
            <label>Date prevue</label>
            <input v-model="wizard.commande.datePrevue" type="date" />
            <label class="helper helper-inline-checkbox">
              <input v-model="wizard.commande.emettreFacture" type="checkbox" />
              Emettre facture apres creation (recommande)
            </label>
          </section>

          <div class="wizard-total-bar">
            <div class="wizard-total-meta">
              <p class="mobile-overline">Total</p>
              <strong>{{ formatCurrency(Number(wizard.commande.montantTotal || 0)) }}</strong>
              <p class="helper">{{ wizard.commande.items.length }} habit(s) ajoutes</p>
            </div>
            <div class="wizard-total-side">
              <span class="status-chip">{{ wizard.commande.items.length }} item(s)</span>
              <span class="helper">Validation finale a l'etape suivante</span>
            </div>
          </div>

          <div class="modal-actions wizard-modal-actions wizard-actions-footer">
            <button class="mini-btn" @click="wizard.step = 1">Retour</button>
            <button class="action-btn blue" @click="onWizardStep2" :disabled="wizard.submitting">Continuer vers les mesures</button>
          </div>
        </section>

        <section
          v-else-if="wizard.step === 3"
          ref="wizardMeasureStepRef"
          class="modal-body modal-body-wizard stack-form wizard-form-shell measure-scroll-shell"
          @focusin.capture="onWizardMeasureFieldFocusIn"
          @focusout.capture="onWizardMeasureFieldFocusOut"
        >
          <div class="wizard-stage-head">
            <div>
              <p class="mobile-overline">Mesures</p>
              <h4>Renseigner les mesures habit par habit</h4>
              <p class="helper">Chaque habit garde ses propres mesures. Le premier habit sert seulement de reference pour l'historique legacy.</p>
            </div>
          </div>

          <section class="wizard-form-section">
            <div class="wizard-section-head">
              <div>
                <p class="mobile-overline">Reference</p>
                <h5>Habit principal</h5>
              </div>
              <span class="status-chip">{{ humanizeContactLabel(wizard.commande.typeHabit) || wizard.commande.typeHabit || "A definir" }}</span>
            </div>
            <p class="helper">Le premier habit avec type defini sert de reference pour l'historique et la compatibilite des anciennes commandes. Les autres habits gardent leurs propres mesures.</p>

            <div v-if="wizard.commande.prefillLoading" class="client-insight-card">
              <p class="helper">Recherche des dernieres mesures...</p>
            </div>
            <div
              v-else-if="wizard.commande.prefill && wizard.commande.prefillDecision === 'idle'"
              class="client-insight-card"
            >
              <p class="client-insight-title">Mesures precedentes trouvees</p>
              <p class="helper">Derniere utilisation : {{ formatDateShort(wizard.commande.prefill.dateDerniereUtilisation) }}</p>
              <div class="inline-actions">
                <button class="mini-btn" type="button" @click="applyCommandePrefill('use')">Utiliser</button>
                <button class="mini-btn" type="button" @click="applyCommandePrefill('modify')">Modifier</button>
                <button class="mini-btn" type="button" @click="ignoreCommandePrefill()">Ignorer</button>
              </div>
            </div>
          </section>

          <section class="wizard-form-section">
            <div class="wizard-section-head">
              <div>
                <p class="mobile-overline">Mesures</p>
                <h5>Mesures par habit</h5>
                <p class="helper">Seuls les habits avec type defini demandent des mesures.</p>
              </div>
              <span class="status-chip">{{ wizard.commande.items.filter((item) => item.typeHabit).length }} habit(s)</span>
            </div>
            <div class="wizard-measure-tabs" v-if="wizardCommandeMeasureItems.length > 0">
              <button
                v-for="(item, index) in wizardCommandeMeasureItems"
                :key="`cmd-measure-tab-${item.idItem}`"
                type="button"
                class="wizard-measure-tab"
                :class="{
                  active: wizardCommandeMeasureIndex === index,
                  complete: getCommandeMeasureStateLabel(item) === 'Complet',
                  warning: getCommandeMeasureStateLabel(item) === 'Partiel' || getCommandeMeasureStateLabel(item) === 'A completer'
                }"
                @click="setWizardCommandeMeasureIndex(index)"
              >
                <span class="wizard-measure-tab-index">Habit {{ index + 1 }}</span>
                <strong>{{ item.description || humanizeContactLabel(item.typeHabit) || item.typeHabit || "Habit" }}</strong>
                <span class="wizard-measure-tab-state">{{ getCommandeMeasureStateLabel(item) }}</span>
              </button>
            </div>
            <div class="wizard-measure-stage-summary" v-if="wizardCommandeMeasureItems.length > 0">
              <span>{{ wizardCommandeMeasureCompletion.complete }} / {{ wizardCommandeMeasureCompletion.total }} habit(s) completes</span>
              <span>Vous renseignez un habit a la fois pour eviter un formulaire trop long.</span>
            </div>
            <div class="wizard-items-stack" v-if="wizardCommandeMeasureActiveItem">
              <article :key="`cmd-item-mes-step-${wizardCommandeMeasureActiveItem.idItem}`" class="panel subtle-panel wizard-item-card wizard-item-card-active">
                <div class="wizard-item-card-head">
                  <div>
                    <p class="mobile-overline">Habit {{ wizardCommandeMeasureIndex + 1 }}</p>
                    <h6>{{ wizardCommandeMeasureActiveItem.description || humanizeContactLabel(wizardCommandeMeasureActiveItem.typeHabit) || wizardCommandeMeasureActiveItem.typeHabit || "Habit" }}</h6>
                  </div>
                  <span class="status-chip">{{ humanizeContactLabel(wizardCommandeMeasureActiveItem.typeHabit) || wizardCommandeMeasureActiveItem.typeHabit }}</span>
                </div>
                <div class="wizard-item-meta">
                  <span>{{ wizardCommandeMeasureIndex === 0 ? "Reference historique" : "Mesures propres a cet habit" }}</span>
                  <strong>{{ formatCurrency(Number(wizardCommandeMeasureActiveItem.prix || 0)) }}</strong>
                </div>
                <div class="wizard-measure-progress">
                  <article class="wizard-measure-progress-card">
                    <span>Etat</span>
                    <strong>{{ getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).completionLabel }}</strong>
                  </article>
                  <article class="wizard-measure-progress-card">
                    <span>Obligatoires</span>
                    <strong>{{ getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).requiredCompleted }}/{{ getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).requiredTotal }}</strong>
                  </article>
                  <article class="wizard-measure-progress-card" :class="{ warning: getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).missingRequired > 0 }">
                    <span>Reste</span>
                    <strong>
                      {{ getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).missingRequired > 0 ? `${getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).missingRequired} mesure(s) requise(s)` : "Complet" }}
                    </strong>
                  </article>
                </div>
                <div class="stack-form wizard-item-measures-block">
                  <label>Mesures {{ wizardCommandeMeasureIndex === 0 ? "(habit principal)" : "" }}</label>
                  <p class="helper">
                    {{ wizardCommandeMeasureIndex === 0 ? "Le pre-remplissage s'applique sur ce premier habit quand un historique existe." : "Renseignez les mesures propres a cet habit." }}
                  </p>
                  <div
                    class="wizard-measure-alert"
                    :class="{ 'is-hidden': getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).missingRequired <= 0 }"
                    :aria-hidden="getCommandeItemMeasureProgress(wizardCommandeMeasureActiveItem).missingRequired <= 0 ? 'true' : 'false'"
                  >
                    <strong>Mesures obligatoires encore attendues.</strong>
                    <span>Completez les champs marques d'une asterisque avant de continuer.</span>
                  </div>
                  <div class="form-grid">
                    <div v-for="field in getCommandeItemMeasureFields(wizardCommandeMeasureActiveItem)" :key="`cmd-item-mes-${wizardCommandeMeasureActiveItem.idItem}-${field.key}`" class="form-row">
                      <label>{{ mesureDisplayLabel(field) }} <span v-if="field.required">*</span></label>
                      <select
                        v-if="mesureInputType(field) === 'select'"
                        v-model="wizardCommandeMeasureActiveItem.mesures[field.key]"
                      >
                        <option value="">Choisir</option>
                        <option value="courtes">courtes</option>
                        <option value="longues">longues</option>
                      </select>
                      <input
                        v-else
                        v-model="wizardCommandeMeasureActiveItem.mesures[field.key]"
                        :type="mesureInputType(field) === 'number' ? 'number' : 'text'"
                        min="0"
                        :step="mesureInputType(field) === 'number' ? '0.1' : undefined"
                        :placeholder="mesurePlaceholder(field)"
                      />
                    </div>
                  </div>
                </div>
                <div class="wizard-measure-nav">
                  <button class="mini-btn" type="button" :disabled="wizardCommandeMeasureIndex <= 0" @click="goToPreviousCommandeMeasureItem">
                    Precedent
                  </button>
                  <button
                    v-if="wizardCommandeMeasureIndex < wizardCommandeMeasureItems.length - 1"
                    class="mini-btn blue"
                    type="button"
                    @click="goToNextCommandeMeasureItem"
                  >
                    Suivant
                  </button>
                  <span v-else class="helper">Dernier habit</span>
                </div>
              </article>
            </div>
            <p v-else class="helper">Ajoutez d'abord un habit avec un type defini pour afficher ses mesures.</p>
          </section>

          <div class="modal-actions wizard-modal-actions wizard-actions-footer">
            <button class="mini-btn" @click="wizard.step = 2">Retour</button>
            <button class="action-btn blue" @click="onWizardStep3" :disabled="wizard.submitting">Continuer vers le resume</button>
          </div>
        </section>

        <section v-else class="modal-body modal-body-wizard stack-form wizard-form-shell">
          <div class="wizard-stage-head">
            <div>
              <p class="mobile-overline">Resume</p>
              <h4>Verification finale</h4>
              <p class="helper">Confirmez le client, les habits, les mesures et la date avant l'enregistrement definitif.</p>
            </div>
          </div>

          <section class="wizard-validation-banner" :class="{ warning: wizardValidationStats.missingRequired > 0 }">
            <div>
              <p class="mobile-overline">Controle final</p>
              <h5>{{ wizardValidationStats.readyLabel }}</h5>
              <p class="helper">
                {{ wizardValidationStats.missingRequired > 0
                  ? `${wizardValidationStats.missingRequired} mesure(s) obligatoire(s) restent a completer avant creation.`
                  : `La commande sera creee pour ${wizardValidationStats.itemsCount} habit(s) et ouvrira directement son detail.` }}
              </p>
            </div>
            <span class="status-chip" :class="{ warning: wizardValidationStats.missingRequired > 0 }">
              {{ wizardValidationStats.missingRequired > 0 ? "A verifier" : "Pret" }}
            </span>
          </section>

          <div class="client-insight-card">
            <p class="client-insight-title">Client</p>
            <p class="client-insight-selected">
              {{ wizard.mode === 'existing' ? wizardClientSearchQuery : `${wizard.newClient.nom} ${wizard.newClient.prenom}`.trim() }}
            </p>
          </div>

          <div class="beneficiary-summary-grid">
            <article class="summary-pill-card">
              <span>Client</span>
              <strong>1</strong>
            </article>
            <article class="summary-pill-card">
              <span>Habits</span>
              <strong>{{ wizardValidationStats.itemsCount }}</strong>
            </article>
            <article class="summary-pill-card">
              <span>Montant</span>
              <strong>{{ formatCurrency(wizardSummary.montantTotal) }}</strong>
            </article>
            <article class="summary-pill-card">
              <span>Livraison</span>
              <strong>{{ wizardValidationStats.datePrevueLabel }}</strong>
            </article>
          </div>

          <div class="wizard-beneficiary-list compact">
            <article class="beneficiary-card">
              <div class="beneficiary-card-head">
                <div>
                  <p class="mobile-overline">Client</p>
                  <h4>{{ wizard.mode === 'existing' ? wizardClientSearchQuery : `${wizard.newClient.nom} ${wizard.newClient.prenom}`.trim() }}</h4>
                </div>
                <span class="status-chip">{{ wizardSummary.items.length }} habit(s)</span>
              </div>
              <p class="helper">Mesures renseignees : {{ wizardSummary.mesuresRenseignees }} · {{ wizardValidationStats.factureLabel }}</p>
              <div class="beneficiary-summary-grid wizard-validation-meta-grid">
                <article class="summary-pill-card">
                  <span>Mesures OK</span>
                  <strong>{{ wizardValidationStats.completeItems }}/{{ wizardValidationStats.itemsCount }}</strong>
                </article>
                <article class="summary-pill-card">
                  <span>Mesures restantes</span>
                  <strong>{{ wizardValidationStats.missingRequired }}</strong>
                </article>
                <article class="summary-pill-card">
                  <span>Date prevue</span>
                  <strong>{{ wizardValidationStats.datePrevueLabel }}</strong>
                </article>
              </div>
            </article>

            <article class="beneficiary-card">
              <div class="beneficiary-card-head">
                <div>
                  <p class="mobile-overline">Creation</p>
                  <h4>Ce qui sera cree</h4>
                </div>
                <span class="status-chip">{{ wizardValidationStats.readyLabel }}</span>
              </div>
              <ul class="client-insight-list">
                <li>Dossier client conserve : {{ wizard.mode === 'existing' ? "client existant reutilise" : "nouveau client cree avec la commande" }}</li>
                <li>{{ wizardValidationStats.itemsCount }} habit(s) seront attaches a cette commande.</li>
                <li>{{ wizardValidationStats.factureLabel }}.</li>
                <li>Apres creation, le detail commande s'ouvre automatiquement.</li>
              </ul>
            </article>

            <article class="beneficiary-card">
              <div class="beneficiary-card-head">
                <div>
                  <p class="mobile-overline">Habits</p>
                  <h4>Recapitulatif par habit</h4>
                </div>
                <span class="status-chip">{{ wizardSummary.items.length }} ligne(s)</span>
              </div>
              <ul class="client-insight-list">
                <li v-for="item in wizardSummary.items" :key="`cmd-summary-item-${item.idItem}`">
                  {{ humanizeContactLabel(item.typeHabit) || item.typeHabit || "Habit" }} - {{ item.description || "Sans description" }} - {{ formatCurrency(Number(item.prix || 0)) }} - {{ getCommandeItemMeasureProgress(item).completionLabel }} - {{ getCommandeItemMeasureProgress(item).missingRequired > 0 ? `${getCommandeItemMeasureProgress(item).missingRequired} requise(s) restante(s)` : "complet" }}
                </li>
              </ul>
            </article>
          </div>

          <div class="modal-actions wizard-modal-actions wizard-actions-footer">
            <button class="mini-btn" @click="wizard.step = 3">Retour</button>
            <button class="action-btn green" @click="onWizardStep4" :disabled="wizard.submitting">Creer la commande</button>
          </div>
        </section>
      </div>
    </div>
  </div>

  <div v-if="retoucheWizard.open" class="modal-backdrop" @click.self="closeRetoucheWizard">
    <div class="modal-card modal-card-wizard">
      <header class="modal-header">
        <h3>Nouvelle retouche</h3>
        <p>Etape {{ retoucheWizard.step }} / 4</p>
      </header>

      <section v-if="retoucheWizard.step === 1" class="modal-body modal-body-wizard">
        <div class="wizard-stage-head">
          <div>
            <p class="mobile-overline">Client</p>
            <h4>Choisir la personne concernee</h4>
            <p class="helper">Selectionnez un client existant ou creez une fiche simple. La retouche reste liee a une seule personne.</p>
          </div>
        </div>

        <div class="segmented">
          <button class="mini-btn" :class="{ active: retoucheWizard.mode === 'existing' }" @click="retoucheWizard.mode = 'existing'">Client existant</button>
          <button v-if="canCreateWizardClient" class="mini-btn" :class="{ active: retoucheWizard.mode === 'new' }" @click="retoucheWizard.mode = 'new'">Nouveau client</button>
        </div>

        <div v-if="retoucheWizard.mode === 'existing'" class="stack-form">
          <label>🔍 Rechercher un client (nom ou telephone)</label>
          <div class="client-search">
            <input
              :value="retoucheClientSearchQueryWizard"
              type="text"
              placeholder="Rechercher un client (nom ou telephone)"
              autocomplete="off"
              @input="onRetoucheClientSearchInput"
              @focus="retoucheClientSearchOpen = true"
              @blur="onRetoucheClientSearchBlur"
              @keydown="onRetoucheClientSearchKeydown"
            />
            <ul v-if="retoucheClientSearchOpen && retoucheClientSearchQueryWizard.trim()" class="client-search-results">
              <li v-for="(row, index) in retoucheClientSearchResultsWizard" :key="`ret-client-${row.client.idClient}`">
                <button
                  type="button"
                  class="client-search-option"
                  :class="{ active: index === retoucheClientSearchIndex }"
                  @mousedown.prevent="selectRetoucheExistingClient(row)"
                >
                  {{ row.nomComplet }} — {{ row.telephone }}
                </button>
              </li>
              <li v-if="retoucheClientSearchResultsWizard.length === 0" class="client-search-empty">Aucun client trouvé</li>
            </ul>
          </div>
          <button v-if="canCreateWizardClient" class="mini-btn" @click="retoucheWizard.mode = 'new'">+ Nouveau client</button>

          <div v-if="retoucheWizard.existingClientId" class="client-insight-card">
            <p class="client-insight-title">Client selectionne</p>
            <p class="client-insight-selected">{{ retoucheClientSearchQueryWizard }}</p>
            <p v-if="retoucheClientInsightLoading" class="helper">Chargement de l'historique client...</p>
            <p v-else-if="retoucheClientInsightError" class="helper">{{ retoucheClientInsightError }}</p>
            <template v-else-if="retoucheClientInsight">
              <h4>Historique client</h4>
              <p>Commandes : {{ retoucheClientInsight.totalCommandes }}</p>
              <p>Retouches : {{ retoucheClientInsight.totalRetouches }}</p>
              <p>Derniere visite : {{ formatDateShort(retoucheClientInsight.derniereVisite) }}</p>

              <div v-if="retoucheClientInsight.operations.length > 0" class="client-insight-block">
                <p class="client-insight-subtitle">Dernieres operations</p>
                <ul class="client-insight-list">
                  <li v-for="row in retoucheClientInsight.operations" :key="row.id">
                    {{ row.libelle }} - {{ formatDateShort(row.date) }} - {{ row.statut }}
                  </li>
                </ul>
              </div>

              <div class="client-insight-block">
                <p class="client-insight-subtitle">Mesures disponibles</p>
                <ul v-if="retoucheClientInsight.mesuresTypes.length > 0" class="client-insight-list">
                  <li v-for="item in retoucheClientInsight.mesuresTypes" :key="`ret-mes-${item}`">{{ item }}</li>
                </ul>
                <p v-else>Aucune mesure enregistree pour ce client</p>
              </div>
            </template>
          </div>
        </div>

        <div v-else class="stack-form">
          <label>Nom</label>
          <input v-model="retoucheWizard.newClient.nom" type="text" />
          <label>Prenom</label>
          <input v-model="retoucheWizard.newClient.prenom" type="text" />
          <label>Telephone</label>
          <input v-model="retoucheWizard.newClient.telephone" type="text" />

          <div v-if="retoucheWizardExactPhoneDuplicateClient || retoucheWizardProbableDuplicateClients.length > 0" class="client-insight-card">
            <p class="client-insight-title">Verification doublon</p>
            <template v-if="retoucheWizardExactPhoneDuplicateClient">
              <p class="client-insight-selected">
                Ce numero appartient deja a {{ formatClientDisplayName(retoucheWizardExactPhoneDuplicateClient) }}.
              </p>
              <button class="mini-btn" type="button" @click="applyRetoucheExistingClient(retoucheWizardExactPhoneDuplicateClient)">
                Utiliser ce client
              </button>
            </template>
            <template v-else>
              <p>
                Des clients au meme nom existent deja. Au clic final, vous pourrez reutiliser le client, mettre a jour son numero ou confirmer un nouveau client.
              </p>
              <ul class="client-insight-list">
                <li v-for="client in retoucheWizardProbableDuplicateClients" :key="`ret-dup-${client.idClient}`">
                  {{ formatClientDisplayName(client) }} - {{ client.telephone || "Sans numero" }}
                  <button class="mini-btn" type="button" @click="applyRetoucheExistingClient(client)">Utiliser</button>
                </li>
              </ul>
            </template>
          </div>
        </div>

        <div class="modal-actions wizard-modal-actions">
          <button class="mini-btn" @click="closeRetoucheWizard">Annuler</button>
          <button class="action-btn blue" @click="onRetoucheWizardStep1" :disabled="retoucheWizard.submitting">Continuer</button>
        </div>
      </section>

      <section v-else-if="retoucheWizard.step === 2" class="modal-body modal-body-wizard stack-form wizard-form-shell">
        <div class="wizard-stage-head">
          <div>
            <p class="mobile-overline">Interventions</p>
            <h4>Definir les interventions a realiser</h4>
            <p class="helper">Ajoutez les operations, leur description et leur prix. La configuration de l'habit et des mesures vient ensuite.</p>
          </div>
        </div>

        <section class="wizard-form-section">
          <div class="wizard-section-head">
            <div>
              <p class="mobile-overline">Client</p>
              <h5>Client selectionne</h5>
            </div>
            <span class="status-chip">1 personne</span>
          </div>
          <div class="client-insight-card wizard-inline-client-card">
            <p class="client-insight-selected">
              {{ retoucheWizard.mode === 'existing' ? retoucheClientSearchQueryWizard : `${retoucheWizard.newClient.nom} ${retoucheWizard.newClient.prenom}`.trim() || "Client en cours" }}
            </p>
            <p class="helper">
              {{ retoucheWizard.mode === 'existing' ? "Fiche existante reutilisee." : "Nouveau client cree au moment de l'enregistrement." }}
            </p>
          </div>
        </section>

        <section class="wizard-form-section">
          <div class="wizard-section-head">
            <div>
              <p class="mobile-overline">Retouches</p>
              <h5>Retouches a realiser</h5>
              <p class="helper">Ajoutez les retouches une par une. L'habit et les mesures seront precises a l'etape suivante.</p>
            </div>
            <button class="mini-btn" type="button" @click="addRetoucheItem">Ajouter retouche</button>
          </div>
          <div class="wizard-items-stack">
            <article v-for="(item, index) in retoucheWizard.retouche.items" :key="item.idItem" class="panel subtle-panel wizard-item-card">
              <div class="wizard-item-card-head">
                <div>
                  <p class="mobile-overline">Retouche {{ index + 1 }}</p>
                  <h6>{{ item.description || humanizeContactLabel(item.typeRetouche) || item.typeRetouche || "Nouvelle retouche" }}</h6>
                </div>
                <button class="mini-btn" type="button" @click="removeRetoucheItem(index)" :disabled="retoucheWizard.retouche.items.length <= 1">
                  Supprimer
                </button>
              </div>
              <div class="wizard-item-grid">
                <div class="stack-form">
                  <label>Type de retouche</label>
                  <select v-model="item.typeRetouche" @change="onRetoucheItemTypeChange(item)">
                    <option value="">Choisir un type de retouche</option>
                    <option v-for="option in retoucheTypeOptions" :key="`${item.idItem}-${option.value}`" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="stack-form">
                  <label>Description</label>
                  <input v-model="item.description" type="text" placeholder="Ex: Ajuster l'ourlet" />
                </div>
                <div class="stack-form">
                  <label>Montant (FC)</label>
                  <input v-model="item.prix" type="number" min="0" step="0.01" />
                </div>
              </div>
              <div class="wizard-item-meta">
                <span>{{ humanizeContactLabel(item.typeRetouche) || item.typeRetouche || "Type a definir" }}</span>
                <strong>{{ formatCurrency(Number(item.prix || 0)) }}</strong>
              </div>
            </article>
          </div>
        </section>

        <div class="wizard-total-bar">
          <div class="wizard-total-meta">
            <p class="mobile-overline">Total</p>
            <strong>{{ formatCurrency(Number(retoucheWizard.retouche.montantTotal || 0)) }}</strong>
            <p class="helper">{{ retoucheWizard.retouche.items.length }} retouche(s) ajoutee(s)</p>
          </div>
          <div class="wizard-total-side">
            <span class="status-chip">{{ retoucheWizard.retouche.items.length }} retouche(s)</span>
            <span class="helper">Configuration detaillee a l'etape suivante</span>
          </div>
        </div>

        <div class="modal-actions wizard-modal-actions wizard-actions-footer">
          <button class="mini-btn" @click="retoucheWizard.step = 1">Retour</button>
          <button class="action-btn blue" @click="onRetoucheWizardStep2" :disabled="retoucheWizard.submitting">Continuer vers la configuration</button>
        </div>
      </section>

      <section
        v-else-if="retoucheWizard.step === 3"
        ref="retoucheMeasureStepRef"
        class="modal-body modal-body-wizard stack-form wizard-form-shell measure-scroll-shell"
        @focusin.capture="onRetoucheMeasureFieldFocusIn"
        @focusout.capture="onRetoucheMeasureFieldFocusOut"
      >
        <div class="wizard-stage-head">
          <div>
            <p class="mobile-overline">Configuration</p>
            <h4>Configurer l'habit et les mesures</h4>
            <p class="helper">Precisez l'habit concerne, les mesures utiles et les informations generales avant le resume.</p>
          </div>
        </div>

        <section class="wizard-form-section">
          <div class="wizard-section-head">
            <div>
              <p class="mobile-overline">Retouches</p>
              <h5>Configuration par retouche</h5>
            </div>
            <span class="status-chip">{{ wizardRetoucheMeasureItems.length }} retouche(s)</span>
          </div>
          <div class="wizard-measure-tabs" v-if="wizardRetoucheMeasureItems.length > 0">
            <button
              v-for="(item, index) in wizardRetoucheMeasureItems"
              :key="`ret-measure-tab-${item.idItem}`"
              type="button"
              class="wizard-measure-tab"
              :class="{
                active: wizardRetoucheMeasureIndex === index,
                complete: getRetoucheMeasureStateLabel(item) === 'Complet' || getRetoucheMeasureStateLabel(item) === 'Sans mesures',
                warning: getRetoucheMeasureStateLabel(item) === 'Partiel' || getRetoucheMeasureStateLabel(item) === 'A completer'
              }"
              @click="setWizardRetoucheMeasureIndex(index)"
            >
              <span class="wizard-measure-tab-index">Retouche {{ index + 1 }}</span>
              <strong>{{ item.description || humanizeContactLabel(item.typeRetouche) || item.typeRetouche || "Retouche" }}</strong>
              <span class="wizard-measure-tab-state">{{ getRetoucheMeasureStateLabel(item) }}</span>
            </button>
          </div>
          <div class="wizard-measure-stage-summary" v-if="wizardRetoucheMeasureItems.length > 0">
            <span>{{ wizardRetoucheMeasureCompletion.complete }} / {{ wizardRetoucheMeasureCompletion.total }} retouche(s) complete(s)</span>
            <span>Vous configurez une retouche a la fois pour garder un formulaire simple sur mobile.</span>
          </div>
          <p v-else class="helper">Ajoutez d'abord une retouche avec un type defini.</p>
        </section>

        <div class="wizard-items-stack" v-if="wizardRetoucheMeasureActiveItem">
          <article :key="`ret-item-config-${wizardRetoucheMeasureActiveItem.idItem}`" class="panel subtle-panel wizard-item-card wizard-item-card-active">
            <div class="wizard-item-card-head">
              <div>
                <p class="mobile-overline">Retouche {{ wizardRetoucheMeasureIndex + 1 }}</p>
                <h6>{{ wizardRetoucheMeasureActiveItem.description || humanizeContactLabel(wizardRetoucheMeasureActiveItem.typeRetouche) || wizardRetoucheMeasureActiveItem.typeRetouche || "Retouche" }}</h6>
              </div>
              <span class="status-chip">{{ humanizeContactLabel(wizardRetoucheMeasureActiveItem.typeRetouche) || wizardRetoucheMeasureActiveItem.typeRetouche || "A definir" }}</span>
            </div>
            <div class="wizard-item-meta">
              <span>{{ getRetoucheMeasureStateLabel(wizardRetoucheMeasureActiveItem) }}</span>
              <strong>{{ formatCurrency(Number(wizardRetoucheMeasureActiveItem.prix || 0)) }}</strong>
            </div>

            <div class="stack-form wizard-item-measures-block">
              <label>Type d'habit</label>
              <p v-if="selectedRetoucheTypeDefinition" class="helper">
                Habits compatibles: {{ (selectedRetoucheTypeDefinition.habitsCompatibles || []).join(", ") }}
                · Mesures {{ retoucheMeasuresRequired ? "requises" : "non requises" }}
              </p>
              <select
                v-model="wizardRetoucheMeasureActiveItem.typeHabit"
                :disabled="!wizardRetoucheMeasureActiveItem.typeRetouche"
                @change="onRetoucheItemHabitChange(wizardRetoucheMeasureActiveItem)"
              >
                <option value="">
                  {{ wizardRetoucheMeasureActiveItem.typeRetouche ? "Choisir un type d'habit" : "Choisir d'abord un type de retouche" }}
                </option>
                <option v-for="option in wizardCompatibleRetoucheHabitOptions" :key="`ret-habit-${wizardRetoucheMeasureActiveItem.idItem}-${option.value}`" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div v-if="String(wizardRetoucheMeasureActiveItem.typeHabit || '').trim()" class="stack-form wizard-item-measures-block">
              <label>Mesures</label>
              <p class="helper">
                <span v-if="retoucheMeasuresRequired">Renseignez les mesures necessaires pour cette retouche.</span>
                <span v-else>Aucune mesure n'est requise pour cette retouche.</span>
              </p>
              <p v-if="retoucheMeasuresConfigError" class="helper" style="color: #b42318;">
                {{ retoucheMeasuresConfigError }}
              </p>
              <div v-if="retoucheMeasuresRequired" class="wizard-measure-progress">
                <article class="wizard-measure-progress-card">
                  <span>Etat</span>
                  <strong>{{ getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).completionLabel }}</strong>
                </article>
                <article class="wizard-measure-progress-card">
                  <span>Obligatoires</span>
                  <strong>{{ getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).requiredCompleted }}/{{ getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).requiredTotal }}</strong>
                </article>
                <article class="wizard-measure-progress-card" :class="{ warning: getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).missingRequired > 0 }">
                  <span>Reste</span>
                  <strong>
                    {{ getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).missingRequired > 0 ? `${getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).missingRequired} mesure(s)` : "Complet" }}
                  </strong>
                </article>
              </div>
              <div
                v-show="retoucheMeasuresRequired"
                class="wizard-measure-alert"
                :class="{ 'is-hidden': getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).completed > 0 }"
                :aria-hidden="getRetoucheItemMeasureProgress(wizardRetoucheMeasureActiveItem).completed > 0 ? 'true' : 'false'"
              >
                <strong>Mesures encore attendues.</strong>
                <span>Renseignez les champs utiles pour cette retouche avant de continuer.</span>
              </div>
              <div v-if="retoucheMeasuresRequired" class="form-grid">
                <div v-for="field in retoucheMesureFields" :key="`ret-mes-${wizardRetoucheMeasureActiveItem.idItem}-${field.key}`" class="form-row">
                  <label>{{ mesureDisplayLabel(field) }} <span v-if="field.required">*</span></label>
                  <select
                    v-if="mesureInputType(field) === 'select'"
                    v-model="wizardRetoucheMeasureActiveItem.mesures[field.key]"
                  >
                    <option value="">Choisir</option>
                    <option value="courtes">courtes</option>
                    <option value="longues">longues</option>
                  </select>
                  <input
                    v-else
                    v-model="wizardRetoucheMeasureActiveItem.mesures[field.key]"
                    :type="mesureInputType(field) === 'number' ? 'number' : 'text'"
                    min="0"
                    :step="mesureInputType(field) === 'number' ? '0.1' : undefined"
                    :placeholder="mesurePlaceholder(field)"
                  />
                </div>
              </div>
            </div>

            <div class="wizard-measure-nav">
              <button class="mini-btn" type="button" :disabled="wizardRetoucheMeasureIndex <= 0" @click="goToPreviousRetoucheMeasureItem">
                Precedent
              </button>
              <button
                v-if="wizardRetoucheMeasureIndex < wizardRetoucheMeasureItems.length - 1"
                class="mini-btn blue"
                type="button"
                @click="goToNextRetoucheMeasureItem"
              >
                Suivant
              </button>
              <span v-else class="helper">Derniere retouche</span>
            </div>
          </article>
        </div>

        <section class="wizard-form-section">
          <div class="wizard-section-head">
            <div>
              <p class="mobile-overline">Informations</p>
              <h5>Details de la retouche</h5>
            </div>
            <span class="status-chip">{{ wizardRetoucheDescriptionRequired ? "Description requise" : "Description optionnelle" }}</span>
          </div>
          <label>Description retouche</label>
          <input v-model="retoucheWizard.retouche.descriptionRetouche" type="text" />
          <label>Date prevue</label>
          <input v-model="retoucheWizard.retouche.datePrevue" type="date" />
          <label class="helper helper-inline-checkbox">
            <input v-model="retoucheWizard.retouche.emettreFacture" type="checkbox" />
            Emettre facture apres creation (recommande)
          </label>
        </section>

        <div class="modal-actions wizard-modal-actions wizard-actions-footer">
          <button class="mini-btn" @click="retoucheWizard.step = 2">Retour</button>
          <button class="action-btn blue" @click="onRetoucheWizardStep3" :disabled="retoucheWizard.submitting">Continuer vers le resume</button>
        </div>
      </section>

      <section v-else class="modal-body modal-body-wizard stack-form wizard-form-shell">
        <div class="wizard-stage-head">
          <div>
            <p class="mobile-overline">Resume</p>
            <h4>Verification finale</h4>
            <p class="helper">Verifiez les interventions, l'habit concerne et les mesures avant d'enregistrer la retouche.</p>
          </div>
        </div>

        <section class="wizard-validation-banner" :class="{ warning: !retoucheValidationStats.measuresConfigured }">
          <div>
            <p class="mobile-overline">Controle final</p>
            <h5>{{ retoucheValidationStats.readyLabel }}</h5>
            <p class="helper">
              {{ !retoucheValidationStats.measuresConfigured
                ? "Certaines retouches n'ont pas encore leur habit ou leurs mesures completes."
                : `La retouche sera creee pour ${retoucheValidationStats.itemsCount} retouche(s) et ouvrira directement son detail.` }}
              </p>
          </div>
          <span class="status-chip" :class="{ warning: !retoucheValidationStats.measuresConfigured }">
            {{ !retoucheValidationStats.measuresConfigured ? "A verifier" : "Pret" }}
          </span>
        </section>

        <div class="beneficiary-summary-grid">
          <article class="summary-pill-card">
            <span>Client</span>
            <strong>1</strong>
          </article>
          <article class="summary-pill-card">
            <span>Interventions</span>
            <strong>{{ retoucheValidationStats.itemsCount }}</strong>
          </article>
          <article class="summary-pill-card">
            <span>Montant</span>
            <strong>{{ formatCurrency(retoucheSummary.montantTotal) }}</strong>
          </article>
          <article class="summary-pill-card">
            <span>Date prevue</span>
            <strong>{{ retoucheValidationStats.datePrevueLabel }}</strong>
          </article>
        </div>

        <div class="wizard-beneficiary-list compact">
          <article class="beneficiary-card">
            <div class="beneficiary-card-head">
              <div>
                <p class="mobile-overline">Client</p>
                <h4>{{ retoucheWizard.mode === 'existing' ? retoucheClientSearchQueryWizard : `${retoucheWizard.newClient.nom} ${retoucheWizard.newClient.prenom}`.trim() }}</h4>
              </div>
              <span class="status-chip">{{ retoucheValidationStats.itemsCount }} retouche(s)</span>
            </div>
            <p class="helper">{{ retoucheValidationStats.factureLabel }}</p>
            <div class="beneficiary-summary-grid wizard-validation-meta-grid">
              <article class="summary-pill-card">
                <span>Mesures</span>
                <strong>{{ retoucheSummary.mesuresRenseignees }}</strong>
              </article>
              <article class="summary-pill-card">
                <span>Completes</span>
                <strong>{{ retoucheValidationStats.completeItems }}/{{ retoucheValidationStats.itemsCount }}</strong>
              </article>
              <article class="summary-pill-card">
                <span>Date prevue</span>
                <strong>{{ retoucheValidationStats.datePrevueLabel }}</strong>
              </article>
            </div>
          </article>

          <article class="beneficiary-card">
            <div class="beneficiary-card-head">
              <div>
                <p class="mobile-overline">Creation</p>
                <h4>Ce qui sera cree</h4>
              </div>
              <span class="status-chip">{{ retoucheValidationStats.readyLabel }}</span>
            </div>
            <ul class="client-insight-list">
              <li>{{ retoucheValidationStats.itemsCount }} retouche(s) seront rattachees a cette fiche.</li>
              <li>{{ retoucheValidationStats.completeItems }} retouche(s) sont deja completement configurees.</li>
              <li>{{ retoucheValidationStats.factureLabel }}.</li>
              <li>Apres creation, le detail retouche s'ouvre automatiquement.</li>
            </ul>
          </article>

          <article class="beneficiary-card">
            <div class="beneficiary-card-head">
              <div>
                <p class="mobile-overline">Retouches</p>
                <h4>Recapitulatif des retouches</h4>
              </div>
              <span class="status-chip">{{ retoucheValidationStats.itemsCount }} ligne(s)</span>
            </div>
            <ul class="client-insight-list">
              <li v-for="item in retoucheSummary.items" :key="`ret-summary-item-${item.idItem}`">
                {{ humanizeContactLabel(item.typeRetouche) || item.typeRetouche || "Retouche" }} - {{ humanizeContactLabel(item.typeHabit) || item.typeHabit || "Habit a definir" }} - {{ getRetoucheMeasureStateLabel(item) }} - {{ formatCurrency(Number(item.prix || 0)) }}
              </li>
            </ul>
          </article>
        </div>

        <div class="modal-actions wizard-modal-actions wizard-actions-footer">
          <button class="mini-btn" @click="retoucheWizard.step = 3">Retour</button>
          <button class="action-btn green" @click="onRetoucheWizardStep4" :disabled="retoucheWizard.submitting">Creer la retouche</button>
        </div>
      </section>
    </div>
  </div>

  <div v-if="detailItemEditModal.open" class="modal-backdrop" @click.self="resetDetailItemEditModal">
    <div class="modal-card">
      <header class="modal-header">
        <div>
          <h3>{{ detailItemEditModal.title }}</h3>
          <p class="helper">{{ detailItemEditModal.subtitle }}</p>
        </div>
      </header>
      <section class="modal-body stack-form">
        <label>Description item</label>
        <input v-model="detailItemEditModal.description" type="text" placeholder="Description" />

        <label>Montant (FC)</label>
        <input v-model="detailItemEditModal.prix" type="number" min="0" step="0.01" />

        <template v-if="detailItemEditModal.fields.length > 0">
          <label>Mesures</label>
          <div class="form-grid">
            <div v-for="field in detailItemEditModal.fields" :key="`detail-edit-${detailItemEditModal.itemId}-${field.key}`" class="form-row">
              <label>{{ mesureDisplayLabel(field) }} <span v-if="field.required">*</span></label>
              <select
                v-if="mesureInputType(field) === 'select'"
                v-model="detailItemEditModal.mesures[field.key]"
              >
                <option value="">Choisir</option>
                <option value="courtes">courtes</option>
                <option value="longues">longues</option>
              </select>
              <input
                v-else
                v-model="detailItemEditModal.mesures[field.key]"
                :type="mesureInputType(field) === 'number' ? 'number' : 'text'"
                min="0"
                :step="mesureInputType(field) === 'number' ? '0.1' : undefined"
                :placeholder="mesurePlaceholder(field)"
              />
            </div>
          </div>
        </template>

        <p v-if="detailItemEditModal.error" class="auth-error">{{ detailItemEditModal.error }}</p>

        <div class="modal-actions">
          <button class="mini-btn" @click="resetDetailItemEditModal">Annuler</button>
          <button class="action-btn blue" :disabled="detailItemEditModal.submitting" @click="submitDetailItemEdit">
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  </div>

  <div v-if="settingsConfirmModal.open" class="modal-backdrop" @click.self="closeSettingsConfirmModal(false)">
    <div class="modal-card modal-card-sm">
      <header class="modal-header">
        <h3>{{ settingsConfirmModal.title }}</h3>
      </header>
      <section class="modal-body">
        <p>{{ settingsConfirmModal.message }}</p>
        <div class="modal-actions">
          <button ref="settingsCancelButtonRef" class="mini-btn" @click="closeSettingsConfirmModal(false)">{{ settingsConfirmModal.cancelLabel }}</button>
          <button class="action-btn red" @click="closeSettingsConfirmModal(true)">{{ settingsConfirmModal.confirmLabel }}</button>
        </div>
      </section>
    </div>
  </div>

  <div
    v-if="actionModal.open"
    class="modal-backdrop"
    :class="{ 'modal-backdrop-front': actionModal.stacked }"
    @click.self="closeActionModal(null)"
  >
    <div class="modal-card modal-card-sm">
      <header class="modal-header">
        <h3>{{ actionModal.title }}</h3>
      </header>
      <section class="modal-body stack-form">
        <p>{{ actionModal.message }}</p>
        <label v-for="field in actionModal.fields" :key="field.key">
          {{ field.label }}
          <textarea
            v-if="field.type === 'textarea'"
            v-model="actionModal.values[field.key]"
            rows="3"
            :placeholder="field.placeholder || ''"
          ></textarea>
          <select v-else-if="field.type === 'select'" v-model="actionModal.values[field.key]">
            <option v-for="option in field.options || []" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <input
            v-else
            v-model="actionModal.values[field.key]"
            :type="field.type || 'text'"
            :min="field.min"
            :placeholder="field.placeholder || ''"
          />
        </label>
        <p v-if="actionModal.error" class="auth-error">{{ actionModal.error }}</p>
        <div class="modal-actions">
          <button ref="actionCancelButtonRef" class="mini-btn" @click="closeActionModal(null)">{{ actionModal.cancelLabel }}</button>
          <button class="action-btn" :class="actionModal.tone" @click="confirmActionModal">{{ actionModal.confirmLabel }}</button>
        </div>
      </section>
    </div>
  </div>
</template>










