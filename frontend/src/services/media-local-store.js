import { OFFLINE_WRITE_ACTIONS } from "./offline-write-service.js";
import {
  ENTITY_SYNC_STATUSES,
  SYNC_QUEUE_STATUSES,
  TABLE_NAMES,
  commandePhotosStore,
  offlineDb,
  putScopedEntityRecord,
  runOfflineTransaction
} from "./local-db.js";
import { createLocalImageId, isLocalEntityId } from "./local-id.js";
import { isOnline } from "./network-service.js";
import { enqueueInTransaction } from "./sync-queue.js";

export const OFFLINE_MEDIA_ACTIONS = Object.freeze({
  ADD_COMMANDE_PHOTO: "ADD_COMMANDE_PHOTO",
  UPDATE_COMMANDE_PHOTO_META: "UPDATE_COMMANDE_PHOTO_META",
  DELETE_COMMANDE_PHOTO: "DELETE_COMMANDE_PHOTO"
});

export const MAX_COMMANDE_PHOTOS = 3;

const ACTIVE_QUEUE_STATUSES = new Set([
  SYNC_QUEUE_STATUSES.PENDING,
  SYNC_QUEUE_STATUSES.PROCESSING,
  SYNC_QUEUE_STATUSES.BLOCKED
]);

const PROTECTED_MEDIA_STATUSES = new Set([
  ENTITY_SYNC_STATUSES.PENDING,
  ENTITY_SYNC_STATUSES.BLOCKED
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour les photos offline.");
  }
  return normalized;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeInteger(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBlob(value) {
  return value instanceof Blob ? value : null;
}

function isProtectedMediaRow(row) {
  return PROTECTED_MEDIA_STATUSES.has(normalizeString(row?.syncStatus).toLowerCase());
}

function isVisibleMediaRow(row) {
  return row?.pendingDelete !== true;
}

function createServerBackedPhotoLocalId(serverId) {
  return `cache_img_${encodeURIComponent(serverId)}`;
}

function queueTable() {
  return offlineDb.table(TABLE_NAMES.SYNC_QUEUE);
}

function commandePhotosTable() {
  return offlineDb.table(TABLE_NAMES.COMMANDE_PHOTOS);
}

function extractCommandeReference(commande) {
  const source =
    commande && typeof commande === "object"
      ? commande
      : {
          idCommande: commande
        };

  const rawId = normalizeString(source?.idCommande || source?.id_commande || source?.id);
  const localId = normalizeString(source?.localId || source?.local_id || (isLocalEntityId(rawId) ? rawId : ""));
  const serverId = normalizeString(source?.serverId || source?.server_id || (!isLocalEntityId(rawId) ? rawId : ""));

  return {
    commandeId: serverId || localId || rawId,
    commandeLocalId: localId,
    commandeServerId: serverId
  };
}

function extractPhotoServerId(payload) {
  return normalizeString(payload?.idMedia || payload?.id_media || payload?.id);
}

function normalizePhotoItemScope(idItem) {
  return normalizeString(idItem);
}

function filterRowsByItemScope(rows = [], idItem = "") {
  const scopeId = normalizePhotoItemScope(idItem);
  return (rows || []).filter((row) => normalizePhotoItemScope(row?.idItem) === scopeId);
}

function buildQueueMetaPayload(record, commandeReference) {
  return {
    commandeLocalId: normalizeString(record?.idCommandeLocalId || commandeReference?.commandeLocalId),
    commandeServerId: normalizeString(record?.idCommandeServerId || commandeReference?.commandeServerId),
    idItem: normalizeString(record?.idItem),
    mediaServerId: normalizeString(record?.serverId),
    sourceType: normalizeString(record?.sourceType),
    note: normalizeString(record?.note),
    position: normalizeInteger(record?.position, 1),
    isPrimary: normalizeBoolean(record?.isPrimary)
  };
}

function buildPhotoRecord({
  atelierId,
  localId,
  commandeReference,
  existing = null,
  patch = {},
  timestamp = nowIso()
}) {
  const next = {
    ...(existing || {}),
    ...(patch || {})
  };

  const position = normalizeInteger(next.position, 1);
  const commandeLocalId =
    normalizeString(next.idCommandeLocalId) || normalizeString(commandeReference?.commandeLocalId) || normalizeString(existing?.idCommandeLocalId);
  const commandeServerId =
    normalizeString(next.idCommandeServerId) || normalizeString(commandeReference?.commandeServerId) || normalizeString(existing?.idCommandeServerId);
  const syncStatus = normalizeString(next.syncStatus || existing?.syncStatus || ENTITY_SYNC_STATUSES.SYNCED).toLowerCase();

  return {
    ...(existing || {}),
    ...(patch || {}),
    atelierId: ensureAtelierId(atelierId),
    localId: normalizeString(localId || next.localId || existing?.localId),
    serverId: normalizeString(next.serverId || existing?.serverId),
    idMedia: normalizeString(next.idMedia || next.serverId || existing?.idMedia || existing?.serverId),
    idCommande: commandeServerId || commandeLocalId || normalizeString(next.idCommande || existing?.idCommande),
    idCommandeLocalId: commandeLocalId,
    idCommandeServerId: commandeServerId,
    idItem: normalizeString(next.idItem ?? existing?.idItem),
    blob: normalizeBlob(next.blob) || normalizeBlob(existing?.blob),
    note: normalizeString(next.note ?? existing?.note),
    position,
    isPrimary: normalizeBoolean(next.isPrimary),
    syncStatus:
      syncStatus === ENTITY_SYNC_STATUSES.PENDING || syncStatus === ENTITY_SYNC_STATUSES.BLOCKED
        ? ENTITY_SYNC_STATUSES.PENDING
        : ENTITY_SYNC_STATUSES.SYNCED,
    updatedAt: timestamp,
    lastSyncedAt:
      syncStatus === ENTITY_SYNC_STATUSES.SYNCED
        ? normalizeString(next.lastSyncedAt || existing?.lastSyncedAt || timestamp)
        : existing?.lastSyncedAt || null,
    pendingDelete: normalizeBoolean(next.pendingDelete),
    typeMedia: normalizeString(next.typeMedia || existing?.typeMedia || "IMAGE"),
    sourceType: normalizeString(next.sourceType || existing?.sourceType || "UPLOAD"),
    nomFichierOriginal: normalizeString(next.nomFichierOriginal || existing?.nomFichierOriginal),
    mimeType: normalizeString(next.mimeType || existing?.mimeType || "image/webp"),
    extensionStockage: normalizeString(next.extensionStockage || existing?.extensionStockage || ""),
    tailleOriginaleBytes: Number(next.tailleOriginaleBytes ?? existing?.tailleOriginaleBytes ?? 0),
    largeur: normalizeNullableNumber(next.largeur ?? existing?.largeur),
    hauteur: normalizeNullableNumber(next.hauteur ?? existing?.hauteur),
    dateCreation: normalizeString(next.dateCreation || existing?.dateCreation || timestamp)
  };
}

async function listQueueEntriesByEntityLocalIdInTransaction(atelierId, entityLocalId) {
  return queueTable().where("[atelierId+entityLocalId]").equals([atelierId, normalizeString(entityLocalId)]).toArray();
}

async function findLatestQueueEntryInTransaction(atelierId, entityLocalId, options = {}) {
  const actionType = normalizeString(options.actionType);
  const entityType = normalizeString(options.entityType);
  const rows = await listQueueEntriesByEntityLocalIdInTransaction(atelierId, entityLocalId);
  return (
    rows
      .filter((row) => {
        if (!ACTIVE_QUEUE_STATUSES.has(normalizeString(row?.status).toLowerCase())) return false;
        if (actionType && normalizeString(row?.actionType) !== actionType) return false;
        if (entityType && normalizeString(row?.entityType) !== entityType) return false;
        return true;
      })
      .sort((left, right) => String(right?.createdAt || "").localeCompare(String(left?.createdAt || "")))[0] || null
  );
}

async function removeQueueEntriesByEntityLocalIdInTransaction(atelierId, entityLocalId, options = {}) {
  const actionTypes = new Set((Array.isArray(options.actionTypes) ? options.actionTypes : []).map((value) => normalizeString(value)));
  const statuses = new Set(
    (Array.isArray(options.statuses) && options.statuses.length > 0
      ? options.statuses
      : Array.from(ACTIVE_QUEUE_STATUSES)
    ).map((value) => normalizeString(value).toLowerCase())
  );
  const rows = await listQueueEntriesByEntityLocalIdInTransaction(atelierId, entityLocalId);
  for (const row of rows) {
    if (!statuses.has(normalizeString(row?.status).toLowerCase())) continue;
    if (actionTypes.size > 0 && !actionTypes.has(normalizeString(row?.actionType))) continue;
    await queueTable().delete(row.queueId);
  }
}

async function listCommandePhotoRecordsInternal(atelierId, commandeReference, options = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commandeReference);
  const seen = new Map();
  const rows = [];

  if (reference.commandeLocalId) {
    const localRows = await commandePhotosTable()
      .where("[atelierId+idCommandeLocalId]")
      .equals([scopedAtelierId, reference.commandeLocalId])
      .toArray();
    rows.push(...localRows);
  }

  if (reference.commandeServerId) {
    const serverRows = await commandePhotosTable()
      .where("[atelierId+idCommandeServerId]")
      .equals([scopedAtelierId, reference.commandeServerId])
      .toArray();
    rows.push(...serverRows);
  }

  for (const row of rows) {
    if (!row?.localId) continue;
    seen.set(row.localId, row);
  }

  return Array.from(seen.values())
    .filter((row) => options.includeHidden === true || isVisibleMediaRow(row))
    .sort((left, right) => {
      const positionDiff = normalizeInteger(left?.position, 1) - normalizeInteger(right?.position, 1);
      if (positionDiff !== 0) return positionDiff;
      return String(left?.updatedAt || "").localeCompare(String(right?.updatedAt || ""));
    });
}

async function getCommandePhotoRecord(atelierId, media) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const localId = normalizeString(media?.localId || media?.idMedia);
  if (localId) {
    const byLocalId = await commandePhotosStore.getByAtelierAndLocalId(scopedAtelierId, localId);
    if (byLocalId) return byLocalId;
  }

  const serverId = normalizeString(media?.serverId || media?.idMedia);
  if (!serverId) return null;
  return commandePhotosStore.getByAtelierAndServerId(scopedAtelierId, serverId);
}

