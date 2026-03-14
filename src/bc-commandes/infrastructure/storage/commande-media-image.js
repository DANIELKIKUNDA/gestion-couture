import path from "node:path";
import sharp from "sharp";

export const ALLOWED_COMMANDE_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export const ALLOWED_COMMANDE_MEDIA_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

export const COMMANDE_MEDIA_MAX_FILE_SIZE_BYTES = Number(process.env.MEDIA_MAX_FILE_SIZE_BYTES || 5 * 1024 * 1024);
const COMMANDE_MEDIA_ORIGINAL_MAX_WIDTH = Number(process.env.MEDIA_ORIGINAL_MAX_WIDTH || 1800);
const COMMANDE_MEDIA_ORIGINAL_MAX_HEIGHT = Number(process.env.MEDIA_ORIGINAL_MAX_HEIGHT || 1800);
const COMMANDE_MEDIA_THUMB_MAX_WIDTH = Number(process.env.MEDIA_THUMB_MAX_WIDTH || 420);
const COMMANDE_MEDIA_THUMB_MAX_HEIGHT = Number(process.env.MEDIA_THUMB_MAX_HEIGHT || 420);
const COMMANDE_MEDIA_WEBP_QUALITY = Number(process.env.MEDIA_WEBP_QUALITY || 82);
const COMMANDE_MEDIA_THUMB_WEBP_QUALITY = Number(process.env.MEDIA_THUMB_WEBP_QUALITY || 74);

export function isAllowedCommandeMediaExtension(value) {
  return ALLOWED_COMMANDE_MEDIA_EXTENSIONS.has(String(value || "").trim().toLowerCase());
}

export function isAllowedCommandeMediaMimeType(value) {
  return ALLOWED_COMMANDE_MEDIA_MIME_TYPES.has(String(value || "").trim().toLowerCase());
}

export function resolveCommandeMediaUploadExtension(originalName = "", mimeType = "") {
  const fileExtension = path.extname(String(originalName || "")).trim().toLowerCase();
  if (isAllowedCommandeMediaExtension(fileExtension)) return fileExtension;
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
  if (normalizedMimeType === "image/jpeg") return ".jpg";
  if (normalizedMimeType === "image/png") return ".png";
  if (normalizedMimeType === "image/webp") return ".webp";
  return "";
}

export async function processCommandeMediaImage({ inputPath, tempDir }) {
  const metadata = await sharp(inputPath, { failOn: "error" }).metadata();
  const format = String(metadata.format || "").trim().toLowerCase();
  if (!["jpeg", "png", "webp"].includes(format)) {
    throw new Error("Format image non supporte");
  }

  const originalTempPath = path.join(tempDir, "original.webp");
  const thumbTempPath = path.join(tempDir, "thumb.webp");

  await sharp(inputPath, { failOn: "error" })
    .rotate()
    .resize({
      width: COMMANDE_MEDIA_ORIGINAL_MAX_WIDTH,
      height: COMMANDE_MEDIA_ORIGINAL_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: COMMANDE_MEDIA_WEBP_QUALITY })
    .toFile(originalTempPath);

  await sharp(inputPath, { failOn: "error" })
    .rotate()
    .resize({
      width: COMMANDE_MEDIA_THUMB_MAX_WIDTH,
      height: COMMANDE_MEDIA_THUMB_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: COMMANDE_MEDIA_THUMB_WEBP_QUALITY })
    .toFile(thumbTempPath);

  return {
    originalTempPath,
    thumbTempPath,
    width: metadata.width ? Number(metadata.width) : null,
    height: metadata.height ? Number(metadata.height) : null,
    mimeType: format === "jpeg" ? "image/jpeg" : `image/${format}`,
    extensionStockage: "webp"
  };
}
