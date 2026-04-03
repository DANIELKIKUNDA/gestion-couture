import Dexie from "dexie";

export const OFFLINE_DB_NAME = "atelier-offline-v1";

export const ENTITY_SYNC_STATUSES = Object.freeze({
  PENDING: "pending",
  SYNCED: "synced",
  BLOCKED: "blocked"
});

export const SYNC_QUEUE_STATUSES = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  DONE: "done",
  SYNCED: "done",
  BLOCKED: "blocked"
});

const ENTITY_SYNC_STATUS_VALUES = new Set(Object.values(ENTITY_SYNC_STATUSES));
const SYNC_QUEUE_STATUS_VALUES = new Set(Object.values(SYNC_QUEUE_STATUSES));
const META_SCOPE_SEPARATOR = "::";

export const TABLE_NAMES = Object.freeze({
  COMMANDES: "commandes",
  RETOUCHES: "retouches",
  CLIENTS: "clients",
  UTILISATEURS: "utilisateurs",
  COMMANDE_PHOTOS: "commande_photos",
  SYNC_QUEUE: "sync_queue",
  META: "meta"
});

const ENTITY_TABLES = new Set([
  TABLE_NAMES.COMMANDES,
  TABLE_NAMES.RETOUCHES,
  TABLE_NAMES.CLIENTS,
  TABLE_NAMES.UTILISATEURS,
  TABLE_NAMES.COMMANDE_PHOTOS
]);

export const offlineDb = new Dexie(OFFLINE_DB_NAME);

offlineDb.version(1).stores({
  commandes:
    "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
  retouches:
    "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
  clients:
    "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
  utilisateurs:
    "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
  commande_photos:
    "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
  sync_queue:
    "&queueId, atelierId, status, attemptCount, retryAt, createdAt, startedAt, finishedAt, entityType, actionType, entityLocalId, entityServerId, [atelierId+status], [atelierId+retryAt], [atelierId+entityLocalId], [atelierId+entityServerId]",
  meta: "&scopeKey, atelierId, key, updatedAt, [atelierId+key]"
});

offlineDb
  .version(2)
  .stores({
    commandes:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    retouches:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    clients:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    utilisateurs:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    commande_photos:
      "&localId, atelierId, serverId, idCommandeLocalId, idCommandeServerId, syncStatus, updatedAt, lastSyncedAt, pendingDelete, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus], [atelierId+idCommandeLocalId], [atelierId+idCommandeServerId]",
    sync_queue:
      "&queueId, atelierId, status, attemptCount, retryAt, createdAt, startedAt, finishedAt, entityType, actionType, entityLocalId, entityServerId, [atelierId+status], [atelierId+retryAt], [atelierId+entityLocalId], [atelierId+entityServerId]",
    meta: "&scopeKey, atelierId, key, updatedAt, [atelierId+key]"
  })
  .upgrade(async (tx) => {
    const rows = await tx.table(TABLE_NAMES.COMMANDE_PHOTOS).toArray();
    for (const row of rows) {
      const idCommande = normalizeString(row?.idCommande);
      const idCommandeLocalId =
        normalizeString(row?.idCommandeLocalId) || (idCommande.startsWith("loc_") ? idCommande : "");
      const idCommandeServerId =
        normalizeServerId(row?.idCommandeServerId) || (!idCommande.startsWith("loc_") ? idCommande : "");
      await tx.table(TABLE_NAMES.COMMANDE_PHOTOS).put({
        ...row,
        idCommandeLocalId,
        idCommandeServerId,
        pendingDelete: row?.pendingDelete === true
      });
    }
  });