function materializeCommandeMediaItems(records = [], options = {}) {
  const commandeServerId = normalizeString(options.commandeServerId);
  return [...(records || [])]
    .map((record) => ({
      localId: normalizeString(record?.localId),
      serverId: normalizeString(record?.serverId),
      syncStatus: normalizeString(record?.syncStatus || ENTITY_SYNC_STATUSES.SYNCED).toLowerCase(),
      updatedAt: normalizeString(record?.updatedAt),
      lastSyncedAt: normalizeString(record?.lastSyncedAt),
      pendingDelete: record?.pendingDelete === true,
      idMedia: normalizeString(record?.serverId || record?.localId || record?.idMedia),
      idCommande:
        normalizeString(record?.idCommandeServerId || record?.idCommandeLocalId || record?.idCommande || commandeServerId),
      idCommandeLocalId: normalizeString(record?.idCommandeLocalId),
      idCommandeServerId: normalizeString(record?.idCommandeServerId || commandeServerId),
      idItem: normalizeString(record?.idItem),
      typeMedia: normalizeString(record?.typeMedia || "IMAGE"),
      sourceType: normalizeString(record?.sourceType || "UPLOAD"),
      nomFichierOriginal: normalizeString(record?.nomFichierOriginal),
      mimeType: normalizeString(record?.mimeType || "image/webp"),
      extensionStockage: normalizeString(record?.extensionStockage),
      tailleOriginaleBytes: Number(record?.tailleOriginaleBytes ?? 0),
      largeur: normalizeNullableNumber(record?.largeur),
      hauteur: normalizeNullableNumber(record?.hauteur),
      note: normalizeString(record?.note),
      position: normalizeInteger(record?.position, 1),
      isPrimary: normalizeBoolean(record?.isPrimary),
      dateCreation: normalizeString(record?.dateCreation),
      blob: normalizeBlob(record?.blob),
      thumbnailBlobUrl: "",
      fileBlobUrl: ""
    }))
    .sort((left, right) => {
      const positionDiff = normalizeInteger(left?.position, 1) - normalizeInteger(right?.position, 1);
      if (positionDiff !== 0) return positionDiff;
      return String(left?.updatedAt || "").localeCompare(String(right?.updatedAt || ""));
    });
}

