<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { atelierApi, ApiError } from "./services/api.js";

const currentRoute = ref("dashboard");
const toast = ref("");
const loading = ref(false);
const errorMessage = ref("");

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

const retoucheFilters = reactive({
  statut: "ALL",
  client: "ALL",
  periode: "ALL",
  recherche: "",
  soldeRestant: "ALL"
});

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
    typeRetouche: "AUTRE",
    montantTotal: "",
    datePrevue: "",
    emettreFacture: true,
    typeHabit: "",
    mesuresHabit: {}
  }
});

const factureEmission = reactive({
  open: false,
  typeOrigine: "COMMANDE",
  idOrigine: "",
  submitting: false
});

const selectedCommandeId = ref("");
const detailCommande = ref(null);
const detailPaiements = ref([]);
const detailLoading = ref(false);
const detailPaiementsLoading = ref(false);
const detailError = ref("");

const selectedRetoucheId = ref("");
const detailRetouche = ref(null);
const detailRetouchePaiements = ref([]);
const detailRetoucheLoading = ref(false);
const detailRetouchePaiementsLoading = ref(false);
const detailRetoucheError = ref("");

const selectedVenteId = ref("");
const detailVente = ref(null);
const detailVenteLoading = ref(false);
const detailVenteError = ref("");

const selectedFactureId = ref("");
const detailFacture = ref(null);
const detailFactureLoading = ref(false);
const detailFactureError = ref("");

const selectedClientConsultationId = ref("");
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
const retoucheTypeOptions = [
  { value: "OURLET", label: "Ourlet" },
  { value: "RESSERRAGE", label: "Resserrage" },
  { value: "AGRANDISSEMENT", label: "Agrandissement" },
  { value: "REPARATION", label: "Reparation" },
  { value: "FERMETURE", label: "Fermeture" },
  { value: "AUTRE", label: "Autre" }
];

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

const auditRoutes = [
  { path: "/audit", title: "Historique & Audit", subtitle: "Hub de navigation audit" },
  { path: "/audit/caisse", title: "Audit de la Caisse", subtitle: "Bilans journaliers, hebdomadaires et mensuels" },
  { path: "/audit/operations", title: "Audit des Operations", subtitle: "Journal global des operations financieres" },
  { path: "/audit/commandes", title: "Audit des Commandes", subtitle: "Historique commandes, paiements, livraisons, annulations" },
  { path: "/audit/retouches", title: "Audit des Retouches", subtitle: "Historique retouches, paiements, livraisons" },
  { path: "/audit/stock-ventes", title: "Audit Stock & Ventes", subtitle: "Ventes, sorties stock et lien caisse" },
  { path: "/audit/factures", title: "Audit des Factures", subtitle: "Factures emises en lecture seule" },
  { path: "/audit/utilisateurs", title: "Audit Utilisateurs", subtitle: "Prevu: actions par utilisateur" },
  { path: "/audit/annuel", title: "Audit Annuel", subtitle: "Prevu: consolidation annuelle" }
];

const clientMap = computed(() => {
  const map = new Map();
  for (const client of clients.value) {
    map.set(client.idClient, `${client.nom || ""} ${client.prenom || ""}`.trim());
  }
  return map;
});

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
  if (detailCommande.value.statutCommande === "LIVREE" || detailCommande.value.statutCommande === "ANNULEE") return false;
  return detailSoldeRestant.value > 0;
});
const canLivrerDetail = computed(() => {
  if (!detailCommande.value) return false;
  return detailCommande.value.statutCommande === "TERMINEE" && detailSoldeRestant.value === 0;
});
const canAnnulerDetail = computed(() => {
  if (!detailCommande.value) return false;
  return detailCommande.value.statutCommande !== "LIVREE" && detailCommande.value.statutCommande !== "ANNULEE";
});

const detailRetoucheSoldeRestant = computed(() => soldeRestant(detailRetouche.value));
const canPayerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  if (detailRetouche.value.statutRetouche === "LIVREE" || detailRetouche.value.statutRetouche === "ANNULEE") return false;
  return detailRetoucheSoldeRestant.value > 0;
});
const canLivrerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  return detailRetouche.value.statutRetouche === "TERMINEE" && detailRetoucheSoldeRestant.value === 0;
});
const canAnnulerRetoucheDetail = computed(() => {
  if (!detailRetouche.value) return false;
  return detailRetouche.value.statutRetouche !== "LIVREE" && detailRetouche.value.statutRetouche !== "ANNULEE";
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
  const set = new Set(habitTypeOptions.map((item) => item.value));
  for (const row of clientConsultationCommandes.value) if (row.typeHabit) set.add(row.typeHabit);
  for (const row of clientConsultationRetouches.value) if (row.typeHabit) set.add(row.typeHabit);
  for (const row of clientConsultationMesures.value) if (row.typeHabit) set.add(row.typeHabit);
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
});

