import { atelierApi } from "./api.js";
import {
  ENTITY_SYNC_STATUSES,
  clientsStore,
  commandesStore,
  retouchesStore
} from "./local-db.js";
import { isOnline } from "./network-service.js";

const PROTECTED_LOCAL_STATUSES = new Set([
  ENTITY_SYNC_STATUSES.PENDING,
  ENTITY_SYNC_STATUSES.BLOCKED
]);

export const OFFLINE_READ_MESSAGES = Object.freeze({
  NO_LOCAL_DATA: "Aucune donnee disponible hors ligne.",
  CLIENT_CONSULTATION: "Aucun detail client disponible hors ligne.",
  RETOUCHE_TYPES: "",
  STOCK: "",
  VENTES: "",
  FACTURES: "",
  CAISSE: "Aucune caisse disponible hors ligne.",
  COMMANDE_DETAIL: "Aucune commande disponible hors ligne.",
  COMMANDE_SUPPLEMENTAL: "Certaines informations sont limitees hors ligne.",
  COMMANDE_MEDIA: "",
  RETOUCHE_DETAIL: "Aucune retouche disponible hors ligne.",
  RETOUCHE_SUPPLEMENTAL: "Certaines informations sont limitees hors ligne."
});

const ENTITY_DESCRIPTORS = Object.freeze({
  clients: {
    store: clientsStore,
    localPrefix: "cli",
    extractServerId(row) {
      return normalizeString(row?.idClient || row?.id_client || row?.id);
    },
    sort(rows = []) {
      return [...rows].sort((left, right) => {
        const leftLabel = `${left?.nom || ""} ${left?.prenom || ""}`.trim();
        const rightLabel = `${right?.nom || ""} ${right?.prenom || ""}`.trim();
        return leftLabel.localeCompare(rightLabel, "fr", { sensitivity: "base" });
      });
    }
  },
  commandes: {
    store: commandesStore,
    localPrefix: "cmd",
    extractServerId(row) {
      return normalizeString(row?.idCommande || row?.id_commande || row?.id);
    },
    sort(rows = []) {
      return [...rows].sort((left, right) =>
        normalizeString(right?.dateCreation || right?.date_creation || right?.updatedAt).localeCompare(
          normalizeString(left?.dateCreation || left?.date_creation || left?.updatedAt)
        )
      );
    }
  },
  retouches: {
    store: retouchesStore,
    localPrefix: "ret",
    extractServerId(row) {
      return normalizeString(row?.idRetouche || row?.id_retouche || row?.id);
    },
    sort(rows = []) {
      return [...rows].sort((left, right) =>
        normalizeString(right?.dateDepot || right?.date_depot || right?.updatedAt).localeCompare(
          normalizeString(left?.dateDepot || left?.date_depot || left?.updatedAt)
        )
      );
    }
  }
});

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour la lecture offline.");
  }
  return normalized;
}

function ensureDescriptor(key) {
  const descriptor = ENTITY_DESCRIPTORS[key];
  if (!descriptor) {
    throw new Error(`Descripteur offline inconnu: ${key}`);
  }
  return descriptor;
}

function createServerBackedLocalId(prefix, serverId) {
  return `cache_${prefix}_${encodeURIComponent(serverId)}`;
}

function isOfflineIdentifier(value) {
  const normalized = normalizeString(value);
  return normalized.startsWith("loc_") || normalized.startsWith("cache_");
}

function isProtectedLocalRow(row) {
  return PROTECTED_LOCAL_STATUSES.has(normalizeString(row?.syncStatus).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

async function getCachedRowsByEntity(atelierId, entityKey) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const descriptor = ensureDescriptor(entityKey);
  const rows = await descriptor.store.listByAtelier(scopedAtelierId);
  return descriptor.sort(rows);
}

async function getCachedRowByIdentifier(atelierId, entityKey, identifier) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const descriptor = ensureDescriptor(entityKey);
  const normalizedIdentifier = normalizeString(identifier);
  if (!normalizedIdentifier) return null;

  const byLocalId = await descriptor.store.getByAtelierAndLocalId(scopedAtelierId, normalizedIdentifier);
  if (byLocalId) return byLocalId;

  return descriptor.store.getByAtelierAndServerId(scopedAtelierId, normalizedIdentifier);
}

async function cacheServerRows(atelierId, entityKey, rows = []) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const descriptor = ensureDescriptor(entityKey);
  const serverRows = Array.isArray(rows) ? rows : [];
  const timestamp = nowIso();
  const preparedRows = [];

  for (const row of serverRows) {
    const serverId = descriptor.extractServerId(row);
    if (!serverId) continue;

    const existing = await descriptor.store.getByAtelierAndServerId(scopedAtelierId, serverId);
    if (existing && isProtectedLocalRow(existing)) {
      continue;
    }

    preparedRows.push({
      ...(existing || {}),
      ...(row || {}),
      localId: normalizeString(existing?.localId) || createServerBackedLocalId(descriptor.localPrefix, serverId),
      serverId,
      syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
      updatedAt: timestamp,
      lastSyncedAt: timestamp
    });
  }

  if (preparedRows.length > 0) {
    await descriptor.store.bulkUpsertByAtelier(scopedAtelierId, preparedRows);
  }

  return getCachedRowsByEntity(scopedAtelierId, entityKey);
}