async function cacheServerCommandeMedia({ atelierId, commandeReference, mediaRows = [] }) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commandeReference);
  if (!reference.commandeServerId) {
    return listCommandePhotoRecordsInternal(scopedAtelierId, reference);
  }

  const timestamp = nowIso();
  const seenServerIds = new Set();

  await runOfflineTransaction("rw", TABLE_NAMES.COMMANDE_PHOTOS, async () => {
    const existingRows = await commandePhotosTable()
      .where("[atelierId+idCommandeServerId]")
      .equals([scopedAtelierId, reference.commandeServerId])
      .toArray();
    const existingByServerId = new Map();
    for (const row of existingRows) {
      const serverId = normalizeString(row?.serverId);
      if (serverId) {
        existingByServerId.set(serverId, row);
      }
    }

    for (const rawRow of mediaRows || []) {
      const serverId = extractPhotoServerId(rawRow);
      if (!serverId) continue;
      seenServerIds.add(serverId);

      const existing = existingByServerId.get(serverId) || null;
      if (existing && isProtectedMediaRow(existing)) {
        continue;
      }

      await putScopedEntityRecord(TABLE_NAMES.COMMANDE_PHOTOS, scopedAtelierId, {
        ...(existing || {}),
        ...(rawRow || {}),
        localId: normalizeString(existing?.localId) || createServerBackedPhotoLocalId(serverId),
        serverId,
        idMedia: serverId,
        idCommande: reference.commandeServerId,
        idCommandeLocalId: normalizeString(existing?.idCommandeLocalId || reference.commandeLocalId),
        idCommandeServerId: reference.commandeServerId,
        idItem: normalizeString(rawRow?.idItem || rawRow?.id_item),
        syncStatus: ENTITY_SYNC_STATUSES.SYNCED,
        pendingDelete: false,
        updatedAt: timestamp,
        lastSyncedAt: timestamp
      });
    }

    for (const existing of existingRows) {
      const serverId = normalizeString(existing?.serverId);
      if (!serverId || seenServerIds.has(serverId) || isProtectedMediaRow(existing)) {
        continue;
      }
      await commandePhotosTable().delete(existing.localId);
    }
  });

  return listCommandePhotoRecordsInternal(scopedAtelierId, reference);
}

