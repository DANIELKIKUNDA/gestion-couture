import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "../../bc-auth/interfaces/http/routes.js";
import { authGuard } from "../../bc-auth/interfaces/http/middlewares/auth-guard.js";
import { requireAuth } from "../../bc-auth/interfaces/http/middlewares/auth-guard.js";
import { securityPolicy } from "../../bc-auth/interfaces/http/middlewares/security-policy.js";
import commandesRoutes from "../../bc-commandes/interfaces/http/routes.js";
import retouchesRoutes from "../../bc-retouches/interfaces/http/routes.js";
import clientsRoutes from "../../bc-clients/interfaces/http/routes.js";
import stockRoutes from "../../bc-stock/interfaces/http/routes.js";
import caisseRoutes from "../../bc-caisse/interfaces/http/routes.js";
import facturationRoutes from "../../bc-facturation/interfaces/http/routes.js";
import parametresRoutes from "../../bc-parametres/interfaces/http/routes.js";

const IS_PROD = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

function resolveCorsOptions() {
  if (!IS_PROD) {
    return { origin: true, credentials: true };
  }

  const configuredOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS requis en production");
  }

  const allowedOrigins = new Set(configuredOrigins);
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origine CORS non autorisee"));
    }
  };
}

function resolveMediaStorageRoot() {
  return path.resolve(process.cwd(), process.env.MEDIA_STORAGE_ROOT || "./storage");
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors(resolveCorsOptions()));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.use("/media", express.static(resolveMediaStorageRoot()));
  app.use(authGuard);
  app.use(securityPolicy);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "atelier-backend" });
  });

  app.use("/api", authRoutes);
  app.use("/api", requireAuth, commandesRoutes);
  app.use("/api", requireAuth, retouchesRoutes);
  app.use("/api", requireAuth, clientsRoutes);
  app.use("/api", requireAuth, stockRoutes);
  app.use("/api", requireAuth, caisseRoutes);
  app.use("/api", requireAuth, facturationRoutes);
  app.use("/api", requireAuth, parametresRoutes);

  app.use((err, _req, res, _next) => {
    const message = err?.message || "Erreur serveur";
    res.status(500).json({ error: message });
  });

  return app;
}
