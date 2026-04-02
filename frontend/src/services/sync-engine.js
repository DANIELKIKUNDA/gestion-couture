import { ApiError, atelierApi } from "./api.js";
import { getEntityByLocalId, getEntityTableName, getServerIdByLocalId, persistSyncedEntityRecord } from "./id-mapper.js";
import { SYNC_QUEUE_STATUSES, TABLE_NAMES, offlineDb, runOfflineTransaction } from "./local-db.js";
import { OFFLINE_MEDIA_ACTIONS } from "./media-local-store.js";
import { isOfflineEntityId } from "./local-id.js";
import { getQueueEntry, listPending } from "./sync-queue.js";
import { getTabId, isOnline, subscribeToNetworkState } from "./network-service.js";
import { OFFLINE_WRITE_ACTIONS } from "./offline-write-service.js";
import { setPendingActions, setSyncInProgress } from "./sync-status-service.js";

const SYNC_CHANNEL_NAME = "atelier.offline.sync.v1";
const SYNC_LOCK_KEY = "syncWorkerLock";
const LOCK_LEASE_MS = 30000;
const HEARTBEAT_MS = 10000;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

const listeners = new Set();
const supportedActionTypes = new Set([
  OFFLINE_WRITE_ACTIONS.CREATE_CLIENT,
  OFFLINE_WRITE_ACTIONS.CREATE_COMMANDE,
  OFFLINE_WRITE_ACTIONS.CREATE_RETOUCHE,
  OFFLINE_MEDIA_ACTIONS.ADD_COMMANDE_PHOTO,
  OFFLINE_MEDIA_ACTIONS.UPDATE_COMMANDE_PHOTO_META,
  OFFLINE_MEDIA_ACTIONS.DELETE_COMMANDE_PHOTO
]);

let started = false;
let currentAtelierId = "";
let runningPromise = null;
let rerunRequested = false;
let channel = null;
let unsubscribeNetworkState = null;
let heartbeatTimer = null;
let heldLock = null;

class SyncDependencyBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyncDependencyBlockedError";
  }
}

class SyncPermanentError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyncPermanentError";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour le moteur de synchronisation.");
  }
  return normalized;
}

function metaTable() {
  return offlineDb.table(TABLE_NAMES.META);
}

function queueTable() {
  return offlineDb.table(TABLE_NAMES.SYNC_QUEUE);
}

function buildMetaScopeKey(atelierId, key) {
  return `${atelierId}::${key}`;
}

function normalizeQueueStatus(status) {
  const normalized = normalizeString(status).toLowerCase();
  if (normalized === "synced") return SYNC_QUEUE_STATUSES.DONE;
  return normalized;
}

function isQueueDone(status) {
  return normalizeQueueStatus(status) === SYNC_QUEUE_STATUSES.DONE;
}

function emitSyncEvent(event) {
  const payload = {
    ...event,
    tabId: getTabId(),
    emittedAt: nowIso()
  };

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // Ignore subscriber errors so the worker keeps running.
    }
  }
}

function postChannelMessage(message) {
  if (!channel) return;
  try {
    channel.postMessage({
      ...message,
      sourceTabId: getTabId(),
      emittedAt: nowIso()
    });
  } catch {
    // BroadcastChannel is best-effort only.
  }
}

function isRetryableError(error) {
  if (error instanceof SyncDependencyBlockedError || error instanceof SyncPermanentError) return false;
  if (error instanceof ApiError) {
    const status = Number(error.status || 0);
    return status === 0 || status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
  }
  return true;
}

function serializeSyncError(error, fallbackMessage = "Erreur de synchronisation") {
  const message = normalizeString(error?.message || fallbackMessage) || fallbackMessage;
  const payload = {
    name: normalizeString(error?.name || "SyncError"),
    message,
    updatedAt: nowIso()
  };

  if (error instanceof ApiError) {
    payload.status = Number(error.status || 0);
    payload.payload = error.payload ?? null;
  }

  return payload;
}

function computeRetryAt(attemptCount) {
  const normalizedAttempts = Math.max(0, Number(attemptCount || 0));
  const delay = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * Math.pow(2, normalizedAttempts));
  return new Date(Date.now() + delay).toISOString();
}