async function queueCommandePhotoMetaUpdateInTransaction(atelierId, commandeReference, record, timestamp) {
  const dependency =
    !normalizeString(record?.serverId)
      ? await findLatestQueueEntryInTransaction(atelierId, record.localId, {
          entityType: "commande_photo",
          actionType: OFFLINE_MEDIA_ACTIONS.ADD_COMMANDE_PHOTO
        })
      : null;

  return enqueueInTransaction(atelierId, {
    status: SYNC_QUEUE_STATUSES.PENDING,
    actionType: OFFLINE_MEDIA_ACTIONS.UPDATE_COMMANDE_PHOTO_META,
    entityType: "commande_photo",
    entityLocalId: record.localId,
    entityServerId: normalizeString(record?.serverId),
    createdAt: timestamp,
    dependsOn: dependency?.queueId ? [dependency.queueId] : [],
    payload: buildQueueMetaPayload(record, commandeReference)
  });
}

async function applyUpdatedVisibleRowsInTransaction(atelierId, commandeReference, updatedVisibleRows, previousVisibleMap, timestamp) {
  for (const row of updatedVisibleRows) {
    const previous = previousVisibleMap.get(row.localId) || null;
    const changed =
      !previous ||
      previous.position !== row.position ||
      previous.isPrimary !== row.isPrimary ||
      normalizeString(previous.note) !== normalizeString(row.note);
    if (!changed) continue;

    const nextRecord = buildPhotoRecord({
      atelierId,
      localId: row.localId,
      commandeReference,
      existing: previous || row,
      patch: row,
      timestamp
    });
    await putScopedEntityRecord(TABLE_NAMES.COMMANDE_PHOTOS, atelierId, nextRecord);
    await queueCommandePhotoMetaUpdateInTransaction(atelierId, commandeReference, nextRecord, timestamp);
  }
}

