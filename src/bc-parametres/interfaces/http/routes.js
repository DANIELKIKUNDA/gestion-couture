import express from "express";
import { AtelierParametresRepoPg } from "../../infrastructure/repositories/atelier-parametres-repo-pg.js";
import { getParametresAtelier } from "../../application/use-cases/get-parametres.js";
import { saveParametresAtelier } from "../../application/use-cases/save-parametres.js";
import { CommandeRepoPg } from "../../../bc-commandes/infrastructure/repositories/commande-repo-pg.js";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";

const router = express.Router();
const repo = new AtelierParametresRepoPg();
const commandeRepo = new CommandeRepoPg();

router.get("/parametres-atelier", requirePermission(PERMISSIONS.MODIFIER_PARAMETRES), async (req, res) => {
  try {
    const current = await getParametresAtelier({ repo });
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

router.get("/parametres-atelier/policy", requirePermission(PERMISSIONS.MODIFIER_PARAMETRES), async (req, res) => {
  try {
    const current = await getParametresAtelier({ repo });
    res.json(current?.payload || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/parametres-atelier", requirePermission(PERMISSIONS.MODIFIER_PARAMETRES), async (req, res) => {
  try {
    const payload = req.body?.payload;
    const updatedBy = req.body?.updatedBy || null;
    const expectedVersion = req.body?.expectedVersion ?? payload?.meta?.version ?? null;
    const saved = await saveParametresAtelier({ repo, payload, updatedBy, expectedVersion, commandeRepo });
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
