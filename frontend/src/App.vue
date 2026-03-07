<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { atelierApi, ApiError, setAuthLostHandler } from "./services/api.js";

const currentRoute = ref("dashboard");
const toast = ref("");
const loading = ref(false);
const errorMessage = ref("");
const authReady = ref(false);
const authenticating = ref(false);
const authError = ref("");
const authMode = ref("checking");
const forbiddenMessage = ref("Acces refuse: permissions insuffisantes.");
const loginForm = reactive({
  email: "",
  motDePasse: ""
});
const showPassword = ref(false);
const authUser = ref(null);
const authPermissions = ref([]);
const bootstrapInitializing = ref(false);

const clients = ref([]);
const commandes = ref([]);
const retouches = ref([]);
const stockArticles = ref([]);
const ventes = ref([]);
const factures = ref([]);
const caisseJour = ref(null);

const stockVentesTab = ref("stock");
const venteSubmitting = ref(false);
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
const commandeSection = ref("liste");
const commandesPagination = reactive({
  page: 1,
  pageSize: 10
});

const retoucheFilters = reactive({
  statut: "ALL",
  client: "ALL",
  periode: "ALL",
  recherche: "",
  soldeRestant: "ALL"
});
const retoucheClientQuery = ref("");
const retoucheSection = ref("liste");
const retouchesPagination = reactive({
  page: 1,
  pageSize: 10
});
const factureFilters = reactive({
  statut: "ALL",
  source: "ALL",
  recherche: "",
  soldeRestant: "ALL"
});
const factureSection = ref("liste");
const facturesPagination = reactive({
  page: 1,
  pageSize: 10
});
const caisseOperationsPagination = reactive({
  page: 1,
  pageSize: 10
});

const dashboardPeriod = ref("LAST_7");
const dashboardPeriodOptions = [
  { value: "TODAY", label: "Aujourd'hui" },
  { value: "LAST_7", label: "7 derniers jours" },
  { value: "LAST_30", label: "30 derniers jours" }
];

const wizard = reactive({
  open: false,
  step: 1,
  mode: "existing",
  existingClientId: "",
  resolvedClientId: "",
  createdCommandeId: "",
  createdFactureId: "",
  submitting: false,
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
    mesuresHabit: {}
  }
});

const retoucheWizard = reactive({
  open: false,
  step: 1,
  mode: "existing",
  existingClientId: "",
  resolvedClientId: "",
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
    mesuresHabit: {}
  }
});
const MAX_CLIENT_SEARCH_RESULTS = 10;
const CLIENT_INSIGHT_PREVIEW_SIZE = 3;
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
const detailLoading = ref(false);
const detailPaiementsLoading = ref(false);
const detailCommandeEventsLoading = ref(false);
const detailError = ref("");

const selectedRetoucheId = ref("");
const detailRetouche = ref(null);
const detailRetouchePaiements = ref([]);
const detailRetoucheEvents = ref([]);
const detailRetoucheLoading = ref(false);
const detailRetouchePaiementsLoading = ref(false);
const detailRetoucheEventsLoading = ref(false);
const detailRetoucheError = ref("");

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

const selectedClientConsultationId = ref("");
const clientConsultationQuery = ref("");
const clientConsultationSection = ref("commandes");
const CLIENT_CONSULT_SECTION_KEY = "atelier.clients_consult.section.v1";
const clientConsultation = ref(null);
const clientConsultationLoading = ref(false);
const clientConsultationError = ref("");
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
const auditCaisseJournalier = ref([]);
const auditOperations = ref([]);
const auditCommandes = ref([]);
const auditRetouches = ref([]);
const auditStockVentes = ref([]);
const auditFactures = ref([]);
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

const SETTINGS_STORAGE_KEY = "atelier.settings.v1";
const settingsEditMode = ref(false);
const settingsConfirmSave = ref(false);
const settingsAuditNote = ref("");
const settingsLoading = ref(false);
const settingsSaving = ref(false);
const settingsError = ref("");
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
  ANNULER_COMMANDE: "Annuler commande/retouche",
  VOIR_BILANS_GLOBAUX: "Voir bilans & audit",
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
      mesuresCibles: ["longueur", "largeurBas"],
      descriptionObligatoire: false,
      habitsCompatibles: ["PANTALON"]
    },
    {
      code: "REPARATION_DECHIRURE",
      libelle: "Reparation dechirure",
      actif: true,
      ordreAffichage: 2,
      necessiteMesures: false,
      mesuresCibles: [],
      descriptionObligatoire: true,
      habitsCompatibles: ["*"]
    },
    {
      code: "REPARATION",
      libelle: "Reparation",
      actif: true,
      ordreAffichage: 3,
      necessiteMesures: false,
      mesuresCibles: [],
      descriptionObligatoire: false,
      habitsCompatibles: ["*"]
    },
    {
      code: "OURLET",
      libelle: "Ourlet",
      actif: true,
      ordreAffichage: 4,
      necessiteMesures: true,
      mesuresCibles: [],
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

const atelierSettingsDefault = {
  meta: {
    version: 1,
    lastSavedAt: ""
  },
  identite: {
    nomAtelier: "Atelier",
    adresse: "",
    telephone: "",
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
    clotureAutoMinuit: true,
    paiementAvantLivraison: true,
    livraisonExpress: true
  },
  facturation: {
    prefixeNumero: "FAC",
    prochainNumero: 1,
    mentions: "Merci pour votre confiance.",
    afficherLogo: true
  },
  securite: {
    rolesAutorises: ["PROPRIETAIRE"],
    confirmationAvantSauvegarde: true,
    verrouillageActif: true,
    auditLog: []
  }
};

const atelierSettings = reactive(cloneSettings(atelierSettingsDefault));

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

function loadAtelierSettingsLocal() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    applySettings(atelierSettings, parsed);
  } catch (err) {
    console.warn("Failed to load atelier settings (local)", err);
  }
}

function serializeSettings() {
  return JSON.stringify(cloneSettings(atelierSettings));
}

function serializeSettingsUser() {
  return JSON.stringify({
    nom: settingsUser.nom,
    role: settingsUser.role
  });
}

function captureSettingsSnapshot() {
  settingsSnapshot.value = serializeSettings();
  settingsUserSnapshot.value = serializeSettingsUser();
}

function restoreSettingsFromSnapshot() {
  if (!settingsSnapshot.value) return;
  try {
    applySettings(atelierSettings, JSON.parse(settingsSnapshot.value));
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
  try {
    settingsLoading.value = true;
    settingsError.value = "";
    const response = await atelierApi.getParametresAtelier();
    if (response?.payload) {
      applySettings(atelierSettings, response.payload);
      if (response.version !== undefined && response.version !== null) {
        atelierSettings.meta.version = Number(response.version || 1);
      }
      persistAtelierSettings();
      captureSettingsSnapshot();
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
    settingsError.value = err instanceof ApiError ? err.message : "Erreur chargement parametres.";
    console.warn("Failed to load atelier settings (api)", err);
  } finally {
    settingsLoading.value = false;
  }
}

function persistAtelierSettings() {
  const payload = cloneSettings(atelierSettings);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
}

const settingsRoleAllowed = computed(() => hasPermission(PERMISSIONS.MODIFIER_PARAMETRES));
const settingsCanEdit = computed(() => settingsEditMode.value && settingsRoleAllowed.value);
const canAccessSecurityModule = computed(() => hasPermission(PERMISSIONS.GERER_UTILISATEURS));
const visibleSettingsTabs = computed(() =>
  settingsTabs.filter((tab) => tab.id !== "securite" || canAccessSecurityModule.value)
);
const settingsLogoPreview = computed(() => (atelierSettings.identite.logoUrl || "").trim());
const atelierLogoUrl = computed(() => settingsLogoPreview.value);
const atelierNomAffichage = computed(() => {
  const value = String(atelierSettings.identite?.nomAtelier || "").trim();
  return value || "Atelier de Couture";
});
const atelierDevise = computed(() => {
  const value = String(atelierSettings.identite?.devise || "").trim().toUpperCase();
  return value || "FC";
});
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
  const noteDirty = settingsAuditNote.value.trim().length > 0;
  const userDirty = serializeSettingsUser() !== settingsUserSnapshot.value;
  return serializeSettings() !== settingsSnapshot.value || userDirty || noteDirty;
});
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
  return [
    {
      code: "OURLET_PANTALON",
      libelle: "Ourlet pantalon",
      actif: true,
      ordreAffichage: 1,
      necessiteMesures: true,
      mesuresCibles: ["longueur", "largeurBas"],
      descriptionObligatoire: false,
      habitsCompatibles: ["PANTALON"]
    },
    {
      code: "REPARATION_DECHIRURE",
      libelle: "Reparation dechirure",
      actif: true,
      ordreAffichage: 2,
      necessiteMesures: false,
      mesuresCibles: [],
      descriptionObligatoire: true,
      habitsCompatibles: ["*"]
    },
    {
      code: "REPARATION",
      libelle: "Reparation",
      actif: true,
      ordreAffichage: 3,
      necessiteMesures: false,
      mesuresCibles: [],
      descriptionObligatoire: false,
      habitsCompatibles: ["*"]
    },
    {
      code: "OURLET",
      libelle: "Ourlet",
      actif: true,
      ordreAffichage: 4,
      necessiteMesures: true,
      mesuresCibles: [],
      descriptionObligatoire: false,
      habitsCompatibles: ["*"]
    }
  ];
});
const retoucheTypeOptions = computed(() => {
  const selectedHabit = String(retoucheWizard.retouche.typeHabit || "").trim().toUpperCase();
  return availableRetoucheTypeDefinitions.value
    .filter((row) => row?.actif !== false)
    .filter((row) => {
      if (!selectedHabit) return true;
      const compatibles = Array.isArray(row?.habitsCompatibles) ? row.habitsCompatibles : ["*"];
      return compatibles.includes("*") || compatibles.includes(selectedHabit);
    })
    .map((row) => ({
      value: row.code,
      label: row.libelle,
      definition: row
    }));
});
const selectedRetoucheTypeDefinition = computed(() => {
  const code = String(retoucheWizard.retouche.typeRetouche || "").trim().toUpperCase();
  return retoucheTypeOptions.value.find((row) => row.value === code)?.definition || null;
});
const retoucheDescriptionRequired = computed(
  () => Boolean(selectedRetoucheTypeDefinition.value?.descriptionObligatoire || atelierSettings.retouches?.descriptionObligatoire)
);
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
      ...(row.mesuresCibles || [])
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
  const current = cloneSettings(atelierSettings);
  const snapshot = settingsSnapshotParsed.value;
  if (tabId === "identite") return JSON.stringify(current.identite || {}) !== JSON.stringify(snapshot.identite || {});
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

function selectSettingsHabit(habitKey) {
  selectedSettingsHabitKey.value = habitKey;
}

function isHabitTypeUsed(habitKey) {
  return settingsUsedHabitTypes.value.has(String(habitKey || "").trim().toUpperCase());
}

function onHabitActiveToggle(habitKey, nextValue) {
  if (nextValue !== false) return;
  if (!isHabitTypeUsed(habitKey)) return;
  const habit = atelierSettings.habits[habitKey];
  if (habit) habit.actif = true;
  notify("Archivage bloque: ce type d'habit est deja utilise par des commandes ou des retouches.");
}