export async function listCommandeMediaLocal({ atelierId, commande } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const rows = await listCommandePhotoRecordsInternal(scopedAtelierId, reference);
  return materializeCommandeMediaItems(rows, {
    commandeServerId: reference.commandeServerId
  });
}

export async function loadCommandeMediaLocalFirst({ atelierId, commande } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const cachedRows = await listCommandePhotoRecordsInternal(scopedAtelierId, reference);
  const online = isOnline();

  return {
    online,
    cached: materializeCommandeMediaItems(cachedRows, {
      commandeServerId: reference.commandeServerId
    }),
    hasCachedData: cachedRows.length > 0,
    refreshPromise:
      online && reference.commandeServerId
        ? Promise.resolve({ needsServerRefresh: true })
        : Promise.resolve(null)
  };
}

export async function addCommandePhotoOffline({
  atelierId,
  commande,
  file,
  note = "",
  sourceType = "UPLOAD",
  existingCount = null,
  idItem = ""
} = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const blob = normalizeBlob(file);
  if (!blob) {
    throw new Error("Photo invalide pour l'enregistrement offline.");
  }

  let createdRow = null;
  const timestamp = nowIso();
  await runOfflineTransaction("rw", [TABLE_NAMES.COMMANDE_PHOTOS, TABLE_NAMES.SYNC_QUEUE], async () => {
    const existingRows = await listCommandePhotoRecordsInternal(scopedAtelierId, reference);
    const scopedRows = filterRowsByItemScope(existingRows, idItem);
    const knownCount =
      Number.isFinite(Number(existingCount)) && Number(existingCount) >= 0
        ? Number(existingCount)
        : scopedRows.length;
    if (knownCount >= MAX_COMMANDE_PHOTOS) {
      throw new Error("Limite atteinte: 3 photos maximum par habit.");
    }

    const currentMaxPosition = scopedRows.reduce((maxValue, row) => Math.max(maxValue, normalizeInteger(row?.position, 1)), 0);
    const hasPrimary = scopedRows.some((row) => row?.isPrimary === true);
    const localId = createLocalImageId();
    createdRow = buildPhotoRecord({
      atelierId: scopedAtelierId,
      localId,
      commandeReference: reference,
      patch: {
        localId,
        idMedia: localId,
        blob,
        note,
        idItem: normalizeString(idItem),
        position: currentMaxPosition + 1,
        isPrimary: !hasPrimary,
        syncStatus: ENTITY_SYNC_STATUSES.PENDING,
        sourceType,
        typeMedia: "IMAGE",
        nomFichierOriginal: normalizeString(file?.name),
        mimeType: normalizeString(file?.type || "image/webp"),
        tailleOriginaleBytes: Number(file?.size || 0),
        dateCreation: timestamp
      },
      timestamp
    });

    await putScopedEntityRecord(TABLE_NAMES.COMMANDE_PHOTOS, scopedAtelierId, createdRow);

    const commandeDependency = reference.commandeLocalId
      ? await findLatestQueueEntryInTransaction(scopedAtelierId, reference.commandeLocalId, {
          entityType: "commande",
          actionType: OFFLINE_WRITE_ACTIONS.CREATE_COMMANDE
        })
      : null;

    await enqueueInTransaction(scopedAtelierId, {
      status: SYNC_QUEUE_STATUSES.PENDING,
      actionType: OFFLINE_MEDIA_ACTIONS.ADD_COMMANDE_PHOTO,
      entityType: "commande_photo",
      entityLocalId: createdRow.localId,
      createdAt: timestamp,
      dependsOn: commandeDependency?.queueId ? [commandeDependency.queueId] : [],
      payload: buildQueueMetaPayload(createdRow, reference)
    });
  });

  return materializeCommandeMediaItems([createdRow], {
    commandeServerId: reference.commandeServerId
  })[0];
}