function buildQueueSuccessRecord(entry, { entityServerId, timestamp }) {
  return {
    ...entry,
    status: SYNC_QUEUE_STATUSES.DONE,
    entityServerId: normalizeString(entityServerId),
    retryAt: null,
    lastError: null,
    finishedAt: timestamp
  };
}

function buildQueueRetryRecord(entry, errorPayload) {
  const nextAttemptCount = Number(entry?.attemptCount || 0) + 1;
  return {
    ...entry,
    status: SYNC_QUEUE_STATUSES.PENDING,
    attemptCount: nextAttemptCount,
    retryAt: computeRetryAt(nextAttemptCount - 1),
    lastError: errorPayload,
    startedAt: null,
    finishedAt: null
  };
}

function buildQueueBlockedRecord(entry, errorPayload) {
  return {
    ...entry,
    status: SYNC_QUEUE_STATUSES.BLOCKED,
    attemptCount: Number(entry?.attemptCount || 0) + 1,
    retryAt: null,
    lastError: errorPayload,
    finishedAt: nowIso()
  };
}

async function acquireWorkerLock(atelierId) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const scopeKey = buildMetaScopeKey(scopedAtelierId, SYNC_LOCK_KEY);
  const currentTabId = getTabId();
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + LOCK_LEASE_MS).toISOString();
  let acquired = false;

  await runOfflineTransaction("rw", TABLE_NAMES.META, async () => {
    const current = await metaTable().get(scopeKey);
    const currentValue = current?.value && typeof current.value === "object" ? current.value : {};
    const ownerTabId = normalizeString(currentValue.ownerTabId);
    const lockExpiresAt = normalizeString(currentValue.expiresAt);
    const lockIsActive = ownerTabId && lockExpiresAt && new Date(lockExpiresAt).getTime() > Date.now();

    if (lockIsActive && ownerTabId !== currentTabId) {
      acquired = false;
      return;
    }

    await metaTable().put({
      scopeKey,
      atelierId: scopedAtelierId,
      key: SYNC_LOCK_KEY,
      updatedAt: timestamp,
      value: {
        ownerTabId: currentTabId,
        heartbeatAt: timestamp,
        expiresAt
      }
    });
    acquired = true;
  });

  if (!acquired) return null;

  heldLock = {
    atelierId: scopedAtelierId,
    ownerTabId: currentTabId,
    expiresAt,
    heartbeatAt: timestamp
  };
  emitSyncEvent({ type: "lock-acquired", atelierId: scopedAtelierId });
  postChannelMessage({ type: "lock-acquired", atelierId: scopedAtelierId });
  return heldLock;
}

async function refreshWorkerLock() {
  if (!heldLock?.atelierId) return false;

  const scopedAtelierId = heldLock.atelierId;
  const scopeKey = buildMetaScopeKey(scopedAtelierId, SYNC_LOCK_KEY);
  const currentTabId = getTabId();
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + LOCK_LEASE_MS).toISOString();
  let refreshed = false;

  await runOfflineTransaction("rw", TABLE_NAMES.META, async () => {
    const current = await metaTable().get(scopeKey);
    const currentValue = current?.value && typeof current.value === "object" ? current.value : {};
    if (normalizeString(currentValue.ownerTabId) !== currentTabId) {
      refreshed = false;
      return;
    }

    await metaTable().put({
      ...(current || {}),
      scopeKey,
      atelierId: scopedAtelierId,
      key: SYNC_LOCK_KEY,
      updatedAt: timestamp,
      value: {
        ownerTabId: currentTabId,
        heartbeatAt: timestamp,
        expiresAt
      }
    });
    refreshed = true;
  });

  if (refreshed) {
    heldLock = {
      atelierId: scopedAtelierId,
      ownerTabId: currentTabId,
      heartbeatAt: timestamp,
      expiresAt
    };
  } else {
    heldLock = null;
    stopHeartbeat();
  }

  return refreshed;
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    void refreshWorkerLock();
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function releaseWorkerLock({ silent = false } = {}) {
  const lock = heldLock;
  heldLock = null;
  stopHeartbeat();
  if (!lock?.atelierId) return;

  const scopeKey = buildMetaScopeKey(lock.atelierId, SYNC_LOCK_KEY);
  const currentTabId = getTabId();
  await runOfflineTransaction("rw", TABLE_NAMES.META, async () => {
    const current = await metaTable().get(scopeKey);
    const currentValue = current?.value && typeof current.value === "object" ? current.value : {};
    if (normalizeString(currentValue.ownerTabId) !== currentTabId) return;
    await metaTable().delete(scopeKey);
  });

  if (!silent) {
    emitSyncEvent({ type: "lock-released", atelierId: lock.atelierId });
    postChannelMessage({ type: "lock-released", atelierId: lock.atelierId });
  }
}

