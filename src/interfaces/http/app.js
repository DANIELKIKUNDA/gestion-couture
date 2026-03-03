import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "../../bc-auth/interfaces/http/routes.js";
import { authGuard } from "../../bc-auth/interfaces/http/middlewares/auth-guard.js";
import { securityPolicy } from "../../bc-auth/interfaces/http/middlewares/security-policy.js";
import commandesRoutes from "../../bc-commandes/interfaces/http/routes.js";
import retouchesRoutes from "../../bc-retouches/interfaces/http/routes.js";
import clientsRoutes from "../../bc-clients/interfaces/http/routes.js";
import stockRoutes from "../../bc-stock/interfaces/http/routes.js";
import caisseRoutes from "../../bc-caisse/interfaces/http/routes.js";
import facturationRoutes from "../../bc-facturation/interfaces/http/routes.js";
import parametresRoutes from "../../bc-parametres/interfaces/http/routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.use(authGuard);
  app.use(securityPolicy);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "atelier-backend" });
  });

  app.use("/api", authRoutes);
  app.use("/api", commandesRoutes);
  app.use("/api", retouchesRoutes);
  app.use("/api", clientsRoutes);
  app.use("/api", stockRoutes);
  app.use("/api", caisseRoutes);
  app.use("/api", facturationRoutes);
  app.use("/api", parametresRoutes);

  app.use((err, _req, res, _next) => {
    const message = err?.message || "Erreur serveur";
    res.status(500).json({ error: message });
  });

  return app;
}
