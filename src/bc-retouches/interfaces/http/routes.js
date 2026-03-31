import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { ClientRepoPg } from "../../../bc-clients/infrastructure/repositories/client-repo-pg.js";
import { SerieMesuresRepoPg } from "../../../bc-clients/infrastructure/repositories/serie-mesures-repo-pg.js";
import { deposerRetouche } from "../../application/use-cases/deposer-retouche.js";
import { demarrerTravail } from "../../application/use-cases/demarrer-travail.js";
import { terminerTravail } from "../../application/use-cases/terminer-travail.js";
import { appliquerPaiement } from "../../application/use-cases/appliquer-paiement.js";
import { enregistrerPaiementRetoucheViaCaisse } from "../../application/use-cases/enregistrer-paiement-via-caisse.js";
import { livrerRetouche } from "../../application/use-cases/livrer-retouche.js";
import { annulerRetoucheViaCaisse } from "../../application/use-cases/annuler-retouche-via-caisse.js";
import { CaisseRepoPg } from "../../../bc-caisse/infrastructure/repositories/caisse-repo-pg.js";
import { requireFields, requireNumber, validateSchema } from "../../../shared/interfaces/validation.js";
import { generateRetoucheId } from "../../../shared/domain/id-generator.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { hasPermission, requireAnyPermission, requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";
import { AtelierParametresRepoPg } from "../../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { DossierRepoPg } from "../../../bc-dossiers/infrastructure/repositories/dossier-repo-pg.js";
import { resolveClientForCreation, serializeClientCreationConflict } from "../../../bc-clients/application/services/resolve-client-for-creation.js";
import { saveLatestMeasuresForClientAndType } from "../../../bc-clients/application/services/measure-prefill-service.js";
import {
  getTypeRetoucheDefinition,
  isRetoucheHabitCompatible,
  resolveMesureTargetsForHabit,
  resolveRetoucheMeasureDefinitions,
  resolveRetouchePolicy
} from "../../domain/retouche-policy.js";

const router = express.Router();
const retoucheRepo = new RetoucheRepoPg();
const clientRepo = new ClientRepoPg();
const serieRepo = new SerieMesuresRepoPg();
const parametresRepo = new AtelierParametresRepoPg();
const dossierRepo = new DossierRepoPg();
const requireRetoucheReadAccess = requireAnyPermission([
  PERMISSIONS.VOIR_RETOUCHES,
  PERMISSIONS.VOIR_BILANS_GLOBAUX,
  PERMISSIONS.CLOTURER_CAISSE,
  PERMISSIONS.TERMINER_COMMANDE,
  PERMISSIONS.LIVRER_COMMANDE,
  PERMISSIONS.ANNULER_COMMANDE
]);
const requireRetoucheCreateAccess = requireAnyPermission([
  PERMISSIONS.CREER_RETOUCHE,
  PERMISSIONS.VOIR_BILANS_GLOBAUX,
  PERMISSIONS.CLOTURER_CAISSE
]);

function resolveActeur(req, fallback = null) {
  const utilisateurId = req.auth?.utilisateurId || null;
  const utilisateurNom = req.auth?.nom || String(fallback || "").trim() || null;
  const role = req.auth?.role || null;
  const utilisateur = utilisateurNom ? `${utilisateurNom}${role ? ` (${role})` : ""}` : null;
  return { utilisateurId, utilisateurNom, role, utilisateur };
}

function atelierIdFromReq(req) {
  return String(req.auth?.atelierId || "ATELIER");
}

function scopedRetoucheRepo(req) {
  return retoucheRepo.forAtelier(atelierIdFromReq(req));
}

function scopedClientRepo(req) {
  return clientRepo.forAtelier(atelierIdFromReq(req));
}

function scopedSerieRepo(req) {
  return serieRepo.forAtelier(atelierIdFromReq(req));
}

function scopedParametresRepo(req) {
  return parametresRepo.forAtelier(atelierIdFromReq(req));
}