async function recoverStaleProcessingJobs(atelierId) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const processingRows = await queueTable().where("[atelierId+status]").equals([scopedAtelierId, SYNC_QUEUE_STATUSES.PROCESSING]).toArray();
  if (processingRows.length === 0) return 0;

  const timestamp = nowIso();
  await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
    for (const row of processingRows) {
      await queueTable().put({
        ...row,
        status: SYNC_QUEUE_STATUSES.PENDING,
        retryAt: null,
        startedAt: null,
        finishedAt: null,
        lastError: row.lastError || {
          message: "Job remis en attente apres expiration du verrou de synchronisation.",
          updatedAt: timestamp
        }
      });
    }
  });

  emitSyncEvent({ type: "processing-recovered", atelierId: scopedAtelierId, count: processingRows.length });
  return processingRows.length;
}

async function resolveJobDependencies(atelierId, entry) {
  const dependencyIds = Array.isArray(entry?.dependsOn) ? entry.dependsOn : [];
  if (dependencyIds.length === 0) {
    return { ready: true, blocked: false };
  }

  for (const queueId of dependencyIds) {
    const dependency = await getQueueEntry(atelierId, queueId);
    if (!dependency) {
      return {
        ready: false,
        blocked: true,
        reason: `Dependance introuvable: ${queueId}`
      };
    }

    const dependencyStatus = normalizeQueueStatus(dependency.status);
    if (dependencyStatus === SYNC_QUEUE_STATUSES.BLOCKED) {
      return {
        ready: false,
        blocked: true,
        reason: `Dependance bloquee: ${queueId}`
      };
    }

    if (!isQueueDone(dependencyStatus)) {
      return {
        ready: false,
        blocked: false
      };
    }
  }

  return {
    ready: true,
    blocked: false
  };
}

async function claimNextQueueEntry(atelierId) {
  const pendingEntries = await listPending(atelierId);
  for (const entry of pendingEntries) {
    if (!supportedActionTypes.has(normalizeString(entry.actionType))) {
      continue;
    }

    const dependencyState = await resolveJobDependencies(atelierId, entry);
    if (dependencyState.blocked) {
      const current = await getQueueEntry(atelierId, entry.queueId);
      if (current && normalizeQueueStatus(current.status) === SYNC_QUEUE_STATUSES.PENDING) {
        await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
          await queueTable().put(buildQueueBlockedRecord(current, {
            message: dependencyState.reason,
            updatedAt: nowIso()
          }));
        });
        emitSyncEvent({ type: "job-blocked", atelierId, queueId: entry.queueId, reason: dependencyState.reason });
      }
      continue;
    }

    if (!dependencyState.ready) {
      continue;
    }

    let claimedEntry = null;
    const timestamp = nowIso();
    await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
      const current = await queueTable().get(entry.queueId);
      if (!current || current.atelierId !== atelierId || normalizeQueueStatus(current.status) !== SYNC_QUEUE_STATUSES.PENDING) {
        return;
      }

      claimedEntry = {
        ...current,
        status: SYNC_QUEUE_STATUSES.PROCESSING,
        startedAt: timestamp,
        finishedAt: null,
        lastError: current.lastError ?? null
      };
      await queueTable().put(claimedEntry);
    });

    if (claimedEntry) {
      return claimedEntry;
    }
  }

  return null;
}

async function refreshPendingActionsCount(atelierId) {
  const scopedAtelierId = normalizeString(atelierId);
  if (!scopedAtelierId) {
    setPendingActions(0);
    return [];
  }
  const pendingEntries = await listPending(scopedAtelierId);
  setPendingActions(pendingEntries.length);
  return pendingEntries;
}

