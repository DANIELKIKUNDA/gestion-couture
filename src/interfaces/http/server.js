import "dotenv/config";
import { CaisseRepoPg } from "../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { BilanCaisseRepoPg } from "../../bc-caisse/infrastructure/repositories/bilan-caisse-repo-pg.js";
import { AtelierParametresRepoPg } from "../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { executerAutomationsCaisse } from "../../bc-caisse/application/services/automations-caisse.js";
import { pool } from "../../shared/infrastructure/db.js";
import { createApp } from "./app.js";

async function autoRepairLegacyRetouchesConstraint() {
  await pool.query("ALTER TABLE retouches DROP CONSTRAINT IF EXISTS retouches_type_retouche_check");
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
let autoJobRunning = false;

setInterval(async () => {
  if (autoJobRunning) return;
  autoJobRunning = true;
  try {
    await executerAutomationsCaisse({ caisseRepo, bilanRepo, parametresRepo });
  } catch (err) {
    console.error("Automations caisse erreur:", err.message);
  } finally {
    autoJobRunning = false;
  }
}, 60_000);
