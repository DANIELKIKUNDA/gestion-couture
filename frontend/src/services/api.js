const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const CAISSE_JOUR_ID = import.meta.env.VITE_CAISSE_JOUR_ID || "";
const CAISSE_USER = import.meta.env.VITE_CAISSE_USER || "frontend";
const CAISSE_MODE_PAIEMENT = import.meta.env.VITE_CAISSE_MODE_PAIEMENT || "CASH";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function authHeaders() {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
  const headers = {
    ...authHeaders(),
    ...(options.headers || {})
  };

  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    const message = payload?.error || `Erreur API (${response.status}) sur ${path}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function resolveCaisseJourId(preferredId = "") {
  if (preferredId) return preferredId;
  if (CAISSE_JOUR_ID) return CAISSE_JOUR_ID;

  const jours = await request("/caisse", { method: "GET" });
  const latest = jours?.[0]?.idCaisseJour || jours?.[0]?.id_caisse_jour;
  if (!latest) {
    throw new ApiError("Aucune caisse disponible pour enregistrer un paiement.", 400, null);
  }
  return latest;
}

export const atelierApi = {
  listClients() {
    return request("/clients", { method: "GET" });
  },

  getClientConsultation(idClient, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === "") continue;
      query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/clients/${idClient}/consultation${suffix}`, { method: "GET" });
  },

  getClientConsultationPdfUrl(idClient, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === "") continue;
      query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return `${API_BASE_URL}/clients/${encodeURIComponent(idClient)}/consultation/pdf${suffix}`;
  },

  listCommandes() {
    return request("/commandes", { method: "GET" });
  },

  getCommande(idCommande) {
    return request(`/commandes/${idCommande}`, { method: "GET" });
  },

  listPaiementsCommande(idCommande) {
    return request(`/commandes/${idCommande}/paiements`, { method: "GET" });
  },

  listRetouches() {
    return request("/retouches", { method: "GET" });
  },

  getRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}`, { method: "GET" });
  },

  listPaiementsRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}/paiements`, { method: "GET" });
  },

  listStockArticles() {
    return request("/stock/articles", { method: "GET" });
  },

  createArticle(input) {
    return request("/stock/articles", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  entrerStockArticle(idArticle, { quantite, motif, utilisateur = CAISSE_USER, referenceMetier = null } = {}) {
    return request(`/stock/articles/${idArticle}/entrees`, {
      method: "POST",
      body: JSON.stringify({ quantite, motif, utilisateur, referenceMetier })
    });
  },

  listVentes() {
    return request("/ventes", { method: "GET" });
  },

  getVente(idVente) {
    return request(`/ventes/${idVente}`, { method: "GET" });
  },

  createVente(lignesVente) {
    return request("/ventes", {
      method: "POST",
      body: JSON.stringify({ lignesVente })
    });
  },

  updateVenteLignes(idVente, lignesVente) {
    return request(`/ventes/${idVente}/lignes`, {
      method: "POST",
      body: JSON.stringify({ lignesVente })
    });
  },

  async validerVente({ idVente, utilisateur = CAISSE_USER, idCaisseJour = "", modePaiement = CAISSE_MODE_PAIEMENT }) {
    const caisseJourId = await resolveCaisseJourId(idCaisseJour);
    return request(`/ventes/${idVente}/valider`, {
      method: "POST",
      body: JSON.stringify({ idCaisseJour: caisseJourId, utilisateur, modePaiement })
    });
  },

  annulerVente(idVente, motif = "") {
    return request(`/ventes/${idVente}/annuler`, {
      method: "POST",
      body: JSON.stringify({ motif })
    });
  },

  listCaisseJours() {
    return request("/caisse", { method: "GET" });
  },

  getCaisseJour(idCaisseJour) {
    return request(`/caisse/${idCaisseJour}`, { method: "GET" });
  },

  enregistrerDepenseCaisse({ idCaisseJour, montant, motif, utilisateur = CAISSE_USER }) {
    return request(`/caisse/${idCaisseJour}/sorties`, {
      method: "POST",
      body: JSON.stringify({ montant, motif, utilisateur })
    });
  },

  cloturerCaisse(idCaisseJour, utilisateur = CAISSE_USER) {
    return request(`/caisse/${idCaisseJour}/cloturer`, {
      method: "POST",
      body: JSON.stringify({ utilisateur })
    });
  },

  ouvrirCaisseDuJour({ soldeOuverture, utilisateur = CAISSE_USER, overrideHeureOuverture = false, role = "", motifOverride = "" }) {
    return request("/caisse/ouvrir", {
      method: "POST",
      body: JSON.stringify({ soldeOuverture, utilisateur, overrideHeureOuverture, role, motifOverride })
    });
  },

  getDernierBilanCaisse(typeBilan) {
    return request(`/caisse/bilans/dernier?type=${encodeURIComponent(typeBilan)}`, { method: "GET" });
  },

  getBilanCaisse(typeBilan, dateDebut, dateFin) {
    return request(
      `/caisse/bilans?type=${encodeURIComponent(typeBilan)}&dateDebut=${encodeURIComponent(dateDebut)}&dateFin=${encodeURIComponent(dateFin)}`,
      { method: "GET" }
    );
  },

  listBilansCaisse(typeBilan, limit = 50) {
    return request(`/caisse/bilans?type=${encodeURIComponent(typeBilan)}&mode=all&limit=${limit}`, { method: "GET" });
  },

  listCaisseAuditJournalier() {
    return request("/caisse/audit/journalier", { method: "GET" });
  },

  listCaisseAuditOperations() {
    return request("/caisse/audit/operations", { method: "GET" });
  },

  listAuditCommandes() {
    return request("/audit/commandes", { method: "GET" });
  },

  listAuditRetouches() {
    return request("/audit/retouches", { method: "GET" });
  },

  listAuditStockVentes() {
    return request("/audit/stock-ventes", { method: "GET" });
  },

  listFactures() {
    return request("/factures", { method: "GET" });
  },

  getFacture(idFacture) {
    return request(`/factures/${idFacture}`, { method: "GET" });
  },

  emettreFacture({ typeOrigine, idOrigine }) {
    return request("/factures/emettre", {
      method: "POST",
      body: JSON.stringify({ typeOrigine, idOrigine })
    });
  },

  getFacturePdfUrl(idFacture) {
    return `${API_BASE_URL}/factures/${encodeURIComponent(idFacture)}/pdf`;
  },

  listAuditFactures() {
    return request("/audit/factures", { method: "GET" });
  },

  getOuvertureCaisseInfo({ overrideHeureOuverture = false, role = "", motifOverride = "", soldeInitial = 0 } = {}) {
    const params = new URLSearchParams({
      overrideHeureOuverture: String(overrideHeureOuverture),
      role,
      motifOverride,
      soldeInitial: String(soldeInitial)
    });
    return request(`/caisse/ouverture-info?${params.toString()}`, { method: "GET" });
  },

  createClient(input) {
    return request("/clients", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  createCommande(input) {
    return request("/commandes", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  createRetouche(input) {
    return request("/retouches", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  livrerCommande(idCommande) {
    return request(`/commandes/${idCommande}/livrer`, { method: "POST" });
  },

  annulerCommande(idCommande) {
    return request(`/commandes/${idCommande}/annuler`, { method: "POST" });
  },

  livrerRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}/livrer`, { method: "POST" });
  },

  annulerRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}/annuler`, { method: "POST" });
  },

  appliquerPaiementCommande(idCommande, montant) {
    return request(`/commandes/${idCommande}/paiements`, {
      method: "POST",
      body: JSON.stringify({ montant })
    });
  },

  appliquerPaiementRetouche(idRetouche, montant) {
    return request(`/retouches/${idRetouche}/paiements`, {
      method: "POST",
      body: JSON.stringify({ montant })
    });
  },

  async enregistrerPaiementViaCaisse({ idCommande, montant, utilisateur = CAISSE_USER, idCaisseJour = "" }) {
    const caisseJourId = await resolveCaisseJourId(idCaisseJour);

    await request(`/caisse/${caisseJourId}/entrees`, {
      method: "POST",
      body: JSON.stringify({
        montant,
        modePaiement: CAISSE_MODE_PAIEMENT,
        motif: "PAIEMENT_COMMANDE",
        referenceMetier: idCommande,
        utilisateur
      })
    });

    return this.appliquerPaiementCommande(idCommande, montant);
  },

  async enregistrerPaiementRetoucheViaCaisse({ idRetouche, montant, utilisateur = CAISSE_USER, idCaisseJour = "" }) {
    const caisseJourId = await resolveCaisseJourId(idCaisseJour);

    await request(`/caisse/${caisseJourId}/entrees`, {
      method: "POST",
      body: JSON.stringify({
        montant,
        modePaiement: CAISSE_MODE_PAIEMENT,
        motif: "PAIEMENT_RETOUCHE",
        referenceMetier: idRetouche,
        utilisateur
      })
    });

    return this.appliquerPaiementRetouche(idRetouche, montant);
  }
};