offlineDb
  .version(3)
  .stores({
    commandes:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    retouches:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    clients:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    utilisateurs:
      "&localId, atelierId, serverId, syncStatus, updatedAt, lastSyncedAt, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus]",
    commande_photos:
      "&localId, atelierId, serverId, idCommandeLocalId, idCommandeServerId, idItem, syncStatus, updatedAt, lastSyncedAt, pendingDelete, [atelierId+localId], [atelierId+serverId], [atelierId+syncStatus], [atelierId+idCommandeLocalId], [atelierId+idCommandeServerId], [atelierId+idItem]",
    sync_queue:
      "&queueId, atelierId, status, attemptCount, retryAt, createdAt, startedAt, finishedAt, entityType, actionType, entityLocalId, entityServerId, [atelierId+status], [atelierId+retryAt], [atelierId+entityLocalId], [atelierId+entityServerId]",
    meta: "&scopeKey, atelierId, key, updatedAt, [atelierId+key]"
  })
  .upgrade(async (tx) => {
    const rows = await tx.table(TABLE_NAMES.COMMANDE_PHOTOS).toArray();
    for (const row of rows) {
      await tx.table(TABLE_NAMES.COMMANDE_PHOTOS).put({
        ...row,
        idItem: normalizeString(row?.idItem)
      });
    }
  });

let openPromise = null;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour les operations offline.");
  }
  return normalized;
}

function ensureEntityTableName(tableName) {
  if (!ENTITY_TABLES.has(tableName)) {
    throw new Error(`Table offline invalide: ${tableName}`);
  }
}

function toIsoTimestamp(value, fallback = nowIso()) {
  if (!value) return fallback;
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return fallback;
  return asDate.toISOString();
}

function toNullableIsoTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  return toIsoTimestamp(value, null);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEntitySyncStatus(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (ENTITY_SYNC_STATUS_VALUES.has(normalized)) return normalized;
  return ENTITY_SYNC_STATUSES.SYNCED;
}

function normalizeQueueStatus(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (SYNC_QUEUE_STATUS_VALUES.has(normalized)) return normalized;
  return SYNC_QUEUE_STATUSES.PENDING;
}

function normalizeServerId(value) {
  return normalizeString(value);
}

async function findExistingEntityRow(table, atelierId, candidate) {
  const candidateLocalId = normalizeString(candidate?.localId);
  if (candidateLocalId) {
    const byLocalId = await table.where("[atelierId+localId]").equals([atelierId, candidateLocalId]).first();
    if (byLocalId) return byLocalId;
  }

  const candidateServerId = normalizeServerId(candidate?.serverId);
  if (candidateServerId) {
    const byServerId = await table.where("[atelierId+serverId]").equals([atelierId, candidateServerId]).first();
    if (byServerId) return byServerId;
  }

  return null;
}

function buildScopedEntityRecord(atelierId, record, existing = null) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  if (!record || typeof record !== "object") {
    throw new Error("Enregistrement offline invalide.");
  }

  const merged = existing ? { ...existing, ...record } : { ...record };
  const localId = normalizeString(existing?.localId || merged.localId);
  if (!localId) {
    throw new Error("localId obligatoire pour un enregistrement offline.");
  }

  const updatedAt = toIsoTimestamp(merged.updatedAt);
  const syncStatus = normalizeEntitySyncStatus(merged.syncStatus);
  const lastSyncedAt =
    syncStatus === ENTITY_SYNC_STATUSES.SYNCED
      ? toNullableIsoTimestamp(merged.lastSyncedAt) || updatedAt
      : toNullableIsoTimestamp(merged.lastSyncedAt);

  return {
    ...merged,
    atelierId: scopedAtelierId,
    localId,
    serverId: normalizeServerId(merged.serverId),
    syncStatus,
    updatedAt,
    lastSyncedAt
  };
}

export async function putScopedEntityRecord(tableName, atelierId, record) {
  ensureEntityTableName(tableName);
  const table = offlineDb.table(tableName);
  const scopedAtelierId = ensureAtelierId(atelierId);
  const existing = await findExistingEntityRow(table, scopedAtelierId, record);
  const normalized = buildScopedEntityRecord(scopedAtelierId, record, existing);
  await table.put(normalized);
  return normalized;
}