async function resolveClientServerId(atelierId, payload = {}, localRecord = null) {
  const directServerId =
    normalizeString(payload.clientServerId) ||
    (!isOfflineEntityId(normalizeString(payload.idClient)) ? normalizeString(payload.idClient) : "") ||
    normalizeString(localRecord?.clientServerId);
  if (directServerId) return directServerId;

  const candidateLocalId =
    normalizeString(payload.clientLocalId) ||
    normalizeString(localRecord?.clientLocalId) ||
    normalizeString(payload.idClient) ||
    normalizeString(localRecord?.idClient);

  if (!candidateLocalId) {
    throw new SyncPermanentError("Reference client manquante pour cette synchronisation.");
  }

  const mappedServerId = await getServerIdByLocalId(atelierId, "client", candidateLocalId);
  if (!mappedServerId) {
    throw new SyncDependencyBlockedError("Le client parent n'est pas encore synchronise.");
  }

  return mappedServerId;
}

async function resolveBeneficiaryClientServerId(atelierId, line = {}) {
  const lineIdClient = normalizeString(line.idClient);
  const directServerId = normalizeString(line.clientServerId) || (!isOfflineEntityId(lineIdClient) ? lineIdClient : "");
  if (directServerId && !normalizeString(line.clientLocalId)) return directServerId;

  const candidateLocalId = normalizeString(line.clientLocalId) || normalizeString(line.idClient);
  if (!candidateLocalId) {
    throw new SyncPermanentError("Reference beneficiaire manquante pour cette synchronisation.");
  }

  const mappedServerId = await getServerIdByLocalId(atelierId, "client", candidateLocalId);
  if (!mappedServerId) {
    throw new SyncDependencyBlockedError("Un beneficiaire n'est pas encore synchronise.");
  }
  return mappedServerId;
}

async function resolveCommandeServerId(atelierId, payload = {}, localRecord = null) {
  const directServerId =
    normalizeString(payload.commandeServerId) ||
    normalizeString(payload.idCommandeServerId) ||
    normalizeString(localRecord?.idCommandeServerId) ||
    normalizeString(localRecord?.idCommande);
  if (directServerId) return directServerId;

  const candidateLocalId =
    normalizeString(payload.commandeLocalId) ||
    normalizeString(payload.idCommandeLocalId) ||
    normalizeString(localRecord?.idCommandeLocalId);
  if (!candidateLocalId) {
    throw new SyncPermanentError("Reference commande manquante pour cette synchronisation photo.");
  }

  const mappedServerId = await getServerIdByLocalId(atelierId, "commande", candidateLocalId);
  if (!mappedServerId) {
    throw new SyncPermanentError("La commande parente n'est pas encore synchronisee.");
  }

  return mappedServerId;
}

async function buildCommandeApiPayload(atelierId, payload = {}, localRecord = {}, clientServerId = "") {
  const requestPayload = {
    descriptionCommande: normalizeString(payload.descriptionCommande),
    montantTotal: Number(payload.montantTotal || 0),
    typeHabit: normalizeString(payload.typeHabit),
    mesuresHabit: payload.mesuresHabit || {},
    items: Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(localRecord?.items)
        ? localRecord.items
        : []
  };
  if (payload.nouveauClient && typeof payload.nouveauClient === "object") {
    requestPayload.nouveauClient = payload.nouveauClient;
  } else {
    requestPayload.idClient = clientServerId;
  }
  if (payload.datePrevue) {
    requestPayload.datePrevue = payload.datePrevue;
  }
  return requestPayload;
}

function buildCommandePhotoUpdatePayload(localRecord = {}) {
  return {
    note: normalizeString(localRecord?.note),
    position: Math.max(1, Number(localRecord?.position || 1)),
    isPrimary: localRecord?.isPrimary === true
  };
}

function buildRetoucheApiPayload(payload = {}, clientServerId, localRecord = {}) {
  const requestPayload = {
    descriptionRetouche: normalizeString(payload.descriptionRetouche),
    typeRetouche: normalizeString(payload.typeRetouche),
    montantTotal: Number(payload.montantTotal || 0),
    typeHabit: normalizeString(payload.typeHabit),
    mesuresHabit: payload.mesuresHabit || {},
    items: Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(localRecord?.items)
        ? localRecord.items
        : []
  };
  if (payload.nouveauClient && typeof payload.nouveauClient === "object") {
    requestPayload.nouveauClient = payload.nouveauClient;
  } else {
    requestPayload.idClient = clientServerId;
  }
  if (payload.datePrevue) {
    requestPayload.datePrevue = payload.datePrevue;
  }
  return requestPayload;
}

