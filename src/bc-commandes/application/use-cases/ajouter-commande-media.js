import { randomUUID } from "node:crypto";
import { pool } from "../../../shared/infrastructure/db.js";

const MAX_MEDIA_PER_COMMANDE = Number(process.env.MEDIA_MAX_FILES_PER_COMMANDE || 3);

function normalizeNote(value) {
  const note = String(value || "").trim();
  if (!note) return "";
  return note.slice(0, 500);
}

function normalizeSourceType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "CAMERA") return "CAMERA";
  return "UPLOAD";
}

export async function ajouterCommandeMedia({
  atelierId,
  idCommande,
  idItem = "",
  fichierUpload,
  tempDir,
  acteur = null,
  mediaRepo,
  storage,
  processImage,
  note = "",
  sourceType = "UPLOAD"
}) {
  if (!fichierUpload?.path) throw new Error("Photo obligatoire");
  if (!tempDir) throw new Error("Dossier temporaire introuvable");

  let processed = null;
  let finalized = null;
  const client = await pool.connect();

  try {
    processed = await processImage({
      inputPath: fichierUpload.path,
      tempDir
    });

    await client.query("BEGIN");
    const commandeResult = await client.query(
      "SELECT id_commande FROM commandes WHERE atelier_id = $1 AND id_commande = $2 FOR UPDATE",
      [atelierId, idCommande]
    );
    if (commandeResult.rowCount === 0) {
      throw new Error("Commande introuvable");
    }

    const mediaScope = { idItem };
    const existing = await mediaRepo.listByCommande(idCommande, client, mediaScope);
    if (existing.length >= MAX_MEDIA_PER_COMMANDE) {
      throw new Error(`Maximum ${MAX_MEDIA_PER_COMMANDE} photo(s) autorise(es) par habit`);
    }

    const idMedia = randomUUID();
    finalized = await storage.finalizeProcessedMedia({
      atelierId,
      idCommande,
      idMedia,
      originalTempPath: processed.originalTempPath,
      thumbTempPath: processed.thumbTempPath
    });

    const isPrimary = existing.length === 0;
    if (isPrimary) {
      await mediaRepo.clearPrimaryForCommande(idCommande, client, mediaScope);
    }

    const created = await mediaRepo.insert(
      {
        idMedia,
        idCommande,
        idItem: idItem ? String(idItem).trim() : null,
        typeMedia: "IMAGE",
        sourceType: normalizeSourceType(sourceType),
        cheminOriginal: finalized.cheminOriginal,
        cheminThumbnail: finalized.cheminThumbnail,
        nomFichierOriginal: fichierUpload.originalname || "",
        mimeType: processed.mimeType || fichierUpload.mimetype || "image/webp",
        extensionStockage: processed.extensionStockage || "webp",
        tailleOriginaleBytes: Number(fichierUpload.size || 0),
        largeur: processed.width,
        hauteur: processed.height,
        note: normalizeNote(note),
        position: existing.length + 1,
        isPrimary,
        creePar: acteur?.utilisateurNom || acteur?.utilisateur || null
      },
      client
    );

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    if (finalized) {
      await storage.deleteStoredMedia({ cheminOriginal: finalized.cheminOriginal }).catch(() => {});
    }
    throw err;
  } finally {
    client.release();
    await storage.cleanupTempDir(tempDir).catch(() => {});
  }
}
