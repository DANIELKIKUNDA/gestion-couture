import { pool } from "../../../shared/infrastructure/db.js";
import { AtelierRepoPg } from "../../../shared/infrastructure/repositories/atelier-repo-pg.js";
import { ROLES } from "../../../bc-auth/domain/roles.js";
import { buildDefaultAtelierParametresPayload } from "../../domain/default-parametres.js";
import { AtelierParametresRepoPg } from "../../infrastructure/repositories/atelier-parametres-repo-pg.js";
import { saveParametresAtelier } from "./save-parametres.js";

export class AtelierLogoForbiddenError extends Error {
  constructor(message = "Acces refuse") {
    super(message);
    this.name = "AtelierLogoForbiddenError";
    this.statusCode = 403;
  }
}

export class AtelierLogoValidationError extends Error {
  constructor(message = "Logo invalide") {
    super(message);
    this.name = "AtelierLogoValidationError";
    this.statusCode = 400;
  }
}

export class AtelierLogoNotFoundError extends Error {
  constructor(message = "Atelier introuvable") {
    super(message);
    this.name = "AtelierLogoNotFoundError";
    this.statusCode = 404;
  }
}

function cloneJson(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function buildUpdatedPayload(currentPayload, atelier, logoUrl) {
  const payload =
    cloneJson(currentPayload) ||
    buildDefaultAtelierParametresPayload({
      nomAtelier: atelier?.nom || "Atelier"
    });
  if (!payload.identite || typeof payload.identite !== "object") {
    payload.identite = {};
  }
  if (!payload.meta || typeof payload.meta !== "object") {
    payload.meta = { version: 1, lastSavedAt: "" };
  }
  payload.identite.nomAtelier = String(payload.identite.nomAtelier || atelier?.nom || "Atelier").trim() || "Atelier";
  payload.identite.logoUrl = String(logoUrl || "").trim();
  payload.meta.lastSavedAt = new Date().toISOString();
  return payload;
}

function assertActorCanUploadLogo(actor, atelierId) {
  const actorRole = String(actor?.roleId || actor?.role || "").trim().toUpperCase();
  const actorAtelierId = String(actor?.atelierId || "").trim();
  const targetAtelierId = String(atelierId || "").trim();
  if (!targetAtelierId) {
    throw new AtelierLogoValidationError("Atelier cible invalide.");
  }
  if (actorRole !== ROLES.PROPRIETAIRE) {
    throw new AtelierLogoForbiddenError("Seul le proprietaire de l'atelier peut modifier le logo.");
  }
  if (actorAtelierId !== targetAtelierId) {
    throw new AtelierLogoForbiddenError("Vous ne pouvez modifier que le logo de votre atelier.");
  }
}

export async function uploadLogoAtelier({
  atelierId,
  actor,
  file,
  storageService,
  atelierRepo = new AtelierRepoPg(),
  parametresRepo = new AtelierParametresRepoPg()
}) {
  assertActorCanUploadLogo(actor, atelierId);
  if (!file?.filename) {
    throw new AtelierLogoValidationError("Aucun fichier logo recu.");
  }
  if (!storageService || typeof storageService.buildPublicUrl !== "function") {
    throw new AtelierLogoValidationError("Stockage logo indisponible.");
  }

  const targetAtelierId = String(atelierId || "").trim();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const txAtelierRepo = atelierRepo instanceof AtelierRepoPg ? new AtelierRepoPg(db) : atelierRepo;
    const txParametresRepo =
      parametresRepo && typeof parametresRepo.forAtelier === "function"
        ? parametresRepo.forAtelier(targetAtelierId, db)
        : new AtelierParametresRepoPg(targetAtelierId, db);
    const atelier = await txAtelierRepo.getById(targetAtelierId);
    if (!atelier) throw new AtelierLogoNotFoundError("Atelier introuvable.");
    const current = await txParametresRepo.getCurrent();
    const previousLogoUrl = String(current?.payload?.identite?.logoUrl || atelier?.logoUrl || "").trim();
    const logoUrl = storageService.buildPublicUrl(file.filename);
    const nextPayload = buildUpdatedPayload(current?.payload, atelier, logoUrl);
    const savedParametres = await saveParametresAtelier({
      repo: txParametresRepo,
      payload: nextPayload,
      updatedBy: actor?.utilisateurId || actor?.email || actor?.roleId || "proprietaire",
      expectedVersion: current?.version ?? null
    });
    await txAtelierRepo.setLogoUrl(targetAtelierId, logoUrl);
    await db.query("COMMIT");
    if (previousLogoUrl && previousLogoUrl !== logoUrl) {
      await storageService.deletePreviousLogo(previousLogoUrl);
    }
    return {
      success: true,
      logoUrl,
      payload: savedParametres?.payload || nextPayload,
      version: Number(savedParametres?.version || current?.version || 1)
    };
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    await storageService.deleteUploadedFile(file);
    throw err;
  } finally {
    db.release();
  }
}