function scopedCaisseRepo(req) {
  return new CaisseRepoPg(atelierIdFromReq(req));
}

function scopedDossierRepo(req) {
  return dossierRepo.forAtelier(atelierIdFromReq(req));
}

async function loadRetouchePolicy(options = null) {
  const repo = options?.req ? scopedParametresRepo(options.req) : parametresRepo;
  if (!repo || typeof repo.getCurrent !== "function") {
    return resolveRetouchePolicy(null);
  }
  try {
    const current = await repo.getCurrent();
    return resolveRetouchePolicy(current?.payload || null);
  } catch {
    return resolveRetouchePolicy(null);
  }
}

function actionRulesForRetouche(retouche) {
  const soldeRestant = Math.max(0, Number(retouche.montantTotal || 0) - Number(retouche.montantPaye || 0));
  const statut = retouche.statutRetouche;
  const actions = {
    voir: true,
    payer: false,
    terminer: false,
    livrer: false,
    annuler: false
  };
  if (statut === "DEPOSEE") {
    actions.payer = soldeRestant > 0;
    actions.annuler = true;
  } else if (statut === "EN_COURS") {
    actions.payer = soldeRestant > 0;
    actions.terminer = true;
    actions.annuler = true;
  } else if (statut === "TERMINEE") {
    actions.payer = soldeRestant > 0;
    actions.livrer = soldeRestant === 0;
  }
  return {
    statutRetouche: statut,
    soldeRestant,
    actions
  };
}

function actionRulesForRetoucheAvecPermissions(retouche, auth) {
  const base = actionRulesForRetouche(retouche);
  return {
    ...base,
    actions: {
      ...base.actions,
      terminer: base.actions.terminer && hasPermission(auth, PERMISSIONS.TERMINER_COMMANDE),
      livrer: base.actions.livrer && hasPermission(auth, PERMISSIONS.LIVRER_COMMANDE),
      annuler: base.actions.annuler && hasPermission(auth, PERMISSIONS.ANNULER_COMMANDE)
    }
  };
}