const clientFilteredCommandes = computed(() => clientConsultationCommandes.value);

const clientFilteredRetouches = computed(() => clientConsultationRetouches.value);

const clientFilteredMesures = computed(() => clientConsultationMesures.value);

const clientCommandesPages = computed(() => Math.max(1, Number(clientConsultationPagination.value.commandes?.totalPages || 1)));
const clientRetouchesPages = computed(() => Math.max(1, Number(clientConsultationPagination.value.retouches?.totalPages || 1)));
const clientMesuresPages = computed(() => Math.max(1, Number(clientConsultationPagination.value.mesures?.totalPages || 1)));

const clientCommandesPaged = computed(() => clientFilteredCommandes.value);
const clientRetouchesPaged = computed(() => clientFilteredRetouches.value);
const clientMesuresPaged = computed(() => clientFilteredMesures.value);

const commandeMesureFields = computed(() => {
  const type = wizard.commande.typeHabit;
  const def = habitMesureDefinitions[type];
  if (!def) return [];
  return [
    ...def.required.map((key) => ({ key, required: true })),
    ...def.optional.map((key) => ({ key, required: false }))
  ];
});

const retoucheMesureFields = computed(() => {
  const type = retoucheWizard.retouche.typeHabit;
  const def = habitMesureDefinitions[type];
  if (!def) return [];
  return [
    ...def.required.map((key) => ({ key, required: false })),
    ...def.optional.map((key) => ({ key, required: false }))
  ];
});

const lowStockArticles = computed(() =>
  stockArticles.value.filter((a) => Number(a.quantiteDisponible || 0) <= Number(a.seuilAlerte || 0))
);

