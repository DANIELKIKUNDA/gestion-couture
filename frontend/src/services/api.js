const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const CAISSE_JOUR_ID = import.meta.env.VITE_CAISSE_JOUR_ID || "";
const CAISSE_USER = import.meta.env.VITE_CAISSE_USER || "frontend";
const CAISSE_MODE_PAIEMENT = import.meta.env.VITE_CAISSE_MODE_PAIEMENT || "CASH";

function assignIfPresent(target, key, value) {
  if (value !== null && value !== undefined && value !== "") {
    if (target && typeof target.set === "function") {
      target.set(key, value);
      return;
    }
    target[key] = value;
  }
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

let authLostHandler = null;
let refreshPromise = null;
let sessionMutationCounter = 0;

export function setAuthLostHandler(handler) {
  authLostHandler = typeof handler === "function" ? handler : null;
}

function notifyAuthLost(reason) {
  if (!authLostHandler) return;
  try {
    authLostHandler(reason);
  } catch {
    // ignore handler errors
  }
}

function getStoredAccessToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

function clearStoredTokens({ markMutation = true } = {}) {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  if (markMutation) sessionMutationCounter += 1;
}

function setAccessToken(token, { markMutation = true } = {}) {
  if (!token) {
    clearStoredTokens({ markMutation });
    return;
  }
  localStorage.setItem("access_token", token);
  localStorage.setItem("token", token);
  if (markMutation) sessionMutationCounter += 1;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const refreshSessionVersion = sessionMutationCounter;
  refreshPromise = (async () => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });
    } catch (err) {
      setAccessToken("");
      throw new ApiError(
        "Connexion API impossible. Verifiez que le frontend et le backend sont demarres, puis rechargez la page.",
        0,
        { path: "/auth/refresh", cause: String(err?.message || err || "network_error") }
      );
    }

    const text = await response.text();
    const payload = text ? tryParseJson(text) : null;
    if (!response.ok || !payload?.token) {
      if (sessionMutationCounter === refreshSessionVersion) {
        setAccessToken("", { markMutation: false });
      }
      throw new ApiError(payload?.error || "Session invalide", response.status || 401, payload);
    }

    if (sessionMutationCounter !== refreshSessionVersion) {
      const currentToken = getStoredAccessToken();
      if (currentToken) return currentToken;
      throw new ApiError("Session invalide", 401, { path: "/auth/refresh", reason: "stale_refresh" });
    }

    setAccessToken(payload.token, { markMutation: false });
    return payload.token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function ensureAccessToken({ allowRefresh = true } = {}) {
  const token = getStoredAccessToken();
  if (token) return token;
  if (!allowRefresh) return "";
  try {
    return await refreshAccessToken();
  } catch {
    return "";
  }
}

async function withAuthHeaders(path, options = {}, tokenOverride = "") {
  const token = tokenOverride || (await ensureAccessToken());
  if (!token) {
    const err = new ApiError("Connexion requise. Connecte-toi pour continuer.", 401, { path, reason: "missing_token" });
    notifyAuthLost({ reason: err.message, path, status: 401 });
    throw err;
  }
  return {
    token,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
}

async function fetchBlobWithAuthRetry(path, options = {}) {
  const execute = async (tokenOverride = "") => {
    const { headers } = await withAuthHeaders(path, options, tokenOverride);
    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: "include"
      });
    } catch (err) {
      throw new ApiError(
        "Connexion API impossible. Verifiez que le frontend et le backend sont demarres, puis rechargez la page.",
        0,
        { path, cause: String(err?.message || err || "network_error") }
      );
    }

    if (response.status === 401) {
      throw new ApiError("Connexion requise. Connecte-toi pour continuer.", 401, { path, reason: "unauthorized" });
    }

    if (!response.ok) {
      const text = await response.text();
      const payload = text ? tryParseJson(text) : null;
      const message = payload?.error || text || `Erreur API (${response.status}) sur ${path}`;
      throw new ApiError(message, response.status, payload);
    }

    return response.blob();
  };

  try {
    return await execute();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    try {
      const refreshed = await refreshAccessToken();
      return await execute(refreshed);
    } catch (refreshErr) {
      notifyAuthLost({ reason: "Session expiree. Reconnecte-toi.", path, status: 401 });
      throw refreshErr instanceof ApiError ? refreshErr : err;
    }
  }
}