function buildScopedMetaRecord(atelierId, key, value, extra = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedKey = normalizeString(key);
  if (!normalizedKey) {
    throw new Error("Cle meta obligatoire.");
  }

  return {
    ...extra,
    atelierId: scopedAtelierId,
    key: normalizedKey,
    scopeKey: `${scopedAtelierId}${META_SCOPE_SEPARATOR}${normalizedKey}`,
    value,
    updatedAt: toIsoTimestamp(extra.updatedAt)
  };
}

export function createScopedEntityStore(tableName) {
  ensureEntityTableName(tableName);
  const table = offlineDb.table(tableName);

  return {
    async bulkUpsertByAtelier(atelierId, rows = []) {
      const scopedAtelierId = ensureAtelierId(atelierId);
      const list = Array.isArray(rows) ? rows : [rows];
      if (list.length === 0) return [];

      const normalizedRows = [];
      await offlineDb.transaction("rw", table, async () => {
        for (const row of list) {
          const existing = await findExistingEntityRow(table, scopedAtelierId, row);
          const normalized = buildScopedEntityRecord(scopedAtelierId, row, existing);
          normalizedRows.push(normalized);
        }
        await table.bulkPut(normalizedRows);
      });

      return normalizedRows;
    },

    async listByAtelier(atelierId) {
      const scopedAtelierId = ensureAtelierId(atelierId);
      return table.where("atelierId").equals(scopedAtelierId).toArray();
    },

    async getByAtelierAndLocalId(atelierId, localId) {
      const scopedAtelierId = ensureAtelierId(atelierId);
      const normalizedLocalId = normalizeString(localId);
      if (!normalizedLocalId) return null;
      return table.where("[atelierId+localId]").equals([scopedAtelierId, normalizedLocalId]).first();
    },

    async getByAtelierAndServerId(atelierId, serverId) {
      const scopedAtelierId = ensureAtelierId(atelierId);
      const normalizedServerId = normalizeServerId(serverId);
      if (!normalizedServerId) return null;
      return table.where("[atelierId+serverId]").equals([scopedAtelierId, normalizedServerId]).first();
    }
  };
}

export const commandesStore = createScopedEntityStore(TABLE_NAMES.COMMANDES);
export const retouchesStore = createScopedEntityStore(TABLE_NAMES.RETOUCHES);
export const clientsStore = createScopedEntityStore(TABLE_NAMES.CLIENTS);
export const utilisateursStore = createScopedEntityStore(TABLE_NAMES.UTILISATEURS);
export const commandePhotosStore = createScopedEntityStore(TABLE_NAMES.COMMANDE_PHOTOS);

export const metaStore = {
  async putByAtelier(atelierId, key, value, extra = {}) {
    const record = buildScopedMetaRecord(atelierId, key, value, extra);
    await offlineDb.table(TABLE_NAMES.META).put(record);
    return record;
  },

  async getByAtelierAndKey(atelierId, key) {
    const scopedAtelierId = ensureAtelierId(atelierId);
    const normalizedKey = normalizeString(key);
    if (!normalizedKey) return null;
    return offlineDb.table(TABLE_NAMES.META).where("[atelierId+key]").equals([scopedAtelierId, normalizedKey]).first();
  },

  async listByAtelier(atelierId) {
    const scopedAtelierId = ensureAtelierId(atelierId);
    return offlineDb.table(TABLE_NAMES.META).where("atelierId").equals(scopedAtelierId).toArray();
  }
};

export function runOfflineTransaction(mode, tableNames, handler) {
  const names = Array.isArray(tableNames) ? tableNames : [tableNames];
  const tables = names.map((name) => offlineDb.table(name));
  return offlineDb.transaction(mode, ...tables, handler);
}

export async function initializeLocalDb() {
  if (!openPromise) {
    openPromise = offlineDb.open().then(() => offlineDb);
  }
  return openPromise;
}