async function duplicateHabitType(sourceKey) {
  if (!settingsCanEdit.value) return;
  const source = atelierSettings.habits[sourceKey];
  if (!source) return;
  const payload = await openActionModal({
    title: "Dupliquer un type d'habit",
    message: `Creer une copie du type ${sourceKey}.`,
    confirmLabel: "Dupliquer",
    cancelLabel: "Annuler",
    fields: [
      { key: "code", label: "Nouveau code", type: "text", required: true, defaultValue: `${sourceKey}_COPIE` },
      { key: "label", label: "Nouveau libelle", type: "text", required: true, defaultValue: `${source.label || sourceKey} copie` },
      { key: "ordre", label: "Ordre", type: "number", required: true, min: 0, defaultValue: Number(source.ordre || 0) + 1 }
    ]
  });
  if (!payload) return;
  const newKey = normalizeHabitTypeKeyInput(payload.code);
  if (!newKey) {
    notify("Code de type d'habit invalide.");
    return;
  }
  if (atelierSettings.habits[newKey]) {
    notify(`Le type d'habit ${newKey} existe deja.`);
    return;
  }
  atelierSettings.habits[newKey] = {
    label: String(payload.label || "").trim(),
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

function normalizeRetoucheTypeDefinition(raw) {
  const code = String(raw?.code || "").trim().toUpperCase();
  if (!code) return null;
  const habitsCompatibles = Array.isArray(raw?.habitsCompatibles)
    ? raw.habitsCompatibles.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : ["*"];
  const mesuresCibles = Array.isArray(raw?.mesuresCibles)
    ? raw.mesuresCibles.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return {
    code,
    libelle: String(raw?.libelle || code).trim() || code,
    actif: raw?.actif !== false,
    ordreAffichage: Number.isFinite(Number(raw?.ordreAffichage)) ? Number(raw.ordreAffichage) : Number.MAX_SAFE_INTEGER,
    necessiteMesures: raw?.necessiteMesures === true,
    mesuresCibles,
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
  row.mesuresCibles = Array.isArray(row.mesuresCibles)
    ? row.mesuresCibles.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  row.habitsCompatibles = Array.isArray(row.habitsCompatibles)
    ? row.habitsCompatibles.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : ["*"];
  if (row.habitsCompatibles.length === 0) row.habitsCompatibles = ["*"];
  return row;
}

function prepareHabitSettingsForSave(habitsRaw) {
  if (!habitsRaw || typeof habitsRaw !== "object") throw new Error("Configuration des habits invalide.");
  const prepared = {};
  const habitOrders = new Set();
  for (const [rawKey, habit] of Object.entries(habitsRaw)) {
    const key = normalizeHabitTypeKeyInput(rawKey);
    if (!key) throw new Error("Chaque type d'habit doit avoir un code valide.");
    if (!habit || typeof habit !== "object") throw new Error(`Configuration invalide pour le type d'habit ${key}.`);
    const label = String(habit.label || "").trim();
    if (!label) throw new Error(`Le libelle du type d'habit ${key} est obligatoire.`);
    if (habit.actif === false && isHabitTypeUsed(key)) {
      throw new Error(`Impossible d'archiver ${label}: ce type d'habit est deja utilise par des commandes ou des retouches.`);
    }
    const ordre = normalizeSortOrder(habit.ordre, NaN);
    if (!Number.isFinite(ordre)) throw new Error(`L'ordre du type d'habit ${label} est obligatoire.`);
    if (habitOrders.has(ordre)) throw new Error(`Ordre de type d'habit duplique: ${ordre}.`);
    habitOrders.add(ordre);
    const mesuresRaw = Array.isArray(habit.mesures) ? habit.mesures : [];
    const measureCodes = new Set();
    const measureOrders = new Set();
    const mesures = mesuresRaw.map((mesure, index) => {
      const code = String(mesure?.code || "").trim();
      if (!code) throw new Error(`Une mesure du type ${label} n'a pas de code.`);
      if (measureCodes.has(code)) throw new Error(`Code de mesure duplique pour ${label}: ${code}.`);
      measureCodes.add(code);
      const mesureLabel = String(mesure?.label || "").trim();
      if (!mesureLabel) throw new Error(`Le libelle de la mesure ${code} est obligatoire.`);
      const mesureOrdre = normalizeSortOrder(mesure?.ordre, NaN);
      if (!Number.isFinite(mesureOrdre)) throw new Error(`L'ordre de la mesure ${code} est obligatoire.`);
      if (measureOrders.has(mesureOrdre)) throw new Error(`Ordre de mesure duplique pour ${label}: ${mesureOrdre}.`);
      measureOrders.add(mesureOrdre);
      const typeChamp = normalizeMesureFieldType(mesure?.typeChamp);
      if (String(mesure?.typeChamp || "").trim() && typeChamp !== String(mesure?.typeChamp || "").trim().toLowerCase()) {
        throw new Error(`typeChamp invalide pour ${label} / ${code}. Valeurs autorisees: number, text, select.`);
      }
      return {
        code,
        label: mesureLabel,
        obligatoire: normalizeBoolean(mesure?.obligatoire, false),
        actif: normalizeBoolean(mesure?.actif, true),
        ordre: mesureOrdre,
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
  const orders = new Set();
  const typesRetouche = sourceTypes.map((row, index) => {
    const draft = ensureRetoucheTypeDraft({ ...row }, index + 1);
    if (!draft) throw new Error("Un type de retouche a un code invalide.");
    if (codes.has(draft.code)) throw new Error(`Code de type de retouche duplique: ${draft.code}.`);
    codes.add(draft.code);
    if (orders.has(draft.ordreAffichage)) throw new Error(`Ordre de type de retouche duplique: ${draft.ordreAffichage}.`);
    orders.add(draft.ordreAffichage);
    const uniqueCibles = Array.from(new Set(draft.mesuresCibles));
    const uniqueHabits = Array.from(new Set(draft.habitsCompatibles));
    if (uniqueHabits.length === 0) uniqueHabits.push("*");
    return {
      code: draft.code,
      libelle: draft.libelle,
      actif: draft.actif !== false,
      ordreAffichage: Number(draft.ordreAffichage),
      necessiteMesures: draft.necessiteMesures === true,
      mesuresCibles: uniqueCibles,
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
    message: "Creer un nouveau type de retouche parametrable.",
    confirmLabel: "Creer",
    cancelLabel: "Annuler",
    fields: [
      { key: "code", label: "Code", type: "text", required: true, defaultValue: "" },
      { key: "libelle", label: "Libelle", type: "text", required: true, defaultValue: "" },
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
  const code = normalizeHabitTypeKeyInput(payload.code);
  if (!code) return notify("Code de type de retouche invalide.");
  const list = atelierSettings.retouches.typesRetouche;
  if (list.some((row) => String(row?.code || "").trim().toUpperCase() === code)) {
    return notify(`Le type de retouche ${code} existe deja.`);
  }
  list.push(
    ensureRetoucheTypeDraft(
      {
        code,
        libelle: String(payload.libelle || "").trim(),
        actif: true,
        ordreAffichage: Number(payload.ordreAffichage),
        necessiteMesures: false,
        mesuresCibles: [],
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
  const list = atelierSettings.retouches.typesRetouche;
  const index = list.findIndex((row) => String(row?.code || "").trim().toUpperCase() === String(code || "").trim().toUpperCase());
  if (index === -1) return;
  list.splice(index, 1);
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

function addMesureToHabit(habitKey) {
  if (!settingsCanEdit.value) return;
  const habit = atelierSettings.habits[habitKey];
  if (!habit) return;
  const code = `mesure_${Date.now().toString(36)}`;
  habit.mesures.push({
    code,
    label: "Nouvelle mesure",
    obligatoire: false,
    actif: true,
    ordre: habit.mesures.length + 1,
    typeChamp: "number"
  });
}

function removeMesureFromHabit(habitKey, mesureCode) {
  if (!settingsCanEdit.value) return;
  const habit = atelierSettings.habits[habitKey];
  if (!habit) return;
  const index = habit.mesures.findIndex((mesure) => String(mesure?.code || "") === String(mesureCode || ""));
  if (index === -1) return;
  habit.mesures.splice(index, 1);
}

async function addHabitType() {
  if (!settingsCanEdit.value) return;
  const payload = await openActionModal({
    title: "Nouveau type d'habit",
    message: "Creer un nouveau type d'habit pour la saisie des mesures.",
    confirmLabel: "Creer",
    cancelLabel: "Annuler",
    fields: [
      { key: "code", label: "Code", type: "text", required: true, defaultValue: "" },
      { key: "label", label: "Libelle", type: "text", required: true, defaultValue: "" },
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
  const key = normalizeHabitTypeKeyInput(payload.code);
  if (!key) {
    notify("Code de type d'habit invalide.");
    return;
  }
  if (atelierSettings.habits[key]) {
    notify(`Le type d'habit ${key} existe deja.`);
    return;
  }
  const order = Number(payload.ordre);
  if (!Number.isFinite(order) || order < 0) {
    notify("Ordre invalide pour le type d'habit.");
    return;
  }
  atelierSettings.habits[key] = {
    label: String(payload.label || "").trim(),
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
    persistAtelierSettings();
    captureSettingsSnapshot();
    settingsConfirmSave.value = false;
    settingsAuditNote.value = "";
    settingsEditMode.value = false;
    notify("Parametres atelier sauvegardes.");
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde des parametres.";
    settingsError.value = message;
    notify(message);
  } finally {
    settingsSaving.value = false;
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

function roleHasPermission(roleId, permission) {
  return getRolePermissionSet(roleId).has(permission);
}

function setRolePermission(roleId, permission, enabled) {
  const role = String(roleId || "").toUpperCase();
  const next = getRolePermissionSet(role);
  if (enabled) next.add(permission);
  else next.delete(permission);
  securityRolePermissions.value = {
    ...securityRolePermissions.value,
    [role]: [...next]
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
      map[role] = Array.from(new Set((row.permissions || []).map((p) => String(p || "").toUpperCase())));
    }
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
  fields = []
}) {
  actionModal.title = title;
  actionModal.message = message;
  actionModal.confirmLabel = confirmLabel;
  actionModal.cancelLabel = cancelLabel;
  actionModal.tone = tone;
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
  const nextPermissions = Array.from(new Set((securityRolePermissions.value[role] || []).map((p) => String(p || "").toUpperCase())));
  if (role === "PROPRIETAIRE" && !nextPermissions.includes(PERMISSIONS.GERER_UTILISATEURS)) {
    securityError.value = "Le role proprietaire doit garder la permission de gestion des utilisateurs.";
    return;
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
  VOIR_BILANS_GLOBAUX: "VOIR_BILANS_GLOBAUX",
  CLOTURER_CAISSE: "CLOTURER_CAISSE",
  LIVRER_COMMANDE: "LIVRER_COMMANDE",
  TERMINER_COMMANDE: "TERMINER_COMMANDE",
  MODIFIER_PARAMETRES: "MODIFIER_PARAMETRES",
  GERER_UTILISATEURS: "GERER_UTILISATEURS"
};

function normalizeSessionPayload(payload) {
  return atelierApi.normalizeSession(payload);
}

const isAuthenticated = computed(() => Boolean(authUser.value));
const currentRole = computed(() => String(authUser.value?.roleId || "").toUpperCase());
const atelierNomConnexion = computed(() => {
  return atelierNomAffichage.value;
});

function hasPermission(permission) {
  if (!permission) return true;
  if (!isAuthenticated.value) return false;
  if (currentRole.value === "PROPRIETAIRE") return true;
  return authPermissions.value.includes(permission);
}

function hasAnyPermission(list = []) {
  if (!Array.isArray(list) || list.length === 0) return isAuthenticated.value;
  return list.some((permission) => hasPermission(permission));
}

function canAccessModule(moduleId) {
  if (!isAuthenticated.value) return false;
  if (currentRole.value === "PROPRIETAIRE") return true;
  if (moduleId === "dashboard") return true;
  if (moduleId === "commandes") {
    if (currentRole.value === "CAISSIER" || currentRole.value === "COUTURIER") return true;
    return hasAnyPermission([PERMISSIONS.TERMINER_COMMANDE, PERMISSIONS.LIVRER_COMMANDE, PERMISSIONS.ANNULER_COMMANDE]);
  }
  if (moduleId === "retouches") return currentRole.value === "CAISSIER" || currentRole.value === "COUTURIER" || canAccessModule("commandes");
  if (moduleId === "clientsMesures") return currentRole.value === "CAISSIER" || currentRole.value === "COUTURIER" || canAccessModule("commandes");
  if (moduleId === "caisse") return currentRole.value === "CAISSIER" || hasPermission(PERMISSIONS.CLOTURER_CAISSE);
  if (moduleId === "facturation") return currentRole.value === "CAISSIER" || canAccessModule("commandes");
  if (moduleId === "stockVentes") return hasPermission(PERMISSIONS.VOIR_BILANS_GLOBAUX);
  if (moduleId === "parametres") return hasPermission(PERMISSIONS.MODIFIER_PARAMETRES);
  if (moduleId === "audit") return hasPermission(PERMISSIONS.VOIR_BILANS_GLOBAUX);
  return false;
}

function canAccessRoute(routeId) {
  if (routeId === "commande-detail" || routeId === "retouche-detail") return canAccessModule("commandes");
  if (routeId === "vente-detail") return canAccessModule("stockVentes");
  if (routeId === "facture-detail") return canAccessModule("facturation");
  if (routeId === "forbidden") return true;
  return canAccessModule(routeId);
}

const menuItems = [
  { id: "dashboard", label: "Tableau de Bord", icon: "dashboard" },
  { id: "commandes", label: "Commandes", icon: "clipboard" },
  { id: "retouches", label: "Retouches", icon: "scissors" },
  { id: "clientsMesures", label: "Clients & Mesures", icon: "users" },
  { id: "caisse", label: "Caisse", icon: "wallet" },
  { id: "stockVentes", label: "Stock & Ventes", icon: "box" },
  { id: "facturation", label: "Facturation", icon: "invoice" },
  { id: "parametres", label: "Parametres Atelier", icon: "settings" },
  { id: "audit", label: "Historique & Audit", icon: "history" }
];

const visibleMenuItems = computed(() => menuItems.filter((item) => canAccessModule(item.id)));

const auditRoutes = [
  { path: "/audit", title: "Historique & Audit", subtitle: "Hub de navigation audit" },
  { path: "/audit/caisse", title: "Audit de la Caisse", subtitle: "Bilans journaliers, hebdomadaires et mensuels" },
  { path: "/audit/operations", title: "Audit des Operations", subtitle: "Journal global des operations financieres" },
  { path: "/audit/commandes", title: "Audit des Commandes", subtitle: "Historique commandes, paiements, livraisons, annulations" },
  { path: "/audit/retouches", title: "Audit des Retouches", subtitle: "Historique retouches, paiements, livraisons" },
  { path: "/audit/stock-ventes", title: "Audit Stock & Ventes", subtitle: "Ventes, sorties stock et lien caisse" },
  { path: "/audit/factures", title: "Audit des Factures", subtitle: "Factures emises en lecture seule" },
  { path: "/audit/utilisateurs", title: "Audit Utilisateurs", subtitle: "Journal des actions de securite et gestion utilisateurs" },
  { path: "/audit/annuel", title: "Audit Annuel", subtitle: "Prevu: consolidation annuelle" }
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

const wizardClientSearchResults = computed(() => searchClients(wizardClientSearchQuery.value));
const retoucheClientSearchResultsWizard = computed(() => searchClients(retoucheClientSearchQueryWizard.value));

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
  if (!idClient) {
    resetWizardClientInsight();
    return;
  }

  const requestId = wizardClientInsightRequestId.value + 1;
  wizardClientInsightRequestId.value = requestId;
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
  if (!idClient) {
    resetRetoucheClientInsight();
    return;
  }

  const requestId = retoucheClientInsightRequestId.value + 1;
  retoucheClientInsightRequestId.value = requestId;
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

const currentTitle = computed(() => {
  if (currentRoute.value === "commande-detail") return "Detail Commande";
  if (currentRoute.value === "retouche-detail") return "Detail Retouche";
  if (currentRoute.value === "vente-detail") return "Detail Vente";
  if (currentRoute.value === "facture-detail") return "Detail Facture";
  if (currentRoute.value === "forbidden") return "Acces refuse";
  if (currentRoute.value === "audit") {
    return auditRoutes.find((item) => item.path === auditSubRoute.value)?.title || "Historique & Audit";
  }
  return menuItems.find((item) => item.id === currentRoute.value)?.label || "Atelier";
});

const currentAuditRoute = computed(() => {
  return auditRoutes.find((item) => item.path === auditSubRoute.value) || auditRoutes[0];
});

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

const detailVenteFacture = computed(() => {
  const id = detailVente.value?.idVente;
  if (!id) return null;
  return findFactureByOrigine("VENTE", id);
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

const facturesPages = computed(() => Math.max(1, Math.ceil(facturesFiltered.value.length / facturesPagination.pageSize)));
const facturesPaged = computed(() => {
  const start = (facturesPagination.page - 1) * facturesPagination.pageSize;
  return facturesFiltered.value.slice(start, start + facturesPagination.pageSize);
});

const facturesKpi = computed(() => ({
  total: facturesFiltered.value.length,
  reglees: facturesFiltered.value.filter((row) => Number(row.solde || 0) === 0).length,
  enAttente: facturesFiltered.value.filter((row) => Number(row.solde || 0) > 0).length,
  montantTotal: facturesFiltered.value.reduce((sum, row) => sum + Number(row.montantTotal || 0), 0)
}));
const auditUtilisateursActions = computed(() => {
  const dynamic = Array.from(new Set(auditUtilisateurs.value.map((row) => String(row.action || "").toUpperCase()).filter(Boolean)));
  return ["ALL", ...dynamic];
});
const auditUtilisateursFiltered = computed(() => {
  const query = auditUtilisateursFiltres.recherche.trim().toLowerCase();
  return auditUtilisateurs.value.filter((row) => {
    if (auditUtilisateursFiltres.action !== "ALL" && String(row.action || "").toUpperCase() !== auditUtilisateursFiltres.action) return false;
    const succes = row.payload?.succes === true;
    if (auditUtilisateursFiltres.statut === "SUCCES" && !succes) return false;
    if (auditUtilisateursFiltres.statut === "ECHEC" && succes) return false;
    if (!query) return true;
    const haystack = `${row.utilisateurId || ""} ${row.role || ""} ${row.action || ""} ${row.entite || ""} ${row.entiteId || ""} ${JSON.stringify(row.payload || {})}`.toLowerCase();
    return haystack.includes(query);
  });
});
const auditUtilisateursPages = computed(() => Math.max(1, Math.ceil(auditUtilisateursFiltered.value.length / auditUtilisateursPagination.pageSize)));
const auditUtilisateursPaged = computed(() => {
  const page = Math.min(Math.max(1, auditUtilisateursPagination.page), auditUtilisateursPages.value);
  const start = (page - 1) * auditUtilisateursPagination.pageSize;
  return auditUtilisateursFiltered.value.slice(start, start + auditUtilisateursPagination.pageSize);
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

function resolveHabitUiDefinition(typeHabit) {
  const type = String(typeHabit || "").trim().toUpperCase();
  if (!type) return null;
  const configured = atelierSettings.habits?.[type];
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
  const type = retoucheWizard.retouche.typeHabit;
  const def = resolveHabitUiDefinition(type);
  if (!def) return [];
  const cibles = Array.isArray(selectedRetoucheTypeDefinition.value?.mesuresCibles)
    ? selectedRetoucheTypeDefinition.value.mesuresCibles.filter(Boolean)
    : [];
  const filteredRequired = cibles.length > 0 ? def.required.filter((key) => cibles.includes(key)) : def.required;
  const filteredOptional = cibles.length > 0 ? def.optional.filter((key) => cibles.includes(key)) : def.optional;
  return [
    ...filteredRequired.map((key) => ({
      key,
      label: def.labels?.[key] || mesureLabelFromKey(key),
      required: false,
      inputType: def.fieldTypes?.[key] || "number"
    })),
    ...filteredOptional.map((key) => ({
      key,
      label: def.labels?.[key] || mesureLabelFromKey(key),
      required: false,
      inputType: def.fieldTypes?.[key] || "number"
    }))
  ];
});

const lowStockArticles = computed(() =>
  stockArticles.value.filter((a) => Number(a.quantiteDisponible || 0) <= Number(a.seuilAlerte || 0))
);

const dashboardCards = computed(() => [
  {
    label: "Commandes creees aujourd'hui",
    value: commandesView.value.filter((c) => dateOnly(c.dateCreation) === todayIso()).length,
    tone: "blue"
  },
  {
    label: "Retouches creees aujourd'hui",
    value: retouches.value.filter((r) => dateOnly(r.dateDepot) === todayIso()).length,
    tone: "teal"
  },
  { label: "Commandes en cours", value: commandesView.value.filter((c) => c.statutCommande === "EN_COURS").length, tone: "blue" },
  { label: "Commandes pretes", value: commandesView.value.filter((c) => c.statutCommande === "TERMINEE").length, tone: "green" },
  {
    label: "Commandes a solder",
    value: commandesView.value.filter((c) => c.soldeRestant > 0 && c.statutCommande !== "ANNULEE").length,
    tone: "amber"
  },
  { label: "Retouches en cours", value: retouches.value.filter((r) => r.statutRetouche === "EN_COURS").length, tone: "teal" },
  { label: "Retouches a solder", value: retouchesView.value.filter((r) => r.soldeRestant > 0).length, tone: "amber" },
  { label: "Clients actifs", value: clients.value.filter((c) => c.actif !== false).length, tone: "slate" }
]);

const financeMetrics = computed(() => {
  const ops = (caisseJour.value?.operations || []).filter((op) => op.statutOperation !== "ANNULEE");
  const totalEntrees = ops.filter((op) => op.typeOperation === "ENTREE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  const avances = ops
    .filter((op) => op.typeOperation === "ENTREE" && String(op.motif || "").startsWith("AVANCE"))
    .reduce((sum, op) => sum + Number(op.montant || 0), 0);

  return {
    soldeCaisse: Number(caisseJour.value?.soldeCourant || 0),
    totalEncaissement: totalEntrees,
    depensesJour: totalSorties,
    avancesRecues: avances
  };
});

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

  const rows = [...cmdRows, ...retRows];
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
const caisseOperations = computed(() => caisseJour.value?.operations || []);
const caisseOperationsPages = computed(() => Math.max(1, Math.ceil(caisseOperations.value.length / caisseOperationsPagination.pageSize)));
const caisseOperationsPaged = computed(() => {
  const page = Math.min(Math.max(1, caisseOperationsPagination.page), caisseOperationsPages.value);
  const start = (page - 1) * caisseOperationsPagination.pageSize;
  return caisseOperations.value.slice(start, start + caisseOperationsPagination.pageSize);
});
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
const commandesPages = computed(() => Math.max(1, Math.ceil(commandesFiltered.value.length / commandesPagination.pageSize)));
const commandesPaged = computed(() => {
  const start = (commandesPagination.page - 1) * commandesPagination.pageSize;
  return commandesFiltered.value.slice(start, start + commandesPagination.pageSize);
});
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
const retouchesPages = computed(() => Math.max(1, Math.ceil(retouchesFiltered.value.length / retouchesPagination.pageSize)));
const retouchesPaged = computed(() => {
  const start = (retouchesPagination.page - 1) * retouchesPagination.pageSize;
  return retouchesFiltered.value.slice(start, start + retouchesPagination.pageSize);
});
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
    annuler: actions.annuler === true
  };
}

async function loadCommandeActionsForId(idCommande, { force = false, detail = false } = {}) {
  const id = String(idCommande || "");
  if (!id) return null;
  if (!force && hasActionEntry(commandeActionsById, id)) {
    const cached = readActionEntry(commandeActionsById, id);
    if (detail) detailCommandeActions.value = cached;
    return cached;
  }
  try {
    const payload = await atelierApi.getCommandeActions(id);
    const normalized = normalizeActionFlags(payload);
    commandeActionsById.value = { ...commandeActionsById.value, [id]: normalized };
    if (detail) detailCommandeActions.value = normalized;
    return normalized;
  } catch {
    commandeActionsById.value = { ...commandeActionsById.value, [id]: null };
    if (detail) detailCommandeActions.value = null;
    return null;
  }
}

async function loadRetoucheActionsForId(idRetouche, { force = false, detail = false } = {}) {
  const id = String(idRetouche || "");
  if (!id) return null;
  if (!force && hasActionEntry(retoucheActionsById, id)) {
    const cached = readActionEntry(retoucheActionsById, id);
    if (detail) detailRetoucheActions.value = cached;
    return cached;
  }
  try {
    const payload = await atelierApi.getRetoucheActions(id);
    const normalized = normalizeActionFlags(payload);
    retoucheActionsById.value = { ...retoucheActionsById.value, [id]: normalized };
    if (detail) detailRetoucheActions.value = normalized;
    return normalized;
  } catch {
    retoucheActionsById.value = { ...retoucheActionsById.value, [id]: null };
    if (detail) detailRetoucheActions.value = null;
    return null;
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
  const canLeave = await canLeaveSettings();
  if (!canLeave) {
    window.history.pushState({}, "", "/");
    return;
  }
  const auditPath = normalizeAuditPath(window.location.pathname);
  if (!auditPath) return;
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
    return;
  }
  authUser.value = {
    id: session.id || "",
    nom: session.nom || "",
    email: session.email || "",
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
    const isAuthNoise = lowered.includes("acces non autorise") || lowered.includes("connexion requise");
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
  authMode.value = "checking";
  try {
    const ownerExists = await atelierApi.hasOwnerBootstrapDone();
    authMode.value = ownerExists ? "login" : "bootstrap";
  } catch {
    authMode.value = "login";
  }
}

async function submitLogin() {
  if (authenticating.value) return;
  authError.value = "";
  authenticating.value = true;
  try {
    const response = await atelierApi.login({
      email: loginForm.email.trim(),
      motDePasse: loginForm.motDePasse
    });
    const session = normalizeSessionPayload(response?.utilisateur ? { ...response.utilisateur } : await atelierApi.me());
    applyAuthSession(session);
    authMode.value = "login";
    loginForm.motDePasse = "";
    await loadAtelierSettings();
    await reloadAll();
    if (!canAccessRoute(currentRoute.value)) currentRoute.value = "dashboard";
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

  bootstrapInitializing.value = true;
  authError.value = "";
  try {
    await atelierApi.bootstrapOwner({
      nom: String(payload.nom || "").trim(),
      email: String(payload.email || "").trim(),
      motDePasse: String(payload.motDePasse || "")
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

async function submitLogout() {
  try {
    await atelierApi.logout();
  } catch {
    // ignore logout transport errors
  }
  applyAuthSession(null);
  authError.value = "";
  currentRoute.value = "dashboard";
}

onMounted(async () => {
  loadAtelierSettingsLocal();
  setAuthLostHandler((context) => {
    if (!isAuthenticated.value) return;
    const reason = String(context?.reason || "").trim();
    authError.value = reason || "Session expiree. Reconnecte-toi.";
  });
  syncRouteFromLocation();
  loadClientConsultationSectionPreference();
  window.addEventListener("popstate", onBrowserNavigation);
  window.addEventListener("beforeunload", onBeforeUnload);
  await hydrateAuthSession();
  if (!isAuthenticated.value) {
    await detectAuthMode();
  }
  if (isAuthenticated.value) {
    await loadAtelierSettings();
    await reloadAll();
    if (currentRoute.value === "audit") loadAuditPage(auditSubRoute.value);
    if (!canAccessRoute(currentRoute.value)) currentRoute.value = "forbidden";
  }
  authReady.value = true;
});

onUnmounted(() => {
  setAuthLostHandler(null);
  window.removeEventListener("popstate", onBrowserNavigation);
  window.removeEventListener("beforeunload", onBeforeUnload);
});

watch(
  () => [isAuthenticated.value, currentRole.value, authPermissions.value.join("|"), currentRoute.value],
  () => {
    if (!authReady.value) return;
    if (!isAuthenticated.value) return;
    if (!canAccessRoute(currentRoute.value)) {
      forbiddenMessage.value = "Acces refuse pour cette section.";
      currentRoute.value = "forbidden";
    }
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
    retouchesPagination.page = 1;
  }
);

watch(retouchesPages, (total) => {
  if (retouchesPagination.page > total) retouchesPagination.page = total;
});

watch(
  () => [factureFilters.statut, factureFilters.source, factureFilters.recherche, factureFilters.soldeRestant, facturesPagination.pageSize],
  () => {
    facturesPagination.page = 1;
  }
);

watch(facturesPages, (total) => {
  if (facturesPagination.page > total) facturesPagination.page = total;
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
    commandesPagination.page = 1;
  }
);

watch(commandesPages, (total) => {
  if (commandesPagination.page > total) commandesPagination.page = total;
});

watch(caisseOperationsPages, (total) => {
  if (caisseOperationsPagination.page > total) caisseOperationsPagination.page = total;
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
  () => wizard.commande.typeHabit,
  () => {
    wizard.commande.mesuresHabit = {};
    resetMesuresModel(wizard.commande.mesuresHabit);
  }
);

watch(
  () => retoucheWizard.retouche.typeHabit,
  () => {
    retoucheWizard.retouche.mesuresHabit = {};
    resetMesuresModel(retoucheWizard.retouche.mesuresHabit);
    const currentType = String(retoucheWizard.retouche.typeRetouche || "").trim().toUpperCase();
    const stillAllowed = retoucheTypeOptions.value.some((option) => option.value === currentType);
    if (!stillAllowed) {
      retoucheWizard.retouche.typeRetouche = retoucheTypeOptions.value[0]?.value || "";
    }
  }
);

watch(
  () => retoucheTypeOptions.value.map((row) => row.value).join("|"),
  () => {
    const currentType = String(retoucheWizard.retouche.typeRetouche || "").trim().toUpperCase();
    if (!retoucheTypeOptions.value.some((option) => option.value === currentType)) {
      retoucheWizard.retouche.typeRetouche = retoucheTypeOptions.value[0]?.value || "";
    }
  },
  { immediate: true }
);

function notify(message) {
  toast.value = message;
  setTimeout(() => {
    if (toast.value === message) toast.value = "";
  }, 2600);
}

function resetRetoucheFilters() {
  retoucheFilters.statut = "ALL";
  retoucheFilters.client = "ALL";
  retoucheFilters.periode = "ALL";
  retoucheFilters.recherche = "";
  retoucheFilters.soldeRestant = "ALL";
  retoucheClientQuery.value = "";
  retouchesPagination.page = 1;
}

function resetFactureFilters() {
  factureFilters.statut = "ALL";
  factureFilters.source = "ALL";
  factureFilters.recherche = "";
  factureFilters.soldeRestant = "ALL";
  facturesPagination.page = 1;
}

function resetCommandeFilters() {
  filters.statut = "ALL";
  filters.client = "ALL";
  filters.periode = "ALL";
  filters.recherche = "";
  filters.soldeRestant = "ALL";
  commandeClientQuery.value = "";
  commandesPagination.page = 1;
}

async function openRoute(routeId) {
  if (!isAuthenticated.value) {
    authError.value = "Connexion requise.";
    return;
  }
  if (!canAccessRoute(routeId)) {
    forbiddenMessage.value = "Acces refuse pour cette section.";
    currentRoute.value = "forbidden";
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
  currentRoute.value = routeId;
  if (routeId === "clientsMesures" && selectedClientConsultationId.value) {
    loadClientConsultation(selectedClientConsultationId.value);
  }
}

async function reloadAll() {
  loading.value = true;
  errorMessage.value = "";
  commandeActionsById.value = {};
  retoucheActionsById.value = {};
  detailCommandeActions.value = null;
  detailRetoucheActions.value = null;

  const [clientsResult, commandesResult, retouchesResult, retoucheTypesResult, stockResult, ventesResult, facturesResult, caisseDaysResult] =
    await Promise.allSettled([
    atelierApi.listClients(),
    atelierApi.listCommandes(),
    atelierApi.listRetouches(),
    atelierApi.listRetoucheTypes(),
    atelierApi.listStockArticles(),
    atelierApi.listVentes(),
    atelierApi.listFactures(),
    atelierApi.listCaisseJours()
    ]);

  if (clientsResult.status === "fulfilled") {
    clients.value = clientsResult.value.map(normalizeClient);
    if (!selectedClientConsultationId.value && clients.value.length > 0) {
      selectedClientConsultationId.value = clients.value[0].idClient;
    }
    if (selectedClientConsultationId.value && !clients.value.some((item) => item.idClient === selectedClientConsultationId.value)) {
      selectedClientConsultationId.value = clients.value[0]?.idClient || "";
      clientConsultation.value = null;
    }
  } else appendError(clientsResult.reason);

  if (commandesResult.status === "fulfilled") commandes.value = commandesResult.value.map(normalizeCommande);
  else appendError(commandesResult.reason);

  if (retouchesResult.status === "fulfilled") retouches.value = retouchesResult.value.map(normalizeRetouche);
  else appendError(retouchesResult.reason);

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
  } else appendError(retoucheTypesResult.reason);

  if (stockResult.status === "fulfilled") stockArticles.value = stockResult.value.map(normalizeStockArticle);
  else appendError(stockResult.reason);

  if (ventesResult.status === "fulfilled") ventes.value = ventesResult.value.map(normalizeVente);
  else appendError(ventesResult.reason);

  if (facturesResult.status === "fulfilled") factures.value = facturesResult.value.map(normalizeFacture);
  else appendError(facturesResult.reason);

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
  } else {
    appendError(caisseDaysResult.reason);
  }

  if (currentRoute.value === "clientsMesures" && selectedClientConsultationId.value) {
    await loadClientConsultation(selectedClientConsultationId.value, true);
  }

  loading.value = false;
}

async function loadClientConsultation(idClient, force = false) {
  if (!idClient) {
    clientConsultation.value = null;
    clientConsultationError.value = "";
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
    const pg = normalized.historique?.pagination || {};
    clientPagination.commandesPage = Number(pg.commandes?.page || clientPagination.commandesPage);
    clientPagination.retouchesPage = Number(pg.retouches?.page || clientPagination.retouchesPage);
    clientPagination.mesuresPage = Number(pg.mesures?.page || clientPagination.mesuresPage);
  } catch (err) {
    clientConsultation.value = null;
    clientConsultationError.value = readableError(err);
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
  const [journalierResult, hebdoResult, mensuelResult] = await Promise.allSettled([
    atelierApi.listCaisseAuditJournalier(),
    atelierApi.listBilansCaisse("HEBDO", 100),
    atelierApi.listBilansCaisse("MENSUEL", 60)
  ]);

  if (journalierResult.status === "fulfilled") auditCaisseJournalier.value = journalierResult.value || [];
  else appendAuditError(readableError(journalierResult.reason));

  if (hebdoResult.status === "fulfilled") bilanHebdo.value = hebdoResult.value || [];
  else appendAuditError(readableError(hebdoResult.reason));

  if (mensuelResult.status === "fulfilled") bilanMensuel.value = mensuelResult.value || [];
  else appendAuditError(readableError(mensuelResult.reason));
}

async function loadAuditUtilisateurs() {
  auditUtilisateurs.value = await atelierApi.listAuditUtilisateurs({ limit: 500 });
}

async function loadAuditPage(path = "/audit") {
  auditError.value = "";
  auditLoading.value = true;

  try {
    if (path === "/audit") {
      await loadAuditHub();
    } else if (path === "/audit/caisse") {
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

function auditEntiteLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "auth/users") return "Gestion des utilisateurs";
  if (key === "auth/users/activation") return "Activation des comptes";
  if (key === "auth/role-permissions") return "Permissions des roles";
  if (key === "/auth/logout") return "Deconnexion";
  if (key === "auth") return "Authentification";
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
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  errorMessage.value = errorMessage.value ? `${errorMessage.value} | ${msg}` : msg;
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
  const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "";
  if (message) return translateErrorMessage(message);
  return "Erreur API inconnue";
}

function translateErrorMessage(message) {
  const value = String(message || "").trim();
  if (!value) return "Erreur API inconnue";

  return value
    .split(";")
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower.includes("string must contain at least 1 character")) return "Ce champ est obligatoire.";
      if (lower.includes("invalid email")) return "Adresse email invalide.";
      if (lower.includes("string must contain at least 8 character")) return "Le mot de passe doit contenir au moins 8 caracteres.";
      if (lower.includes("caisse is closed")) return "Operation impossible: la caisse est cloturee.";
      if (lower.startsWith("missing fields:")) {
        const fields = part.split(":")[1] || "";
        return `Champs obligatoires manquants: ${fields.trim()}`;
      }
      return part;
    })
    .join(" ");
}

function loginErrorMessage(err) {
  const message = readableError(err);
  const lowered = message.toLowerCase();
  if (lowered.includes("utilisateur inexistant")) return "Cet utilisateur n'existe pas.";
  if (lowered.includes("mot de passe incorrect")) return "Mot de passe incorrect.";
  if (lowered.includes("identifiants invalides")) return "Adresse email ou mot de passe incorrect.";
  if (lowered.includes("compte inactif")) return "Compte desactive ou suspendu. Contactez le proprietaire.";
  return message;
}

function normalizeClient(raw) {
  return {
    idClient: raw.idClient || raw.id_client || raw.id,
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
  return {
    idCommande: raw.idCommande || raw.id_commande || raw.id,
    idClient: raw.idClient || raw.id_client || raw.clientId,
    descriptionCommande: raw.descriptionCommande || raw.description || "",
    montantTotal: Number(raw.montantTotal ?? raw.montant_total ?? 0),
    montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
    typeHabit: raw.typeHabit || raw.type_habit || "",
    mesuresHabit: raw.mesuresHabit || raw.mesures_habit_snapshot || null,
    statutCommande: raw.statutCommande || raw.statut || "CREEE",
    dateCreation: toIsoDate(raw.dateCreation || raw.date_creation),
    datePrevue: toIsoDate(raw.datePrevue || raw.date_prevue || raw.dateLivraison),
    clientNom: raw.clientNom || raw.client_nom || ""
  };
}

function normalizeRetouche(raw) {
  return {
    idRetouche: raw.idRetouche || raw.id_retouche || raw.id,
    idClient: raw.idClient || raw.id_client,
    descriptionRetouche: raw.descriptionRetouche || raw.description || "",
    typeRetouche: raw.typeRetouche || raw.type_retouche || "",
    montantTotal: Number(raw.montantTotal ?? raw.montant_total ?? 0),
    montantPaye: Number(raw.montantPaye ?? raw.montant_paye ?? 0),
    typeHabit: raw.typeHabit || raw.type_habit || "",
    mesuresHabit: raw.mesuresHabit || raw.mesures_habit_snapshot || null,
    statutRetouche: raw.statutRetouche || raw.statut || "DEPOSEE",
    dateDepot: toIsoDate(raw.dateDepot || raw.date_depot),
    datePrevue: toIsoDate(raw.datePrevue || raw.date_prevue),
    clientNom: raw.clientNom || raw.client_nom || ""
  };
}

function normalizeStockArticle(raw) {
  return {
    idArticle: raw.idArticle || raw.id_article,
    nomArticle: raw.nomArticle || raw.nom_article,
    quantiteDisponible: Number(raw.quantiteDisponible ?? raw.quantite_disponible ?? 0),
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
    REMBOURSEMENT_COMMANDE_ANNULEE: "Remboursement commande annulee"
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

function toIsoDate(input) {
  if (!input) return "";
  return String(input).slice(0, 10);
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

async function exportClientConsultationPdf() {
  if (!clientConsultationClient.value?.idClient) return;
  await openBlobPdfInNewTab(() =>
    atelierApi.getClientConsultationPdfBlobUrl(clientConsultationClient.value.idClient, {
      source: clientHistoryFilters.source,
      typeHabit: clientHistoryFilters.typeHabit,
      periode: clientHistoryFilters.periode,
      size: 200,
      autoprint: 1
    })
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
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
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

function formatMesuresLines(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const valeurs = snapshot.valeurs && typeof snapshot.valeurs === "object" ? snapshot.valeurs : snapshot;
  return Object.entries(valeurs).map(([key, value]) => {
    if (key === "typeManches") return `${mesureDisplayLabel(key)}: ${String(value)}`;
    return `${mesureDisplayLabel(key)}: ${Number(value)} cm`;
  });
}

function soldeRestant(commande) {
  if (!commande) return 0;
  return Math.max(0, Number(commande.montantTotal || 0) - Number(commande.montantPaye || 0));
}

function canPayer(commande) {
  if (!commande) return false;
  const id = String(commande.idCommande || "");
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
  const confirmed = await openActionModal({
    title: "Annuler la commande",
    message: `Cette action annule la commande ${commande.idCommande}.`,
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerCommande(commande.idCommande);
    await reloadAll();
    notify(`Commande annulee: ${commande.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

function resetWizard() {
  wizard.step = 1;
  wizard.mode = "existing";
  wizard.existingClientId = "";
  wizard.resolvedClientId = "";
  wizard.createdCommandeId = "";
  wizard.createdFactureId = "";
  wizard.submitting = false;
  wizard.newClient.nom = "";
  wizard.newClient.prenom = "";
  wizard.newClient.telephone = "";
  wizard.commande.descriptionCommande = "";
  wizard.commande.montantTotal = "";
  wizard.commande.datePrevue = "";
  wizard.commande.emettreFacture = true;
  wizard.commande.typeHabit = "";
  wizard.commande.mesuresHabit = {};
  resetMesuresModel(wizard.commande.mesuresHabit);
  wizardClientSearchQuery.value = "";
  wizardClientSearchOpen.value = false;
  wizardClientSearchIndex.value = -1;
  resetWizardClientInsight();
}

function openNouvelleCommande() {
  resetWizard();
  wizard.open = true;
}

function closeWizard() {
  wizard.open = false;
}

function resetRetoucheWizard() {
  retoucheWizard.step = 1;
  retoucheWizard.mode = "existing";
  retoucheWizard.existingClientId = "";
  retoucheWizard.resolvedClientId = "";
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
  retoucheWizard.retouche.mesuresHabit = {};
  resetMesuresModel(retoucheWizard.retouche.mesuresHabit);
  retoucheClientSearchQueryWizard.value = "";
  retoucheClientSearchOpen.value = false;
  retoucheClientSearchIndex.value = -1;
  resetRetoucheClientInsight();
}

function openNouvelleRetouche() {
  resetRetoucheWizard();
  retoucheWizard.open = true;
}

function closeRetoucheWizard() {
  retoucheWizard.open = false;
}

function selectWizardExistingClient(result) {
  if (!result?.client?.idClient) return;
  wizard.existingClientId = result.client.idClient;
  wizardClientSearchQuery.value = `${result.nomComplet} — ${result.telephone}`;
  wizardClientSearchOpen.value = false;
  wizardClientSearchIndex.value = -1;
  void loadWizardClientInsight(result.client.idClient);
}

function onWizardClientSearchInput(event) {
  wizardClientSearchQuery.value = event.target.value;
  wizard.existingClientId = "";
  wizardClientSearchOpen.value = true;
  resetWizardClientInsight();
}

function onWizardClientSearchBlur() {
  window.setTimeout(() => {
    wizardClientSearchOpen.value = false;
    wizardClientSearchIndex.value = -1;
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
  wizard.submitting = true;
  try {
    if (wizard.mode === "existing") {
      if (!wizard.existingClientId) throw new Error("Selectionnez un client existant.");
      wizard.resolvedClientId = wizard.existingClientId;
    } else {
      const payload = {
        nom: wizard.newClient.nom,
        prenom: wizard.newClient.prenom,
        telephone: wizard.newClient.telephone
      };
      if (!payload.nom || !payload.prenom || !payload.telephone) throw new Error("Completez nom, prenom et telephone.");

      const created = await atelierApi.createClient(payload);
      const normalized = normalizeClient(created.client || created);
      clients.value.push(normalized);
      wizard.resolvedClientId = normalized.idClient;
    }

    wizard.step = 2;
  } catch (err) {
    notify(readableError(err));
  } finally {
    wizard.submitting = false;
  }
}

async function onWizardStep2() {
  wizard.submitting = true;
  try {
    if (!wizard.resolvedClientId) throw new Error("Client non resolu.");

    const montant = Number(wizard.commande.montantTotal);
    if (!wizard.commande.descriptionCommande || Number.isNaN(montant) || montant <= 0) {
      throw new Error("Description et montant valide sont obligatoires.");
    }
    if (!wizard.commande.typeHabit) throw new Error("Type d'habit obligatoire.");

    const commandesConfig = atelierSettings.commandes || {};
    const mesuresObligatoires = commandesConfig.mesuresObligatoires !== false;
    const interdictionSansMesures = commandesConfig.interdictionSansMesures !== false;

    const mesuresSnapshot = collectMesuresSnapshot({
      typeHabit: wizard.commande.typeHabit,
      mesuresModel: wizard.commande.mesuresHabit,
      requireComplete: mesuresObligatoires && interdictionSansMesures,
      requireAtLeastOne: mesuresObligatoires
    });

    const payload = {
      idClient: wizard.resolvedClientId,
      descriptionCommande: wizard.commande.descriptionCommande,
      montantTotal: montant,
      typeHabit: wizard.commande.typeHabit,
      mesuresHabit: mesuresSnapshot
    };

    if (wizard.commande.datePrevue) payload.datePrevue = `${wizard.commande.datePrevue}T00:00:00.000Z`;

    const created = await atelierApi.createCommande(payload);
    const normalized = normalizeCommande(created);
    wizard.createdCommandeId = normalized.idCommande;
    wizard.createdFactureId = "";
    commandes.value.unshift(normalized);
    if (wizard.commande.emettreFacture === true) {
      const facture = await emettreFactureDepuisOrigine("COMMANDE", normalized.idCommande, { ouvrirDetail: false });
      wizard.createdFactureId = facture.idFacture || facture.id_facture || "";
    }
    wizard.step = 3;
  } catch (err) {
    notify(readableError(err));
  } finally {
    wizard.submitting = false;
  }
}

async function onRetoucheWizardStep1() {
  retoucheWizard.submitting = true;
  try {
    if (retoucheWizard.mode === "existing") {
      if (!retoucheWizard.existingClientId) throw new Error("Selectionnez un client existant.");
      retoucheWizard.resolvedClientId = retoucheWizard.existingClientId;
    } else {
      const payload = {
        nom: retoucheWizard.newClient.nom,
        prenom: retoucheWizard.newClient.prenom,
        telephone: retoucheWizard.newClient.telephone
      };
      if (!payload.nom || !payload.prenom || !payload.telephone) throw new Error("Completez nom, prenom et telephone.");

      const created = await atelierApi.createClient(payload);
      const normalized = normalizeClient(created.client || created);
      clients.value.push(normalized);
      retoucheWizard.resolvedClientId = normalized.idClient;
    }

    retoucheWizard.step = 2;
  } catch (err) {
    notify(readableError(err));
  } finally {
    retoucheWizard.submitting = false;
  }
}

async function onRetoucheWizardStep2() {
  retoucheWizard.submitting = true;
  try {
    if (!retoucheWizard.resolvedClientId) throw new Error("Client non resolu.");

    const montant = Number(retoucheWizard.retouche.montantTotal);
    if (Number.isNaN(montant) || montant <= 0) throw new Error("Montant total invalide.");
    if (!retoucheWizard.retouche.typeHabit) throw new Error("Type d'habit obligatoire.");
    if (!retoucheWizard.retouche.typeRetouche) throw new Error("Type de retouche obligatoire.");
    if (retoucheDescriptionRequired.value && !String(retoucheWizard.retouche.descriptionRetouche || "").trim()) {
      throw new Error("Description retouche obligatoire.");
    }

    const measuresAllowed = retoucheMeasuresRequired.value || atelierSettings.retouches?.mesuresOptionnelles !== false;
    const mesuresSnapshot = collectMesuresSnapshot({
      typeHabit: retoucheWizard.retouche.typeHabit,
      mesuresModel: retoucheWizard.retouche.mesuresHabit,
      requireComplete: false,
      requireAtLeastOne: retoucheMeasuresRequired.value
    });

    const hasMeasures = Object.keys(mesuresSnapshot || {}).length > 0;
    if (!measuresAllowed && hasMeasures) {
      throw new Error("Mesures non autorisees pour ce type de retouche.");
    }

    const payload = {
      idClient: retoucheWizard.resolvedClientId,
      descriptionRetouche: String(retoucheWizard.retouche.descriptionRetouche || "").trim(),
      typeRetouche: retoucheWizard.retouche.typeRetouche,
      montantTotal: montant,
      typeHabit: retoucheWizard.retouche.typeHabit,
      mesuresHabit: mesuresSnapshot
    };

    if (retoucheWizard.retouche.datePrevue) payload.datePrevue = `${retoucheWizard.retouche.datePrevue}T00:00:00.000Z`;

    const created = await atelierApi.createRetouche(payload);
    const normalized = normalizeRetouche(created);
    retoucheWizard.createdRetoucheId = normalized.idRetouche;
    retoucheWizard.createdFactureId = "";
    retouches.value.unshift(normalized);
    if (retoucheWizard.retouche.emettreFacture === true) {
      const facture = await emettreFactureDepuisOrigine("RETOUCHE", normalized.idRetouche, { ouvrirDetail: false });
      retoucheWizard.createdFactureId = facture.idFacture || facture.id_facture || "";
    }
    retoucheWizard.step = 3;
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
  const quantite = Number(newArticle.quantiteDisponible || 0);
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
    await atelierApi.validerVente({ idVente: vente.idVente, utilisateur: "frontend" });
    if (emettreFacture) {
      await emettreFactureDepuisOrigine("VENTE", vente.idVente, { ouvrirDetail: false });
      notify(`Vente validee + facture emise: ${vente.idVente}`);
      if (currentRoute.value === "vente-detail" && detailVente.value?.idVente === vente.idVente) {
        await loadVenteDetail(vente.idVente);
      }
      return;
    }
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
    stockInputs[idArticle] = { quantite: "", motif: "ACHAT" };
  }
  return stockInputs[idArticle];
}

async function onApprovisionnerStock(article) {
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
    await atelierApi.entrerStockArticle(article.idArticle, {
      quantite,
      motif: input.motif,
      utilisateur: "frontend"
    });
    input.quantite = "";
    await reloadAll();
    notify(`Stock approvisionne: ${article.nomArticle}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onPaiementCommande(commande) {
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
  const confirmed = await openActionModal({
    title: "Annuler la commande",
    message: `Cette action annule la commande ${detailCommande.value.idCommande}.`,
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerCommande(detailCommande.value.idCommande);
    await loadCommandeDetail(detailCommande.value.idCommande);
    await reloadAll();
    notify(`Commande annulee: ${detailCommande.value.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onPaiementRetouche(retouche) {
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
  const confirmed = await openActionModal({
    title: "Annuler la retouche",
    message: `Cette action annule la retouche ${retouche.idRetouche}.`,
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerRetouche(retouche.idRetouche);
    await reloadAll();
    notify(`Retouche annulee: ${retouche.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onAnnulerRetoucheDetail() {
  if (!detailRetouche.value) return;
  const confirmed = await openActionModal({
    title: "Annuler la retouche",
    message: `Cette action annule la retouche ${detailRetouche.value.idRetouche}.`,
    confirmLabel: "Confirmer l'annulation",
    tone: "red"
  });
  if (!confirmed) return;
  try {
    await atelierApi.annulerRetouche(detailRetouche.value.idRetouche);
    await loadRetoucheDetail(detailRetouche.value.idRetouche);
    await reloadAll();
    notify(`Retouche annulee: ${detailRetouche.value.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onDepenseCaisse() {
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
      utilisateur: "frontend",
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
    await atelierApi.cloturerCaisse(caisseJour.value.idCaisseJour, "frontend");
    await reloadAll();
    notify("Caisse cloturee.");
  } catch (err) {
    notify(readableError(err));
  }
}

async function onOuvrirCaisseDuJour() {
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

    await atelierApi.ouvrirCaisseDuJour({ soldeOuverture, utilisateur: "frontend" });
    await reloadAll();
    notify("Caisse du jour ouverte.");
  } catch (err) {
    notify(readableError(err));
  }
}

async function onOuvrirCaisseAnticipee() {
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
      utilisateur: "manager",
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
  await openBlobPdfInNewTab(() => atelierApi.getFacturePdfBlobUrl(facture.idFacture, { autoPrint: false }));
  notify(`PDF pret: ${facture.numeroFacture}`);
}

async function onImprimerFacture(facture) {
  if (!facture?.idFacture) return;
  await openBlobPdfInNewTab(() => atelierApi.getFacturePdfBlobUrl(facture.idFacture, { autoPrint: true }));
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

async function loadCommandeDetail(idCommande) {
  if (!idCommande) return;
  detailLoading.value = true;
  detailError.value = "";
  detailCommandeActions.value = null;
  try {
    const detail = await atelierApi.getCommande(idCommande);
    detailCommande.value = normalizeCommande(detail);
    void loadCommandeActionsForId(idCommande, { force: true, detail: true });
  } catch (err) {
    detailCommande.value = null;
    detailCommandeActions.value = null;
    detailPaiements.value = [];
    detailCommandeEvents.value = [];
    detailError.value = readableError(err);
    detailLoading.value = false;
    return;
  }
  detailLoading.value = false;

  detailPaiementsLoading.value = true;
  try {
    const paiements = await atelierApi.listPaiementsCommande(idCommande);
    detailPaiements.value = (paiements || []).map(normalizePaiement);
  } catch (err) {
    detailPaiements.value = [];
    detailError.value = detailError.value ? `${detailError.value} | ${readableError(err)}` : readableError(err);
  } finally {
    detailPaiementsLoading.value = false;
  }

  detailCommandeEventsLoading.value = true;
  try {
    const events = await atelierApi.listCommandeEvents(idCommande);
    detailCommandeEvents.value = (events || [])
      .map(normalizeWorkflowEvent)
      .sort((a, b) => new Date(b.dateEvent).getTime() - new Date(a.dateEvent).getTime());
  } catch (err) {
    detailCommandeEvents.value = [];
    detailError.value = detailError.value ? `${detailError.value} | ${readableError(err)}` : readableError(err);
  } finally {
    detailCommandeEventsLoading.value = false;
  }
}

async function loadRetoucheDetail(idRetouche) {
  if (!idRetouche) return;
  detailRetoucheLoading.value = true;
  detailRetoucheError.value = "";
  detailRetoucheActions.value = null;
  try {
    const detail = await atelierApi.getRetouche(idRetouche);
    detailRetouche.value = normalizeRetouche(detail);
    void loadRetoucheActionsForId(idRetouche, { force: true, detail: true });
  } catch (err) {
    detailRetouche.value = null;
    detailRetoucheActions.value = null;
    detailRetouchePaiements.value = [];
    detailRetoucheEvents.value = [];
    detailRetoucheError.value = readableError(err);
    detailRetoucheLoading.value = false;
    return;
  }
  detailRetoucheLoading.value = false;

  detailRetouchePaiementsLoading.value = true;
  try {
    const paiements = await atelierApi.listPaiementsRetouche(idRetouche);
    detailRetouchePaiements.value = (paiements || []).map(normalizePaiement);
  } catch (err) {
    detailRetouchePaiements.value = [];
    detailRetoucheError.value = detailRetoucheError.value ? `${detailRetoucheError.value} | ${readableError(err)}` : readableError(err);
  } finally {
    detailRetouchePaiementsLoading.value = false;
  }

  detailRetoucheEventsLoading.value = true;
  try {
    const events = await atelierApi.listRetoucheEvents(idRetouche);
    detailRetoucheEvents.value = (events || [])
      .map(normalizeWorkflowEvent)
      .sort((a, b) => new Date(b.dateEvent).getTime() - new Date(a.dateEvent).getTime());
  } catch (err) {
    detailRetoucheEvents.value = [];
    detailRetoucheError.value = detailRetoucheError.value ? `${detailRetoucheError.value} | ${readableError(err)}` : readableError(err);
  } finally {
    detailRetoucheEventsLoading.value = false;
  }
}
</script>

<template>
  <div v-if="!authReady" class="auth-shell">
    <article class="auth-card">
      <header class="auth-card-head">
        <div class="auth-logo">
          <img v-if="atelierLogoUrl" :src="atelierLogoUrl" alt="Logo atelier" />
          <span v-else>AT</span>
        </div>
        <h2>Chargement de la session...</h2>
      </header>
    </article>
  </div>

  <div v-else-if="!isAuthenticated" class="auth-shell">
    <article class="auth-card">
      <header class="auth-card-head">
        <div class="auth-logo">
          <img v-if="atelierLogoUrl" :src="atelierLogoUrl" alt="Logo atelier" />
          <span v-else>AT</span>
        </div>
        <h2>{{ atelierNomConnexion }}</h2>
        <p>Connexion securisee</p>
      </header>
      <p v-if="authError" class="auth-error">{{ authError }}</p>
      <div v-if="authMode === 'checking'" class="auth-message">
        <p>Verification de la configuration de l'atelier...</p>
      </div>
      <div v-else-if="authMode === 'bootstrap'" class="auth-message">
        <p>Aucun compte proprietaire n'existe encore pour cet atelier.</p>
        <button class="action-btn blue auth-submit" type="button" :disabled="bootstrapInitializing" @click="bootstrapAtelier">
          {{ bootstrapInitializing ? "Initialisation..." : "Initialiser l'atelier" }}
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

  <div v-else class="workspace classic">
    <aside class="sidebar classic-sidebar">
      <div class="brand classic-brand">
        <div class="brand-mark">
          <img v-if="atelierLogoUrl" :src="atelierLogoUrl" alt="Logo atelier" />
          <span v-else>AT</span>
        </div>
        <div>
          <h1>{{ atelierNomAffichage }}</h1>
          <p>Gestion metier</p>
        </div>
      </div>

      <nav class="menu">
        <a
          v-for="item in visibleMenuItems"
          :key="item.id"
          href="#"
          class="menu-item"
          :class="{ active: currentRoute === item.id }"
          @click.prevent="openRoute(item.id)"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-for="(path, i) in iconPaths[item.icon]" :key="`${item.id}-${i}`" :d="path" />
          </svg>
          <span>{{ item.label }}</span>
        </a>
      </nav>
      <div class="sidebar-user">
        <div class="sidebar-user-meta">
          <strong>{{ authUser?.nom || "Utilisateur" }}</strong>
          <span>{{ authUser?.roleId || "-" }}</span>
        </div>
        <button class="mini-btn" @click="submitLogout">Deconnexion</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar classic-topbar">
        <div>
          <p class="date-label">{{ todayLabel() }}</p>
          <h2>{{ currentTitle }}</h2>
          <p class="date-label">{{ atelierNomAffichage }}</p>
        </div>
        <div class="topbar-actions">
          <button class="mini-btn" @click="reloadAll" :disabled="loading">Actualiser</button>
          <div class="toast" :class="{ visible: toast }">{{ toast || "Pret" }}</div>
        </div>
      </header>

      <div class="content-scroll">
        <div v-if="errorMessage" class="panel error-panel">
          <strong>Erreur de synchronisation API</strong>
          <p>{{ errorMessage }}</p>
        </div>

        <section v-if="currentRoute === 'dashboard'" class="dashboard classic-dashboard">
        <article class="panel dashboard-filter">
          <div>
            <h3>Vue globale</h3>
            <p class="helper">Filtrer les indicateurs par periode</p>
          </div>
          <div class="row-actions">
            <select v-model="dashboardPeriod">
              <option v-for="option in dashboardPeriodOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </article>

        <div class="kpi-grid legacy-kpi-grid">
          <article v-for="card in dashboardCards" :key="card.label" class="kpi-card legacy-kpi" :data-tone="card.tone">
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
            <p>Avances Recues</p>
            <strong>{{ formatCurrency(financeMetrics.avancesRecues) }}</strong>
          </div>

        </article>

        <div class="split-grid legacy-split">
          <article class="panel">
            <h3>Dernieres Commandes</h3>
            <table class="data-table">
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
                  <td>{{ row.clientNom }}</td>
                  <td>{{ row.type }}</td>
                  <td>{{ row.statut }}</td>
                  <td>{{ formatCurrency(row.montantTotal) }}</td>
                  <td>{{ formatCurrency(row.avancePayee) }}</td>
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
      </section>

      <section v-else-if="currentRoute === 'commandes'" class="commandes-page">
        <article class="panel panel-header">
          <h3>Page centrale des commandes</h3>
          <button class="action-btn blue" @click="openNouvelleCommande">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.plus" :key="`new-cmd-${i}`" :d="path" />
            </svg>
            Nouvelle commande
          </button>
        </article>

        <article class="panel">
          <div class="segmented">
            <button class="mini-btn" :class="{ active: commandeSection === 'liste' }" @click="commandeSection = 'liste'">Liste</button>
            <button class="mini-btn" :class="{ active: commandeSection === 'indicateurs' }" @click="commandeSection = 'indicateurs'">Indicateurs</button>
            <button class="mini-btn" :class="{ active: commandeSection === 'actions' }" @click="commandeSection = 'actions'">Actions rapides</button>
          </div>
        </article>

        <article v-show="commandeSection === 'liste'" class="panel">
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

        <article v-show="commandeSection === 'indicateurs'" class="panel">
          <h3>Indicateurs commandes</h3>
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
          <div class="quick-actions">
            <button class="action-btn blue" @click="openNouvelleCommande">Nouvelle commande</button>
            <button class="action-btn green" @click="commandeSection = 'liste'">Voir la liste</button>
            <button class="action-btn amber" @click="openRoute('clientsMesures')">Consulter client</button>
          </div>
        </article>

        <article v-show="commandeSection === 'liste'" class="panel">
          <div class="panel-header">
            <h3>Tableau des commandes API</h3>
            <span class="status-pill" data-tone="due">
              {{ commandesSoldeRestantCount }} avec solde restant
            </span>
          </div>
          <div class="table-scroll-x">
            <table class="data-table">
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
                  <td>{{ commande.idCommande }}</td>
                  <td>{{ commande.clientNom }}</td>
                  <td>{{ commande.descriptionCommande }}</td>
                  <td>
                    <span class="status-pill" :data-status="commande.statutCommande">{{ commande.statutCommande }}</span>
                  </td>
                  <td>
                    <span class="status-pill" :data-tone="commande.soldeRestant === 0 ? 'ok' : 'due'">
                      {{ commande.soldeRestant === 0 ? "Solde OK" : "Solde restant" }}
                    </span>
                  </td>
                  <td>{{ formatCurrency(commande.montantTotal) }}</td>
                  <td>{{ formatCurrency(commande.montantPaye) }}</td>
                  <td>{{ formatCurrency(commande.soldeRestant) }}</td>
                  <td>{{ commande.datePrevue || "-" }}</td>
                  <td class="row-actions">
                    <button class="mini-btn" @click="onVoirCommande(commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.eye" :key="`see-${commande.idCommande}-${i}`" :d="path" />
                      </svg>
                      Voir
                    </button>
                    <button class="mini-btn" v-if="canPayer(commande)" @click="onPaiementCommande(commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.cash" :key="`cash-${commande.idCommande}-${i}`" :d="path" />
                      </svg>
                      Paiement
                    </button>
                    <button class="mini-btn" v-if="canLivrer(commande)" @click="onLivrerCommande(commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.check" :key="`liv-${commande.idCommande}-${i}`" :d="path" />
                      </svg>
                      Livrer
                    </button>
                    <button class="mini-btn" v-if="canTerminer(commande)" @click="onTerminerCommande(commande)">
                      Terminer
                    </button>
                    <button class="mini-btn" v-if="canAnnuler(commande)" @click="onAnnulerCommande(commande)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M21 3L3 21" />
                      </svg>
                      Annuler
                    </button>
                  </td>
                </tr>
                <tr v-if="commandesFiltered.length === 0">
                  <td colspan="10">Aucune commande ne correspond aux filtres actuels.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-footer table-pagination">
            <select v-model.number="commandesPagination.pageSize">
              <option :value="5">5 / page</option>
              <option :value="10">10 / page</option>
              <option :value="20">20 / page</option>
              <option :value="50">50 / page</option>
            </select>
            <button class="mini-btn" :disabled="commandesPagination.page <= 1" @click="commandesPagination.page -= 1">Precedent</button>
            <span>Page {{ commandesPagination.page }} / {{ commandesPages }}</span>
            <button class="mini-btn" :disabled="commandesPagination.page >= commandesPages" @click="commandesPagination.page += 1">Suivant</button>
          </div>
        </article>
      </section>

        <section v-else-if="currentRoute === 'retouches'" class="commandes-page">
        <article class="panel panel-header">
          <h3>Page centrale des retouches</h3>
          <button class="action-btn blue" @click="openNouvelleRetouche">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, i) in iconPaths.plus" :key="`new-ret-${i}`" :d="path" />
            </svg>
            Nouvelle retouche
          </button>
        </article>

        <article class="panel">
          <div class="segmented">
            <button class="mini-btn" :class="{ active: retoucheSection === 'liste' }" @click="retoucheSection = 'liste'">Liste</button>
            <button class="mini-btn" :class="{ active: retoucheSection === 'kpi' }" @click="retoucheSection = 'kpi'">Indicateurs</button>
            <button class="mini-btn" :class="{ active: retoucheSection === 'actions' }" @click="retoucheSection = 'actions'">Actions rapides</button>
          </div>
        </article>

        <article v-show="retoucheSection === 'liste'" class="panel">
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

        <article v-show="retoucheSection === 'kpi'" class="panel">
          <h3>Indicateurs retouches</h3>
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
          <div class="quick-actions">
            <button class="action-btn blue" @click="openNouvelleRetouche">Nouvelle retouche</button>
            <button class="action-btn green" @click="retoucheSection = 'liste'">Voir la liste</button>
            <button class="action-btn amber" @click="openRoute('clientsMesures')">Consulter client</button>
          </div>
        </article>

        <article v-show="retoucheSection === 'liste'" class="panel">
          <div class="panel-header">
            <h3>Tableau des retouches API</h3>
            <span class="status-pill" data-tone="due">
              {{ retouchesSoldeRestantCount }} avec solde restant
            </span>
          </div>
          <div class="table-scroll-x">
            <table class="data-table">
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
                  <td>{{ retouche.idRetouche }}</td>
                  <td>{{ retouche.clientNom }}</td>
                  <td>{{ retouche.typeRetouche || "-" }}</td>
                  <td>{{ retouche.descriptionRetouche }}</td>
                  <td>
                    <span class="status-pill" :data-status="retouche.statutRetouche">{{ retouche.statutRetouche }}</span>
                  </td>
                  <td>
                    <span class="status-pill" :data-tone="retouche.soldeRestant === 0 ? 'ok' : 'due'">
                      {{ retouche.soldeRestant === 0 ? "Solde OK" : "Solde restant" }}
                    </span>
                  </td>
                  <td>{{ formatCurrency(retouche.montantTotal) }}</td>
                  <td>{{ formatCurrency(retouche.montantPaye) }}</td>
                  <td>{{ formatCurrency(retouche.soldeRestant) }}</td>
                  <td>{{ retouche.dateDepot || "-" }}</td>
                  <td>{{ retouche.datePrevue || "-" }}</td>
                  <td class="row-actions">
                    <button class="mini-btn" @click="onVoirRetouche(retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.eye" :key="`see-ret-${retouche.idRetouche}-${i}`" :d="path" />
                      </svg>
                      Voir
                    </button>
                    <button class="mini-btn" v-if="canPayerRetouche(retouche)" @click="onPaiementRetouche(retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.cash" :key="`cash-ret-${retouche.idRetouche}-${i}`" :d="path" />
                      </svg>
                      Paiement
                    </button>
                    <button class="mini-btn" v-if="canLivrerRetouche(retouche)" @click="onLivrerRetouche(retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path v-for="(path, i) in iconPaths.check" :key="`liv-ret-${retouche.idRetouche}-${i}`" :d="path" />
                      </svg>
                      Livrer
                    </button>
                    <button class="mini-btn" v-if="canTerminerRetouche(retouche)" @click="onTerminerRetouche(retouche)">
                      Terminer
                    </button>
                    <button class="mini-btn" v-if="canAnnulerRetouche(retouche)" @click="onAnnulerRetouche(retouche)">
                      <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M21 3L3 21" />
                      </svg>
                      Annuler
                    </button>
                  </td>
                </tr>
                <tr v-if="retouchesFiltered.length === 0">
                  <td colspan="12">Aucune retouche ne correspond aux filtres actuels.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-footer table-pagination">
            <select v-model.number="retouchesPagination.pageSize">
              <option :value="5">5 / page</option>
              <option :value="10">10 / page</option>
              <option :value="20">20 / page</option>
              <option :value="50">50 / page</option>
            </select>
            <button class="mini-btn" :disabled="retouchesPagination.page <= 1" @click="retouchesPagination.page -= 1">Precedent</button>
            <span>Page {{ retouchesPagination.page }} / {{ retouchesPages }}</span>
            <button class="mini-btn" :disabled="retouchesPagination.page >= retouchesPages" @click="retouchesPagination.page += 1">Suivant</button>
          </div>
        </article>
      </section>

        <section v-else-if="currentRoute === 'clientsMesures'" class="commandes-page">
        <article class="panel panel-header">
          <h3>Fiche Client - Consultation</h3>
          <div class="filters compact client-consultation-picker" style="min-width: 320px;">
            <input v-model.trim="clientConsultationQuery" type="text" placeholder="Rechercher client (nom, telephone...)" />
            <select v-model="selectedClientConsultationId">
              <option value="" v-if="clients.length === 0">Aucun client disponible</option>
              <option value="" v-else-if="clientConsultationClientOptions.length === 0">Aucun resultat</option>
              <option v-for="client in clientConsultationClientOptions" :key="`consult-${client.idClient}`" :value="client.idClient">
                {{ `${client.nom} ${client.prenom}`.trim() }} - {{ client.telephone }}
              </option>
            </select>
          </div>
          <button class="mini-btn" @click="exportClientConsultationPdf" :disabled="!clientConsultationClient">Exporter PDF</button>
        </article>

        <article class="panel" v-if="clientConsultationLoading">
          <p>Chargement de l'historique client...</p>
        </article>

        <article class="panel error-panel" v-else-if="clientConsultationError">
          <strong>Erreur de consultation client</strong>
          <p>{{ clientConsultationError }}</p>
        </article>

        <template v-else-if="clientConsultationClient">
          <article class="panel">
            <h3>Identite client</h3>
            <p><strong>Nom complet:</strong> {{ clientConsultationClient.nomComplet || "-" }}</p>
            <p><strong>Contact:</strong> {{ clientConsultationClient.telephone || "-" }}</p>
            <p><strong>Premier passage:</strong> {{ clientConsultationClient.datePremierPassage || "-" }}</p>
            <p><strong>Dernier passage:</strong> {{ clientConsultationClient.dateDernierPassage || clientConsultationSynthese.dateDerniereActivite || "-" }}</p>
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
                <strong>{{ clientConsultationSynthese.dateDerniereActivite || "-" }}</strong>
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
              <table class="data-table">
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
                    <td>{{ row.date || "-" }}</td>
                    <td>{{ row.typeHabit || "-" }}</td>
                    <td>{{ row.statut || "-" }}</td>
                    <td>{{ formatCurrency(row.montant) }}</td>
                    <td><button class="mini-btn" @click="openCommandeDetail(row.idCommande)">Voir</button></td>
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
              <table class="data-table">
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
                    <td>{{ row.date || "-" }}</td>
                    <td>{{ row.typeHabit || "-" }}</td>
                    <td>{{ row.typeRetouche || "-" }}</td>
                    <td>{{ row.statut || "-" }}</td>
                    <td>{{ formatCurrency(row.montant) }}</td>
                    <td><button class="mini-btn" @click="openRetoucheDetail(row.idRetouche)">Voir</button></td>
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
              <table class="data-table">
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
                    <td>{{ row.datePrise || "-" }}</td>
                    <td>{{ row.typeHabit || "-" }}</td>
                    <td>{{ row.source || "-" }}</td>
                    <td>
                      <template v-for="(line, idx) in formatMesuresLines(row.mesures)" :key="`cm-line-${index}-${idx}`">
                        <div>{{ line }}</div>
                      </template>
                      <div v-if="formatMesuresLines(row.mesures).length === 0">Aucune mesure</div>
                    </td>
                    <td><button class="mini-btn" @click="onVoirOrigineMesure(row)">Voir</button></td>
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

        <article class="panel" v-else>
          <p>Selectionnez un client pour consulter sa memoire atelier.</p>
        </article>
      </section>
        <section v-else-if="currentRoute === 'stockVentes'" class="commandes-page">
        <article class="panel panel-header">
          <h3>Stock & Ventes</h3>
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
              <button class="action-btn blue" @click="showNewArticle = !showNewArticle">
                {{ showNewArticle ? "Fermer" : "Ajouter article" }}
              </button>
            </div>
            <div v-if="showNewArticle" class="stack">
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
                  <label>Prix unitaire</label>
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
            <h3>Liste des articles</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Quantite</th>
                  <th>Prix unitaire</th>
                  <th>Seuil</th>
                  <th>Etat</th>
                  <th>Approvisionnement</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="article in stockArticles" :key="article.idArticle">
                  <td>{{ article.nomArticle }}</td>
                  <td>{{ article.quantiteDisponible }}</td>
                  <td>{{ formatCurrency(article.prixVenteUnitaire) }}</td>
                  <td>{{ article.seuilAlerte }}</td>
                  <td>
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
                    <input
                      class="inline-input"
                      type="number"
                      min="0"
                      placeholder="Quantite"
                      v-model="ensureStockInput(article.idArticle).quantite"
                    />
                    <input class="inline-input" type="text" placeholder="Motif" v-model="ensureStockInput(article.idArticle).motif" />
                    <button class="mini-btn" @click="onApprovisionnerStock(article)">Entrer</button>
                  </td>
                </tr>
                <tr v-if="stockArticles.length === 0">
                  <td colspan="6">Aucun article en stock.</td>
                </tr>
              </tbody>
            </table></article>
        </template>

        <template v-else>
          <article class="panel">
            <h3>Nouvelle vente</h3>
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

            <table class="data-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Quantite</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(ligne, index) in venteDraft.lignes" :key="`${ligne.idArticle}-${index}`">
                  <td>{{ stockArticleMap.get(ligne.idArticle) || ligne.idArticle }}</td>
                  <td>{{ ligne.quantite }}</td>
                  <td class="row-actions">
                    <button class="mini-btn" @click="removeVenteLigne(index)">Retirer</button>
                  </td>
                </tr>
                <tr v-if="venteDraft.lignes.length === 0">
                  <td colspan="3">Aucune ligne ajoutee.</td>
                </tr>
              </tbody>
            </table>
            <div class="panel-footer">
              <button class="action-btn blue" @click="onCreerVente" :disabled="venteSubmitting">Creer la vente</button>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h3>Historique des ventes</h3>
              <span class="status-pill" :data-status="caisseStatus">{{ caisseStatus }}</span>
            </div>
            <table class="data-table">
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
                <tr v-for="vente in ventesView" :key="vente.idVente">
                  <td>{{ vente.idVente }}</td>
                  <td>{{ formatDateTime(vente.date) }}</td>
                  <td>
                    <span class="status-pill" :data-status="vente.statut">{{ vente.statut }}</span>
                  </td>
                  <td>{{ formatCurrency(vente.total) }}</td>
                  <td>{{ vente.referenceCaisse || "-" }}</td>
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
            </table></article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'commande-detail'" class="commande-detail">
        <article class="panel panel-header detail-header">
          <div>
            <h3>Detail commande</h3>
            <p class="helper" v-if="detailCommande">ID: {{ detailCommande.idCommande }}</p>
          </div>
          <div class="row-actions">
            <button class="mini-btn" @click="openRoute('commandes')">Retour</button>
            <button
              class="action-btn blue"
              v-if="detailCommande && !detailCommandeFacture && detailCommande.statutCommande !== 'ANNULEE'"
              @click="onEmettreFactureCommandeDetail"
              :disabled="detailLoading"
            >
              Emettre facture
            </button>
            <button class="mini-btn" v-if="detailCommandeFacture" @click="onVoirFactureParOrigine('COMMANDE', detailCommande.idCommande)">
              Voir facture
            </button>
            <button class="mini-btn" v-if="detailCommandeFacture" @click="onImprimerFactureParOrigine('COMMANDE', detailCommande.idCommande)">
              Imprimer facture
            </button>
            <button class="action-btn blue" v-if="canPayerDetail" @click="onPaiementDetail" :disabled="detailLoading || detailPaiementsLoading">
              Payer
            </button>
            <button class="action-btn green" v-if="canLivrerDetail" @click="onLivrerDetail" :disabled="detailLoading">
              Livrer
            </button>
            <button class="action-btn amber" v-if="canTerminerDetail" @click="onTerminerDetail" :disabled="detailLoading">
              Terminer
            </button>
            <button class="action-btn red" v-if="canAnnulerDetail" @click="onAnnulerDetail" :disabled="detailLoading">
              Annuler
            </button>
          </div>

        </article>

        <article v-if="detailError" class="panel error-panel">
          <strong>Erreur detail commande</strong>
          <p>{{ detailError }}</p>
        </article>

        <article v-if="detailLoading" class="panel">
          <p>Chargement de la commande...</p>
        </article>

        <template v-else-if="detailCommande">
          <article class="panel detail-grid" style="grid-template-columns: 1fr 1fr 1fr;">
            <div>
              <h4>Identite commande</h4>
              <p><strong>Client:</strong> {{ detailCommande.clientNom || detailCommande.idClient }}</p>
              <p><strong>Description:</strong> {{ detailCommande.descriptionCommande }}</p>
              <p><strong>Statut:</strong> {{ detailCommande.statutCommande }}</p>
              <p><strong>Facture:</strong> {{ detailCommandeFacture ? detailCommandeFacture.numeroFacture : "Non emise" }}</p>
              <p><strong>Date creation:</strong> {{ detailCommande.dateCreation || "-" }}</p>
              <p><strong>Date prevue:</strong> {{ detailCommande.datePrevue || "-" }}</p>
            </div>
            <div>
              <h4>Mesures de l'habit</h4>
              <p><strong>Type d'habit:</strong> {{ detailCommande.typeHabit || "-" }}</p>
              <p><strong>Unite:</strong> cm</p>
              <p><strong>Mode:</strong> Lecture seule</p>
              <template v-for="(line, idx) in formatMesuresLines(detailCommande.mesuresHabit)" :key="`cmd-mes-line-${idx}`">
                <p>{{ line }}</p>
              </template>
              <p v-if="formatMesuresLines(detailCommande.mesuresHabit).length === 0">Aucune mesure.</p>
            </div>
            <div>
              <h4>Resume financier</h4>
              <p><strong>Montant total:</strong> {{ formatCurrency(detailCommande.montantTotal) }}</p>
              <p><strong>Total paye:</strong> {{ formatCurrency(detailCommande.montantPaye) }}</p>
              <p><strong>Solde restant:</strong> {{ formatCurrency(detailSoldeRestant) }}</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header detail-panel-header">
              <h4>Historique des paiements</h4>
              <span class="helper" v-if="detailPaiementsLoading">Chargement...</span>
            </div>
            <table class="data-table">
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
                <tr v-for="paiement in detailPaiements" :key="paiement.idOperation">
                  <td>{{ formatDateTime(paiement.dateOperation || paiement.dateJour) }}</td>
                  <td>{{ formatCurrency(paiement.montant) }}</td>
                  <td>{{ paiement.modePaiement || "-" }}</td>
                  <td>{{ paiement.statutOperation || "-" }}</td>
                  <td>{{ paiement.motif || paiement.referenceMetier || "-" }}</td>
                </tr>
                <tr v-if="!detailPaiementsLoading && detailPaiements.length === 0">
                  <td colspan="5">Aucun paiement enregistre.</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article class="panel">
            <div class="panel-header detail-panel-header">
              <h4>Historique des evenements</h4>
              <span class="helper" v-if="detailCommandeEventsLoading">Chargement...</span>
            </div>
            <table class="data-table">
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
                <tr v-for="event in detailCommandeEvents" :key="event.idEvent">
                  <td>{{ formatDateTime(event.dateEvent) }}</td>
                  <td>{{ event.typeEventLabel }}</td>
                  <td>
                    <span class="status-pill" :data-status="event.ancienStatut || ''">{{ event.ancienStatutLabel }}</span>
                  </td>
                  <td>
                    <span class="status-pill" :data-status="event.nouveauStatut || ''">{{ event.nouveauStatutLabel }}</span>
                  </td>
                  <td>{{ event.utilisateurNom }}</td>
                  <td>{{ event.role }}</td>
                </tr>
                <tr v-if="!detailCommandeEventsLoading && detailCommandeEvents.length === 0">
                  <td colspan="6">Aucun evenement enregistre.</td>
                </tr>
              </tbody>
            </table>
          </article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'retouche-detail'" class="commande-detail">
        <article class="panel panel-header detail-header">
          <div>
            <h3>Detail retouche</h3>
            <p class="helper" v-if="detailRetouche">ID: {{ detailRetouche.idRetouche }}</p>
          </div>
          <div class="row-actions">
            <button class="mini-btn" @click="openRoute('retouches')">Retour</button>
            <button
              class="action-btn blue"
              v-if="detailRetouche && !detailRetoucheFacture && detailRetouche.statutRetouche !== 'ANNULEE'"
              @click="onEmettreFactureRetoucheDetail"
              :disabled="detailRetoucheLoading"
            >
              Emettre facture
            </button>
            <button class="mini-btn" v-if="detailRetoucheFacture" @click="onVoirFactureParOrigine('RETOUCHE', detailRetouche.idRetouche)">
              Voir facture
            </button>
            <button class="mini-btn" v-if="detailRetoucheFacture" @click="onImprimerFactureParOrigine('RETOUCHE', detailRetouche.idRetouche)">
              Imprimer facture
            </button>
            <button
              class="action-btn blue"
              v-if="canPayerRetoucheDetail"
              @click="onPaiementRetoucheDetail"
              :disabled="detailRetoucheLoading || detailRetouchePaiementsLoading"
            >
              Payer
            </button>
            <button class="action-btn green" v-if="canLivrerRetoucheDetail" @click="onLivrerRetoucheDetail" :disabled="detailRetoucheLoading">
              Livrer
            </button>
            <button class="action-btn amber" v-if="canTerminerRetoucheDetail" @click="onTerminerRetoucheDetail" :disabled="detailRetoucheLoading">
              Terminer
            </button>
            <button class="action-btn red" v-if="canAnnulerRetoucheDetail" @click="onAnnulerRetoucheDetail" :disabled="detailRetoucheLoading">
              Annuler
            </button>
          </div>

        </article>

        <article v-if="detailRetoucheError" class="panel error-panel">
          <strong>Erreur detail retouche</strong>
          <p>{{ detailRetoucheError }}</p>
        </article>

        <article v-if="detailRetoucheLoading" class="panel">
          <p>Chargement de la retouche...</p>
        </article>

        <template v-else-if="detailRetouche">
          <article class="panel detail-grid" style="grid-template-columns: 1fr 1fr 1fr;">
            <div>
              <h4>Identite retouche</h4>
              <p><strong>Client:</strong> {{ detailRetouche.clientNom || detailRetouche.idClient }}</p>
              <p><strong>Type:</strong> {{ detailRetouche.typeRetouche || "-" }}</p>
              <p><strong>Description:</strong> {{ detailRetouche.descriptionRetouche }}</p>
              <p><strong>Statut:</strong> {{ detailRetouche.statutRetouche }}</p>
              <p><strong>Facture:</strong> {{ detailRetoucheFacture ? detailRetoucheFacture.numeroFacture : "Non emise" }}</p>
              <p><strong>Date depot:</strong> {{ detailRetouche.dateDepot || "-" }}</p>
              <p><strong>Date prevue:</strong> {{ detailRetouche.datePrevue || "-" }}</p>
            </div>
            <div>
              <h4>Mesures de l'habit</h4>
              <p><strong>Type d'habit:</strong> {{ detailRetouche.typeHabit || "-" }}</p>
              <p><strong>Unite:</strong> cm</p>
              <p><strong>Mode:</strong> Lecture seule</p>
              <template v-for="(line, idx) in formatMesuresLines(detailRetouche.mesuresHabit)" :key="`ret-mes-line-${idx}`">
                <p>{{ line }}</p>
              </template>
              <p v-if="formatMesuresLines(detailRetouche.mesuresHabit).length === 0">Aucune mesure.</p>
            </div>
            <div>
              <h4>Resume financier</h4>
              <p><strong>Montant total:</strong> {{ formatCurrency(detailRetouche.montantTotal) }}</p>
              <p><strong>Total paye:</strong> {{ formatCurrency(detailRetouche.montantPaye) }}</p>
              <p><strong>Solde restant:</strong> {{ formatCurrency(detailRetoucheSoldeRestant) }}</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header detail-panel-header">
              <h4>Historique des paiements</h4>
              <span class="helper" v-if="detailRetouchePaiementsLoading">Chargement...</span>
            </div>
            <table class="data-table">
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
                <tr v-for="paiement in detailRetouchePaiements" :key="paiement.idOperation">
                  <td>{{ formatDateTime(paiement.dateOperation || paiement.dateJour) }}</td>
                  <td>{{ formatCurrency(paiement.montant) }}</td>
                  <td>{{ paiement.modePaiement || "-" }}</td>
                  <td>{{ paiement.statutOperation || "-" }}</td>
                  <td>{{ paiement.motif || paiement.referenceMetier || "-" }}</td>
                </tr>
                <tr v-if="!detailRetouchePaiementsLoading && detailRetouchePaiements.length === 0">
                  <td colspan="5">Aucun paiement enregistre.</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article class="panel">
            <div class="panel-header detail-panel-header">
              <h4>Historique des evenements</h4>
              <span class="helper" v-if="detailRetoucheEventsLoading">Chargement...</span>
            </div>
            <table class="data-table">
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
                <tr v-for="event in detailRetoucheEvents" :key="event.idEvent">
                  <td>{{ formatDateTime(event.dateEvent) }}</td>
                  <td>{{ event.typeEventLabel }}</td>
                  <td>
                    <span class="status-pill" :data-status="event.ancienStatut || ''">{{ event.ancienStatutLabel }}</span>
                  </td>
                  <td>
                    <span class="status-pill" :data-status="event.nouveauStatut || ''">{{ event.nouveauStatutLabel }}</span>
                  </td>
                  <td>{{ event.utilisateurNom }}</td>
                  <td>{{ event.role }}</td>
                </tr>
                <tr v-if="!detailRetoucheEventsLoading && detailRetoucheEvents.length === 0">
                  <td colspan="6">Aucun evenement enregistre.</td>
                </tr>
              </tbody>
            </table>
          </article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'vente-detail'" class="commande-detail">
        <article class="panel panel-header detail-header">
          <div>
            <h3>Detail vente</h3>
            <p class="helper" v-if="detailVente">ID: {{ detailVente.idVente }}</p>
          </div>
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
              Imprimer facture
            </button>
            <button
              class="action-btn blue"
              v-if="detailVente && detailVente.statut === 'BROUILLON'"
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
            <button class="action-btn red" v-if="detailVente && detailVente.statut === 'BROUILLON'" @click="onAnnulerVente(detailVente)">
              Annuler
            </button>
          </div>

        </article>

        <article v-if="detailVenteError" class="panel error-panel">
          <strong>Erreur detail vente</strong>
          <p>{{ detailVenteError }}</p>
        </article>

        <article v-if="detailVenteLoading" class="panel">
          <p>Chargement de la vente...</p>
        </article>

        <template v-else-if="detailVente">
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

          <article class="panel">
            <div class="panel-header detail-panel-header">
              <h4>Lignes de vente</h4>
              <span class="helper">Lecture seule</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Quantite</th>
                  <th>Prix unitaire</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ligne in detailVente.lignesVente" :key="ligne.idLigne">
                  <td>{{ ligne.libelleArticle || ligne.idArticle }}</td>
                  <td>{{ ligne.quantite }}</td>
                  <td>{{ formatCurrency(ligne.prixUnitaire) }}</td>
                </tr>
                <tr v-if="detailVente.lignesVente.length === 0">
                  <td colspan="3">Aucune ligne.</td>
                </tr>
              </tbody>
            </table></article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'facturation'" class="commandes-page">
        <article class="panel panel-header">
          <div>
            <h3>Factures</h3>
            <p class="helper">Module immuable en lecture seule. Le statut est derive de la caisse.</p>
          </div>
          <div class="row-actions">
            <button class="action-btn blue" @click="onEmettreFacture">Emettre facture</button>
          </div>

        </article>

        <article class="panel">
          <div class="segmented">
            <button class="mini-btn" :class="{ active: factureSection === 'liste' }" @click="factureSection = 'liste'">Liste</button>
            <button class="mini-btn" :class="{ active: factureSection === 'indicateurs' }" @click="factureSection = 'indicateurs'">Indicateurs</button>
            <button class="mini-btn" :class="{ active: factureSection === 'actions' }" @click="factureSection = 'actions'">Actions rapides</button>
          </div>
        </article>

        <article v-show="factureSection === 'liste'" class="panel">
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
          <p class="helper" v-if="factureFilters.recherche.trim()">
            Recherche active - {{ facturesFiltered.length }} resultat(s)
          </p>
        </article>

        <article v-show="factureSection === 'indicateurs'" class="panel">
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
              <strong>{{ formatCurrency(facturesKpi.montantTotal) }}</strong>
            </div>
          </div>
        </article>

        <article v-show="factureSection === 'actions'" class="panel">
          <div class="quick-actions">
            <button class="action-btn blue" @click="onEmettreFacture">Emettre facture</button>
            <button class="action-btn green" @click="factureSection = 'liste'">Voir la liste</button>
            <button class="action-btn amber" @click="openRoute('audit')">Ouvrir audit</button>
          </div>
        </article>

        <article v-show="factureSection === 'liste'" class="panel">
          <div class="table-scroll-x">
            <table class="data-table">
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
                  <td>{{ facture.numeroFacture }}</td>
                  <td>{{ facture.client?.nom || "-" }}</td>
                  <td>{{ facture.typeOrigine }} / {{ facture.idOrigine }}</td>
                  <td>{{ formatDateTime(facture.dateEmission) }}</td>
                  <td>{{ formatCurrency(facture.montantTotal) }}</td>
                  <td>{{ formatCurrency(facture.montantPaye) }}</td>
                  <td>{{ formatCurrency(facture.solde) }}</td>
                  <td>{{ facture.statut }}</td>
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
          <div class="panel-footer table-pagination">
            <select v-model.number="facturesPagination.pageSize">
              <option :value="5">5 / page</option>
              <option :value="10">10 / page</option>
              <option :value="20">20 / page</option>
              <option :value="50">50 / page</option>
            </select>
            <button class="mini-btn" :disabled="facturesPagination.page <= 1" @click="facturesPagination.page -= 1">Precedent</button>
            <span>Page {{ facturesPagination.page }} / {{ facturesPages }}</span>
            <button class="mini-btn" :disabled="facturesPagination.page >= facturesPages" @click="facturesPagination.page += 1">Suivant</button>
          </div>
        </article>
      </section>

        <section v-else-if="currentRoute === 'parametres'" class="commandes-page parametres-page">
        <article class="panel panel-header">
          <div>
            <h3>Parametres Atelier</h3>
            <p class="helper">Configuration metier globale. Lecture par les modules, modification rare et securisee.</p>
            <p class="helper" v-if="atelierSettings.meta.lastSavedAt">
              Derniere sauvegarde: {{ formatDateTime(atelierSettings.meta.lastSavedAt) }}
            </p>
          </div>
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
            <button class="mini-btn" :disabled="!settingsCanEdit || settingsSaving" @click="resetAtelierSettings">Reinitialiser</button>
          </div>
        </article>

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

        <article v-if="settingsLoading" class="panel">
          <p>Chargement des parametres...</p>
        </article>

        <article v-if="settingsSaving" class="panel info-panel">
          <p>Sauvegarde des parametres en cours...</p>
        </article>

        <article v-if="settingsError" class="panel error-panel">
          <strong>Erreur parametres</strong>
          <p>{{ settingsError }}</p>
        </article>

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
              <label>Devise</label>
              <select v-model="atelierSettings.identite.devise" :disabled="!settingsCanEdit">
                <option v-for="devise in deviseOptions" :key="devise" :value="devise">{{ devise }}</option>
              </select>
            </div>
            <div class="stack-form">
              <label>Logo (URL optionnelle)</label>
              <input v-model="atelierSettings.identite.logoUrl" type="text" :disabled="!settingsCanEdit" />
            </div>
            <div class="settings-logo-preview" v-if="settingsLogoPreview">
              <label>Previsualisation logo</label>
              <img :src="settingsLogoPreview" alt="Logo atelier" />
            </div>
          </div>
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
                    {{ row.necessiteMesures ? "Mesures requises" : atelierSettings.retouches.mesuresOptionnelles === false ? "Sans mesures" : "Mesures optionnelles" }}
                  </span>
                </button>
                <p v-if="filteredSettingsRetoucheTypeEntries.length === 0" class="helper">Aucun type de retouche ne correspond au filtre actuel.</p>
              </div>
              <div class="panel-footer table-pagination">
                <select v-model.number="settingsRetouchePagination.pageSize">
                  <option :value="6">6 / page</option>
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                </select>
                <button class="mini-btn" :disabled="settingsRetouchePagination.page <= 1" @click="settingsRetouchePagination.page -= 1">Precedent</button>
                <span>Page {{ settingsRetouchePagination.page }} / {{ settingsRetouchePages }}</span>
                <button class="mini-btn" :disabled="settingsRetouchePagination.page >= settingsRetouchePages" @click="settingsRetouchePagination.page += 1">Suivant</button>
              </div>
            </article>

            <article v-if="selectedSettingsRetoucheType" class="panel measure-editor">
              <div class="panel-header detail-panel-header">
                <div class="stack-form measure-habit-meta">
                  <label>Libelle du type</label>
                  <input v-model="selectedSettingsRetoucheType.libelle" type="text" :disabled="!settingsCanEdit" />
                  <span class="helper">Code: {{ selectedSettingsRetoucheType.code }}</span>
                </div>
                <div class="row-actions">
                  <label class="helper">
                    <input v-model="selectedSettingsRetoucheType.actif" type="checkbox" :disabled="!settingsCanEdit" />
                    Actif
                  </label>
                  <div class="stack-form measure-order-field">
                    <label>Ordre</label>
                    <input v-model.number="selectedSettingsRetoucheType.ordreAffichage" type="number" min="1" :disabled="!settingsCanEdit" />
                  </div>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="removeRetoucheType(selectedSettingsRetoucheType.code)">Retirer</button>
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

              <div class="stack-form">
                <label>Mesures cibles</label>
                <select v-model="selectedSettingsRetoucheType.mesuresCibles" multiple size="8" :disabled="!settingsCanEdit || !selectedSettingsRetoucheType.necessiteMesures">
                  <option
                    v-for="field in selectedSettingsRetoucheType.habitsCompatibles?.includes('*')
                      ? []
                      : Array.from(new Set(
                          selectedSettingsRetoucheType.habitsCompatibles.flatMap((habitKey) =>
                            resolveHabitUiDefinition(habitKey)
                              ? [...resolveHabitUiDefinition(habitKey).required, ...resolveHabitUiDefinition(habitKey).optional]
                              : []
                          )
                        ))"
                    :key="`rt-mesure-${field}`"
                    :value="field"
                  >
                    {{ mesureLabelFromKey(field) }}
                  </option>
                </select>
                <span class="helper">Si aucun habit unique n'est selectionne, laisse vide pour autoriser toutes les mesures du type choisi.</span>
              </div>
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
              <div class="panel-footer table-pagination">
                <select v-model.number="settingsMeasurePagination.pageSize">
                  <option :value="8">8 / page</option>
                  <option :value="12">12 / page</option>
                  <option :value="20">20 / page</option>
                </select>
                <button class="mini-btn" :disabled="settingsMeasurePagination.page <= 1" @click="settingsMeasurePagination.page -= 1">Precedent</button>
                <span>Page {{ settingsMeasurePagination.page }} / {{ settingsMeasurePages }}</span>
                <button class="mini-btn" :disabled="settingsMeasurePagination.page >= settingsMeasurePages" @click="settingsMeasurePagination.page += 1">Suivant</button>
              </div>
            </article>

            <article v-if="selectedHabitConfigEntry" class="panel measure-editor">
              <div class="panel-header detail-panel-header">
                <div class="stack-form measure-habit-meta">
                  <label>Type d'habit</label>
                  <input v-model="selectedHabitConfigEntry.config.label" type="text" :disabled="!settingsCanEdit" />
                  <span class="helper">Code: {{ selectedHabitConfigEntry.key }}</span>
                  <span v-if="isHabitTypeUsed(selectedHabitConfigEntry.key)" class="helper">
                    Ce type est deja utilise par des commandes ou retouches. Archivage bloque.
                  </span>
                </div>
                <div class="row-actions">
                  <div class="measure-inline-fields">
                    <label class="helper">
                      <input
                        v-model="selectedHabitConfigEntry.config.actif"
                        type="checkbox"
                        :disabled="!settingsCanEdit"
                        @change="onHabitActiveToggle(selectedHabitConfigEntry.key, selectedHabitConfigEntry.config.actif)"
                      />
                      Actif
                    </label>
                    <div class="stack-form measure-order-field">
                      <label>Ordre</label>
                      <input v-model.number="selectedHabitConfigEntry.config.ordre" type="number" min="0" :disabled="!settingsCanEdit" />
                    </div>
                  </div>
                  <button class="mini-btn" :disabled="!settingsCanEdit" @click="duplicateHabitType(selectedHabitConfigEntry.key)">
                    Dupliquer
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
            <label class="helper">
              <input v-model="atelierSettings.caisse.clotureAutoMinuit" type="checkbox" :disabled="!settingsCanEdit" />
              Cloture automatique a minuit
            </label>
            <label class="helper">
              <input v-model="atelierSettings.caisse.paiementAvantLivraison" type="checkbox" :disabled="!settingsCanEdit" />
              Paiement obligatoire avant livraison
            </label>
            <label class="helper">
              <input v-model="atelierSettings.caisse.livraisonExpress" type="checkbox" :disabled="!settingsCanEdit" />
              Autoriser livraison express
            </label>
          </div>
        </article>

        <article v-show="settingsActiveTab === 'facturation'" id="settings-facturation" class="panel settings-section" role="tabpanel">
          <h3>Facturation</h3>
          <div class="settings-grid">
            <div class="stack-form">
              <label>Prefixe numerotation</label>
              <input v-model="atelierSettings.facturation.prefixeNumero" type="text" :disabled="!settingsCanEdit" />
            </div>
            <div class="stack-form">
              <label>Prochain numero</label>
              <input v-model="atelierSettings.facturation.prochainNumero" type="number" min="1" :disabled="!settingsCanEdit" />
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
              <div class="panel-footer table-pagination">
                <select v-model.number="securityUsersPagination.pageSize">
                  <option :value="5">5 / page</option>
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                  <option :value="50">50 / page</option>
                </select>
                <button class="mini-btn" :disabled="securityUsersPagination.page <= 1" @click="securityUsersPagination.page -= 1">Precedent</button>
                <span>Page {{ securityUsersPagination.page }} / {{ securityUsersPages }} · {{ securityUsersFiltered.length }} utilisateur(s)</span>
                <button class="mini-btn" :disabled="securityUsersPagination.page >= securityUsersPages" @click="securityUsersPagination.page += 1">Suivant</button>
              </div>
            </article>

            <article class="panel nested-panel">
              <div class="panel-header detail-panel-header">
                <h4>Permissions par role</h4>
              </div>
              <div class="settings-grid">
                <article class="panel nested-panel" v-for="role in securityRoleOptions" :key="`role-perm-${role.value}`">
                  <h4>{{ role.label }}</h4>
                  <div class="settings-roles">
                    <label class="helper" v-for="perm in securityPermissionOptions" :key="`perm-${role.value}-${perm}`">
                      <input
                        type="checkbox"
                        :checked="roleHasPermission(role.value, perm)"
                        @change="setRolePermission(role.value, perm, $event.target.checked)"
                      />
                      {{ securityPermissionLabels[perm] }}
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

        <article class="panel settings-sticky-actions">
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
      </section>

        <section v-else-if="currentRoute === 'facture-detail'" class="commande-detail">
        <article class="panel panel-header detail-header">
          <div>
            <h3>Detail facture</h3>
            <p class="helper" v-if="detailFacture">N{{ detailFacture.numeroFacture }}</p>
          </div>
          <div class="row-actions">
            <button class="mini-btn" @click="openRoute('facturation')">Retour</button>
            <button class="mini-btn" v-if="detailFacture" @click="onOuvrirOrigineFacture(detailFacture)">Voir origine</button>
            <button class="action-btn blue" v-if="detailFacture" @click="onGenererPdfFacture(detailFacture)">Generer PDF</button>
            <button class="action-btn green" v-if="detailFacture" @click="onImprimerFacture(detailFacture)">Imprimer</button>
          </div>

        </article>

        <article v-if="detailFactureError" class="panel error-panel">
          <strong>Erreur detail facture</strong>
          <p>{{ detailFactureError }}</p>
        </article>

        <article v-if="detailFactureLoading" class="panel">
          <p>Chargement de la facture...</p>
        </article>

        <template v-else-if="detailFacture">
          <article class="panel detail-grid">
            <div>
              <h4>En-tete</h4>
              <p><strong>Numero:</strong> {{ detailFacture.numeroFacture }}</p>
              <p><strong>Date emission:</strong> {{ formatDateTime(detailFacture.dateEmission) }}</p>
              <p><strong>Client:</strong> {{ detailFacture.client?.nom || "-" }}</p>
              <p><strong>Contact:</strong> {{ detailFacture.client?.contact || "-" }}</p>
              <p><strong>Origine:</strong> {{ detailFacture.typeOrigine }} / {{ detailFacture.idOrigine }}</p>
              <p><strong>Reference caisse:</strong> {{ detailFacture.referenceCaisse || "-" }}</p>
            </div>
            <div>
              <h4>Resume financier</h4>
              <p><strong>Total:</strong> {{ formatCurrency(detailFacture.montantTotal) }}</p>
              <p><strong>Paye:</strong> {{ formatCurrency(detailFacture.montantPaye) }}</p>
              <p><strong>Solde:</strong> {{ formatCurrency(detailFacture.solde) }}</p>
              <p><strong>Statut:</strong> {{ detailFacture.statut }}</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header detail-panel-header">
              <h4>Lignes facture</h4>
              <span class="helper">Lecture seule</span>
            </div>
            <table class="data-table">
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
                  <td>{{ ligne.description }}</td>
                  <td>{{ ligne.quantite }}</td>
                  <td>{{ formatCurrency(ligne.prix) }}</td>
                  <td>{{ formatCurrency(ligne.montant) }}</td>
                </tr>
                <tr v-if="detailFacture.lignes.length === 0">
                  <td colspan="4">Aucune ligne.</td>
                </tr>
              </tbody>
            </table></article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'caisse'" class="commande-detail">
        <article class="panel panel-header detail-header" :class="{ 'caisse-header-closed': !caisseOuverte }">
          <div>
            <h3>Caisse du jour</h3>
            <p class="helper" v-if="caisseJour">ID: {{ caisseJour.idCaisseJour }} Â· Date: {{ caisseJour.date }}</p>
          </div>
          <div class="row-actions">
            <span class="status-pill" :data-status="caisseStatus">
              <svg v-if="!caisseOuverte" class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path v-for="(path, i) in iconPaths.lock" :key="`lock-${i}`" :d="path" />
              </svg>
              {{ caisseStatus }}
            </span>
            <button class="action-btn green" v-if="!caisseOuverte" @click="onOuvrirCaisseDuJour">Ouvrir la caisse</button>
            <button class="mini-btn" v-if="!caisseOuverte" @click="onOuvrirCaisseAnticipee">Ouverture anticipee (manager)</button>
            <button class="action-btn amber" v-if="caisseOuverte" @click="onDepenseCaisse">Enregistrer depense</button>
            <button class="action-btn red" v-if="caisseOuverte" @click="onCloturerCaisse">Cloturer la caisse</button>
          </div>

        </article>

        <article v-if="caisseJour && !caisseOuverte" class="panel caisse-locked">
          <strong>Caisse cloturee</strong>
          <p>Aucune ecriture n'est autorisee apres cloture.</p>
        </article>

        <article v-if="!caisseJour" class="panel error-panel">
          <strong>Caisse indisponible</strong>
          <p>Aucune caisse du jour n'a ete chargee.</p>
        </article>

        <template v-else>
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
            <table class="data-table">
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
                  <td>{{ formatDateTime(op.dateOperation) }}</td>
                  <td>{{ op.typeOperation }}</td>
                  <td>{{ formatCurrency(op.montant) }}</td>
                  <td>
                    <span v-if="op.typeOperation === 'SORTIE'" class="status-pill" :data-tone="op.typeDepense === 'EXCEPTIONNELLE' ? 'amber' : 'blue'">
                      {{ depenseTypeLabel(op.typeDepense) }}
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td>{{ op.modePaiement || "-" }}</td>
                  <td>{{ op.motif || "-" }}</td>
                  <td>{{ op.justification || "-" }}</td>
                  <td>{{ op.referenceMetier || "-" }}</td>
                  <td>{{ op.effectuePar || "-" }}</td>
                  <td>{{ op.statutOperation || "-" }}</td>
                </tr>
                <tr v-if="caisseOperations.length === 0">
                  <td colspan="10">Aucune operation enregistree.</td>
                </tr>
              </tbody>
            </table>
            <div class="panel-footer table-pagination">
              <select v-model.number="caisseOperationsPagination.pageSize">
                <option :value="10">10 / page</option>
                <option :value="20">20 / page</option>
                <option :value="50">50 / page</option>
              </select>
              <button class="mini-btn" :disabled="caisseOperationsPagination.page <= 1" @click="caisseOperationsPagination.page -= 1">Precedent</button>
              <span>Page {{ caisseOperationsPagination.page }} / {{ caisseOperationsPages }}</span>
              <button class="mini-btn" :disabled="caisseOperationsPagination.page >= caisseOperationsPages" @click="caisseOperationsPagination.page += 1">Suivant</button>
            </div>
          </article>

        </template>
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
            <article class="panel audit-hub-card">
              <h4>Audit de la Caisse</h4>
              <p class="helper">Bilans financiers - Journaliers - Hebdomadaires - Mensuels</p>
              <div class="audit-metrics">
                <p><strong>Caisses cloturees:</strong> {{ auditHubMetrics.caissesCloturees }}</p>
                <p><strong>Dernier solde cloture:</strong> {{ formatCurrency(auditHubMetrics.dernierSoldeCloture) }}</p>
                <p><strong>Mois courant:</strong> {{ auditHubMetrics.moisCourant }}</p>
              </div>
              <button class="action-btn blue" @click="navigateAudit('/audit/caisse')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit des Operations</h4>
              <p class="helper">Journal global de toutes les operations financieres</p>
              <div class="audit-metrics">
                <p><strong>Total operations:</strong> {{ auditHubMetrics.totalOperations }}</p>
                <p><strong>Montant cumule:</strong> {{ formatCurrency(auditHubMetrics.montantCumule) }}</p>
              </div>
              <button class="action-btn blue" @click="navigateAudit('/audit/operations')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit des Commandes</h4>
              <p class="helper">Historique des commandes, paiements, livraisons et annulations</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/commandes')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit des Retouches</h4>
              <p class="helper">Historique des retouches, paiements et livraisons</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/retouches')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit Stock & Ventes</h4>
              <p class="helper">Ventes, sorties stock et liens avec la caisse</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/stock-ventes')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit Factures</h4>
              <p class="helper">Factures emises, lecture seule et statut derive des paiements caisse</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/factures')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit Utilisateurs</h4>
              <p class="helper">Actions de securite: comptes, activations, roles et permissions</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/utilisateurs')">Voir</button>
            </article>

            <article class="panel audit-hub-card">
              <h4>Audit Annuel (prevu)</h4>
              <p class="helper">Consolidation annuelle et comparaison des bilans</p>
              <button class="action-btn blue" @click="navigateAudit('/audit/annuel')">Voir</button>
            </article>
          </div>
        </template>

        <template v-else-if="auditSubRoute === '/audit/caisse'">
          <article class="panel">
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
                <tr v-for="row in auditCaisseJournalier" :key="row.id_caisse_jour">
                  <td>{{ row.date_ouverture ? row.date_ouverture.slice(0, 10) : "-" }}</td>
                  <td>{{ row.heure_ouverture || "-" }}</td>
                  <td>{{ row.date_cloture ? row.date_cloture.slice(0, 10) : "-" }}</td>
                  <td>{{ row.heure_cloture || "-" }}</td>
                  <td>{{ row.jour_semaine || "-" }}</td>
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
          </article>

          <article class="panel">
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
                <tr v-for="row in bilanHebdo" :key="row.id_bilan">
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
          </article>

          <article class="panel">
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
                <tr v-for="row in bilanMensuel" :key="row.id_bilan">
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
          </article>

          <article class="panel">
            <h3>Bilans annuels (prevu)</h3>
            <p class="helper">Structure prevue, non active.</p>
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/operations'">
          <article class="panel">
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
                <tr v-for="op in auditOperations" :key="op.id_operation">
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
            </table></article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/commandes'">
          <article class="panel">
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
                <tr v-for="row in auditCommandes" :key="row.idCommande">
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
            </table></article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/retouches'">
          <article class="panel">
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
                <tr v-for="row in auditRetouches" :key="row.idRetouche">
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
            </table></article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/stock-ventes'">
          <article class="panel">
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
                <tr v-for="row in auditStockVentes" :key="row.idMouvement">
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
            </table></article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/factures'">
          <article class="panel">
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
                <tr v-for="row in auditFactures" :key="row.idFacture">
                  <td>{{ row.numeroFacture }}</td>
                  <td>{{ row.client?.nom || "-" }}</td>
                  <td>{{ row.typeOrigine }} / {{ row.idOrigine }}</td>
                  <td>{{ formatDateTime(row.dateEmission) }}</td>
                  <td>{{ formatCurrency(row.montantTotal) }}</td>
                  <td>{{ formatCurrency(row.montantPaye) }}</td>
                  <td>{{ formatCurrency(row.solde) }}</td>
                  <td>{{ row.statut }}</td>
                </tr>
                <tr v-if="auditFactures.length === 0">
                  <td colspan="8">Aucune facture.</td>
                </tr>
              </tbody>
            </table></article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/utilisateurs'">
          <article class="panel">
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
                    {{ action === "ALL" ? "Toutes les actions" : action }}
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
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Utilisateur</th>
                  <th>Role</th>
                  <th>Entite</th>
                  <th>Succes</th>
                  <th>Raison</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in auditUtilisateursPaged" :key="row.idEvenement">
                  <td>{{ formatDateTime(row.dateEvenement) }}</td>
                  <td>{{ row.action || "-" }}</td>
                  <td>
                    <div>{{ row.utilisateurNom || row.utilisateurId || "-" }}</div>
                    <small class="helper" v-if="row.utilisateurEmail">{{ row.utilisateurEmail }}</small>
                  </td>
                  <td>{{ row.role || "-" }}</td>
                  <td>
                    <div>{{ auditEntiteLabel(row.entite) }}<span v-if="row.entiteId"> / {{ row.entiteId }}</span></div>
                    <small class="helper" v-if="row.entite">{{ row.entite }}</small>
                  </td>
                  <td>{{ row.payload?.succes === true ? "Oui" : "Non" }}</td>
                  <td>{{ row.payload?.raison || "-" }}</td>
                  <td>
                    <details>
                      <summary>Voir</summary>
                      <div class="audit-user-details">
                        <template v-if="auditUserDiffRows(row.payload?.details).length > 0">
                          <table class="data-table compact">
                            <thead>
                              <tr>
                                <th>Champ</th>
                                <th>Avant</th>
                                <th>Apres</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="item in auditUserDiffRows(row.payload?.details)" :key="`${row.idEvenement}-${item.key}`">
                                <td>{{ item.label }}</td>
                                <td>{{ item.before }}</td>
                                <td>{{ item.after }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </template>
                        <template v-else>
                          <pre>{{ JSON.stringify(row.payload?.details || {}, null, 2) }}</pre>
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
            <div class="panel-footer table-pagination">
              <select v-model.number="auditUtilisateursPagination.pageSize">
                <option :value="10">10 / page</option>
                <option :value="20">20 / page</option>
                <option :value="50">50 / page</option>
                <option :value="100">100 / page</option>
              </select>
              <button class="mini-btn" :disabled="auditUtilisateursPagination.page <= 1" @click="auditUtilisateursPagination.page -= 1">Precedent</button>
              <span>Page {{ auditUtilisateursPagination.page }} / {{ auditUtilisateursPages }} · {{ auditUtilisateursFiltered.length }} evenement(s)</span>
              <button class="mini-btn" :disabled="auditUtilisateursPagination.page >= auditUtilisateursPages" @click="auditUtilisateursPagination.page += 1">Suivant</button>
            </div>
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/annuel'">
          <article class="panel">
            <h3>Audit Annuel (prevu futur)</h3>
            <p class="helper">Cette route est reservee pour la consolidation annuelle.</p>
          </article>
        </template>
      </section>

        <section v-else-if="currentRoute === 'forbidden'" class="placeholder">
          <article class="panel error-panel">
            <h3>Acces refuse (403)</h3>
            <p>{{ forbiddenMessage }}</p>
          </article>
        </section>

        <section v-else class="placeholder">
          <article class="panel">
            <h3>{{ menuItems.find((item) => item.id === currentRoute)?.label }}</h3>
            <p>Vue en lecture/preparation. Le dashboard et la page commandes sont relies a la BD via l'API.</p>
          </article>
        </section>
      </div>
    </main>

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

  <div v-if="wizard.open" class="modal-backdrop" @click.self="closeWizard">
      <div class="modal-card">
        <header class="modal-header">
          <h3>Nouvelle commande</h3>
          <p>Etape {{ wizard.step }} / 3</p>
        </header>

        <section v-if="wizard.step === 1" class="modal-body">
          <p class="helper">Selectionner un client existant ou creer un client minimal pour cette commande.</p>

          <div class="segmented">
            <button class="mini-btn" :class="{ active: wizard.mode === 'existing' }" @click="wizard.mode = 'existing'">Client existant</button>
            <button class="mini-btn" :class="{ active: wizard.mode === 'new' }" @click="wizard.mode = 'new'">Nouveau client</button>
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
            <button class="mini-btn" @click="wizard.mode = 'new'">+ Nouveau client</button>

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
            <label>Telephone</label>
            <input v-model="wizard.newClient.telephone" type="text" />
          </div>

          <div class="modal-actions">
            <button class="mini-btn" @click="closeWizard">Annuler</button>
            <button class="action-btn blue" @click="onWizardStep1" :disabled="wizard.submitting">Continuer</button>
          </div>
        </section>

        <section v-else-if="wizard.step === 2" class="modal-body stack-form">
          <p class="helper">Creation de la commande liee au client selectionne.</p>
          <label>Type d'habit</label>
          <select v-model="wizard.commande.typeHabit">
            <option value="">Choisir un type d'habit</option>
            <option v-for="option in availableHabitTypeOptions" :key="`cmd-habit-${option.value}`" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <template v-if="wizard.commande.typeHabit">
            <label>Mesures (cm)</label>
            <div class="form-grid">
              <div v-for="field in commandeMesureFields" :key="`cmd-mes-${field.key}`" class="form-row">
                <label>{{ mesureDisplayLabel(field) }} <span v-if="field.required">*</span></label>
                <select
                  v-if="mesureInputType(field) === 'select'"
                  v-model="wizard.commande.mesuresHabit[field.key]"
                >
                  <option value="">Choisir</option>
                  <option value="courtes">courtes</option>
                  <option value="longues">longues</option>
                </select>
                <input
                  v-else
                  v-model="wizard.commande.mesuresHabit[field.key]"
                  :type="mesureInputType(field) === 'number' ? 'number' : 'text'"
                  min="0"
                  :step="mesureInputType(field) === 'number' ? '0.1' : undefined"
                  :placeholder="mesurePlaceholder(field)"
                />
              </div>
            </div>
          </template>
          <label>Description commande</label>
          <input v-model="wizard.commande.descriptionCommande" type="text" />
          <label>Montant total (FC)</label>
          <input v-model="wizard.commande.montantTotal" type="number" min="1" />
          <label>Date prevue</label>
          <input v-model="wizard.commande.datePrevue" type="date" />
          <label class="helper">
            <input v-model="wizard.commande.emettreFacture" type="checkbox" />
            Emettre facture apres creation (recommande)
          </label>

          <div class="modal-actions">
            <button class="mini-btn" @click="wizard.step = 1">Retour</button>
            <button class="action-btn blue" @click="onWizardStep2" :disabled="wizard.submitting">Creer la commande</button>
          </div>
        </section>

        <section v-else class="modal-body">
          <p class="helper">Commande creee avec succes.</p>
          <p><strong>ID commande:</strong> {{ wizard.createdCommandeId }}</p>
          <p v-if="wizard.createdFactureId"><strong>ID facture:</strong> {{ wizard.createdFactureId }}</p>
          <div class="modal-actions">
            <button class="action-btn green" @click="onWizardStep3Redirect">Voir le detail de la commande</button>
            <button v-if="wizard.createdFactureId" class="action-btn blue" @click="onWizardStep3FactureRedirect">Voir la facture</button>
          </div>
        </section>
      </div>
    </div>
  </div>

  <div v-if="retoucheWizard.open" class="modal-backdrop" @click.self="closeRetoucheWizard">
    <div class="modal-card">
      <header class="modal-header">
        <h3>Nouvelle retouche</h3>
        <p>Etape {{ retoucheWizard.step }} / 3</p>
      </header>

      <section v-if="retoucheWizard.step === 1" class="modal-body">
        <p class="helper">Selectionner un client existant ou creer un client minimal pour cette retouche.</p>

        <div class="segmented">
          <button class="mini-btn" :class="{ active: retoucheWizard.mode === 'existing' }" @click="retoucheWizard.mode = 'existing'">Client existant</button>
          <button class="mini-btn" :class="{ active: retoucheWizard.mode === 'new' }" @click="retoucheWizard.mode = 'new'">Nouveau client</button>
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
          <button class="mini-btn" @click="retoucheWizard.mode = 'new'">+ Nouveau client</button>

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
        </div>

        <div class="modal-actions">
          <button class="mini-btn" @click="closeRetoucheWizard">Annuler</button>
          <button class="action-btn blue" @click="onRetoucheWizardStep1" :disabled="retoucheWizard.submitting">Continuer</button>
        </div>
      </section>

      <section v-else-if="retoucheWizard.step === 2" class="modal-body stack-form">
        <p class="helper">Creation de la retouche liee au client selectionne.</p>
        <label>Type d'habit</label>
        <select v-model="retoucheWizard.retouche.typeHabit">
          <option value="">Choisir un type d'habit</option>
          <option v-for="option in availableHabitTypeOptions" :key="`ret-habit-${option.value}`" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <template v-if="retoucheWizard.retouche.typeHabit">
          <label>
            Mesures (cm)
            <span v-if="retoucheMeasuresRequired">- au moins une mesure cible est requise</span>
            <span v-else-if="atelierSettings.retouches?.mesuresOptionnelles === false">- non requises pour ce type</span>
            <span v-else>- saisie optionnelle</span>
          </label>
          <div class="form-grid">
            <div v-for="field in retoucheMesureFields" :key="`ret-mes-${field.key}`" class="form-row">
              <label>{{ mesureDisplayLabel(field) }}</label>
              <select
                v-if="mesureInputType(field) === 'select'"
                v-model="retoucheWizard.retouche.mesuresHabit[field.key]"
              >
                <option value="">Choisir</option>
                <option value="courtes">courtes</option>
                <option value="longues">longues</option>
              </select>
              <input
                v-else
                v-model="retoucheWizard.retouche.mesuresHabit[field.key]"
                :type="mesureInputType(field) === 'number' ? 'number' : 'text'"
                min="0"
                :step="mesureInputType(field) === 'number' ? '0.1' : undefined"
                :placeholder="mesurePlaceholder(field)"
              />
            </div>
          </div>
        </template>
        <label>Type de retouche</label>
        <select v-model="retoucheWizard.retouche.typeRetouche">
          <option value="">Choisir un type de retouche</option>
          <option v-for="option in retoucheTypeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p v-if="selectedRetoucheTypeDefinition" class="helper">
          Habits compatibles: {{ (selectedRetoucheTypeDefinition.habitsCompatibles || []).join(", ") }}
          · Description {{ retoucheDescriptionRequired ? "obligatoire" : "optionnelle" }}
          · Mesures {{ retoucheMeasuresRequired ? "requises" : atelierSettings.retouches?.mesuresOptionnelles === false ? "non autorisees" : "optionnelles" }}
        </p>
        <label>Description retouche</label>
        <input v-model="retoucheWizard.retouche.descriptionRetouche" type="text" />
        <label>Montant total (FC)</label>
        <input v-model="retoucheWizard.retouche.montantTotal" type="number" min="1" />
        <label>Date prevue</label>
        <input v-model="retoucheWizard.retouche.datePrevue" type="date" />
        <label class="helper">
          <input v-model="retoucheWizard.retouche.emettreFacture" type="checkbox" />
          Emettre facture apres creation (recommande)
        </label>

        <div class="modal-actions">
          <button class="mini-btn" @click="retoucheWizard.step = 1">Retour</button>
          <button class="action-btn blue" @click="onRetoucheWizardStep2" :disabled="retoucheWizard.submitting">Creer la retouche</button>
        </div>
      </section>

      <section v-else class="modal-body">
        <p class="helper">Retouche creee avec succes.</p>
        <p><strong>ID retouche:</strong> {{ retoucheWizard.createdRetoucheId }}</p>
        <p v-if="retoucheWizard.createdFactureId"><strong>ID facture:</strong> {{ retoucheWizard.createdFactureId }}</p>
        <div class="modal-actions">
          <button class="action-btn green" @click="onRetoucheWizardStep3Redirect">Voir le detail de la retouche</button>
          <button v-if="retoucheWizard.createdFactureId" class="action-btn blue" @click="onRetoucheWizardStep3FactureRedirect">
            Voir la facture
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

  <div v-if="actionModal.open" class="modal-backdrop" @click.self="closeActionModal(null)">
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










