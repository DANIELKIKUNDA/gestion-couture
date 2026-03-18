import multer from "multer";
import {
  AtelierLogoStorageLocal,
  ALLOWED_ATELIER_LOGO_MIME_TYPES,
  ATELIER_LOGO_MAX_FILE_SIZE_BYTES,
  validateAtelierLogoFile
} from "../../infrastructure/storage/atelier-logo-storage-local.js";

const storageService = new AtelierLogoStorageLocal();

const diskStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    storageService.ensureLogoDir()
      .then((dir) => callback(null, dir))
      .catch((err) => callback(err));
  },
  filename(_req, file, callback) {
    try {
      callback(null, storageService.generateFileName(file));
    } catch (err) {
      callback(err);
    }
  }
});

function fileFilter(_req, file, callback) {
  try {
    const mimeType = String(file?.mimetype || "").trim().toLowerCase();
    if (!ALLOWED_ATELIER_LOGO_MIME_TYPES.has(mimeType)) {
      callback(new Error("Le logo doit etre une image PNG ou JPG."));
      return;
    }
    validateAtelierLogoFile(file);
    callback(null, true);
  } catch (err) {
    callback(err);
  }
}

const upload = multer({
  storage: diskStorage,
  limits: {
    files: 1,
    fileSize: ATELIER_LOGO_MAX_FILE_SIZE_BYTES
  },
  fileFilter
});

export function atelierLogoUploadSingle(fieldName = "logo") {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Le logo ne doit pas depasser 2 MB." });
      }
      return res.status(400).json({ error: err?.message || "Upload logo invalide." });
    });
  };
}
