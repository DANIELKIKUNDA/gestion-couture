import { initializeLocalDb, metaStore } from "./local-db.js";

const OFFLINE_SESSION_META_KEY = "auth.offline_session.v1";
const OFFLINE_SESSION_ATELIER_KEY = "atelier.offline.session.atelier_id.v1";
const OFFLINE_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const OFFLINE_SESSION_SCHEMA_VERSION = 1;
const SYSTEM_MANAGER_ROLE = "MANAGER_SYSTEME";
const CLOCK_DRIFT_TOLERANCE_MS = 5 * 60 * 1000;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return normalizeString(value).toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function readLastAtelierId() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeString(window.localStorage.getItem(OFFLINE_SESSION_ATELIER_KEY));
  } catch {
    return "";
  }
}

function writeLastAtelierId(atelierId) {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeString(atelierId);
    if (normalized) {
      window.localStorage.setItem(OFFLINE_SESSION_ATELIER_KEY, normalized);
    } else {
      window.localStorage.removeItem(OFFLINE_SESSION_ATELIER_KEY);
    }
  } catch {
    // Storage can be unavailable in private contexts.
  }
}

function normalizePermissions(permissions = []) {
  if (!Array.isArray(permissions)) return [];
  return Array.from(new Set(permissions.map((permission) => normalizeRole(permission)).filter(Boolean)));
}

function normalizeSessionSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  const userId = normalizeString(raw.userId || raw.id);
  const atelierId = normalizeString(raw.atelierId);
  const roleId = normalizeRole(raw.roleId || raw.role);
  if (!userId || !atelierId || !roleId) return null;

  return {
    schemaVersion: Number(raw.schemaVersion || OFFLINE_SESSION_SCHEMA_VERSION),
    offlineEnabled: raw.offlineEnabled === true,
    userId,
    id: userId,
    nom: normalizeString(raw.nom),
    email: normalizeString(raw.email),
    roleId,
    roles: [roleId],
    permissions: normalizePermissions(raw.permissions),
    atelierId,
    atelierSlug: normalizeString(raw.atelierSlug),
    atelierNom: normalizeString(raw.atelierNom),
    lastOnlineVerifiedAt: normalizeString(raw.lastOnlineVerifiedAt)
  };
}

function buildSessionSnapshot(session, context = {}) {
  const normalized = normalizeSessionSnapshot({
    ...session,
    userId: session?.userId || session?.id,
    roleId: session?.roleId || session?.roles?.[0],
    atelierSlug: context.atelierSlug || session?.atelierSlug,
    atelierNom: context.atelierNom || session?.atelierNom,
    lastOnlineVerifiedAt: context.lastOnlineVerifiedAt || nowIso(),
    offlineEnabled: true,
    schemaVersion: OFFLINE_SESSION_SCHEMA_VERSION
  });
  if (!normalized) return null;
  return normalized;
}

function getExpirationReason(snapshot, maxAgeMs = OFFLINE_SESSION_MAX_AGE_MS) {
  const verifiedAt = Date.parse(snapshot?.lastOnlineVerifiedAt || "");
  if (!Number.isFinite(verifiedAt)) return "expired";
  const now = Date.now();
  if (verifiedAt - now > CLOCK_DRIFT_TOLERANCE_MS) return "clock_invalid";
  if (now - verifiedAt > maxAgeMs) return "expired";
  return "";
}

function toAuthSession(snapshot) {
  return {
    id: snapshot.userId,
    nom: snapshot.nom,
    email: snapshot.email,
    atelierId: snapshot.atelierId,
    roleId: snapshot.roleId,
    roles: snapshot.roles,
    actif: true,
    permissions: snapshot.permissions,
    offline: true,
    offlineSession: {
      atelierSlug: snapshot.atelierSlug,
      atelierNom: snapshot.atelierNom,
      lastOnlineVerifiedAt: snapshot.lastOnlineVerifiedAt
    }
  };
}

export async function saveOfflineSessionSnapshot(session, context = {}) {
  const snapshot = buildSessionSnapshot(session, context);
  if (!snapshot) return null;
  if (snapshot.roleId === SYSTEM_MANAGER_ROLE) {
    await clearOfflineSessionSnapshot();
    return null;
  }

  await initializeLocalDb();
  await metaStore.deleteAllByKey(OFFLINE_SESSION_META_KEY);
  await metaStore.putByAtelier(snapshot.atelierId, OFFLINE_SESSION_META_KEY, snapshot);
  writeLastAtelierId(snapshot.atelierId);
  return snapshot;
}

export async function restoreOfflineSessionSnapshot({ maxAgeMs = OFFLINE_SESSION_MAX_AGE_MS } = {}) {
  const atelierId = readLastAtelierId();
  if (!atelierId) {
    return { session: null, reason: "missing_snapshot" };
  }

  await initializeLocalDb();
  const row = await metaStore.getByAtelierAndKey(atelierId, OFFLINE_SESSION_META_KEY);
  const snapshot = normalizeSessionSnapshot(row?.value);
  if (!snapshot || snapshot.offlineEnabled !== true) {
    return { session: null, reason: "missing_snapshot" };
  }
  if (snapshot.roleId === SYSTEM_MANAGER_ROLE) {
    return { session: null, reason: "system_manager_blocked" };
  }
  const expirationReason = getExpirationReason(snapshot, maxAgeMs);
  if (expirationReason) {
    return { session: null, reason: expirationReason };
  }

  return { session: toAuthSession(snapshot), snapshot, reason: "" };
}

export async function clearOfflineSessionSnapshot(atelierId = "") {
  const targetAtelierId = normalizeString(atelierId) || readLastAtelierId();
  try {
    await initializeLocalDb();
    await metaStore.deleteAllByKey(OFFLINE_SESSION_META_KEY);
    if (targetAtelierId) {
      await metaStore.deleteByAtelierAndKey(targetAtelierId, OFFLINE_SESSION_META_KEY);
    }
  } catch {
    // Logout must stay resilient even if IndexedDB is temporarily unavailable.
  }
  writeLastAtelierId("");
}

export const OFFLINE_SESSION_MESSAGES = Object.freeze({
  FIRST_LOGIN_REQUIRED: "Connexion internet requise pour la premiere connexion.",
  EXPIRED: "Session hors ligne expiree. Reconnecte-toi avec internet.",
  CLOCK_INVALID: "Horloge de l'appareil incoherente. Reconnecte-toi avec internet.",
  SYSTEM_MANAGER_BLOCKED: "La console systeme necessite une connexion internet."
});