const dashboardCards = computed(() => [
  { label: "Commandes en cours", value: commandesView.value.filter((c) => c.statutCommande === "EN_COURS").length, tone: "blue" },
  { label: "Commandes pretes", value: commandesView.value.filter((c) => c.statutCommande === "TERMINEE").length, tone: "green" },
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

const recentWorkRows = computed(() => {
  const cmdRows = commandesView.value.map((c) => ({
    id: c.idCommande,
    clientNom: c.clientNom,
    type: "Commande",
    statut: c.statutCommande,
    montantTotal: c.montantTotal,
    avancePayee: c.montantPaye,
    dateRef: c.dateCreation || c.datePrevue || ""
  }));

  const retRows = retouches.value.map((r) => ({
    id: r.idRetouche,
    clientNom: r.clientNom || clientMap.value.get(r.idClient) || r.idClient,
    type: "Retouche",
    statut: r.statutRetouche,
    montantTotal: Number(r.montantTotal || 0),
    avancePayee: Number(r.montantPaye || 0),
    dateRef: r.dateDepot || r.datePrevue || ""
  }));

  return [...cmdRows, ...retRows]
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
const caisseTotals = computed(() => {
  const ops = caisseOperations.value.filter((op) => op.statutOperation !== "ANNULEE");
  const totalEntrees = ops.filter((op) => op.typeOperation === "ENTREE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  const totalSorties = ops.filter((op) => op.typeOperation === "SORTIE").reduce((sum, op) => sum + Number(op.montant || 0), 0);
  return { totalEntrees, totalSorties };
});

const alerts = computed(() => {
  const today = todayIso();
  const lateCommandes = commandesView.value.filter(
    (c) => c.datePrevue && c.datePrevue < today && c.statutCommande !== "LIVREE" && c.statutCommande !== "ANNULEE"
  );
  const lowStock = stockArticles.value.filter((a) => Number(a.quantiteDisponible || 0) <= Number(a.seuilAlerte || 0));
  const caisseNotClosed = caisseJour.value && caisseJour.value.statutCaisse !== "CLOTUREE";

  const items = [];
  if (lateCommandes.length > 0) items.push(`${lateCommandes.length} commande(s) en retard`);
  for (const article of lowStock) {
    items.push(`Stock faible: ${article.nomArticle}`);
  }
  if (caisseNotClosed) items.push("Caisse non cloturee");
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

  return commandesView.value.filter((commande) => {
    if (filters.statut !== "ALL" && commande.statutCommande !== filters.statut) return false;
    if (filters.client !== "ALL" && commande.idClient !== filters.client) return false;

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

  return retouchesView.value.filter((retouche) => {
    if (retoucheFilters.statut !== "ALL" && retouche.statutRetouche !== retoucheFilters.statut) return false;
    if (retoucheFilters.client !== "ALL" && retouche.idClient !== retoucheFilters.client) return false;

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

function onBrowserNavigation() {
  const auditPath = normalizeAuditPath(window.location.pathname);
  if (!auditPath) return;
  currentRoute.value = "audit";
  auditSubRoute.value = auditPath;
  loadAuditPage(auditPath);
}

onMounted(async () => {
  syncRouteFromLocation();
  window.addEventListener("popstate", onBrowserNavigation);
  await reloadAll();
  if (currentRoute.value === "audit") loadAuditPage(auditSubRoute.value);
});

onUnmounted(() => {
  window.removeEventListener("popstate", onBrowserNavigation);
});

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
  () => [clientPagination.commandesPage, clientPagination.retouchesPage, clientPagination.mesuresPage],
  async () => {
    if (currentRoute.value === "clientsMesures" && selectedClientConsultationId.value) {
      await loadClientConsultation(selectedClientConsultationId.value, true);
    }
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
  }
);

function notify(message) {
  toast.value = message;
  setTimeout(() => {
    if (toast.value === message) toast.value = "";
  }, 2600);
}

function openRoute(routeId) {
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

  const [clientsResult, commandesResult, retouchesResult, stockResult, ventesResult, facturesResult, caisseDaysResult] =
    await Promise.allSettled([
    atelierApi.listClients(),
    atelierApi.listCommandes(),
    atelierApi.listRetouches(),
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
  if (row?.type_operation === "SORTIE") return "DÃ©pense atelier";
  return motif || String(row?.type_operation || "-");
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
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Erreur API inconnue";
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
    soldeCourant: Number(raw.soldeCourant ?? raw.solde_courant ?? 0),
    operations: (raw.operations || []).map((op) => ({
      idOperation: op.idOperation || op.id_operation,
      typeOperation: op.typeOperation || op.type_operation,
      montant: Number(op.montant || 0),
      motif: op.motif || "",
      dateOperation: op.dateOperation || op.date_operation || "",
      statutOperation: op.statutOperation || op.statut_operation || "VALIDE"
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

function exportClientConsultationPdf() {
  if (!clientConsultationClient.value?.idClient) return;
  const url = atelierApi.getClientConsultationPdfUrl(clientConsultationClient.value.idClient, {
    source: clientHistoryFilters.source,
    typeHabit: clientHistoryFilters.typeHabit,
    periode: clientHistoryFilters.periode,
    size: 200,
    autoprint: 1
  });
  window.open(url, "_blank");
}

function formatDateTime(input) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
  return `${new Intl.NumberFormat("fr-FR").format(Number(value || 0))} FC`;
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

function mesureInputType(fieldKey) {
  return fieldKey === "typeManches" ? "select" : "number";
}

function mesurePlaceholder(fieldKey) {
  if (fieldKey === "typeManches") return "courtes | longues";
  return "cm";
}

function mesureDisplayLabel(fieldKey) {
  return mesureLabels[fieldKey] || fieldKey;
}

function parseMesureValue(raw, label) {
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) throw new Error(`Mesure invalide: ${label}`);
  if (n > 400) throw new Error(`Mesure aberrante: ${label}`);
  return n;
}

function collectMesuresSnapshot({ typeHabit, mesuresModel, requireComplete }) {
  const def = habitMesureDefinitions[typeHabit];
  if (!def) throw new Error("Type d'habit requis.");
  const out = {};

  for (const field of def.required) {
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
    out[field] = parseMesureValue(raw, mesureDisplayLabel(field));
  }

  for (const field of def.optional) {
    if (field === "typeManches") continue;
    const raw = mesuresModel[field];
    if (raw === undefined || raw === null || raw === "") continue;
    out[field] = parseMesureValue(raw, mesureDisplayLabel(field));
  }

  if (out.typeManches === "longues") {
    const raw = mesuresModel.longueurManches;
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete) throw new Error("Longueur manches requise si manches longues.");
    } else {
      out.longueurManches = parseMesureValue(raw, mesureDisplayLabel("longueurManches"));
    }
  }

  if (!requireComplete && Object.keys(out).length === 0) {
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
  if (commande.statutCommande === "LIVREE" || commande.statutCommande === "ANNULEE") return false;
  return soldeRestant(commande) > 0;
}

function canLivrer(commande) {
  if (!commande) return false;
  return commande.statutCommande === "TERMINEE" && soldeRestant(commande) === 0;
}

function canAnnuler(commande) {
  if (!commande) return false;
  return commande.statutCommande !== "LIVREE" && commande.statutCommande !== "ANNULEE";
}

function canPayerRetouche(retouche) {
  if (!retouche) return false;
  if (retouche.statutRetouche === "LIVREE" || retouche.statutRetouche === "ANNULEE") return false;
  return soldeRestant(retouche) > 0;
}

function canLivrerRetouche(retouche) {
  if (!retouche) return false;
  return retouche.statutRetouche === "TERMINEE" && soldeRestant(retouche) === 0;
}

function canAnnulerRetouche(retouche) {
  if (!retouche) return false;
  return retouche.statutRetouche !== "LIVREE" && retouche.statutRetouche !== "ANNULEE";
}

async function onAnnulerCommande(commande) {
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
  retoucheWizard.retouche.typeRetouche = "AUTRE";
  retoucheWizard.retouche.montantTotal = "";
  retoucheWizard.retouche.datePrevue = "";
  retoucheWizard.retouche.emettreFacture = true;
  retoucheWizard.retouche.typeHabit = "";
  retoucheWizard.retouche.mesuresHabit = {};
  resetMesuresModel(retoucheWizard.retouche.mesuresHabit);
}

function openNouvelleRetouche() {
  resetRetoucheWizard();
  retoucheWizard.open = true;
}

function closeRetoucheWizard() {
  retoucheWizard.open = false;
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

    const mesuresSnapshot = collectMesuresSnapshot({
      typeHabit: wizard.commande.typeHabit,
      mesuresModel: wizard.commande.mesuresHabit,
      requireComplete: true
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
    if (!retoucheWizard.retouche.descriptionRetouche || Number.isNaN(montant) || montant <= 0) {
      throw new Error("Description et montant valide sont obligatoires.");
    }
    if (!retoucheWizard.retouche.typeHabit) throw new Error("Type d'habit obligatoire.");

    const mesuresSnapshot = collectMesuresSnapshot({
      typeHabit: retoucheWizard.retouche.typeHabit,
      mesuresModel: retoucheWizard.retouche.mesuresHabit,
      requireComplete: false
    });

    const payload = {
      idClient: retoucheWizard.resolvedClientId,
      descriptionRetouche: retoucheWizard.retouche.descriptionRetouche,
      typeRetouche: retoucheWizard.retouche.typeRetouche || "AUTRE",
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
    if (message.toLowerCase().includes("caisse is closed") || message.toLowerCase().includes("caisse")) {
      notify("Caisse cloturee: validation impossible.");
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
  const motif = window.prompt("Motif d'annulation (optionnel)", "") ?? "";
  try {
    await atelierApi.annulerVente(vente.idVente, motif);
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
  const raw = window.prompt(`Montant du paiement caisse pour ${commande.idCommande} (FC)`, "25000");
  if (raw === null) return;

  const montant = Number(raw);
  if (Number.isNaN(montant) || montant <= 0) {
    notify("Montant invalide.");
    return;
  }

  try {
    await atelierApi.enregistrerPaiementViaCaisse({ idCommande: commande.idCommande, montant, utilisateur: "frontend" });
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${commande.idCommande}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onPaiementDetail() {
  if (!detailCommande.value) return;
  const raw = window.prompt(`Montant du paiement caisse pour ${detailCommande.value.idCommande} (FC)`, "25000");
  if (raw === null) return;

  const montant = Number(raw);
  if (Number.isNaN(montant) || montant <= 0) {
    notify("Montant invalide.");
    return;
  }

  try {
    await atelierApi.enregistrerPaiementViaCaisse({ idCommande: detailCommande.value.idCommande, montant, utilisateur: "frontend" });
    await loadCommandeDetail(detailCommande.value.idCommande);
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${detailCommande.value.idCommande}`);
  } catch (err) {
    notify(readableError(err));
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

async function onAnnulerDetail() {
  if (!detailCommande.value) return;
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
  const raw = window.prompt(`Montant du paiement caisse pour ${retouche.idRetouche} (FC)`, "10000");
  if (raw === null) return;

  const montant = Number(raw);
  if (Number.isNaN(montant) || montant <= 0) {
    notify("Montant invalide.");
    return;
  }

  try {
    await atelierApi.enregistrerPaiementRetoucheViaCaisse({ idRetouche: retouche.idRetouche, montant, utilisateur: "frontend" });
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${retouche.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
  }
}

async function onPaiementRetoucheDetail() {
  if (!detailRetouche.value) return;
  const raw = window.prompt(`Montant du paiement caisse pour ${detailRetouche.value.idRetouche} (FC)`, "10000");
  if (raw === null) return;

  const montant = Number(raw);
  if (Number.isNaN(montant) || montant <= 0) {
    notify("Montant invalide.");
    return;
  }

  try {
    await atelierApi.enregistrerPaiementRetoucheViaCaisse({ idRetouche: detailRetouche.value.idRetouche, montant, utilisateur: "frontend" });
    await loadRetoucheDetail(detailRetouche.value.idRetouche);
    await reloadAll();
    notify(`Paiement enregistre via la caisse pour ${detailRetouche.value.idRetouche}`);
  } catch (err) {
    notify(readableError(err));
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

async function onAnnulerRetouche(retouche) {
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

  const motif = window.prompt("Motif de la depense", "");
  if (motif === null) return;
  if (!motif.trim()) {
    notify("Motif obligatoire.");
    return;
  }

  const raw = window.prompt("Montant de la depense (FC)", "5000");
  if (raw === null) return;
  const montant = Number(raw);
  if (Number.isNaN(montant) || montant <= 0) {
    notify("Montant invalide.");
    return;
  }

  try {
    await atelierApi.enregistrerDepenseCaisse({ idCaisseJour: caisseJour.value.idCaisseJour, montant, motif: motif.trim(), utilisateur: "frontend" });
    await reloadAll();
    notify("Depense enregistree.");
  } catch (err) {
    notify(readableError(err));
  }
}

async function onCloturerCaisse() {
  if (!caisseJour.value) return;
  if (!caisseOuverte.value) {
    notify("Caisse deja cloturee.");
    return;
  }

  const confirm = window.confirm("Cloturer la caisse ? Cette action bloque toute nouvelle ecriture.");
  if (!confirm) return;

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
      const raw = window.prompt("Solde d'ouverture initial (FC)", "0");
      if (raw === null) return;
      soldeOuverture = Number(raw);
      if (Number.isNaN(soldeOuverture) || soldeOuverture < 0) {
        notify("Solde d'ouverture invalide.");
        return;
      }
    }

    await atelierApi.ouvrirCaisseDuJour({ soldeOuverture, utilisateur: "frontend" });
    await reloadAll();
    notify("Caisse du jour ouverte.");
  } catch (err) {
    notify(readableError(err));
  }
}

async function onOuvrirCaisseAnticipee() {
  const motif = window.prompt("Motif ouverture anticipee (manager)", "");
  if (motif === null) return;
  if (!motif.trim()) {
    notify("Motif obligatoire.");
    return;
  }

  try {
    const info = await atelierApi.getOuvertureCaisseInfo({
      overrideHeureOuverture: true,
      role: "manager",
      motifOverride: motif.trim()
    });
    let soldeOuverture = 0;
    if (info.source === "INITIAL_REQUIRED") {
      const raw = window.prompt("Solde d'ouverture initial (FC)", "0");
      if (raw === null) return;
      soldeOuverture = Number(raw);
      if (Number.isNaN(soldeOuverture) || soldeOuverture < 0) {
        notify("Solde d'ouverture invalide.");
        return;
      }
    }

    await atelierApi.ouvrirCaisseDuJour({
      soldeOuverture,
      utilisateur: "manager",
      overrideHeureOuverture: true,
      role: "manager",
      motifOverride: motif.trim()
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

function facturePdfUrl(idFacture, autoPrint = false) {
  const base = atelierApi.getFacturePdfUrl(idFacture);
  return autoPrint ? `${base}?autoprint=1` : base;
}

function onGenererPdfFacture(facture) {
  if (!facture?.idFacture) return;
  window.open(facturePdfUrl(facture.idFacture, false), "_blank");
  notify(`PDF pret: ${facture.numeroFacture}`);
}

function onImprimerFacture(facture) {
  if (!facture?.idFacture) return;
  window.open(facturePdfUrl(facture.idFacture, true), "_blank");
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
  try {
    const detail = await atelierApi.getCommande(idCommande);
    detailCommande.value = normalizeCommande(detail);
  } catch (err) {
    detailCommande.value = null;
    detailPaiements.value = [];
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
}

async function loadRetoucheDetail(idRetouche) {
  if (!idRetouche) return;
  detailRetoucheLoading.value = true;
  detailRetoucheError.value = "";
  try {
    const detail = await atelierApi.getRetouche(idRetouche);
    detailRetouche.value = normalizeRetouche(detail);
  } catch (err) {
    detailRetouche.value = null;
    detailRetouchePaiements.value = [];
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
}
</script>

<template>
  <div class="workspace classic">
    <aside class="sidebar classic-sidebar">
      <div class="brand classic-brand">
        <div class="brand-mark">AT</div>
        <div>
          <h1>Atelier de Couture</h1>
          <p>Gestion metier</p>
        </div>
      </div>

      <nav class="menu">
        <a
          v-for="item in menuItems"
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
    </aside>

    <main class="main">
      <header class="topbar classic-topbar">
        <div>
          <p class="date-label">{{ todayIso() }}</p>
          <h2>{{ currentTitle }}</h2>
        </div>
        <div class="topbar-actions">
          <button class="mini-btn" @click="reloadAll" :disabled="loading">Actualiser</button>
          <div class="toast" :class="{ visible: toast }">{{ toast || "Pret" }}</div>
        </div>
      </header>

      <div v-if="errorMessage" class="panel error-panel">
        <strong>Erreur de synchronisation API</strong>
        <p>{{ errorMessage }}</p>
      </div>

      <section v-if="currentRoute === 'dashboard'" class="dashboard classic-dashboard">
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
                <li v-for="alert in alerts" :key="alert">
                  <span>{{ alert }}</span>
                </li>
              </ul>
            </article>
          </div>
        </div>

        <div class="quick-actions legacy-actions">
          <button class="action-btn blue" @click="openNouvelleCommande">Nouvelle Commande</button>
          <button class="action-btn blue" @click="openNouvelleRetouche">Nouvelle Retouche</button>
          <button class="action-btn green" @click="placeholderAction('Paiement Client')">Paiement Client</button>
          <button class="action-btn amber" @click="placeholderAction('Vente Article')">Vente Article</button>
          <button class="action-btn red" @click="placeholderAction('Cloturer la Caisse')">Cloturer la Caisse</button>
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
          <h3>Filtres commandes</h3>
          <div class="filters compact">
            <select v-model="filters.statut">
              <option v-for="status in statusOptions" :key="status" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <select v-model="filters.client">
              <option value="ALL">Tous clients</option>
              <option v-for="client in clients" :key="client.idClient" :value="client.idClient">
                {{ `${client.nom} ${client.prenom}`.trim() }}
              </option>
            </select>
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

        </article>

        <article class="panel">
          <div class="panel-header">
            <h3>Tableau des commandes API</h3>
            <span class="status-pill" data-tone="due">
              {{ commandesSoldeRestantCount }} avec solde restant
            </span>
          </div>
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
                v-for="commande in commandesFiltered"
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
                  <button class="mini-btn" v-if="canAnnuler(commande)" @click="onAnnulerCommande(commande)">
                    <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 3l18 18" />
                      <path d="M21 3L3 21" />
                    </svg>
                    Annuler
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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
          <h3>Filtres retouches</h3>
          <div class="filters compact">
            <select v-model="retoucheFilters.statut">
              <option v-for="status in retoucheStatusOptions" :key="status" :value="status">
                {{ status === "ALL" ? "Tous statuts" : status }}
              </option>
            </select>
            <select v-model="retoucheFilters.client">
              <option value="ALL">Tous clients</option>
              <option v-for="client in clients" :key="client.idClient" :value="client.idClient">
                {{ `${client.nom} ${client.prenom}`.trim() }}
              </option>
            </select>
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

        </article>

        <article class="panel">
          <div class="panel-header">
            <h3>Tableau des retouches API</h3>
            <span class="status-pill" data-tone="due">
              {{ retouchesSoldeRestantCount }} avec solde restant
            </span>
          </div>
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
                v-for="retouche in retouchesFiltered"
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
                  <button class="mini-btn" v-if="canAnnulerRetouche(retouche)" @click="onAnnulerRetouche(retouche)">
                    <svg class="icon mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 3l18 18" />
                      <path d="M21 3L3 21" />
                    </svg>
                    Annuler
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>

      <section v-else-if="currentRoute === 'clientsMesures'" class="commandes-page">
        <article class="panel panel-header">
          <h3>Fiche Client - Consultation</h3>
          <div class="filters compact" style="min-width: 320px;">
            <select v-model="selectedClientConsultationId">
              <option value="" v-if="clients.length === 0">Aucun client disponible</option>
              <option v-for="client in clients" :key="`consult-${client.idClient}`" :value="client.idClient">
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
            <h3>Historique des commandes ({{ clientConsultationResultats.commandes }})</h3>
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
            <div class="panel-footer">
              <button class="mini-btn" :disabled="clientPagination.commandesPage <= 1" @click="setClientPage('commandes', clientPagination.commandesPage - 1)">Precedent</button>
              <span>Page {{ clientPagination.commandesPage }} / {{ clientCommandesPages }}</span>
              <button class="mini-btn" :disabled="clientPagination.commandesPage >= clientCommandesPages" @click="setClientPage('commandes', clientPagination.commandesPage + 1)">Suivant</button>
            </div>
          </article>

          <article class="panel">
            <h3>Historique des retouches ({{ clientConsultationResultats.retouches }})</h3>
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
            <div class="panel-footer">
              <button class="mini-btn" :disabled="clientPagination.retouchesPage <= 1" @click="setClientPage('retouches', clientPagination.retouchesPage - 1)">Precedent</button>
              <span>Page {{ clientPagination.retouchesPage }} / {{ clientRetouchesPages }}</span>
              <button class="mini-btn" :disabled="clientPagination.retouchesPage >= clientRetouchesPages" @click="setClientPage('retouches', clientPagination.retouchesPage + 1)">Suivant</button>
            </div>
          </article>

          <article class="panel">
            <h3>Historique des mesures ({{ clientConsultationResultats.mesures }})</h3>
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
            </table></article>
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
            </table></article>
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
              <tr v-for="facture in facturesView" :key="facture.idFacture">
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
              <tr v-if="facturesView.length === 0">
                <td colspan="9">Aucune facture emise.</td>
              </tr>
            </tbody>
          </table>
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
          <article class="panel detail-grid">
            <div>
              <h4>Statut caisse</h4>
              <p><strong>Etat:</strong> {{ caisseStatus }}</p>
              <p><strong>Solde courant:</strong> {{ formatCurrency(caisseJour.soldeCourant) }}</p>
              <p><strong>Solde ouverture:</strong> {{ formatCurrency(caisseJour.soldeOuverture) }}</p>
              <p><strong>Ouverte par:</strong> {{ caisseJour.ouvertePar || "-" }}</p>
            </div>
            <div>
              <h4>Resume financier</h4>
              <p><strong>Total entrees:</strong> {{ formatCurrency(caisseTotals.totalEntrees) }}</p>
              <p><strong>Total sorties:</strong> {{ formatCurrency(caisseTotals.totalSorties) }}</p>
              <p><strong>Solde:</strong> {{ formatCurrency(caisseJour.soldeCourant) }}</p>
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
                  <th>Mode</th>
                  <th>Motif</th>
                  <th>Reference</th>
                  <th>Utilisateur</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="op in caisseOperations" :key="op.idOperation">
                  <td>{{ formatDateTime(op.dateOperation) }}</td>
                  <td>{{ op.typeOperation }}</td>
                  <td>{{ formatCurrency(op.montant) }}</td>
                  <td>{{ op.modePaiement || "-" }}</td>
                  <td>{{ op.motif || "-" }}</td>
                  <td>{{ op.referenceMetier || "-" }}</td>
                  <td>{{ op.effectuePar || "-" }}</td>
                  <td>{{ op.statutOperation || "-" }}</td>
                </tr>
                <tr v-if="caisseOperations.length === 0">
                  <td colspan="8">Aucune operation enregistree.</td>
                </tr>
              </tbody>
            </table>
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
              <h4>Audit Utilisateurs (prevu)</h4>
              <p class="helper">Actions par utilisateur, encaissements, depenses, clotures de caisse</p>
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
                  <td>{{ formatCurrency(row.solde_cloture) }}</td>
                  <td>{{ row.nombre_operations }}</td>
                </tr>
                <tr v-if="auditCaisseJournalier.length === 0">
                  <td colspan="10">Aucune caisse cloturee.</td>
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
                  <th>Mode de paiement</th>
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
                  <td>{{ op.mode_paiement || "-" }}</td>
                  <td>{{ op.effectue_par || "-" }}</td>
                  <td>{{ op.reference_metier || "-" }}</td>
                  <td>{{ op.id_caisse_jour || "-" }}</td>
                </tr>
                <tr v-if="auditOperations.length === 0">
                  <td colspan="7">Aucune operation.</td>
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
            <h3>Audit Utilisateurs (prevu futur)</h3>
            <p class="helper">Cette route est reservee pour les actions par utilisateur, encaissements, depenses et clotures.</p>
          </article>
        </template>

        <template v-else-if="auditSubRoute === '/audit/annuel'">
          <article class="panel">
            <h3>Audit Annuel (prevu futur)</h3>
            <p class="helper">Cette route est reservee pour la consolidation annuelle.</p>
          </article>
        </template>
      </section>

      <section v-else class="placeholder">
        <article class="panel">
          <h3>{{ menuItems.find((item) => item.id === currentRoute)?.label }}</h3>
          <p>Vue en lecture/preparation. Le dashboard et la page commandes sont relies a la BD via l'API.</p>
        </article>
      </section>
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
            <label>Client</label>
            <select v-model="wizard.existingClientId">
              <option value="">Choisir un client</option>
              <option v-for="client in clients" :key="client.idClient" :value="client.idClient">
                {{ `${client.nom} ${client.prenom}`.trim() }} - {{ client.telephone }}
              </option>
            </select>
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
            <option v-for="option in habitTypeOptions" :key="`cmd-habit-${option.value}`" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <template v-if="wizard.commande.typeHabit">
            <label>Mesures (cm)</label>
            <div class="form-grid">
              <div v-for="field in commandeMesureFields" :key="`cmd-mes-${field.key}`" class="form-row">
                <label>{{ mesureDisplayLabel(field.key) }} <span v-if="field.required">*</span></label>
                <select
                  v-if="mesureInputType(field.key) === 'select'"
                  v-model="wizard.commande.mesuresHabit[field.key]"
                >
                  <option value="">Choisir</option>
                  <option value="courtes">courtes</option>
                  <option value="longues">longues</option>
                </select>
                <input
                  v-else
                  v-model="wizard.commande.mesuresHabit[field.key]"
                  type="number"
                  min="0"
                  step="0.1"
                  :placeholder="mesurePlaceholder(field.key)"
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
          <label>Client</label>
          <select v-model="retoucheWizard.existingClientId">
            <option value="">Choisir un client</option>
            <option v-for="client in clients" :key="client.idClient" :value="client.idClient">
              {{ `${client.nom} ${client.prenom}`.trim() }} - {{ client.telephone }}
            </option>
          </select>
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
          <option v-for="option in habitTypeOptions" :key="`ret-habit-${option.value}`" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <template v-if="retoucheWizard.retouche.typeHabit">
          <label>Mesures (cm) - saisie partielle autorisee</label>
          <div class="form-grid">
            <div v-for="field in retoucheMesureFields" :key="`ret-mes-${field.key}`" class="form-row">
              <label>{{ mesureDisplayLabel(field.key) }}</label>
              <select
                v-if="mesureInputType(field.key) === 'select'"
                v-model="retoucheWizard.retouche.mesuresHabit[field.key]"
              >
                <option value="">Choisir</option>
                <option value="courtes">courtes</option>
                <option value="longues">longues</option>
              </select>
              <input
                v-else
                v-model="retoucheWizard.retouche.mesuresHabit[field.key]"
                type="number"
                min="0"
                step="0.1"
                :placeholder="mesurePlaceholder(field.key)"
              />
            </div>
          </div>
        </template>
        <label>Type de retouche</label>
        <select v-model="retoucheWizard.retouche.typeRetouche">
          <option v-for="option in retoucheTypeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
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
</template>