async function enregistrerEvenementRetouche({
  atelierId,
  idRetouche,
  typeEvent,
  utilisateur = null,
  ancienStatut = null,
  nouveauStatut = null,
  payload = {}
}, db = pool) {
  const eventPayload = {
    utilisateur,
    ancienStatut,
    nouveauStatut,
    ...payload
  };
  await db.query(
    `INSERT INTO retouche_events (id_event, atelier_id, id_retouche, type_event, payload, date_event)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
    [randomUUID(), atelierId, idRetouche, typeEvent, JSON.stringify(eventPayload)]
  );
}

async function lockRetoucheCreation(db, atelierId, idRetouche) {
  const lockKey = `retouche:create:${String(atelierId || "").trim()}:${String(idRetouche || "").trim()}`;
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
}

// List retouches
router.get("/retouches", requireRetoucheReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id_retouche,
              r.id_client,
              r.id_dossier,
              r.description,
              r.type_retouche,
              r.date_depot,
              r.date_prevue,
              r.montant_total,
              r.montant_paye,
              r.type_habit,
              r.mesures_habit_snapshot,
              r.statut,
              c.nom,
              c.prenom
       FROM retouches r
       LEFT JOIN clients c ON c.id_client = r.id_client AND c.atelier_id = r.atelier_id
       WHERE r.atelier_id = $1
       ORDER BY r.date_depot DESC`,
      [atelierIdFromReq(req)]
    );

    const rows = result.rows.map((row) => ({
      idRetouche: row.id_retouche,
      idClient: row.id_client,
      dossierId: row.id_dossier || null,
      clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
      descriptionRetouche: row.description,
      typeRetouche: row.type_retouche,
      dateDepot: row.date_depot,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      statutRetouche: row.statut
    }));

    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/retouches/types", async (req, res) => {
  try {
    const policy = await loadRetouchePolicy({ req });
    res.json(
      (policy.typesRetouche || []).map((row) => ({
        code: row.code,
        libelle: row.libelle,
        actif: row.actif !== false,
        ordreAffichage: Number(row.ordreAffichage || 1),
        necessiteMesures: row.necessiteMesures,
        mesures: row.mesures || [],
        descriptionObligatoire: row.descriptionObligatoire,
        habitsCompatibles: row.habitsCompatibles || ["*"]
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit retouches (read-only)
router.get("/audit/retouches", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        r.id_retouche,
        r.id_client,
        r.id_dossier,
        r.description,
        r.type_retouche,
        r.date_depot,
        r.date_prevue,
        r.montant_total,
        r.montant_paye,
        r.type_habit,
        r.mesures_habit_snapshot,
        r.statut,
        c.nom,
        c.prenom,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' THEN op.montant ELSE 0 END), 0) AS total_paiements,
        COALESCE(COUNT(op.id_operation), 0) AS nombre_paiements
      FROM retouches r
      LEFT JOIN clients c ON c.id_client = r.id_client AND c.atelier_id = r.atelier_id
      LEFT JOIN caisse_operation op ON op.reference_metier = r.id_retouche AND op.motif = 'PAIEMENT_RETOUCHE' AND op.atelier_id = r.atelier_id
      WHERE r.atelier_id = $1
      GROUP BY r.id_retouche, c.nom, c.prenom
      ORDER BY r.date_depot DESC`,
      [atelierIdFromReq(req)]
    );

    res.json(
      result.rows.map((row) => ({
        idRetouche: row.id_retouche,
        idClient: row.id_client,
        dossierId: row.id_dossier || null,
        clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
        descriptionRetouche: row.description,
        typeRetouche: row.type_retouche,
        dateDepot: row.date_depot,
        datePrevue: row.date_prevue,
        montantTotal: Number(row.montant_total),
        montantPaye: Number(row.montant_paye),
        typeHabit: row.type_habit,
        mesuresHabit: row.mesures_habit_snapshot,
        statutRetouche: row.statut,
        totalPaiements: Number(row.total_paiements),
        nombrePaiements: Number(row.nombre_paiements)
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get retouche by id
router.get("/retouches/:id", requireRetoucheReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id_retouche,
              r.id_client,
              r.id_dossier,
              r.description,
              r.type_retouche,
              r.date_depot,
              r.date_prevue,
              r.montant_total,
              r.montant_paye,
              r.type_habit,
              r.mesures_habit_snapshot,
              r.statut,
              c.nom,
              c.prenom
       FROM retouches r
       LEFT JOIN clients c ON c.id_client = r.id_client AND c.atelier_id = r.atelier_id
       WHERE r.id_retouche = $1 AND r.atelier_id = $2`,
      [req.params.id, atelierIdFromReq(req)]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Retouche introuvable" });

    const row = result.rows[0];
    res.json({
      idRetouche: row.id_retouche,
      idClient: row.id_client,
      dossierId: row.id_dossier || null,
      clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
      descriptionRetouche: row.description,
      typeRetouche: row.type_retouche,
      dateDepot: row.date_depot,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      statutRetouche: row.statut
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get actions autorisees for retouche
router.get("/retouches/:id/actions", requireRetoucheReadAccess, async (req, res) => {
  try {
    const retouche = await scopedRetoucheRepo(req).getById(req.params.id);
    if (!retouche) return res.status(404).json({ error: "Retouche introuvable" });
    res.json(actionRulesForRetoucheAvecPermissions(retouche, req.auth));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get events for retouche (audit trail)
router.get("/retouches/:id/events", requireRetoucheReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_event, id_retouche, type_event, payload, date_event
       FROM retouche_events
       WHERE id_retouche = $1 AND atelier_id = $2
       ORDER BY date_event DESC`,
      [req.params.id, atelierIdFromReq(req)]
    );
    res.json(
      result.rows.map((row) => ({
        idEvent: row.id_event,
        idRetouche: row.id_retouche,
        typeEvent: row.type_event,
        payload: row.payload,
        dateEvent: row.date_event
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get paiements for retouche
router.get("/retouches/:id/paiements", requireRetoucheReadAccess, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT op.id_operation,
              op.id_caisse_jour,
              op.type_operation,
              op.montant,
              op.mode_paiement,
              op.motif,
              op.reference_metier,
              op.date_operation,
              op.effectue_par,
              op.statut_operation,
              cj.date_jour
       FROM caisse_operation op
       LEFT JOIN caisse_jour cj ON cj.id_caisse_jour = op.id_caisse_jour AND cj.atelier_id = op.atelier_id
       WHERE op.reference_metier = $1 AND op.atelier_id = $2
       ORDER BY op.date_operation DESC`,
      [req.params.id, atelierIdFromReq(req)]
    );

    res.json(
      result.rows.map((row) => ({
        idOperation: row.id_operation,
        idCaisseJour: row.id_caisse_jour,
        typeOperation: row.type_operation,
        montant: Number(row.montant),
        modePaiement: row.mode_paiement,
        motif: row.motif,
        referenceMetier: row.reference_metier,
        dateOperation: row.date_operation,
        dateJour: row.date_jour,
        effectuePar: row.effectue_par,
        statutOperation: row.statut_operation
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a new Retouche
router.post("/retouches", requireRetoucheCreateAccess, async (req, res) => {
  const schema = z
    .object({
      idRetouche: z.string().min(1).optional(),
      idDossier: z.string().min(1).optional(),
      idClient: z.string().min(1),
      descriptionRetouche: z.string().optional(),
      typeRetouche: z.string().min(1),
      montantTotal: z.coerce.number(),
      typeHabit: z.string().min(1),
      mesuresHabit: z.any().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["idClient", "typeRetouche", "montantTotal", "typeHabit"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montantTotal");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  const dbClient = await pool.connect();
  try {
    const acteur = resolveActeur(req);
    const policy = await loadRetouchePolicy({ req });
    const repo = scopedRetoucheRepo(req).withExecutor(dbClient);
    const mesuresRepo = scopedSerieRepo(req).withExecutor(dbClient);
    const dossiers = scopedDossierRepo(req).withExecutor(dbClient);
    const requestedIdRetouche = String(body.idRetouche || "").trim();
    const requestedDossierId = String(body.idDossier || "").trim() || null;
    if (requestedIdRetouche) {
      const existingRetouche = await repo.getById(requestedIdRetouche);
      if (existingRetouche) {
        return res.status(200).json(existingRetouche);
      }
    }
    const typeDefinition = getTypeRetoucheDefinition(body.typeRetouche, policy);
    const habitCompatible = isRetoucheHabitCompatible(typeDefinition, body.typeHabit);
    if (!habitCompatible) throw new Error("Type d'habit incompatible avec ce type de retouche");
    const mesureTargets = resolveMesureTargetsForHabit({
      typeDefinition,
      typeHabit: body.typeHabit
    });
    const measureDefinitions = resolveRetoucheMeasureDefinitions({ typeDefinition });
    const measuresRequired = typeDefinition.necessiteMesures === true;
    if (measuresRequired && measureDefinitions.length === 0) {
      throw new Error("Configuration invalide: aucune mesure definie pour ce type de retouche.");
    }
    await dbClient.query("BEGIN");
    if (requestedDossierId) {
      const existingDossier = await dossiers.getById(requestedDossierId);
      if (!existingDossier) {
        throw Object.assign(new Error("Dossier introuvable."), { status: 404, code: "DOSSIER_NOT_FOUND" });
      }
    }
    const retouche = deposerRetouche({
      ...body,
      idRetouche: requestedIdRetouche || generateRetoucheId()
    }, {
      policy: { retouches: policy }
    });
    retouche.dossierId = requestedDossierId;
    await repo.save(retouche);
    if (requestedDossierId) {
      await dossiers.touch(requestedDossierId, acteur.utilisateur);
    }
    await saveLatestMeasuresForClientAndType({
      idClient: retouche.idClient,
      typeHabit: retouche.typeHabit,
      mesuresSnapshot: retouche.mesuresHabit,
      prisePar: acteur.utilisateur,
      observations: `Retouche ${retouche.idRetouche}`,
      serieRepo: mesuresRepo
    });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "RETOUCHE_DEPOSEE",
      utilisateur: acteur.utilisateur,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montantTotal: Number(retouche.montantTotal || 0),
        typeRetouche: retouche.typeRetouche,
        necessiteMesures: measuresRequired,
        mesures: mesureTargets
      }
    }, dbClient);
    await dbClient.query("COMMIT");
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "CREER_RETOUCHE",
      entite: "RETOUCHE",
      entiteId: retouche.idRetouche,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.status(201).json({
      ...retouche,
      dossierId: retouche.dossierId || null
    });
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

router.post("/retouches/wizard", requireRetoucheCreateAccess, async (req, res) => {
  const schema = z
    .object({
      idRetouche: z.string().min(1).optional(),
      idDossier: z.string().min(1).optional(),
      idClient: z.string().min(1).optional(),
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
      descriptionRetouche: z.string().optional(),
      typeRetouche: z.string().min(1),
      montantTotal: z.coerce.number(),
      typeHabit: z.string().min(1),
      mesuresHabit: z.any().optional(),
      datePrevue: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const hasExistingClient = Boolean(String(body.idClient || "").trim());
  const hasNewClient = Boolean(body.nouveauClient);
  if (hasExistingClient === hasNewClient) {
    return res.status(400).json({ error: "Fournissez soit idClient, soit nouveauClient." });
  }
  const r1 = requireFields(body, ["typeRetouche", "montantTotal", "typeHabit"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montantTotal");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  const dbClient = await pool.connect();
  try {
    const acteur = resolveActeur(req);
    const policy = await loadRetouchePolicy({ req });
    const repo = scopedRetoucheRepo(req).withExecutor(dbClient);
    const clients = scopedClientRepo(req).withExecutor(dbClient);
    const mesuresRepo = scopedSerieRepo(req).withExecutor(dbClient);
    const dossiers = scopedDossierRepo(req).withExecutor(dbClient);
    const requestedIdRetouche = String(body.idRetouche || "").trim();
    const requestedDossierId = String(body.idDossier || "").trim() || null;
    if (requestedIdRetouche) {
      const existingRetouche = await repo.getById(requestedIdRetouche);
      if (existingRetouche) {
        return res.status(200).json({
          retouche: existingRetouche,
          client: null
        });
      }
    }
    const typeDefinition = getTypeRetoucheDefinition(body.typeRetouche, policy);
    if (!isRetoucheHabitCompatible(typeDefinition, body.typeHabit)) {
      throw new Error("Type d'habit incompatible avec ce type de retouche");
    }
    const mesureTargets = resolveMesureTargetsForHabit({
      typeDefinition,
      typeHabit: body.typeHabit
    });
    const measureDefinitions = resolveRetoucheMeasureDefinitions({ typeDefinition });
    if (typeDefinition.necessiteMesures === true && measureDefinitions.length === 0) {
      throw new Error("Configuration invalide: aucune mesure definie pour ce type de retouche.");
    }

    await dbClient.query("BEGIN");

    const atelierId = atelierIdFromReq(req);
    const resolvedRetoucheId = requestedIdRetouche || generateRetoucheId();
    await lockRetoucheCreation(dbClient, atelierId, resolvedRetoucheId);
    const existingRetouche = await repo.getById(resolvedRetoucheId);
    if (existingRetouche) {
      await dbClient.query("COMMIT");
      return res.status(200).json({
        retouche: existingRetouche,
        client: null
      });
    }

    if (requestedDossierId) {
      const existingDossier = await dossiers.getById(requestedDossierId);
      if (!existingDossier) {
        throw Object.assign(new Error("Dossier introuvable."), { status: 404, code: "DOSSIER_NOT_FOUND" });
      }
    }

    const clientResolution = await resolveClientForCreation({
      idClient: body.idClient,
      nouveauClient: body.nouveauClient,
      doublonDecision: body.doublonDecision,
      clientRepo: clients
    });

    const retouche = deposerRetouche({
      ...body,
      idClient: clientResolution.idClient,
      idRetouche: resolvedRetoucheId
    }, {
      policy: { retouches: policy }
    });
    retouche.dossierId = requestedDossierId;

    await dbClient.query(
      `INSERT INTO retouches (id_retouche, atelier_id, id_client, id_dossier, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        retouche.idRetouche,
        atelierId,
        retouche.idClient,
        retouche.dossierId,
        retouche.descriptionRetouche,
        retouche.typeRetouche,
        retouche.dateDepot,
        retouche.datePrevue,
        retouche.montantTotal,
        retouche.montantPaye,
        retouche.statutRetouche,
        retouche.typeHabit,
        JSON.stringify(retouche.mesuresHabit)
      ]
    );
    if (requestedDossierId) {
      await dossiers.touch(requestedDossierId, acteur.utilisateur);
    }
    await saveLatestMeasuresForClientAndType({
      idClient: retouche.idClient,
      typeHabit: retouche.typeHabit,
      mesuresSnapshot: retouche.mesuresHabit,
      prisePar: acteur.utilisateur,
      observations: `Retouche ${retouche.idRetouche}`,
      serieRepo: mesuresRepo
    });

    const measuresRequired = typeDefinition.necessiteMesures === true;
    await dbClient.query(
      `INSERT INTO retouche_events (id_event, atelier_id, id_retouche, type_event, payload, date_event)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [
        randomUUID(),
        atelierId,
        retouche.idRetouche,
        "RETOUCHE_DEPOSEE",
        JSON.stringify({
          utilisateur: acteur.utilisateur,
          ancienStatut: null,
          nouveauStatut: retouche.statutRetouche,
          utilisateurId: acteur.utilisateurId,
          utilisateurNom: acteur.utilisateurNom,
          role: acteur.role,
          montantTotal: Number(retouche.montantTotal || 0),
          typeRetouche: retouche.typeRetouche,
          necessiteMesures: measuresRequired,
          mesures: mesureTargets
        })
      ]
    );

    await dbClient.query("COMMIT");
    return res.status(201).json({
      retouche: {
        ...retouche,
        dossierId: retouche.dossierId || null
      },
      client: hasNewClient ? clientResolution.client : null,
      clientResolution: clientResolution.strategy
    });
  } catch (err) {
    await dbClient.query("ROLLBACK").catch(() => {});
    if (Number(err?.status || 0) === 409) {
      return res.status(409).json(serializeClientCreationConflict(err));
    }
    if (Number(err?.status || 0) === 404) {
      return res.status(404).json({ code: String(err.code || "NOT_FOUND"), message: err.message });
    }
    return res.status(400).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// Start work
router.post("/retouches/:id/demarrer", async (req, res) => {
  try {
    const schema = z
      .object({
        parametresAtelier: z.record(z.any()).optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const acteur = resolveActeur(req);
    const repo = scopedRetoucheRepo(req);
    const before = await repo.getById(req.params.id);
    const retouche = await demarrerTravail({
      idRetouche: req.params.id,
      parametresAtelier: parsed.data.parametresAtelier || {},
      retoucheRepo: repo
    });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "TRAVAIL_DEMARRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutRetouche || null,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role
      }
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finish work
router.post("/retouches/:id/terminer", requirePermission(PERMISSIONS.TERMINER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const repo = scopedRetoucheRepo(req);
    const before = await repo.getById(req.params.id);
    const retouche = await terminerTravail({
      idRetouche: req.params.id,
      retoucheRepo: repo
    });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "TRAVAIL_TERMINE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutRetouche || null,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "TERMINER_RETOUCHE",
      entite: "RETOUCHE",
      entiteId: retouche.idRetouche,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment
router.post("/retouches/:id/paiements", async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const repo = scopedRetoucheRepo(req);
    const before = await repo.getById(req.params.id);
    const retouche = await appliquerPaiement({
      idRetouche: req.params.id,
      montant: body.montant,
      retoucheRepo: repo
    });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "PAIEMENT_ENREGISTRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutRetouche || null,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montant: Number(body.montant || 0)
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "PAYER_RETOUCHE",
      entite: "RETOUCHE",
      entiteId: retouche.idRetouche,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montant: Number(body.montant || 0)
      }
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment via caisse (atomic)
router.post("/retouches/:id/paiements/caisse", async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      idCaisseJour: z.string().min(1),
      utilisateur: z.string().min(1),
      modePaiement: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant", "idCaisseJour", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const repo = scopedRetoucheRepo(req);
    const before = await repo.getById(req.params.id);
    const retouche = await enregistrerPaiementRetoucheViaCaisse({
      idRetouche: req.params.id,
      montant: body.montant,
      idCaisseJour: body.idCaisseJour,
      utilisateur: acteur.utilisateur || body.utilisateur,
      modePaiement: body.modePaiement || "CASH",
      retoucheRepo: repo,
      caisseRepo: scopedCaisseRepo(req)
    });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "PAIEMENT_CAISSE_ENREGISTRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutRetouche || null,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montant: Number(body.montant || 0),
        idCaisseJour: body.idCaisseJour || null,
        modePaiement: body.modePaiement || "CASH"
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "PAYER_RETOUCHE_CAISSE",
      entite: "RETOUCHE",
      entiteId: retouche.idRetouche,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montant: Number(body.montant || 0),
        idCaisseJour: body.idCaisseJour || null
      }
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deliver
router.post("/retouches/:id/livrer", requirePermission(PERMISSIONS.LIVRER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const repo = scopedRetoucheRepo(req);
    const before = await repo.getById(req.params.id);
    const retouche = await livrerRetouche({ idRetouche: req.params.id, retoucheRepo: repo });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "RETOUCHE_LIVREE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutRetouche || null,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "LIVRER_RETOUCHE",
      entite: "RETOUCHE",
      entiteId: retouche.idRetouche,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel
router.post("/retouches/:id/annuler", requirePermission(PERMISSIONS.ANNULER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      idCaisseJour: z.string().min(1).optional(),
      utilisateur: z.string().min(1).optional(),
      modePaiement: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const repo = scopedRetoucheRepo(req);
    const before = await repo.getById(req.params.id);
    const retouche = await annulerRetoucheViaCaisse({
      idRetouche: req.params.id,
      idCaisseJour: parsed.data.idCaisseJour,
      utilisateur: acteur.utilisateur || parsed.data.utilisateur,
      modePaiement: parsed.data.modePaiement || "CASH",
      retoucheRepo: repo,
      caisseRepo: scopedCaisseRepo(req)
    });
    await enregistrerEvenementRetouche({
      atelierId: atelierIdFromReq(req),
      idRetouche: retouche.idRetouche,
      typeEvent: "RETOUCHE_ANNULEE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutRetouche || null,
      nouveauStatut: retouche.statutRetouche,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montantRembourse: Number(before?.montantPaye || 0),
        idCaisseJour: parsed.data.idCaisseJour || null,
        modePaiement: parsed.data.modePaiement || "CASH"
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ANNULER_RETOUCHE",
      entite: "RETOUCHE",
      entiteId: retouche.idRetouche,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montantRembourse: Number(before?.montantPaye || 0)
      }
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