function buildCommandeEmbeddedClientResults(payload = {}, localRecord = {}, response = {}) {
  const related = [];
  const clientsAssocies = Array.isArray(response?.clientsAssocies) ? response.clientsAssocies : [];
  if (payload?.nouveauClient && normalizeString(localRecord?.clientLocalId)) {
    const matched = clientsAssocies.find((client) => normalizeString(client?.idClient) === normalizeString(payload.nouveauClient?.idClient));
    if (matched) {
      related.push({
        localId: normalizeString(localRecord.clientLocalId),
        serverPayload: matched
      });
    }
  }
  return related;
}

function buildRetoucheEmbeddedClientResults(payload = {}, localRecord = {}, response = {}) {
  if (!(payload?.nouveauClient && normalizeString(localRecord?.clientLocalId) && response?.client)) return [];
  return [
    {
      localId: normalizeString(localRecord.clientLocalId),
      serverPayload: response.client
    }
  ];
}

async function executeQueueEntry(atelierId, entry) {
  const actionType = normalizeString(entry.actionType);

  if (actionType === OFFLINE_WRITE_ACTIONS.CREATE_CLIENT) {
    const localRecord = await getEntityByLocalId(atelierId, "client", entry.entityLocalId);
    if (!localRecord) {
      throw new SyncPermanentError("Client local introuvable pour la synchronisation.");
    }

    const response = await atelierApi.createClient(entry.payload || {});
    return {
      entityType: "client",
      localRecord,
      serverPayload: response?.client || response,
      references: {}
    };
  }

  if (actionType === OFFLINE_WRITE_ACTIONS.CREATE_COMMANDE) {
    const localRecord = await getEntityByLocalId(atelierId, "commande", entry.entityLocalId);
    if (!localRecord) {
      throw new SyncPermanentError("Commande locale introuvable pour la synchronisation.");
    }

    const clientServerId = entry.payload?.nouveauClient ? "" : await resolveClientServerId(atelierId, entry.payload, localRecord);
    const response = await atelierApi.createCommande(await buildCommandeApiPayload(atelierId, entry.payload || {}, localRecord, clientServerId));
    return {
      entityType: "commande",
      localRecord,
      serverPayload: response?.commande || response,
      references: {
        clientServerId: normalizeString(response?.client?.idClient || clientServerId)
      },
      relatedClients: buildCommandeEmbeddedClientResults(entry.payload || {}, localRecord, response || {})
    };
  }

  if (actionType === OFFLINE_WRITE_ACTIONS.CREATE_RETOUCHE) {
    const localRecord = await getEntityByLocalId(atelierId, "retouche", entry.entityLocalId);
    if (!localRecord) {
      throw new SyncPermanentError("Retouche locale introuvable pour la synchronisation.");
    }

    const clientServerId = entry.payload?.nouveauClient ? "" : await resolveClientServerId(atelierId, entry.payload, localRecord);
    const response = await atelierApi.createRetouche(buildRetoucheApiPayload(entry.payload || {}, clientServerId, localRecord));
    return {
      entityType: "retouche",
      localRecord,
      serverPayload: response?.retouche || response,
      references: { clientServerId: normalizeString(response?.client?.idClient || clientServerId) },
      relatedClients: buildRetoucheEmbeddedClientResults(entry.payload || {}, localRecord, response || {})
    };
  }

  if (actionType === OFFLINE_MEDIA_ACTIONS.ADD_COMMANDE_PHOTO) {
    const localRecord = await getEntityByLocalId(atelierId, "commande_photo", entry.entityLocalId);
    if (!localRecord) {
      throw new SyncPermanentError("Photo locale introuvable pour la synchronisation.");
    }
    if (!(localRecord.blob instanceof Blob)) {
      throw new SyncPermanentError("Blob photo introuvable pour la synchronisation.");
    }
    if (localRecord.pendingDelete === true) {
      throw new SyncPermanentError("Cette photo est deja marquee pour suppression.");
    }

    const commandeServerId = await resolveCommandeServerId(atelierId, entry.payload, localRecord);
    const formData = new FormData();
    formData.append("photo", localRecord.blob, normalizeString(localRecord.nomFichierOriginal) || "photo-offline.webp");
    if (normalizeString(localRecord.note)) {
      formData.append("note", normalizeString(localRecord.note));
    }
    if (normalizeString(localRecord.sourceType)) {
      formData.append("sourceType", normalizeString(localRecord.sourceType));
    }

    const response = await atelierApi.uploadCommandeMedia(commandeServerId, formData);
    return {
      entityType: "commande_photo",
      localRecord,
      serverPayload: response?.media || response,
      references: {
        commandeServerId,
        commandeLocalId: normalizeString(localRecord.idCommandeLocalId || entry.payload?.commandeLocalId)
      }
    };
  }

  if (actionType === OFFLINE_MEDIA_ACTIONS.UPDATE_COMMANDE_PHOTO_META) {
    const localRecord = await getEntityByLocalId(atelierId, "commande_photo", entry.entityLocalId);
    if (!localRecord) {
      throw new SyncPermanentError("Photo locale introuvable pour la mise a jour.");
    }
    if (localRecord.pendingDelete === true) {
      throw new SyncPermanentError("Cette photo est en attente de suppression.");
    }

    const commandeServerId = await resolveCommandeServerId(atelierId, entry.payload, localRecord);
    const mediaServerId = normalizeString(localRecord.serverId || entry.entityServerId || entry.payload?.mediaServerId);
    if (!mediaServerId) {
      throw new SyncPermanentError("La photo n'est pas encore synchronisee cote serveur.");
    }

    const response = await atelierApi.updateCommandeMedia(
      commandeServerId,
      mediaServerId,
      buildCommandePhotoUpdatePayload(localRecord)
    );

    return {
      entityType: "commande_photo",
      localRecord,
      serverPayload: response?.media || response,
      references: {
        commandeServerId,
        commandeLocalId: normalizeString(localRecord.idCommandeLocalId || entry.payload?.commandeLocalId)
      }
    };
  }

  if (actionType === OFFLINE_MEDIA_ACTIONS.DELETE_COMMANDE_PHOTO) {
    const localRecord = await getEntityByLocalId(atelierId, "commande_photo", entry.entityLocalId);
    const commandeServerId = await resolveCommandeServerId(atelierId, entry.payload, localRecord);
    const mediaServerId = normalizeString(localRecord?.serverId || entry.entityServerId || entry.payload?.mediaServerId);
    if (!mediaServerId) {
      throw new SyncPermanentError("Reference media serveur introuvable pour la suppression.");
    }

    await atelierApi.deleteCommandeMedia(commandeServerId, mediaServerId);
    return {
      kind: "delete",
      entityType: "commande_photo",
      localRecord:
        localRecord || {
          localId: entry.entityLocalId,
          serverId: mediaServerId
        },
      references: {
        commandeServerId,
        commandeLocalId: normalizeString(localRecord?.idCommandeLocalId || entry.payload?.commandeLocalId)
      },
      entityServerId: mediaServerId
    };
  }

  throw new SyncPermanentError(`Action de synchronisation non prise en charge: ${actionType}`);
}

