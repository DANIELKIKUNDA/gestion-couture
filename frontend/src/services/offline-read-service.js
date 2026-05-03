import { atelierApi } from "./api.js";
import {
  ENTITY_SYNC_STATUSES,
  clientsStore,
  commandesStore,
  metaStore,
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
  RETOUCHE_TYPES: "Types de retouche indisponibles hors ligne.",
  STOCK: "Stock affiche depuis la derniere synchronisation.",
  VENTES: "Ventes affichees depuis la derniere synchronisation.",
  FACTURES: "Factures affichees depuis la derniere synchronisation.",
  CAISSE: "Aucune caisse disponible hors ligne.",
  DOSSIERS: "Dossiers affiches depuis la derniere synchronisation.",
  COMMANDE_DETAIL: "Aucune commande disponible hors ligne.",
  COMMANDE_SUPPLEMENTAL: "Certaines informations sont limitees hors ligne.",
  COMMANDE_MEDIA: "",
  RETOUCHE_DETAIL: "Aucune retouche disponible hors ligne.",
  RETOUCHE_SUPPLEMENTAL: "Certaines informations sont limitees hors ligne."
});

export const READONLY_CACHE_KEYS = Object.freeze({
  DOSSIERS: "dossiers",
  RETOUCHE_TYPES: "retoucheTypes",
  STOCK_ARTICLES: "stockArticles",
  VENTES: "ventes",
  FACTURES: "factures",
  CAISSE_JOURS: "caisseJours"
});

const READONLY_DETAIL_KEYS = Object.freeze({
  DOSSIERS: "dossiers",
  FACTURES: "factures",
  CAISSE_JOURS: "caisseJours",
  VENTES: "ventes"
});

const READONLY_LIST_LOADERS = Object.freeze({
  [READONLY_CACHE_KEYS.DOSSIERS]: () => atelierApi.listDossiers(),
  [READONLY_CACHE_KEYS.RETOUCHE_TYPES]: () => atelierApi.listRetoucheTypes(),
  [READONLY_CACHE_KEYS.STOCK_ARTICLES]: () => atelierApi.listStockArticles(),
  [READONLY_CACHE_KEYS.VENTES]: () => atelierApi.listVentes(),
  [READONLY_CACHE_KEYS.FACTURES]: () => atelierApi.listFactures(),
  [READONLY_CACHE_KEYS.CAISSE_JOURS]: () => atelierApi.listCaisseJours()
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

function readonlyListMetaKey(cacheKey) {
  return `readonly:list:${normalizeString(cacheKey)}`;
}

function readonlyDetailMetaKey(cacheKey, identifier) {
  return `readonly:detail:${normalizeString(cacheKey)}:${encodeURIComponent(normalizeString(identifier))}`;
}

function ensureReadonlyListKey(cacheKey) {
  const normalized = normalizeString(cacheKey);
  if (!READONLY_LIST_LOADERS[normalized]) {
    throw new Error(`Cache lecture inconnu: ${cacheKey}`);
  }
  return normalized;
}

function ensureReadonlyDetailKey(cacheKey) {
  const normalized = normalizeString(cacheKey);
  if (!Object.values(READONLY_DETAIL_KEYS).includes(normalized)) {
    throw new Error(`Cache detail lecture inconnu: ${cacheKey}`);
  }
  return normalized;
}

async function getReadonlyListCache(atelierId, cacheKey) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = ensureReadonlyListKey(cacheKey);
  const record = await metaStore.getByAtelierAndKey(scopedAtelierId, readonlyListMetaKey(normalizedKey));
  return Array.isArray(record?.value) ? record.value : [];
}

async function getReadonlyDetailCache(atelierId, cacheKey, identifier) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = ensureReadonlyDetailKey(cacheKey);
  const normalizedIdentifier = normalizeString(identifier);
  if (!normalizedIdentifier) return null;
  const record = await metaStore.getByAtelierAndKey(
    scopedAtelierId,
    readonlyDetailMetaKey(normalizedKey, normalizedIdentifier)
  );
  return record?.value && typeof record.value === "object" ? record.value : null;
}

export async function cacheReadonlyList(atelierId, cacheKey, rows = []) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = ensureReadonlyListKey(cacheKey);
  const value = Array.isArray(rows) ? rows : [];
  await metaStore.putByAtelier(scopedAtelierId, readonlyListMetaKey(normalizedKey), value, {
    updatedAt: nowIso()
  });
  return value;
}

export async function cacheReadonlyDetail(atelierId, cacheKey, identifier, row) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = ensureReadonlyDetailKey(cacheKey);
  const normalizedIdentifier = normalizeString(identifier);
  if (!normalizedIdentifier || !row || typeof row !== "object") return null;
  await metaStore.putByAtelier(scopedAtelierId, readonlyDetailMetaKey(normalizedKey, normalizedIdentifier), row, {
    updatedAt: nowIso()
  });
  return row;
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

async function refreshReadonlyListsFromServer({ atelierId, keys = [] } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKeys = Array.from(new Set((keys || []).map(ensureReadonlyListKey)));
  const settled = await Promise.allSettled(normalizedKeys.map((key) => READONLY_LIST_LOADERS[key]()));
  const refreshed = { values: {}, errors: {} };

  for (let index = 0; index < normalizedKeys.length; index += 1) {
    const key = normalizedKeys[index];
    const result = settled[index];
    if (result.status === "fulfilled") {
      refreshed.values[key] = await cacheReadonlyList(scopedAtelierId, key, result.value || []);
    } else {
      refreshed.errors[key] = result.reason;
    }
  }

  return refreshed;
}

async function refreshReadonlyDetailFromServer({ atelierId, cacheKey, identifier, loader } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = ensureReadonlyDetailKey(cacheKey);
  const normalizedIdentifier = normalizeString(identifier);
  if (!normalizedIdentifier) return { row: null, skipped: true };
  const payload = await loader(normalizedIdentifier);
  await cacheReadonlyDetail(scopedAtelierId, normalizedKey, normalizedIdentifier, payload);
  return { row: payload, skipped: false };
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

export async function loadReadonlyListsLocalFirst({ atelierId, keys = [] } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKeys = Array.from(new Set((keys || []).map(ensureReadonlyListKey)));
  const cachedEntries = await Promise.all(
    normalizedKeys.map(async (key) => [key, await getReadonlyListCache(scopedAtelierId, key)])
  );
  const cached = Object.fromEntries(cachedEntries);
  const hasCachedData = Object.values(cached).some((rows) => Array.isArray(rows) && rows.length > 0);
  const online = isOnline();

  return {
    online,
    cached,
    hasCachedData,
    refreshPromise: online
      ? refreshReadonlyListsFromServer({
          atelierId: scopedAtelierId,
          keys: normalizedKeys
        })
      : Promise.resolve(null)
  };
}

export async function loadReadonlyDetailLocalFirst({ atelierId, cacheKey, identifier, loader } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = ensureReadonlyDetailKey(cacheKey);
  const normalizedIdentifier = normalizeString(identifier);
  const cached = await getReadonlyDetailCache(scopedAtelierId, normalizedKey, normalizedIdentifier);
  const online = isOnline();

  return {
    online,
    cached,
    hasCachedData: Boolean(cached),
    refreshPromise:
      online && typeof loader === "function"
        ? refreshReadonlyDetailFromServer({
            atelierId: scopedAtelierId,
            cacheKey: normalizedKey,
            identifier: normalizedIdentifier,
            loader
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