async function request(path, options = {}) {
  return requestWithRetry(path, options);
}

async function requestWithRetry(path, options = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
  const isAuthPublicEndpoint =
    path === "/auth/login" ||
    path === "/auth/refresh" ||
    path === "/auth/bootstrap-owner/status" ||
    path === "/auth/bootstrap-owner" ||
    path === "/system/bootstrap-manager/status" ||
    path === "/system/bootstrap-manager" ||
    path === "/auth/password/forgot" ||
    path === "/auth/password/reset";
  const execute = async (tokenOverride = "") => {
    const baseHeaders = isAuthPublicEndpoint ? { ...(options.headers || {}) } : (await withAuthHeaders(path, options, tokenOverride)).headers;
    if (hasBody && !baseHeaders["Content-Type"]) {
      baseHeaders["Content-Type"] = "application/json";
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: baseHeaders,
        credentials: "include"
      });
    } catch (err) {
      throw new ApiError(
        "Connexion API impossible. Verifiez que le frontend et le backend sont demarres, puis rechargez la page.",
        0,
        { path, cause: String(err?.message || err || "network_error") }
      );
    }

    const text = await response.text();
    const payload = text ? tryParseJson(text) : null;

    if (!response.ok) {
      const message = payload?.error || `Erreur API (${response.status}) sur ${path}`;
      throw new ApiError(message, response.status, payload);
    }

    return payload;
  };

  try {
    return await execute();
  } catch (err) {
    if (isAuthPublicEndpoint || !(err instanceof ApiError) || err.status !== 401) throw err;
    try {
      const refreshed = await refreshAccessToken();
      return await execute(refreshed);
    } catch (refreshErr) {
      notifyAuthLost({ reason: "Session expiree. Reconnecte-toi.", path, status: 401 });
      throw refreshErr instanceof ApiError ? refreshErr : err;
    }
  }
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
  async login({ email, motDePasse, atelierSlug = "" }) {
    const payload = { email, motDePasse };
    assignIfPresent(payload, "atelierSlug", atelierSlug);
    const response = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (response?.token) {
      setAccessToken(response.token, { markMutation: true });
    }
    return response;
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken("", { markMutation: true });
    }
  },

  me() {
    return request("/auth/me", { method: "GET" });
  },

  normalizeSession(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.user && Array.isArray(payload.permissions)) {
      const roleId = payload.user.roleId || payload.user.roles?.[0] || "";
      return {
        id: payload.user.id || "",
        nom: payload.user.nom || "",
        email: payload.user.email || "",
        atelierId: payload.user.atelierId || "",
        roleId,
        roles: payload.user.roles || (roleId ? [roleId] : []),
        actif: payload.user.actif !== false,
        permissions: payload.permissions || []
      };
    }
    const roleId = payload.roleId || payload.role || "";
    return {
      id: payload.id || "",
      nom: payload.nom || "",
      email: payload.email || "",
      atelierId: payload.atelierId || "",
      roleId,
      roles: roleId ? [roleId] : [],
      actif: payload.actif !== false,
      permissions: payload.permissions || []
    };
  },

  async restoreSession() {
    try {
      await ensureAccessToken();
      if (!getStoredAccessToken()) return null;
      const payload = await request("/auth/me", { method: "GET" });
      return this.normalizeSession(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return null;
      }
      throw err;
    }
  },

  forgotPassword(email) {
    return request("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  resetPassword({ token, nouveauMotDePasse }) {
    return request("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ token, nouveauMotDePasse })
    });
  },

  bootstrapOwner({ nom, email, motDePasse, atelierSlug = "" }) {
    const payload = { nom, email, motDePasse };
    assignIfPresent(payload, "atelierSlug", atelierSlug);
    return request("/auth/bootstrap-owner", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getOwnerBootstrapStatus({ atelierSlug = "" } = {}) {
    const query = new URLSearchParams();
    assignIfPresent(
      {
        set(key, value) {
          query.set(key, value);
        }
      },
      "atelierSlug",
      atelierSlug
    );
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/auth/bootstrap-owner/status${suffix}`, { method: "GET" });
  },

  async hasOwnerBootstrapDone({ atelierSlug = "" } = {}) {
    const payload = await this.getOwnerBootstrapStatus({ atelierSlug });
    return payload?.initialized === true;
  },

  getSystemBootstrapStatus() {
    return request("/system/bootstrap-manager/status", { method: "GET" });
  },

  bootstrapSystemManager({ nom, email, motDePasse }) {
    return request("/system/bootstrap-manager", {
      method: "POST",
      body: JSON.stringify({ nom, email, motDePasse })
    });
  },

  listSystemAteliers({ search = "", status = "", sortBy = "", sortDir = "", page = null, pageSize = null } = {}) {
    const query = new URLSearchParams();
    assignIfPresent(
      {
        set(key, value) {
          query.set(key, value);
        }
      },
      "search",
      String(search || "").trim()
    );
    assignIfPresent(
      {
        set(key, value) {
          query.set(key, value);
        }
      },
      "status",
      String(status || "").trim()
    );
    assignIfPresent(
      {
        set(key, value) {
          query.set(key, value);
        }
      },
      "sortBy",
      String(sortBy || "").trim()
    );
    assignIfPresent(
      {
        set(key, value) {
          query.set(key, value);
        }
      },
      "sortDir",
      String(sortDir || "").trim()
    );
    if (page !== null && page !== undefined && page !== "") {
      query.set("page", String(page));
    }
    if (pageSize !== null && pageSize !== undefined && pageSize !== "") {
      query.set("pageSize", String(pageSize));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/system/ateliers${suffix}`, { method: "GET" });
  },

  createSystemAtelier(input) {
    return request("/system/ateliers", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  getSystemAtelierDetail(idAtelier) {
    return request(`/system/ateliers/${encodeURIComponent(idAtelier)}`, { method: "GET" });
  },

  setSystemAtelierActivation(idAtelier, actif) {
    return request(`/system/ateliers/${encodeURIComponent(idAtelier)}/activation`, {
      method: "PATCH",
      body: JSON.stringify({ actif: actif !== false })
    });
  },

  listRolePermissions() {
    return request("/auth/role-permissions", { method: "GET" });
  },

  updateRolePermissions(role, permissions) {
    return request(`/auth/role-permissions/${encodeURIComponent(role)}`, {
      method: "PUT",
      body: JSON.stringify({ permissions })
    });
  },

  listUsers() {
    return request("/auth/users", { method: "GET" });
  },

  createUser(input) {
    return request("/auth/users", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  updateUser(id, input) {
    return request(`/auth/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  setUserActivation(id, actif) {
    return request(`/auth/users/${encodeURIComponent(id)}/activation`, {
      method: "PATCH",
      body: JSON.stringify({ actif: actif !== false })
    });
  },

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

  async getClientConsultationPdfBlobUrl(idClient, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === "") continue;
      query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const blob = await fetchBlobWithAuthRetry(`/clients/${encodeURIComponent(idClient)}/consultation/pdf${suffix}`, { method: "GET" });
    return URL.createObjectURL(blob);
  },

  listCommandes() {
    return request("/commandes", { method: "GET" });
  },

  getCommande(idCommande) {
    return request(`/commandes/${idCommande}`, { method: "GET" });
  },

  getCommandeActions(idCommande) {
    return request(`/commandes/${idCommande}/actions`, { method: "GET" });
  },

  listCommandeEvents(idCommande) {
    return request(`/commandes/${idCommande}/events`, { method: "GET" });
  },

  listPaiementsCommande(idCommande) {
    return request(`/commandes/${idCommande}/paiements`, { method: "GET" });
  },

  listRetouches() {
    return request("/retouches", { method: "GET" });
  },

  listRetoucheTypes() {
    return request("/retouches/types", { method: "GET" });
  },

  getRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}`, { method: "GET" });
  },

  getRetoucheActions(idRetouche) {
    return request(`/retouches/${idRetouche}/actions`, { method: "GET" });
  },

  listRetoucheEvents(idRetouche) {
    return request(`/retouches/${idRetouche}/events`, { method: "GET" });
  },

  listPaiementsRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}/paiements`, { method: "GET" });
  },

  listStockArticles() {
    return request("/stock/articles", { method: "GET" });
  },

  listFournisseurs() {
    return request("/stock/fournisseurs", { method: "GET" });
  },

  createFournisseur(input) {
    return request("/stock/fournisseurs", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  updateFournisseur(idFournisseur, input) {
    return request(`/stock/fournisseurs/${idFournisseur}`, {
      method: "PUT",
      body: JSON.stringify(input)
    });
  },

  createArticle(input) {
    return request("/stock/articles", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  updateStockArticle(idArticle, input) {
    return request(`/stock/articles/${idArticle}`, {
      method: "PUT",
      body: JSON.stringify(input)
    });
  },

  listHistoriquePrixArticle(idArticle) {
    return request(`/stock/articles/${idArticle}/prix-historique`, { method: "GET" });
  },

  entrerStockArticle(
    idArticle,
    {
      quantite,
      motif,
      utilisateur = null,
      idCaisseJour = null,
      referenceMetier = null,
      fournisseurId = null,
      fournisseur = null,
      referenceAchat = null,
      prixAchatUnitaire = null
    } = {}
  ) {
    const payload = { quantite, motif };
    assignIfPresent(payload, "utilisateur", utilisateur);
    assignIfPresent(payload, "idCaisseJour", idCaisseJour);
    assignIfPresent(payload, "referenceMetier", referenceMetier);
    assignIfPresent(payload, "fournisseur", fournisseur);
    assignIfPresent(payload, "fournisseurId", fournisseurId);
    assignIfPresent(payload, "referenceAchat", referenceAchat);
    assignIfPresent(payload, "prixAchatUnitaire", prixAchatUnitaire);
    return request(`/stock/articles/${idArticle}/entrees`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  sortirStockArticle(idArticle, { quantite, motif, utilisateur = null, referenceMetier = null } = {}) {
    const payload = { quantite, motif };
    assignIfPresent(payload, "utilisateur", utilisateur);
    assignIfPresent(payload, "referenceMetier", referenceMetier);
    return request(`/stock/articles/${idArticle}/sorties`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  ajusterStockArticle(idArticle, { quantite, motif, utilisateur = null, referenceMetier = null } = {}) {
    const payload = { quantite, motif };
    assignIfPresent(payload, "utilisateur", utilisateur);
    assignIfPresent(payload, "referenceMetier", referenceMetier);
    return request(`/stock/articles/${idArticle}/ajuster`, {
      method: "POST",
      body: JSON.stringify(payload)
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

  async validerVente({ idVente, utilisateur = null, idCaisseJour = "", modePaiement = CAISSE_MODE_PAIEMENT }) {
    const caisseJourId = await resolveCaisseJourId(idCaisseJour);
    const payload = { idCaisseJour: caisseJourId, modePaiement };
    assignIfPresent(payload, "utilisateur", utilisateur);
    return request(`/ventes/${idVente}/valider`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async validerVenteEtFacturer({ idVente, utilisateur = null, idCaisseJour = "", modePaiement = CAISSE_MODE_PAIEMENT }) {
    const caisseJourId = await resolveCaisseJourId(idCaisseJour);
    const payload = { idCaisseJour: caisseJourId, modePaiement };
    assignIfPresent(payload, "utilisateur", utilisateur);
    return request(`/ventes/${idVente}/valider-et-facturer`, {
      method: "POST",
      body: JSON.stringify(payload)
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

  enregistrerDepenseCaisse({ idCaisseJour, montant, motif, typeDepense, justification = "", utilisateur = null, role = "" }) {
    const payload = { montant, motif, typeDepense, justification, role };
    assignIfPresent(payload, "utilisateur", utilisateur);
    return request(`/caisse/${idCaisseJour}/sorties`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  cloturerCaisse(idCaisseJour, utilisateur = null) {
    const payload = {};
    assignIfPresent(payload, "utilisateur", utilisateur);
    return request(`/caisse/${idCaisseJour}/cloturer`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  ouvrirCaisseDuJour({ soldeOuverture, utilisateur = null, overrideHeureOuverture = false, role = "", motifOverride = "" }) {
    const payload = { soldeOuverture, overrideHeureOuverture, role, motifOverride };
    assignIfPresent(payload, "utilisateur", utilisateur);
    return request("/caisse/ouvrir", {
      method: "POST",
      body: JSON.stringify(payload)
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

  getStockMouvement(idMouvement) {
    return request(`/stock/mouvements/${idMouvement}`, { method: "GET" });
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

  async getFacturePdfBlobUrl(idFacture, { autoPrint = false } = {}) {
    const suffix = autoPrint ? "?autoprint=1" : "";
    const blob = await fetchBlobWithAuthRetry(`/factures/${encodeURIComponent(idFacture)}/pdf${suffix}`, { method: "GET" });
    return URL.createObjectURL(blob);
  },

  listAuditFactures() {
    return request("/audit/factures", { method: "GET" });
  },

  listAuditUtilisateurs({ q = "", action = "ALL", statut = "ALL", limit = 200 } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    if (statut) params.set("statut", statut);
    params.set("limit", String(limit));
    return request(`/audit/utilisateurs?${params.toString()}`, { method: "GET" });
  },

  getParametresAtelier() {
    return request("/parametres-atelier", { method: "GET" });
  },

  saveParametresAtelier(payload, updatedBy = "", expectedVersion = null) {
    const resolvedExpectedVersion =
      expectedVersion ?? (payload?.meta?.version !== undefined && payload?.meta?.version !== null ? Number(payload.meta.version) : null);
    return request("/parametres-atelier", {
      method: "PUT",
      body: JSON.stringify({ payload, updatedBy, expectedVersion: resolvedExpectedVersion })
    });
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

  createRetoucheWizard(input) {
    return request("/retouches/wizard", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  livrerCommande(idCommande) {
    return request(`/commandes/${idCommande}/livrer`, { method: "POST" });
  },

  terminerCommande(idCommande) {
    return request(`/commandes/${idCommande}/terminer`, { method: "POST" });
  },

  annulerCommande(idCommande, { utilisateur = CAISSE_USER, idCaisseJour = "", modePaiement = CAISSE_MODE_PAIEMENT } = {}) {
    const payload = {
      utilisateur,
      modePaiement
    };
    if (idCaisseJour) payload.idCaisseJour = idCaisseJour;
    return request(`/commandes/${idCommande}/annuler`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  livrerRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}/livrer`, { method: "POST" });
  },

  terminerRetouche(idRetouche) {
    return request(`/retouches/${idRetouche}/terminer`, { method: "POST" });
  },

  annulerRetouche(idRetouche, { utilisateur = CAISSE_USER, idCaisseJour = "", modePaiement = CAISSE_MODE_PAIEMENT } = {}) {
    const payload = {
      utilisateur,
      modePaiement
    };
    if (idCaisseJour) payload.idCaisseJour = idCaisseJour;
    return request(`/retouches/${idRetouche}/annuler`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
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
    return request(`/commandes/${idCommande}/paiements/caisse`, {
      method: "POST",
      body: JSON.stringify({
        montant,
        idCaisseJour: caisseJourId,
        modePaiement: CAISSE_MODE_PAIEMENT,
        utilisateur
      })
    });
  },

  async enregistrerPaiementRetoucheViaCaisse({ idRetouche, montant, utilisateur = CAISSE_USER, idCaisseJour = "" }) {
    const caisseJourId = await resolveCaisseJourId(idCaisseJour);
    return request(`/retouches/${idRetouche}/paiements/caisse`, {
      method: "POST",
      body: JSON.stringify({
        montant,
        idCaisseJour: caisseJourId,
        modePaiement: CAISSE_MODE_PAIEMENT,
        utilisateur
      })
    });
  }
};