async function commitSuccessfulJob(atelierId, entry, result) {
  const timestamp = nowIso();
  const entityTableName = getEntityTableName(result.entityType);
  const hasRelatedClients = Array.isArray(result?.relatedClients) && result.relatedClients.length > 0;
  const transactionTables = hasRelatedClients
    ? [entityTableName, TABLE_NAMES.CLIENTS, TABLE_NAMES.SYNC_QUEUE]
    : [entityTableName, TABLE_NAMES.SYNC_QUEUE];
  let updatedEntity = null;
  let updatedQueueEntry = null;

  await runOfflineTransaction("rw", transactionTables, async () => {
    const persisted = await persistSyncedEntityRecord({
      atelierId,
      entityType: result.entityType,
      localRecord: result.localRecord,
      serverPayload: result.serverPayload,
      references: result.references,
      timestamp
    });
    updatedEntity = persisted.entity;

    if (hasRelatedClients) {
      for (const clientRef of result.relatedClients) {
        await persistSyncedEntityRecord({
          atelierId,
          entityType: "client",
          localRecord: clientRef?.localId ? { localId: clientRef.localId } : null,
          serverPayload: clientRef?.serverPayload || {},
          references: {},
          timestamp
        });
      }
    }

    const current = await queueTable().get(entry.queueId);
    if (!current || current.atelierId !== atelierId) {
      throw new Error("Entree sync_queue introuvable pendant la finalisation du job.");
    }

    updatedQueueEntry = buildQueueSuccessRecord(current, {
      entityServerId: persisted.serverId,
      timestamp
    });
    await queueTable().put(updatedQueueEntry);
  });

  emitSyncEvent({
    type: "job-synced",
    atelierId,
    queueId: entry.queueId,
    entityType: result.entityType,
    entityLocalId: updatedEntity?.localId || entry.entityLocalId,
    entityServerId: updatedEntity?.serverId || updatedQueueEntry?.entityServerId || ""
  });

  return {
    entity: updatedEntity,
    queueEntry: updatedQueueEntry
  };
}

