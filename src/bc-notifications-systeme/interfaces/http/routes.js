import express from "express";
import { z } from "zod";

import { validateSchema } from "../../../shared/interfaces/validation.js";
import { requireSystemManager } from "../../../bc-auth/interfaces/http/middlewares/require-system-manager.js";
import { envoyerNotificationSysteme } from "../../application/use-cases/envoyer-notification-systeme.js";
import { listerNotificationsSysteme } from "../../application/use-cases/lister-notifications-systeme.js";
import { listerContactsAteliers } from "../../application/use-cases/lister-contacts-ateliers.js";
import { listerNotificationsPourAtelier } from "../../application/use-cases/lister-notifications-pour-atelier.js";
import { compterNotificationsNonLues } from "../../application/use-cases/compter-notifications-non-lues.js";
import { marquerNotificationCommeLue } from "../../application/use-cases/marquer-notification-comme-lue.js";
import { NotificationSystemeRepoPg } from "../../infrastructure/repositories/notification-systeme-repo-pg.js";
import { AtelierContactQueryPg } from "../../infrastructure/repositories/atelier-contact-query-pg.js";
import { NotificationLectureRepoPg } from "../../infrastructure/repositories/notification-lecture-repo-pg.js";

const router = express.Router();
const notificationRepo = new NotificationSystemeRepoPg();
const atelierContactQuery = new AtelierContactQueryPg();
const notificationLectureRepo = new NotificationLectureRepoPg();

function mapNotification(notification) {
  return {
    idNotification: notification.idNotification,
    portee: notification.portee,
    atelierId: notification.atelierId || null,
    titre: notification.titre,
    message: notification.message,
    canal: notification.canal,
    statut: notification.statut,
    creeParUserId: notification.creeParUserId,
    creeParNom: notification.creeParNom,
    dateCreation: notification.dateCreation || null,
    dateEnvoi: notification.dateEnvoi || null
  };
}

function mapAtelierNotification(entry) {
  return {
    ...mapNotification(entry.notification),
    estLue: Boolean(entry.estLue),
    luAt: entry.luAt || null
  };
}

function resolveAtelierNotificationAccess(req) {
  const role = String(req.auth?.roleId || req.auth?.role || "").trim().toUpperCase();
  const atelierId = String(req.auth?.atelierId || "").trim();
  if (!atelierId || role === "MANAGER_SYSTEME") return null;
  return atelierId;
}

router.get("/system/notifications", requireSystemManager, async (_req, res) => {
  try {
    const notifications = await listerNotificationsSysteme({ notificationRepo });
    res.json({
      items: notifications.map(mapNotification)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/notifications", requireSystemManager, async (req, res) => {
  try {
    const schema = z
      .object({
        portee: z.enum(["GLOBAL", "ATELIER"]),
        atelierId: z.string().trim().optional().nullable(),
        titre: z.string().trim().min(1),
        message: z.string().trim().min(1)
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const notification = await envoyerNotificationSysteme({
      notificationRepo,
      atelierContactQuery,
      input: parsed.data,
      actor: {
        id: req.auth?.utilisateurId || "",
        nom: req.auth?.nom || req.auth?.email || "Manager systeme"
      }
    });

    res.status(201).json({
      notification: mapNotification(notification)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/system/ateliers/contacts", requireSystemManager, async (req, res) => {
  try {
    const schema = z
      .object({
        search: z.string().trim().optional(),
        atelierId: z.string().trim().optional(),
        includeInactive: z
          .union([z.boolean(), z.enum(["true", "false"])])
          .optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.query || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const contacts = await listerContactsAteliers({
      atelierContactQuery,
      input: {
        search: parsed.data.search || "",
        atelierId: parsed.data.atelierId || null,
        includeInactive: parsed.data.includeInactive === true || parsed.data.includeInactive === "true"
      }
    });

    res.json({
      items: contacts
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const atelierId = resolveAtelierNotificationAccess(req);
    if (!atelierId) return res.status(403).json({ error: "Acces non autorise" });

    const notifications = await listerNotificationsPourAtelier({
      notificationLectureRepo,
      atelierId
    });

    res.json({
      items: notifications.map(mapAtelierNotification)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/notifications/unread-count", async (req, res) => {
  try {
    const atelierId = resolveAtelierNotificationAccess(req);
    if (!atelierId) return res.status(403).json({ error: "Acces non autorise" });

    const total = await compterNotificationsNonLues({
      notificationLectureRepo,
      atelierId
    });

    res.json({ total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const atelierId = resolveAtelierNotificationAccess(req);
    if (!atelierId) return res.status(403).json({ error: "Acces non autorise" });

    const schema = z.object({
      id: z.string().trim().min(1)
    });
    const parsed = validateSchema(schema, req.params || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const result = await marquerNotificationCommeLue({
      notificationLectureRepo,
      notificationRepo,
      notificationId: parsed.data.id,
      atelierId,
      luParUserId: req.auth?.utilisateurId || null
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
