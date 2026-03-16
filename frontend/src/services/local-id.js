const LOCAL_ID_PREFIXES = Object.freeze({
  CLIENT: "loc_cli",
  COMMANDE: "loc_cmd",
  RETOUCHE: "loc_ret",
  IMAGE: "loc_img"
});

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function generateUuidFragment() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `${now}${random}`;
}

function createLocalId(prefix) {
  const normalizedPrefix = normalizeString(prefix);
  if (!normalizedPrefix) {
    throw new Error("Prefixe localId obligatoire.");
  }
  return `${normalizedPrefix}_${generateUuidFragment()}`;
}

export function createLocalClientId() {
  return createLocalId(LOCAL_ID_PREFIXES.CLIENT);
}

export function createLocalCommandeId() {
  return createLocalId(LOCAL_ID_PREFIXES.COMMANDE);
}

export function createLocalRetoucheId() {
  return createLocalId(LOCAL_ID_PREFIXES.RETOUCHE);
}

export function createLocalImageId() {
  return createLocalId(LOCAL_ID_PREFIXES.IMAGE);
}

export function isLocalEntityId(value) {
  return normalizeString(value).startsWith("loc_");
}

export function isServerCacheEntityId(value) {
  return normalizeString(value).startsWith("cache_");
}

export function isOfflineEntityId(value) {
  return isLocalEntityId(value) || isServerCacheEntityId(value);
}