async function commitDeletedPhotoJob(atelierId, entry, result) {
  const timestamp = nowIso();
  let updatedQueueEntry = null;

  await runOfflineTransaction("rw", [TABLE_NAMES.COMMANDE_PHOTOS, TABLE_NAMES.SYNC_QUEUE], async () => {
    if (normalizeString(result?.localRecord?.localId)) {
      await offlineDb.table(TABLE_NAMES.COMMANDE_PHOTOS).delete(result.localRecord.localId);
    }

    const current = await queueTable().get(entry.queueId);
    if (!current || current.atelierId !== atelierId) {
      throw new Error("Entree sync_queue introuvable pendant la suppression du media.");
    }

    updatedQueueEntry = buildQueueSuccessRecord(current, {
      entityServerId: normalizeString(result?.entityServerId || result?.localRecord?.serverId),
      timestamp
    });
    await queueTable().put(updatedQueueEntry);
  });

  emitSyncEvent({
    type: "job-synced",
    atelierId,
    queueId: entry.queueId,
    entityType: "commande_photo",
    entityLocalId: normalizeString(result?.localRecord?.localId || entry.entityLocalId),
    entityServerId: normalizeString(result?.entityServerId || result?.localRecord?.serverId)
  });

  return {
    entity: null,
    queueEntry: updatedQueueEntry
  };
}

async function scheduleRetry(atelierId, entry, error) {
  const current = await getQueueEntry(atelierId, entry.queueId);
  if (!current) return null;

  const updatedEntry = buildQueueRetryRecord(current, serializeSyncError(error));
  await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
    await queueTable().put(updatedEntry);
  });

  emitSyncEvent({
    type: "job-retry-scheduled",
    atelierId,
    queueId: entry.queueId,
    retryAt: updatedEntry.retryAt,
    attemptCount: updatedEntry.attemptCount
  });

  return updatedEntry;
}

async function blockJob(atelierId, entry, error) {
  const current = await getQueueEntry(atelierId, entry.queueId);
  if (!current) return null;

  const updatedEntry = buildQueueBlockedRecord(current, serializeSyncError(error));
  await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
    await queueTable().put(updatedEntry);
  });

  emitSyncEvent({
    type: "job-blocked",
    atelierId,
    queueId: entry.queueId,
    reason: updatedEntry.lastError?.message || "Erreur metier"
  });

  return updatedEntry;
}

async function processQueueCycle(atelierId) {
  const pendingEntries = await refreshPendingActionsCount(atelierId);
  setSyncInProgress(pendingEntries.length > 0);
  const summary = {
    processedCount: 0,
    syncedCount: 0,
    blockedCount: 0,
    retriedCount: 0
  };

  emitSyncEvent({ type: "cycle-start", atelierId });
  postChannelMessage({ type: "cycle-start", atelierId });

  while (isOnline() && currentAtelierId === atelierId) {
    const nextEntry = await claimNextQueueEntry(atelierId);
    if (!nextEntry) break;

    summary.processedCount += 1;

    try {
      const result = await executeQueueEntry(atelierId, nextEntry);
      try {
        if (result?.kind === "delete" && result?.entityType === "commande_photo") {
          await commitDeletedPhotoJob(atelierId, nextEntry, result);
        } else {
          await commitSuccessfulJob(atelierId, nextEntry, result);
        }
        summary.syncedCount += 1;
      } catch (commitError) {
        const message = normalizeString(commitError?.message || "Persistance locale impossible apres succes serveur.");
        await blockJob(
          atelierId,
          nextEntry,
          new SyncPermanentError(
            `${message} Une verification manuelle est requise avant toute nouvelle tentative pour eviter les doublons.`
          )
        );
        summary.blockedCount += 1;
      }
    } catch (error) {
      if (isRetryableError(error)) {
        await scheduleRetry(atelierId, nextEntry, error);
        summary.retriedCount += 1;
        if (error instanceof ApiError && Number(error.status || 0) === 0) {
          break;
        }
      } else {
        await blockJob(atelierId, nextEntry, error);
        summary.blockedCount += 1;
      }
    }
  }

  setSyncInProgress(false);
  setPendingActions(0);
  emitSyncEvent({ type: "cycle-complete", atelierId, ...summary });
  postChannelMessage({ type: "cycle-complete", atelierId, ...summary });
  return summary;
}

