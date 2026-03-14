import fs from "node:fs/promises";
import path from "node:path";

function normalizeSegment(value, fallback = "unknown") {
  const normalized = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_");
  return normalized || fallback;
}

function normalizeStoredPath(value) {
  return String(value || "").split(path.sep).join("/");
}

function resolveRootDir() {
  return path.resolve(process.cwd(), process.env.MEDIA_STORAGE_ROOT || "./storage");
}

function resolveTempRootDir() {
  return path.resolve(process.cwd(), process.env.MEDIA_TEMP_ROOT || "./storage/tmp");
}

export class CommandeMediaStorageLocal {
  get rootDir() {
    return resolveRootDir();
  }

  get tempRootDir() {
    return resolveTempRootDir();
  }

  buildTempRequestDir(atelierId, requestId) {
    return path.join(this.tempRootDir, "commandes", normalizeSegment(atelierId, "ATELIER"), normalizeSegment(requestId, "request"));
  }

  async ensureTempRequestDir(atelierId, requestId) {
    const tempDir = this.buildTempRequestDir(atelierId, requestId);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  buildMediaDir(atelierId, idCommande, idMedia) {
    return path.join(
      this.rootDir,
      "ateliers",
      normalizeSegment(atelierId, "ATELIER"),
      "commandes",
      normalizeSegment(idCommande, "commande"),
      normalizeSegment(idMedia, "media")
    );
  }

  async finalizeProcessedMedia({ atelierId, idCommande, idMedia, originalTempPath, thumbTempPath }) {
    const mediaDir = this.buildMediaDir(atelierId, idCommande, idMedia);
    await fs.mkdir(mediaDir, { recursive: true });
    const originalFinalPath = path.join(mediaDir, "original.webp");
    const thumbFinalPath = path.join(mediaDir, "thumb.webp");
    await fs.rename(originalTempPath, originalFinalPath);
    await fs.rename(thumbTempPath, thumbFinalPath);
    return {
      mediaDir,
      cheminOriginal: normalizeStoredPath(path.relative(this.rootDir, originalFinalPath)),
      cheminThumbnail: normalizeStoredPath(path.relative(this.rootDir, thumbFinalPath))
    };
  }

  resolveStoredPath(relativePath) {
    const safeRelativePath = normalizeStoredPath(relativePath);
    const absolutePath = path.resolve(this.rootDir, safeRelativePath);
    const normalizedRoot = path.resolve(this.rootDir);
    if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error("Chemin media invalide");
    }
    return absolutePath;
  }

  async deleteStoredMedia(media) {
    const originalPath = this.resolveStoredPath(media?.cheminOriginal || media?.chemin_original || "");
    const mediaDir = path.dirname(originalPath);
    await fs.rm(mediaDir, { recursive: true, force: true });
  }

  async cleanupTempDir(tempDir) {
    if (!tempDir) return;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
