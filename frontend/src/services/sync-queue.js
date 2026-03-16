import { SYNC_QUEUE_STATUSES, TABLE_NAMES, offlineDb, runOfflineTransaction } from "./local-db.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function ensureAtelierId(atelierId) {
  const normalized = normalizeString(atelierId);
  if (!normalized) {
    throw new Error("atelierId obligatoire pour la sync queue.");
  }
  return normalized;
}

function createQueueId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `sq_${globalThis.crypto.randomUUID()}`;
  }
  return `sq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStatus(status) {
  const normalized = normalizeString(status).toLowerCase();
  if (Object.values(SYNC_QUEUE_STATUSES).includes(normalized)) {
    return normalized;
  }
  return SYNC_QUEUE_STATUSES.PENDING;
}

function toIsoTimestamp(value, fallback = nowIso()) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function toNullableIsoTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  return toIsoTimestamp(value, null);
}

function normalizeAttemptCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function normalizeDependsOn(dependsOn) {
  const source = Array.isArray(dependsOn) ? dependsOn : dependsOn ? [dependsOn] : [];
  return Array.from(new Set(source.map((item) => normalizeString(item)).filter(Boolean)));
}

function normalizeLastError(lastError) {
  if (lastError === null || lastError === undefined || lastError === "") return null;
  if (typeof lastError === "string") {
    return {
      message: lastError,
      updatedAt: nowIso()
    };
  }
  if (typeof lastError === "object") {
    return {
      ...lastError,
      message: normalizeString(lastError.message || "Erreur de synchronisation"),
      updatedAt: toIsoTimestamp(lastError.updatedAt)
    };
  }
  return {
    message: String(lastError),
    updatedAt: nowIso()
  };
}

function buildQueueEntry(atelierId, input = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const createdAt = toIsoTimestamp(input.createdAt);
  const status = normalizeStatus(input.status);

  return {
    queueId: normalizeString(input.queueId) || createQueueId(),
    atelierId: scopedAtelierId,
    status,
    attemptCount: normalizeAttemptCount(input.attemptCount),
    retryAt: toNullableIsoTimestamp(input.retryAt),
    dependsOn: normalizeDependsOn(input.dependsOn),
    lastError: normalizeLastError(input.lastError),
    createdAt,
    startedAt: toNullableIsoTimestamp(input.startedAt),
    finishedAt: toNullableIsoTimestamp(input.finishedAt),
    entityType: normalizeString(input.entityType),
    actionType: normalizeString(input.actionType),
    entityLocalId: normalizeString(input.entityLocalId),
    entityServerId: normalizeString(input.entityServerId),
    payload: input.payload ?? null,
    meta: input.meta ?? null
  };
}

function applyStatusSideEffects(entry, nextStatus, patch = {}) {
  const now = toIsoTimestamp(patch.updatedAt);
  const updated = {
    ...entry,
    ...patch,
    status: normalizeStatus(nextStatus),
    attemptCount: normalizeAttemptCount(patch.attemptCount ?? entry.attemptCount),
    retryAt: toNullableIsoTimestamp(patch.retryAt ?? entry.retryAt),
    dependsOn: normalizeDependsOn(patch.dependsOn ?? entry.dependsOn),
    lastError: normalizeLastError(patch.lastError ?? entry.lastError),
    startedAt: toNullableIsoTimestamp(patch.startedAt ?? entry.startedAt),
    finishedAt: toNullableIsoTimestamp(patch.finishedAt ?? entry.finishedAt)
  };

  if (updated.status === SYNC_QUEUE_STATUSES.PROCESSING) {
    updated.startedAt = updated.startedAt || now;
    updated.finishedAt = null;
  } else if (updated.status === SYNC_QUEUE_STATUSES.SYNCED || updated.status === SYNC_QUEUE_STATUSES.BLOCKED) {
    updated.finishedAt = updated.finishedAt || now;
  } else if (updated.status === SYNC_QUEUE_STATUSES.PENDING) {
    updated.finishedAt = null;
  }

  return updated;
}

function queueTable() {
  return offlineDb.table(TABLE_NAMES.SYNC_QUEUE);
}

async function putQueueEntry(entry) {
  await queueTable().put(entry);
  return entry;
}

export async function enqueueInTransaction(atelierId, input = {}) {
  const entry = buildQueueEntry(atelierId, input);
  await putQueueEntry(entry);
  return entry;
}

export async function enqueue(atelierId, input = {}) {
  const entry = buildQueueEntry(atelierId, input);
  await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
    await putQueueEntry(entry);
  });
  return entry;
}

export async function listPending(atelierId, options = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const now = toIsoTimestamp(options.now);
  const limit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0 ? Number(options.limit) : Infinity;

  const rows = await queueTable().where("[atelierId+status]").equals([scopedAtelierId, SYNC_QUEUE_STATUSES.PENDING]).toArray();
  return rows
    .filter((row) => !row.retryAt || row.retryAt <= now)
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))
    .slice(0, limit);
}

export async function updateStatus(atelierId, queueId, nextStatus, patch = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedQueueId = normalizeString(queueId);
  if (!normalizedQueueId) {
    throw new Error("queueId obligatoire pour mettre a jour le statut.");
  }

  let updatedEntry = null;
  await runOfflineTransaction("rw", TABLE_NAMES.SYNC_QUEUE, async () => {
    const current = await queueTable().get(normalizedQueueId);
    if (!current || current.atelierId !== scopedAtelierId) {
      throw new Error("Entree sync_queue introuvable pour cet atelier.");
    }

    updatedEntry = applyStatusSideEffects(current, nextStatus, patch);
    await queueTable().put(updatedEntry);
  });

  return updatedEntry;
}

export async function getQueueEntry(atelierId, queueId) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedQueueId = normalizeString(queueId);
  if (!normalizedQueueId) return null;

  const entry = await queueTable().get(normalizedQueueId);
  if (!entry || entry.atelierId !== scopedAtelierId) return null;
  return entry;
}

export async function listQueueByAtelier(atelierId) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const rows = await queueTable().where("atelierId").equals(scopedAtelierId).toArray();
  return rows.sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

export async function findLatestActiveEntryByEntityLocalId(atelierId, entityLocalId, options = {}) {
  const scopedAtelierId = ensureAtelierId(atelierId);
  const normalizedEntityLocalId = normalizeString(entityLocalId);
  if (!normalizedEntityLocalId) return null;

  const actionType = normalizeString(options.actionType);
  const entityType = normalizeString(options.entityType);
  const statusesSource = Array.isArray(options.statuses) && options.statuses.length > 0
    ? options.statuses
    : [SYNC_QUEUE_STATUSES.PENDING, SYNC_QUEUE_STATUSES.PROCESSING, SYNC_QUEUE_STATUSES.BLOCKED];
  const allowedStatuses = new Set(statusesSource.map((status) => normalizeStatus(status)));

  const rows = await queueTable().where("[atelierId+entityLocalId]").equals([scopedAtelierId, normalizedEntityLocalId]).toArray();
  const filtered = rows
    .filter((row) => {
      if (!allowedStatuses.has(normalizeStatus(row.status))) return false;
      if (actionType && normalizeString(row.actionType) !== actionType) return false;
      if (entityType && normalizeString(row.entityType) !== entityType) return false;
      return true;
    })
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));

  return filtered[0] || null;
}