async function runSyncLoop() {
  const atelierId = currentAtelierId;
  if (!atelierId || !isOnline()) return null;

  const lock = await acquireWorkerLock(atelierId);
  if (!lock) return null;

  try {
    startHeartbeat();
    await recoverStaleProcessingJobs(atelierId);
    return await processQueueCycle(atelierId);
  } finally {
    await releaseWorkerLock();
  }
}

async function scheduleRun() {
  if (!started || !currentAtelierId || !isOnline()) return null;
  if (runningPromise) {
    rerunRequested = true;
    return runningPromise;
  }

  runningPromise = (async () => {
    do {
      rerunRequested = false;
      try {
        await runSyncLoop();
      } catch (error) {
        setSyncInProgress(false);
        await refreshPendingActionsCount(currentAtelierId);
        emitSyncEvent({
          type: "cycle-error",
          atelierId: currentAtelierId,
          error: serializeSyncError(error, "Erreur moteur de synchronisation")
        });
      }
    } while (rerunRequested && currentAtelierId && isOnline());
  })();

  try {
    return await runningPromise;
  } finally {
    runningPromise = null;
  }
}

function handleNetworkStateChange(state) {
  if (state?.online && currentAtelierId) {
    void requestSync(currentAtelierId, { broadcast: true });
  }
}

function handleBroadcastMessage(event) {
  const payload = event?.data && typeof event.data === "object" ? event.data : null;
  if (!payload) return;
  if (normalizeString(payload.sourceTabId) === getTabId()) return;
  const atelierId = normalizeString(payload.atelierId);
  if (!atelierId || atelierId !== currentAtelierId) return;

  if (payload.type === "request-sync" || payload.type === "lock-released") {
    void scheduleRun();
  }
}

async function handlePageHide() {
  await releaseWorkerLock({ silent: true });
}

export function initializeSyncEngine() {
  if (started) return;
  started = true;

  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.addEventListener("message", handleBroadcastMessage);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", handlePageHide);
  }

  unsubscribeNetworkState = subscribeToNetworkState(handleNetworkStateChange);
}

export async function setSyncEngineAtelierContext(atelierId = "") {
  const nextAtelierId = normalizeString(atelierId);
  if (!started) {
    initializeSyncEngine();
  }

  if (currentAtelierId === nextAtelierId) {
    if (nextAtelierId) {
      await requestSync(nextAtelierId, { broadcast: false });
    }
    return;
  }

  currentAtelierId = nextAtelierId;
  rerunRequested = Boolean(nextAtelierId);

  if (!nextAtelierId) {
    setSyncInProgress(false);
    setPendingActions(0);
    if (!runningPromise) {
      await releaseWorkerLock({ silent: true });
    }
    emitSyncEvent({ type: "context-cleared", atelierId: "" });
    return;
  }

  if (!runningPromise && heldLock?.atelierId && heldLock.atelierId !== nextAtelierId) {
    await releaseWorkerLock({ silent: true });
  }

  emitSyncEvent({ type: "context-updated", atelierId: nextAtelierId });
  await requestSync(nextAtelierId, { broadcast: true });
}

export async function requestSync(atelierId = currentAtelierId, options = {}) {
  const targetAtelierId = normalizeString(atelierId || currentAtelierId);
  if (!targetAtelierId) return null;
  currentAtelierId = targetAtelierId;

  if (!started) {
    initializeSyncEngine();
  }

  if (options.broadcast !== false) {
    postChannelMessage({ type: "request-sync", atelierId: targetAtelierId });
  }

  await refreshPendingActionsCount(targetAtelierId);
  return scheduleRun();
}

export function subscribeToSyncEvents(listener) {
  if (typeof listener !== "function") {
    throw new Error("Un listener de sync doit etre une fonction.");
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
