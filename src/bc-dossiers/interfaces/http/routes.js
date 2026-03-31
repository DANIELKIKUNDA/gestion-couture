import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { z } from "zod";
import { DossierRepoPg } from "../../infrastructure/repositories/dossier-repo-pg.js";
import { ClientRepoPg } from "../../../bc-clients/infrastructure/repositories/client-repo-pg.js";
import { creerDossier } from "../../application/use-cases/creer-dossier.js";
import { resolveClientForCreation, serializeClientCreationConflict } from "../../../bc-clients/application/services/resolve-client-for-creation.js";
import { validateSchema } from "../../../shared/interfaces/validation.js";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { requireAnyPermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";
import { generateDossierId } from "../../../shared/domain/id-generator.js";

const router = express.Router();
const dossierRepo = new DossierRepoPg();
const clientRepo = new ClientRepoPg();

const requireDossierReadAccess = requireAnyPermission([
  PERMISSIONS.VOIR_CLIENTS,
  PERMISSIONS.VOIR_COMMANDES,
  PERMISSIONS.VOIR_RETOUCHES,
  PERMISSIONS.VOIR_BILANS_GLOBAUX,
  PERMISSIONS.CLOTURER_CAISSE
]);

const requireDossierCreateAccess = requireAnyPermission([
  PERMISSIONS.CREER_COMMANDE,
  PERMISSIONS.CREER_RETOUCHE,
  PERMISSIONS.CREER_CLIENT,
  PERMISSIONS.VOIR_BILANS_GLOBAUX,
  PERMISSIONS.CLOTURER_CAISSE
]);

function atelierIdFromReq(req) {
  return String(req.auth?.atelierId || "ATELIER");
}

function scopedDossierRepo(req) {
  return dossierRepo.forAtelier(atelierIdFromReq(req));
}

function scopedClientRepo(req) {
  return clientRepo.forAtelier(atelierIdFromReq(req));
}

function resolveActeur(req, fallback = null) {
  const utilisateurId = req.auth?.utilisateurId || null;
  const utilisateurNom = req.auth?.nom || String(fallback || "").trim() || null;
  const role = req.auth?.role || null;
  const utilisateur = utilisateurNom ? `${utilisateurNom}${role ? ` (${role})` : ""}` : null;
  return { utilisateurId, utilisateurNom, role, utilisateur };
}

async function lockDossierCreation(db, atelierId, idDossier) {
  const lockKey = `dossier:create:${String(atelierId || "").trim()}:${String(idDossier || "").trim()}`;
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
}

router.get("/dossiers", requireDossierReadAccess, async (req, res) => {
  try {
    const rows = await scopedDossierRepo(req).listSummaries();
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/dossiers/:id", requireDossierReadAccess, async (req, res) => {
  try {
    const detail = await scopedDossierRepo(req).getDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "Dossier introuvable" });
    res.json(detail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/dossiers", requireDossierCreateAccess, async (req, res) => {
  const schema = z
    .object({
      idDossier: z.string().min(1).optional(),
      idResponsableClient: z.string().min(1).optional(),
      idClient: z.string().min(1).optional(),
      nouveauResponsable: z
        .object({
          idClient: z.string().min(1).optional(),
          nom: z.string().min(1),
          prenom: z.string().min(1),
          telephone: z.string().optional().default("")
        })
        .optional(),
      nouveauClient: z
        .object({
          idClient: z.string().min(1).optional(),
          nom: z.string().min(1),
          prenom: z.string().min(1),
          telephone: z.string().optional().default("")
        })
        .optional(),
      doublonDecision: z
        .object({
          action: z.enum(["USE_EXISTING", "UPDATE_EXISTING_PHONE", "CONFIRM_NEW"]),
          idClient: z.string().min(1).optional()
        })
        .optional(),
      typeDossier: z.enum(["INDIVIDUEL", "FAMILLE", "GROUPE"]).optional(),
      notes: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;

  const responsableId = String(body.idResponsableClient || body.idClient || "").trim();
  const nouveauResponsable = body.nouveauResponsable || body.nouveauClient;
  const hasNewResponsable =
    Boolean(
      nouveauResponsable &&
        typeof nouveauResponsable === "object" &&
        (nouveauResponsable.idClient || nouveauResponsable.nom || nouveauResponsable.prenom || nouveauResponsable.telephone)
    );
  if (Boolean(responsableId) === hasNewResponsable) {
    return res.status(400).json({ error: "Fournissez soit idResponsableClient, soit nouveauResponsable." });
  }

  const dbClient = await pool.connect();
  try {
    const repo = scopedDossierRepo(req).withExecutor(dbClient);
    const clients = scopedClientRepo(req).withExecutor(dbClient);
    const acteur = resolveActeur(req);
    const atelierId = atelierIdFromReq(req);
    const requestedId = String(body.idDossier || "").trim() || generateDossierId();

    await dbClient.query("BEGIN");
    await lockDossierCreation(dbClient, atelierId, requestedId);
    const existing = await repo.getById(requestedId);
    if (existing) {
      await dbClient.query("COMMIT");
      return res.status(200).json(await repo.getDetail(requestedId));
    }

    const resolution = await resolveClientForCreation({
      idClient: responsableId,
      nouveauClient: nouveauResponsable,
      doublonDecision: body.doublonDecision,
      clientRepo: clients
    });

    const dossier = creerDossier({
      idDossier: requestedId,
      responsableClient: resolution.client,
      typeDossier: body.typeDossier || "INDIVIDUEL",
      notes: String(body.notes || "").trim(),
      creePar: acteur.utilisateur
    });

    await repo.save(dossier);
    await dbClient.query("COMMIT");

    const detail = await scopedDossierRepo(req).getDetail(dossier.idDossier);
    return res.status(201).json({
      dossier: detail,
      responsable: resolution.client,
      clientResolution: resolution.strategy
    });
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    if (Number(err?.status || 0) === 409) {
      return res.status(409).json(serializeClientCreationConflict(err));
    }
    if (Number(err?.status || 0) === 404) {
      return res.status(404).json({ code: String(err.code || "NOT_FOUND"), message: err.message });
    }
    res.status(400).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

export default router;
