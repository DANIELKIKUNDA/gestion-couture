import express from "express";
import { AtelierParametresRepoPg } from "../../infrastructure/repositories/atelier-parametres-repo-pg.js";
import { getParametresAtelier, getRuntimeParametresAtelier } from "../../application/use-cases/get-parametres.js";
import { saveParametresAtelier } from "../../application/use-cases/save-parametres.js";
import { uploadLogoAtelier, AtelierLogoForbiddenError, AtelierLogoNotFoundError, AtelierLogoValidationError } from "../../application/use-cases/upload-logo-atelier.js";
import { atelierLogoUploadSingle } from "./atelier-logo-upload.js";
import { AtelierLogoStorageLocal } from "../../infrastructure/storage/atelier-logo-storage-local.js";
import { CommandeRepoPg } from "../../../bc-commandes/infrastructure/repositories/commande-repo-pg.js";
import { AtelierRepoPg } from "../../../shared/infrastructure/repositories/atelier-repo-pg.js";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";

const router = express.Router();
const repo = new AtelierParametresRepoPg();
const commandeRepo = new CommandeRepoPg();
const atelierRepo = new AtelierRepoPg();
const logoStorage = new AtelierLogoStorageLocal();

function atelierIdFromReq(req) {
  return String(req.auth?.atelierId || "ATELIER");
}

function scopedRepo(req) {
  return repo.forAtelier(atelierIdFromReq(req));
}

function scopedCommandeRepo(req) {
  return commandeRepo.forAtelier(atelierIdFromReq(req));
}

router.get("/parametres-atelier", requirePermission(PERMISSIONS.MODIFIER_PARAMETRES), async (req, res) => {
  try {
    const current = await getParametresAtelier({ repo: scopedRepo(req) });
    res.json(
      current || {
        payload: null,
        version: 1,
        updatedAt: null,
        updatedBy: null
      }
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/parametres-atelier/policy", async (req, res) => {
  try {
    const role = String(req.auth?.roleId || req.auth?.role || "").trim().toUpperCase();
    if (role === "MANAGER_SYSTEME") {
      return res.status(403).json({ error: "Acces non autorise" });
    }
    const current = await getRuntimeParametresAtelier({ repo: scopedRepo(req) });
    res.json(current);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/parametres-atelier", requirePermission(PERMISSIONS.MODIFIER_PARAMETRES), async (req, res) => {
  try {
    const payload = req.body?.payload;
    const updatedBy = req.body?.updatedBy || null;
    const expectedVersion = req.body?.expectedVersion ?? payload?.meta?.version ?? null;
    const saved = await saveParametresAtelier({
      repo: scopedRepo(req),
      payload,
      updatedBy,
      expectedVersion,
      commandeRepo: scopedCommandeRepo(req)
    });
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/ateliers/:id/logo", requirePermission(PERMISSIONS.MODIFIER_PARAMETRES), atelierLogoUploadSingle("logo"), async (req, res) => {
  try {
    const uploaded = await uploadLogoAtelier({
      atelierId: req.params.id,
      actor: req.auth,
      file: req.file,
      storageService: logoStorage,
      atelierRepo,
      parametresRepo: repo.forAtelier(req.params.id)
    });
    res.json({
      success: true,
      logoUrl: uploaded.logoUrl
    });
  } catch (err) {
    if (err instanceof AtelierLogoForbiddenError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof AtelierLogoNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof AtelierLogoValidationError) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err?.message || "Impossible de mettre a jour le logo." });
  }
});

export default router;
