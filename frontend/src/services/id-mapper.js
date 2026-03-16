import {
  ENTITY_SYNC_STATUSES,
  TABLE_NAMES,
  commandePhotosStore,
  clientsStore,
  commandesStore,
  putScopedEntityRecord,
  retouchesStore
} from "./local-db.js";

const ENTITY_DESCRIPTORS = Object.freeze({
  client: {
    tableName: TABLE_NAMES.CLIENTS,
    store: clientsStore,
    extractServerId(payload) {
      return normalizeString(payload?.idClient || payload?.id_client || payload?.id);
    },
    buildRecord(localRecord, serverPayload, context) {
      const serverId = context.serverId;
      return {
        ...localRecord,
        ...(serverPayload || {}),
        localId: localRecord.localId,
        serverId,
        idClient: serverId,
        syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
        updatedAt: context.timestamp,
        lastSyncedAt: context.timestamp
      };
    }
  },
  commande: {
    tableName: TABLE_NAMES.COMMANDES,
    store: commandesStore,
    extractServerId(payload) {
      return normalizeString(payload?.idCommande || payload?.id_commande || payload?.id);
    },
    buildRecord(localRecord, serverPayload, context) {
      const serverId = context.serverId;
      const clientServerId =
        normalizeString(context.references?.clientServerId) ||
        normalizeString(serverPayload?.idClient || serverPayload?.id_client || serverPayload?.clientId || serverPayload?.client_id) ||
        normalizeString(localRecord?.clientServerId) ||
        normalizeString(localRecord?.idClient);

      return {
        ...localRecord,
        ...(serverPayload || {}),
        localId: localRecord.localId,
        serverId,
        idCommande: serverId,
        idClient: clientServerId,
        clientServerId,
        syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
        updatedAt: context.timestamp,
        lastSyncedAt: context.timestamp
      };
    }
  },
  retouche: {
    tableName: TABLE_NAMES.RETOUCHES,
    store: retouchesStore,
    extractServerId(payload) {
      return normalizeString(payload?.idRetouche || payload?.id_retouche || payload?.id);
    },
    buildRecord(localRecord, serverPayload, context) {
      const serverId = context.serverId;
      const clientServerId =
        normalizeString(context.references?.clientServerId) ||
        normalizeString(serverPayload?.idClient || serverPayload?.id_client || serverPayload?.clientId || serverPayload?.client_id) ||
        normalizeString(localRecord?.clientServerId) ||
        normalizeString(localRecord?.idClient);

      return {
        ...localRecord,
        ...(serverPayload || {}),
        localId: localRecord.localId,
        serverId,
        idRetouche: serverId,
        idClient: clientServerId,
        clientServerId,
        syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
        updatedAt: context.timestamp,
        lastSyncedAt: context.timestamp
      };
    }
  },
  commande_photo: {
    tableName: TABLE_NAMES.COMMANDE_PHOTOS,
    store: commandePhotosStore,
    extractServerId(payload) {
      return normalizeString(payload?.idMedia || payload?.id_media || payload?.id);
    },
    buildRecord(localRecord, serverPayload, context) {
      const serverId = context.serverId;
      const commandeServerId =
        normalizeString(context.references?.commandeServerId) ||
        normalizeString(serverPayload?.idCommande || serverPayload?.id_commande || localRecord?.idCommandeServerId || localRecord?.idCommande);
      const commandeLocalId =
        normalizeString(context.references?.commandeLocalId) || normalizeString(localRecord?.idCommandeLocalId);

      return {
        ...localRecord,
        ...(serverPayload || {}),
        localId: localRecord.localId,
        serverId,
        idMedia: serverId,
        idCommande: commandeServerId || commandeLocalId,
        idCommandeLocalId: commandeLocalId,
        idCommandeServerId: commandeServerId,
        syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
        pendingDelete: false,
        updatedAt: context.timestamp,
        lastSyncedAt: context.timestamp
      };
    }
  }
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour les mappings offline.");
  }
  return normalized;
}

function ensureEntityType(entityType) {
  const normalized = normalizeString(entityType).toLowerCase();
  const descriptor = ENTITY_DESCRIPTORS[normalized];
  if (!descriptor) {
    throw new Error(`Type d'entite offline inconnu: ${entityType}`);
  }
  return {
    entityType: normalized,
    descriptor
  };
}

export async function getEntityByLocalId(atelierId, entityType, localId) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedLocalId = normalizeString(localId);
  if (!normalizedLocalId) return null;
  const { descriptor } = ensureEntityType(entityType);
  return descriptor.store.getByAtelierAndLocalId(scopedAtelierId, normalizedLocalId);
}

export async function getServerIdByLocalId(atelierId, entityType, localId) {
  const row = await getEntityByLocalId(atelierId, entityType, localId);
  return normalizeString(row?.serverId);
}

export function extractServerId(entityType, payload) {
  const { descriptor } = ensureEntityType(entityType);
  return descriptor.extractServerId(payload);
}

export function getEntityTableName(entityType) {
  const { descriptor } = ensureEntityType(entityType);
  return descriptor.tableName;
}

export async function buildSyncedEntityRecord({
  atelierId,
  entityType,
  localRecord,
  serverPayload,
  references = {},
  timestamp = nowIso()
} = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const { descriptor } = ensureEntityType(entityType);
  const record = localRecord || (await getEntityByLocalId(scopedAtelierId, entityType, serverPayload?.localId));
  if (!record?.localId) {
    throw new Error(`Entite locale introuvable pour ${entityType}.`);
  }

  const serverId = extractServerId(entityType, serverPayload);
  if (!serverId) {
    throw new Error(`serverId manquant dans la reponse serveur pour ${entityType}.`);
  }

  return descriptor.buildRecord(record, serverPayload, {
    atelierId: scopedAtelierId,
    timestamp,
    serverId,
    references
  });
}

export async function persistSyncedEntityRecord({
  atelierId,
  entityType,
  localRecord,
  serverPayload,
  references = {},
  timestamp = nowIso()
} = {}) {
  const nextRecord = await buildSyncedEntityRecord({
    atelierId,
    entityType,
    localRecord,
    serverPayload,
    references,
    timestamp
  });

  const tableName = getEntityTableName(entityType);
  const saved = await putScopedEntityRecord(tableName, atelierId, nextRecord);
  return {
    entity: saved,
    serverId: normalizeString(saved.serverId)
  };
}