async function cacheServerRow(atelierId, entityKey, row) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const descriptor = ensureDescriptor(entityKey);
  const serverId = descriptor.extractServerId(row);
  if (!serverId) return null;

  const existing = await descriptor.store.getByAtelierAndServerId(scopedAtelierId, serverId);
  if (!existing || !isProtectedLocalRow(existing)) {
    await descriptor.store.bulkUpsertByAtelier(scopedAtelierId, {
      ...(existing || {}),
      ...(row || {}),
      localId: normalizeString(existing?.localId) || createServerBackedLocalId(descriptor.localPrefix, serverId),
      serverId,
      syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
      updatedAt: nowIso(),
      lastSyncedAt: nowIso()
    });
  }

  return descriptor.store.getByAtelierAndServerId(scopedAtelierId, serverId);
}

async function refreshMainListsFromServer({
  atelierId,
  loadClients = false,
  loadCommandes = false,
  loadRetouches = false
} = {}) {
  const tasks = [];
  if (loadClients) tasks.push({ key: "clients", run: () => atelierApi.listClients() });
  if (loadCommandes) tasks.push({ key: "commandes", run: () => atelierApi.listCommandes() });
  if (loadRetouches) tasks.push({ key: "retouches", run: () => atelierApi.listRetouches() });

  const settled = await Promise.allSettled(tasks.map((task) => task.run()));
  const refreshed = {
    clients: null,
    commandes: null,
    retouches: null,
    errors: {}
  };

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const result = settled[index];
    if (result.status === "fulfilled") {
      refreshed[task.key] = await cacheServerRows(atelierId, task.key, result.value || []);
    } else {
      refreshed.errors[task.key] = result.reason;
    }
  }

  return refreshed;
}

function resolveServerIdentifier(identifier, cachedRow, entityKey) {
  const normalizedIdentifier = normalizeString(identifier);
  if (normalizeString(cachedRow?.serverId)) return normalizeString(cachedRow.serverId);

  const descriptor = ensureDescriptor(entityKey);
  const extracted = descriptor.extractServerId(cachedRow);
  if (extracted && !isOfflineIdentifier(extracted)) return extracted;

  if (isOfflineIdentifier(normalizedIdentifier)) {
    return "";
  }
  return normalizedIdentifier;
}

async function refreshEntityDetailFromServer({ atelierId, entityKey, identifier, loader }) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const cached = await getCachedRowByIdentifier(scopedAtelierId, entityKey, identifier);
  const serverIdentifier = resolveServerIdentifier(identifier, cached, entityKey);

  if (!serverIdentifier) {
    return {
      row: cached,
      skipped: true
    };
  }

  const payload = await loader(serverIdentifier);
  const row = await cacheServerRow(scopedAtelierId, entityKey, payload);
  return {
    row,
    skipped: false
  };
}

export async function loadMainListsLocalFirst({
  atelierId,
  loadClients = false,
  loadCommandes = false,
  loadRetouches = false
} = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const cachedClients = loadClients ? await getCachedRowsByEntity(scopedAtelierId, "clients") : [];
  const cachedCommandes = loadCommandes ? await getCachedRowsByEntity(scopedAtelierId, "commandes") : [];
  const cachedRetouches = loadRetouches ? await getCachedRowsByEntity(scopedAtelierId, "retouches") : [];
  const online = isOnline();

  return {
    online,
    cached: {
      clients: cachedClients,
      commandes: cachedCommandes,
      retouches: cachedRetouches
    },
    hasCachedData: cachedClients.length > 0 || cachedCommandes.length > 0 || cachedRetouches.length > 0,
    refreshPromise: online
      ? refreshMainListsFromServer({
          atelierId: scopedAtelierId,
          loadClients,
          loadCommandes,
          loadRetouches
        })
      : Promise.resolve(null)
  };
}

export async function loadCommandeDetailLocalFirst({ atelierId, idCommande } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const cached = await getCachedRowByIdentifier(scopedAtelierId, "commandes", idCommande);
  const online = isOnline();

  return {
    online,
    cached,
    hasCachedData: Boolean(cached),
    refreshPromise: online
      ? refreshEntityDetailFromServer({
          atelierId: scopedAtelierId,
          entityKey: "commandes",
          identifier: idCommande,
          loader: (serverId) => atelierApi.getCommande(serverId)
        })
      : Promise.resolve(null)
  };
}

export async function loadRetoucheDetailLocalFirst({ atelierId, idRetouche } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const cached = await getCachedRowByIdentifier(scopedAtelierId, "retouches", idRetouche);
  const online = isOnline();

  return {
    online,
    cached,
    hasCachedData: Boolean(cached),
    refreshPromise: online
      ? refreshEntityDetailFromServer({
          atelierId: scopedAtelierId,
          entityKey: "retouches",
          identifier: idRetouche,
          loader: (serverId) => atelierApi.getRetouche(serverId)
        })
      : Promise.resolve(null)
  };
}
