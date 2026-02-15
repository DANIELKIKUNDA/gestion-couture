import "dotenv/config";
import express from "express";
import commandesRoutes from "../../bc-commandes/interfaces/http/routes.js";
import retouchesRoutes from "../../bc-retouches/interfaces/http/routes.js";
import caisseRoutes from "../../bc-caisse/interfaces/http/routes.js";
import clientsRoutes from "../../bc-clients/interfaces/http/routes.js";
import stockRoutes from "../../bc-stock/interfaces/http/routes.js";
import facturesRoutes from "../../bc-facturation/interfaces/http/routes.js";
import parametresRoutes from "../../bc-parametres/interfaces/http/routes.js";
import { CaisseRepoPg } from "../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { BilanCaisseRepoPg } from "../../bc-caisse/infrastructure/repositories/bilan-caisse-repo-pg.js";
import { executerAutomationsCaisse } from "../../bc-caisse/application/services/automations-caisse.js";

const app = express();
app.use(express.json());

app.use("/api", commandesRoutes);
app.use("/api", retouchesRoutes);
app.use("/api", caisseRoutes);
app.use("/api", clientsRoutes);
app.use("/api", stockRoutes);
app.use("/api", facturesRoutes);
app.use("/api", parametresRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});

const caisseRepo = new CaisseRepoPg();
const bilanRepo = new BilanCaisseRepoPg();
let autoJobRunning = false;

setInterval(async () => {
  if (autoJobRunning) return;
  autoJobRunning = true;
  try {
    await executerAutomationsCaisse({ caisseRepo, bilanRepo });
  } catch (err) {
    console.error("Automations caisse erreur:", err.message);
  } finally {
    autoJobRunning = false;
  }
}, 60_000);