export async function saveCommandePhotoNoteOffline({ atelierId, commande, media, note = "" } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const existing = await getCommandePhotoRecord(scopedAtelierId, media);
  if (!existing) {
    throw new Error("Photo introuvable dans le stockage local.");
  }
  if (existing.pendingDelete === true) {
    throw new Error("Cette photo est deja en attente de suppression.");
  }

  const timestamp = nowIso();
  await runOfflineTransaction("rw", [TABLE_NAMES.COMMANDE_PHOTOS, TABLE_NAMES.SYNC_QUEUE], async () => {
    const updated = buildPhotoRecord({
      atelierId: scopedAtelierId,
      localId: existing.localId,
      commandeReference: reference,
      existing,
      patch: {
        note,
        syncStatus: ENTITY_SYNC_STATUSES.PENDING
      },
      timestamp
    });
    await putScopedEntityRecord(TABLE_NAMES.COMMANDE_PHOTOS, scopedAtelierId, updated);
    await queueCommandePhotoMetaUpdateInTransaction(scopedAtelierId, reference, updated, timestamp);
  });

  return listCommandeMediaLocal({ atelierId: scopedAtelierId, commande: reference });
}

export async function setCommandePhotoPrimaryOffline({ atelierId, commande, media } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const rows = await listCommandePhotoRecordsInternal(scopedAtelierId, reference);
  const targetLocalId = normalizeString(media?.localId || media?.idMedia);
  const target = rows.find((row) => row.localId === targetLocalId || normalizeString(row.serverId) === normalizeString(media?.serverId));
  if (!target) {
    throw new Error("Photo introuvable dans le stockage local.");
  }
  if (target.pendingDelete === true) {
    throw new Error("Cette photo est en attente de suppression.");
  }

  const timestamp = nowIso();
  const visibleRows = filterRowsByItemScope(rows.filter(isVisibleMediaRow), target?.idItem);
  const previousVisibleMap = new Map(visibleRows.map((row) => [row.localId, row]));
  const updatedVisibleRows = visibleRows.map((row) => ({
    ...row,
    isPrimary: row.localId === target.localId,
    syncStatus: row.localId === target.localId || row.isPrimary ? ENTITY_SYNC_STATUSES.PENDING : row.syncStatus
  }));

  await runOfflineTransaction("rw", [TABLE_NAMES.COMMANDE_PHOTOS, TABLE_NAMES.SYNC_QUEUE], async () => {
    await applyUpdatedVisibleRowsInTransaction(scopedAtelierId, reference, updatedVisibleRows, previousVisibleMap, timestamp);
  });

  return listCommandeMediaLocal({ atelierId: scopedAtelierId, commande: reference });
}

