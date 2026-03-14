import fs from "node:fs/promises";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { CommandeMediaStorageLocal } from "../../infrastructure/storage/commande-media-storage-local.js";
import {
  ALLOWED_COMMANDE_MEDIA_MIME_TYPES,
  COMMANDE_MEDIA_MAX_FILE_SIZE_BYTES,
  resolveCommandeMediaUploadExtension
} from "../../infrastructure/storage/commande-media-image.js";

const storageService = new CommandeMediaStorageLocal();

function atelierIdFromReq(req) {
  return String(req.auth?.atelierId || "ATELIER");
}

const diskStorage = multer.diskStorage({
  destination(req, _file, callback) {
    const requestId = randomUUID();
    storageService.ensureTempRequestDir(atelierIdFromReq(req), requestId)
      .then((tempDir) => {
        req.commandeMediaUpload = { requestId, tempDir };
        callback(null, tempDir);
      })
      .catch((err) => callback(err));
  },
  filename(_req, file, callback) {
    const extension = resolveCommandeMediaUploadExtension(file.originalname, file.mimetype) || ".img";
    callback(null, `upload-${randomUUID()}${extension}`);
  }
});

function fileFilter(_req, file, callback) {
  if (!ALLOWED_COMMANDE_MEDIA_MIME_TYPES.has(String(file.mimetype || "").trim().toLowerCase())) {
    callback(new Error("Format image non supporte"));
    return;
  }
  callback(null, true);
}

const upload = multer({
  storage: diskStorage,
  limits: {
    files: 1,
    fileSize: COMMANDE_MEDIA_MAX_FILE_SIZE_BYTES
  },
  fileFilter
});

export function commandeMediaUploadSingle(fieldName = "photo") {
  return upload.single(fieldName);
}

export async function cleanupCommandeMediaUpload(req) {
  const tempDir = req?.commandeMediaUpload?.tempDir || "";
  if (!tempDir) return;
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
}
