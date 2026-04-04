import "dotenv/config";
import { CaisseRepoPg } from "../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { BilanCaisseRepoPg } from "../../bc-caisse/infrastructure/repositories/bilan-caisse-repo-pg.js";
import { AtelierParametresRepoPg } from "../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { executerAutomationsCaisse } from "../../bc-caisse/application/services/automations-caisse.js";
import { AtelierRepoPg } from "../../shared/infrastructure/repositories/atelier-repo-pg.js";
import { pool } from "../../shared/infrastructure/db.js";
import { createApp } from "./app.js";

async function autoRepairLegacyRetouchesConstraint() {
  await pool.query(`
    DO $$
    DECLARE
      constraint_row RECORD;
    BEGIN
      FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.retouches'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%type_retouche%'
      LOOP
        EXECUTE format('ALTER TABLE public.retouches DROP CONSTRAINT %I', constraint_row.conname);
      END LOOP;
    END $$;
  `);
}

try {
  await autoRepairLegacyRetouchesConstraint();
} catch (err) {
  console.warn("Retouches legacy constraint auto-repair skipped:", err?.message || err);
}

const app = createApp();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});

const caisseRepo = new CaisseRepoPg();
const bilanRepo = new BilanCaisseRepoPg();
const parametresRepo = new AtelierParametresRepoPg();
const atelierRepo = new AtelierRepoPg();
let autoJobRunning = false;

function normalizeAtelierId(value) {
  return String(value || "").trim();
}

async function runCaisseAutomationsForAtelier(atelierId) {
  const scopedAtelierId = normalizeAtelierId(atelierId) || "ATELIER";
  await executerAutomationsCaisse({
    atelierId: scopedAtelierId,
    caisseRepo: caisseRepo.forAtelier(scopedAtelierId),
    bilanRepo: bilanRepo.forAtelier(scopedAtelierId),
    parametresRepo: parametresRepo.forAtelier(scopedAtelierId)
  });
}

async function runCaisseAutomationsForAllAteliers() {
  const ateliers = await atelierRepo.listAll();
  const actifs = (ateliers || []).filter((atelier) => atelier?.actif !== false);

  if (actifs.length === 0) {
    console.warn("[AUTO-CAISSE] aucun atelier actif trouve, fallback sur ATELIER");
    await runCaisseAutomationsForAtelier("ATELIER");
    return;
  }

  for (const atelier of actifs) {
    const atelierId = normalizeAtelierId(atelier?.idAtelier);
    if (!atelierId) {
      console.warn("[AUTO-CAISSE] atelier ignore: idAtelier manquant");
      continue;
    }

    console.log(`[AUTO-CAISSE] traitement atelier=${atelierId} nom=${String(atelier?.nom || "").trim() || "-"}`);
    try {
      await runCaisseAutomationsForAtelier(atelierId);
    } catch (err) {
      console.error(`[AUTO-CAISSE] erreur atelier=${atelierId}:`, err?.message || err);
    }
  }
}

setInterval(async () => {
  if (autoJobRunning) return;
  autoJobRunning = true;
  try {
    await runCaisseAutomationsForAllAteliers();
  } catch (err) {
    console.error("Automations caisse erreur:", err.message);
  } finally {
    autoJobRunning = false;
  }
}, 60_000);
