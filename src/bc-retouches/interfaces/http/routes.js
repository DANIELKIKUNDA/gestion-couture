import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { deposerRetouche } from "../../application/use-cases/deposer-retouche.js";
import { creerClient } from "../../../bc-clients/application/use-cases/creer-client.js";
import { demarrerTravail } from "../../application/use-cases/demarrer-travail.js";
import { terminerTravail } from "../../application/use-cases/terminer-travail.js";
import { appliquerPaiement } from "../../application/use-cases/appliquer-paiement.js";
import { enregistrerPaiementRetoucheViaCaisse } from "../../application/use-cases/enregistrer-paiement-via-caisse.js";
import { livrerRetouche } from "../../application/use-cases/livrer-retouche.js";
import { annulerRetoucheViaCaisse } from "../../application/use-cases/annuler-retouche-via-caisse.js";
import { requireFields, requireNumber, validateSchema } from "../../../shared/interfaces/validation.js";
import { generateClientId, generateRetoucheId } from "../../../shared/domain/id-generator.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { hasPermission, requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";
import { AtelierParametresRepoPg } from "../../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import {
  getTypeRetoucheDefinition,
  isRetoucheHabitCompatible,
  resolveMesureTargetsForHabit,
  resolveRetoucheMeasureDefinitions,
  resolveRetouchePolicy
} from "../../domain/retouche-policy.js";

const router = express.Router();
const retoucheRepo = new RetoucheRepoPg();
const parametresRepo = new AtelierParametresRepoPg();

function resolveActeur(req, fallback = null) {
  const utilisateurId = req.auth?.utilisateurId || null;
  const utilisateurNom = req.auth?.nom || String(fallback || "").trim() || null;
  const role = req.auth?.role || null;
  const utilisateur = utilisateurNom ? `${utilisateurNom}${role ? ` (${role})` : ""}` : null;
  return { utilisateurId, utilisateurNom, role, utilisateur };
}

