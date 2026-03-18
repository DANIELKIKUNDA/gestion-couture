import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const ALLOWED_ATELIER_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
export const ATELIER_LOGO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATELIER_LOGO_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function normalizeStoredPath(value) {
  return String(value || "").split(path.sep).join("/");
}

function resolveRootDir() {
  return path.resolve(process.cwd(), process.env.MEDIA_STORAGE_ROOT || "./storage");
}

function resolveExtension(originalName, mimeType) {
  const name = String(originalName || "").trim().toLowerCase();
  const mime = String(mimeType || "").trim().toLowerCase();
  if (mime === "image/png" || name.endsWith(".png")) return ".png";
  if (mime === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return ".jpg";
  return "";
}

function getOriginalExtension(originalName = "") {
  return path.extname(String(originalName || "").trim().toLowerCase());
}

function isSuspiciousOriginalName(originalName = "") {
  const value = String(originalName || "").trim();
  if (!value) return true;
  if (value !== path.basename(value)) return true;
  if (/[\0\r\n]/.test(value)) return true;
  return false;
}

export function validateAtelierLogoFile(file = {}) {
  const mimeType = String(file.mimetype || "").trim().toLowerCase();
  const originalName = String(file.originalname || "").trim();
  const extension = getOriginalExtension(originalName);

  if (isSuspiciousOriginalName(originalName)) {
    throw new Error("Nom de fichier logo suspect.");
  }
  if (!ALLOWED_ATELIER_LOGO_MIME_TYPES.has(mimeType)) {
    throw new Error("Le logo doit etre une image PNG ou JPG.");
  }
  if (!ALLOWED_ATELIER_LOGO_EXTENSIONS.has(extension)) {
    throw new Error("Extension de logo non supportee.");
  }
  if (mimeType === "image/png" && extension !== ".png") {
    throw new Error("Le type PNG doit utiliser l'extension .png.");
  }
  if (mimeType === "image/jpeg" && extension !== ".jpg" && extension !== ".jpeg") {
    throw new Error("Le type JPG doit utiliser l'extension .jpg ou .jpeg.");
  }
}

export class AtelierLogoStorageLocal {
  get rootDir() {
    return resolveRootDir();
  }

  get logoDir() {
    return path.join(this.rootDir, "ateliers");
  }

  async ensureLogoDir() {
    await fs.mkdir(this.logoDir, { recursive: true });
    return this.logoDir;
  }

  generateFileName(file = {}) {
    validateAtelierLogoFile(file);
    const extension = resolveExtension(file.originalname, file.mimetype);
    if (!extension) throw new Error("Le logo doit etre une image PNG ou JPG.");
    return `logo-${Date.now()}-${randomUUID()}${extension}`;
  }

  buildStoredRelativePath(fileName = "") {
    return normalizeStoredPath(path.join("ateliers", String(fileName || "").trim()));
  }

  buildPublicUrl(fileName = "") {
    return `/media/${this.buildStoredRelativePath(fileName)}`;
  }

  resolvePublicUrlToAbsolutePath(logoUrl = "") {
    const value = String(logoUrl || "").trim();
    if (!value.startsWith("/media/")) return null;
    const relativePath = value.slice("/media/".length);
    if (!relativePath.startsWith("ateliers/")) return null;
    const absolutePath = path.resolve(this.rootDir, relativePath);
    const normalizedRoot = path.resolve(this.rootDir);
    if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error("Chemin logo invalide");
    }
    return absolutePath;
  }

  async deleteUploadedFile(file) {
    const filePath = String(file?.path || "").trim();
    if (!filePath) return;
    await fs.rm(filePath, { force: true }).catch(() => {});
  }

  async deletePreviousLogo(logoUrl = "") {
    const absolutePath = this.resolvePublicUrlToAbsolutePath(logoUrl);
    if (!absolutePath) return;
    await fs.rm(absolutePath, { force: true }).catch(() => {});
  }
}
