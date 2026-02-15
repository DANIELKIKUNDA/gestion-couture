import express from "express";
import { AtelierParametresRepoPg } from "../../infrastructure/repositories/atelier-parametres-repo-pg.js";
import { getParametresAtelier } from "../../application/use-cases/get-parametres.js";
import { saveParametresAtelier } from "../../application/use-cases/save-parametres.js";

const router = express.Router();
const repo = new AtelierParametresRepoPg();

router.get("/parametres-atelier", async (req, res) => {
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

router.get("/parametres-atelier/policy", async (req, res) => {
  try {
    const current = await getParametresAtelier({ repo });
    res.json(current?.payload || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/parametres-atelier", async (req, res) => {
  try {
    const payload = req.body?.payload;
    const updatedBy = req.body?.updatedBy || null;
    const saved = await saveParametresAtelier({ repo, payload, updatedBy });
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
