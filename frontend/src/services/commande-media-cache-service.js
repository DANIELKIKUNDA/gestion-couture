import { TABLE_NAMES, offlineDb } from "./local-db.js";

export const COMMANDE_MEDIA_CACHE_VARIANTS = Object.freeze({
  THUMBNAIL: "thumbnail",
  ORIGINAL: "original"
});

const CACHE_SOURCE = Object.freeze({
  SERVER: "server",
  OFFLINE_UPLOAD: "offline-upload"
});

const MAX_CACHE_BYTES = 120 * 1024 * 1024;
const MAX_CACHE_ROWS = 600;

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function normalizeVariant(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === COMMANDE_MEDIA_CACHE_VARIANTS.ORIGINAL) return COMMANDE_MEDIA_CACHE_VARIANTS.ORIGINAL;
  return COMMANDE_MEDIA_CACHE_VARIANTS.THUMBNAIL;
}

function normalizeBlob(value) {
  return value instanceof Blob ? value : null;
}

function buildCacheKey({ atelierId, idCommande, idMedia, variant }) {
  return [
    normalizeString(atelierId),
    normalizeString(idCommande),
    normalizeString(idMedia),
    normalizeVariant(variant)
  ].join("::");
}

function table() {
  return offlineDb.table(TABLE_NAMES.COMMANDE_MEDIA_CACHE);
}

function canUseCache({ atelierId, idCommande, idMedia }) {
  return Boolean(normalizeString(atelierId) && normalizeString(idCommande) && normalizeString(idMedia));
}

async function trimCommandeMediaCache(atelierId) {
  const scopedAtelierId = normalizeString(atelierId);
  if (!scopedAtelierId) return;

  const rows = await table().where("atelierId").equals(scopedAtelierId).toArray();
  if (rows.length <= MAX_CACHE_ROWS) {
    const totalBytes = rows.reduce((sum, row) => sum + Number(row?.byteSize || 0), 0);
    if (totalBytes <= MAX_CACHE_BYTES) return;
  }

  const ordered = rows.sort((left, right) =>
    String(left?.lastAccessedAt || left?.cachedAt || "").localeCompare(String(right?.lastAccessedAt || right?.cachedAt || ""))
  );
  let totalBytes = ordered.reduce((sum, row) => sum + Number(row?.byteSize || 0), 0);
  let rowCount = ordered.length;

  for (const row of ordered) {
    if (rowCount <= MAX_CACHE_ROWS && totalBytes <= MAX_CACHE_BYTES) break;
    await table().delete(row.cacheKey);
    totalBytes -= Number(row?.byteSize || 0);
    rowCount -= 1;
  }
}

export async function getCachedCommandeMediaBlob({ atelierId, idCommande, idMedia, variant } = {}) {
  if (!canUseCache({ atelierId, idCommande, idMedia })) return null;
  const cacheKey = buildCacheKey({ atelierId, idCommande, idMedia, variant });
  const record = await table().get(cacheKey);
  const blob = normalizeBlob(record?.blob);
  if (!blob) return null;
  await table().update(cacheKey, { lastAccessedAt: nowIso() });
  return blob;
}

export async function cacheCommandeMediaBlob({
  atelierId,
  idCommande,
  idMedia,
  variant = COMMANDE_MEDIA_CACHE_VARIANTS.THUMBNAIL,
  blob,
  mimeType = "",
  source = CACHE_SOURCE.SERVER
} = {}) {
  const mediaBlob = normalizeBlob(blob);
  if (!mediaBlob || !canUseCache({ atelierId, idCommande, idMedia })) return null;

  const timestamp = nowIso();
  const normalizedVariant = normalizeVariant(variant);
  const record = {
    cacheKey: buildCacheKey({ atelierId, idCommande, idMedia, variant: normalizedVariant }),
    atelierId: normalizeString(atelierId),
    idCommande: normalizeString(idCommande),
    idMedia: normalizeString(idMedia),
    variant: normalizedVariant,
    blob: mediaBlob,
    mimeType: normalizeString(mimeType || mediaBlob.type || "image/webp"),
    byteSize: Number(mediaBlob.size || 0),
    source: normalizeString(source || CACHE_SOURCE.SERVER),
    cachedAt: timestamp,
    lastAccessedAt: timestamp
  };

  await table().put(record);
  trimCommandeMediaCache(record.atelierId).catch(() => {});
  return record;
}

export async function getOrFetchCommandeMediaBlob({
  atelierId,
  idCommande,
  idMedia,
  variant = COMMANDE_MEDIA_CACHE_VARIANTS.THUMBNAIL,
  canFetch = false,
  fetchBlob
} = {}) {
  const cached = await getCachedCommandeMediaBlob({ atelierId, idCommande, idMedia, variant });
  if (cached) {
    return {
      blob: cached,
      source: "cache"
    };
  }

  if (!canFetch || typeof fetchBlob !== "function") {
    return {
      blob: null,
      source: "missing"
    };
  }

  const fetched = normalizeBlob(await fetchBlob());
  if (!fetched) {
    return {
      blob: null,
      source: "missing"
    };
  }

  await cacheCommandeMediaBlob({
    atelierId,
    idCommande,
    idMedia,
    variant,
    blob: fetched,
    mimeType: fetched.type,
    source: CACHE_SOURCE.SERVER
  });

  return {
    blob: fetched,
    source: "network"
  };
}

export async function cacheSyncedCommandePhotoBlob({ atelierId, localRecord, serverPayload, references } = {}) {
  const blob = normalizeBlob(localRecord?.blob);
  const idCommande =
    normalizeString(references?.commandeServerId) ||
    normalizeString(serverPayload?.idCommande || serverPayload?.id_commande || localRecord?.idCommandeServerId);
  const idMedia = normalizeString(serverPayload?.idMedia || serverPayload?.id_media || serverPayload?.id || localRecord?.serverId);
  if (!blob || !canUseCache({ atelierId, idCommande, idMedia })) return null;

  return cacheCommandeMediaBlob({
    atelierId,
    idCommande,
    idMedia,
    variant: COMMANDE_MEDIA_CACHE_VARIANTS.ORIGINAL,
    blob,
    mimeType: localRecord?.mimeType || blob.type,
    source: CACHE_SOURCE.OFFLINE_UPLOAD
  });
}

export async function deleteCommandeMediaCache({ atelierId, idCommande, idMedia } = {}) {
  if (!canUseCache({ atelierId, idCommande, idMedia })) return 0;
  const rows = await table()
    .where("[atelierId+idMedia]")
    .equals([normalizeString(atelierId), normalizeString(idMedia)])
    .toArray();
  const matchingRows = rows.filter((row) => normalizeString(row?.idCommande) === normalizeString(idCommande));
  await Promise.all(matchingRows.map((row) => table().delete(row.cacheKey)));
  return matchingRows.length;
}