export async function moveCommandePhotoOffline({ atelierId, commande, media, direction = 0 } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const rows = await listCommandePhotoRecordsInternal(scopedAtelierId, reference);
  const visibleRows = filterRowsByItemScope(rows.filter(isVisibleMediaRow), media?.idItem);
  const targetLocalId = normalizeString(media?.localId || media?.idMedia);
  const currentIndex = visibleRows.findIndex(
    (row) => row.localId === targetLocalId || normalizeString(row.serverId) === normalizeString(media?.serverId)
  );
  if (currentIndex < 0) {
    throw new Error("Photo introuvable dans le stockage local.");
  }

  const nextIndex = currentIndex + Number(direction || 0);
  if (nextIndex < 0 || nextIndex >= visibleRows.length) {
    return listCommandeMediaLocal({ atelierId: scopedAtelierId, commande: reference });
  }

  const reordered = [...visibleRows];
  const [movedRow] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, movedRow);
  const previousVisibleMap = new Map(visibleRows.map((row) => [row.localId, row]));
  const timestamp = nowIso();
  const updatedVisibleRows = reordered.map((row, index) => ({
    ...row,
    position: index + 1,
    syncStatus:
      normalizeInteger(row.position, 1) !== index + 1 ? ENTITY_SYNC_STATUSES.PENDING : normalizeString(row.syncStatus)
  }));

  await runOfflineTransaction("rw", [TABLE_NAMES.COMMANDE_PHOTOS, TABLE_NAMES.SYNC_QUEUE], async () => {
    await applyUpdatedVisibleRowsInTransaction(scopedAtelierId, reference, updatedVisibleRows, previousVisibleMap, timestamp);
  });

  return listCommandeMediaLocal({ atelierId: scopedAtelierId, commande: reference });
}

export async function deleteCommandePhotoOffline({ atelierId, commande, media } = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const reference = extractCommandeReference(commande);
  const existing = await getCommandePhotoRecord(scopedAtelierId, media);
  if (!existing) {
    throw new Error("Photo introuvable dans le stockage local.");
  }

  const timestamp = nowIso();
  await runOfflineTransaction("rw", [TABLE_NAMES.COMMANDE_PHOTOS, TABLE_NAMES.SYNC_QUEUE], async () => {
    const allRows = await listCommandePhotoRecordsInternal(scopedAtelierId, reference, { includeHidden: true });
    const scopedVisibleRows = filterRowsByItemScope(allRows.filter(isVisibleMediaRow), existing.idItem);
    const visibleRows = scopedVisibleRows.filter((row) => row.localId !== existing.localId);
    const previousVisibleMap = new Map(scopedVisibleRows.map((row) => [row.localId, row]));

    if (!normalizeString(existing.serverId)) {
      await removeQueueEntriesByEntityLocalIdInTransaction(scopedAtelierId, existing.localId);
      await commandePhotosTable().delete(existing.localId);
    } else {
      await removeQueueEntriesByEntityLocalIdInTransaction(scopedAtelierId, existing.localId, {
        actionTypes: [OFFLINE_MEDIA_ACTIONS.UPDATE_COMMANDE_PHOTO_META]
      });

      const tombstone = buildPhotoRecord({
        atelierId: scopedAtelierId,
        localId: existing.localId,
        commandeReference: reference,
        existing,
        patch: {
          pendingDelete: true,
          syncStatus: ENTITY_SYNC_STATUSES.PENDING
        },
        timestamp
      });
      await putScopedEntityRecord(TABLE_NAMES.COMMANDE_PHOTOS, scopedAtelierId, tombstone);
      await enqueueInTransaction(scopedAtelierId, {
        status: SYNC_QUEUE_STATUSES.PENDING,
        actionType: OFFLINE_MEDIA_ACTIONS.DELETE_COMMANDE_PHOTO,
        entityType: "commande_photo",
        entityLocalId: tombstone.localId,
        entityServerId: normalizeString(tombstone.serverId),
        createdAt: timestamp,
        payload: buildQueueMetaPayload(tombstone, reference)
      });
    }

    const hasPrimary = visibleRows.some((row) => row.isPrimary === true);
    const normalizedVisibleRows = visibleRows.map((row, index) => ({
      ...row,
      position: index + 1,
      isPrimary: hasPrimary ? row.isPrimary : index === 0,
      syncStatus:
        normalizeInteger(row.position, 1) !== index + 1 || (!hasPrimary && index === 0)
          ? ENTITY_SYNC_STATUSES.PENDING
          : normalizeString(row.syncStatus)
    }));

    await applyUpdatedVisibleRowsInTransaction(scopedAtelierId, reference, normalizedVisibleRows, previousVisibleMap, timestamp);
  });

  return listCommandeMediaLocal({ atelierId: scopedAtelierId, commande: reference });
}