async function loadRetouchePolicy() {
  if (!parametresRepo || typeof parametresRepo.getCurrent !== "function") {
    return resolveRetouchePolicy(null);
  }
  try {
    const current = await parametresRepo.getCurrent();
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
  idRetouche,
  typeEvent,
  utilisateur = null,
  ancienStatut = null,
  nouveauStatut = null,
  payload = {}
}) {
  const eventPayload = {
    utilisateur,
    ancienStatut,
    nouveauStatut,
    ...payload
  };
  await pool.query(
    `INSERT INTO retouche_events (id_event, id_retouche, type_event, payload, date_event)
     VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [randomUUID(), idRetouche, typeEvent, JSON.stringify(eventPayload)]
  );
}

// List retouches
router.get("/retouches", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id_retouche,
              r.id_client,
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
       LEFT JOIN clients c ON c.id_client = r.id_client
       ORDER BY r.date_depot DESC`
    );

    const rows = result.rows.map((row) => ({
      idRetouche: row.id_retouche,
      idClient: row.id_client,
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
    const policy = await loadRetouchePolicy();
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
      LEFT JOIN clients c ON c.id_client = r.id_client
      LEFT JOIN caisse_operation op ON op.reference_metier = r.id_retouche AND op.motif = 'PAIEMENT_RETOUCHE'
      GROUP BY r.id_retouche, c.nom, c.prenom
      ORDER BY r.date_depot DESC`
    );

    res.json(
      result.rows.map((row) => ({
        idRetouche: row.id_retouche,
        idClient: row.id_client,
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
router.get("/retouches/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id_retouche,
              r.id_client,
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
       LEFT JOIN clients c ON c.id_client = r.id_client
       WHERE r.id_retouche = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Retouche introuvable" });

    const row = result.rows[0];
    res.json({
      idRetouche: row.id_retouche,
      idClient: row.id_client,
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
router.get("/retouches/:id/actions", async (req, res) => {
  try {
    const retouche = await retoucheRepo.getById(req.params.id);
    if (!retouche) return res.status(404).json({ error: "Retouche introuvable" });
    res.json(actionRulesForRetoucheAvecPermissions(retouche, req.auth));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get events for retouche (audit trail)
router.get("/retouches/:id/events", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_event, id_retouche, type_event, payload, date_event
       FROM retouche_events
       WHERE id_retouche = $1
       ORDER BY date_event DESC`,
      [req.params.id]
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
router.get("/retouches/:id/paiements", async (req, res) => {
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
       LEFT JOIN caisse_jour cj ON cj.id_caisse_jour = op.id_caisse_jour
       WHERE op.reference_metier = $1
       ORDER BY op.date_operation DESC`,
      [req.params.id]
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
router.post("/retouches", async (req, res) => {
  const schema = z
    .object({
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

  try {
    const acteur = resolveActeur(req);
    const policy = await loadRetouchePolicy();
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
    const retouche = deposerRetouche({
      ...body,
      idRetouche: generateRetoucheId()
    }, {
      policy: { retouches: policy }
    });
    await retoucheRepo.save(retouche);
    await enregistrerEvenementRetouche({
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
    });
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
    res.status(201).json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/retouches/wizard", async (req, res) => {
  const schema = z
    .object({
      idClient: z.string().min(1).optional(),
      nouveauClient: z
        .object({
          nom: z.string().min(1),
          prenom: z.string().min(1),
          telephone: z.string().min(1)
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
    const policy = await loadRetouchePolicy();
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

    let createdClient = null;
    let idClient = String(body.idClient || "").trim();
    if (!idClient) {
      createdClient = creerClient({
        ...body.nouveauClient,
        idClient: generateClientId()
      });
      idClient = createdClient.idClient;
      await dbClient.query(
        `INSERT INTO clients (id_client, nom, prenom, telephone, adresse, sexe, actif, date_creation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          createdClient.idClient,
          createdClient.nom,
          createdClient.prenom,
          createdClient.telephone,
          createdClient.adresse,
          createdClient.sexe,
          createdClient.actif,
          createdClient.dateCreation
        ]
      );
    }

    const retouche = deposerRetouche({
      ...body,
      idClient,
      idRetouche: generateRetoucheId()
    }, {
      policy: { retouches: policy }
    });

    await dbClient.query(
      `INSERT INTO retouches (id_retouche, id_client, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        retouche.idRetouche,
        retouche.idClient,
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

    const measuresRequired = typeDefinition.necessiteMesures === true;
    await dbClient.query(
      `INSERT INTO retouche_events (id_event, id_retouche, type_event, payload, date_event)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [
        randomUUID(),
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
      retouche,
      client: createdClient
    });
  } catch (err) {
    await dbClient.query("ROLLBACK");
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
    const before = await retoucheRepo.getById(req.params.id);
    const retouche = await demarrerTravail({
      idRetouche: req.params.id,
      parametresAtelier: parsed.data.parametresAtelier || {},
      retoucheRepo
    });
    await enregistrerEvenementRetouche({
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
    const before = await retoucheRepo.getById(req.params.id);
    const retouche = await terminerTravail({
      idRetouche: req.params.id,
      retoucheRepo
    });
    await enregistrerEvenementRetouche({
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
    const before = await retoucheRepo.getById(req.params.id);
    const retouche = await appliquerPaiement({
      idRetouche: req.params.id,
      montant: body.montant,
      retoucheRepo
    });
    await enregistrerEvenementRetouche({
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
    const before = await retoucheRepo.getById(req.params.id);
    const retouche = await enregistrerPaiementRetoucheViaCaisse({
      idRetouche: req.params.id,
      montant: body.montant,
      idCaisseJour: body.idCaisseJour,
      utilisateur: acteur.utilisateur || body.utilisateur,
      modePaiement: body.modePaiement || "CASH"
    });
    await enregistrerEvenementRetouche({
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
    const before = await retoucheRepo.getById(req.params.id);
    const retouche = await livrerRetouche({ idRetouche: req.params.id, retoucheRepo });
    await enregistrerEvenementRetouche({
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
    const before = await retoucheRepo.getById(req.params.id);
    const retouche = await annulerRetoucheViaCaisse({
      idRetouche: req.params.id,
      idCaisseJour: parsed.data.idCaisseJour,
      utilisateur: acteur.utilisateur || parsed.data.utilisateur,
      modePaiement: parsed.data.modePaiement || "CASH"
    });
    await enregistrerEvenementRetouche({
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
