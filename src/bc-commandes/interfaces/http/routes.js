import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { creerCommande } from "../../application/use-cases/creer-commande.js";
import { terminerTravail } from "../../application/use-cases/terminer-travail.js";
import { appliquerPaiement } from "../../application/use-cases/appliquer-paiement.js";
import { enregistrerPaiementViaCaisse } from "../../application/use-cases/enregistrer-paiement-via-caisse.js";
import { livrerCommande } from "../../application/use-cases/livrer-commande.js";
import { annulerCommandeViaCaisse } from "../../application/use-cases/annuler-commande-via-caisse.js";
import { requireFields, requireNumber, validateSchema } from "../../../shared/interfaces/validation.js";
import { generateCommandeId } from "../../../shared/domain/id-generator.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { hasPermission, requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";
import { AtelierParametresRepoPg } from "../../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { resolveCommandePolicy } from "../../domain/commande-policy.js";

const router = express.Router();
const commandeRepo = new CommandeRepoPg();
const parametresRepo = new AtelierParametresRepoPg();

function resolveActeur(req, fallback = null) {
  const utilisateurId = req.auth?.utilisateurId || null;
  const utilisateurNom = req.auth?.nom || String(fallback || "").trim() || null;
  const role = req.auth?.role || null;
  const utilisateur = utilisateurNom ? `${utilisateurNom}${role ? ` (${role})` : ""}` : null;
  return { utilisateurId, utilisateurNom, role, utilisateur };
}

const DEBUG_COMMANDE_POLICY = String(process.env.DEBUG_COMMANDE_POLICY || "").toLowerCase() === "true";

function logCommandePolicy(context, meta) {
  if (!DEBUG_COMMANDE_POLICY) return;
  const scope = String(context || "unknown");
  console.info(`[COMMANDES_POLICY] context=${scope} source=${meta.source} version=${meta.version ?? "n/a"}`);
}

async function loadCommandePolicy(context = "unknown") {
  if (!parametresRepo || typeof parametresRepo.getCurrent !== "function") {
    const meta = {
      policy: resolveCommandePolicy(null),
      payload: null,
      source: "default-no-repo",
      version: null
    };
    logCommandePolicy(context, meta);
    return meta;
  }
  try {
    const current = await parametresRepo.getCurrent();
    const meta = {
      policy: resolveCommandePolicy(current?.payload || null),
      payload: current?.payload || null,
      source: current?.payload ? "atelier_parametres" : "default-empty-parametres",
      version: Number(current?.version || 1)
    };
    logCommandePolicy(context, meta);
    return meta;
  } catch {
    const meta = {
      policy: resolveCommandePolicy(null),
      payload: null,
      source: "default-on-error",
      version: null
    };
    logCommandePolicy(context, meta);
    return meta;
  }
}

function actionRulesForCommande(commande, policy) {
  const soldeRestant = Math.max(0, Number(commande.montantTotal || 0) - Number(commande.montantPaye || 0));
  const statut = commande.statutCommande;
  const allowAnnulation = statut !== "LIVREE" && (policy.autoriserAnnulationApresPaiement || Number(commande.montantPaye || 0) === 0);
  const actions = {
    voir: true,
    payer: false,
    terminer: false,
    livrer: false,
    annuler: false
  };

  if (statut === "CREEE") {
    actions.payer = soldeRestant > 0;
    actions.annuler = allowAnnulation;
  } else if (statut === "EN_COURS") {
    actions.payer = soldeRestant > 0;
    actions.terminer = true;
    actions.annuler = allowAnnulation;
  } else if (statut === "TERMINEE") {
    actions.payer = soldeRestant > 0;
    actions.livrer = policy.livraisonAutoriseeSeulementSiPaiementTotal ? soldeRestant === 0 : true;
    actions.annuler = allowAnnulation;
  }

  return {
    statutCommande: statut,
    soldeRestant,
    actions
  };
}

function actionRulesForCommandeAvecPermissions(commande, auth, policy) {
  const base = actionRulesForCommande(commande, policy);
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

async function enregistrerEvenementCommande({
  idCommande,
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
    `INSERT INTO commande_events (id_event, id_commande, type_event, payload, date_event)
     VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [randomUUID(), idCommande, typeEvent, JSON.stringify(eventPayload)]
  );
}

// List commandes
router.get("/commandes", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id_commande,
              c.id_client,
              c.description,
              c.date_creation,
              c.date_prevue,
              c.montant_total,
              c.montant_paye,
              c.type_habit,
              c.mesures_habit_snapshot,
              c.statut,
              cl.nom,
              cl.prenom
       FROM commandes c
       LEFT JOIN clients cl ON cl.id_client = c.id_client
       ORDER BY c.date_creation DESC`
    );

    const rows = result.rows.map((row) => ({
      idCommande: row.id_commande,
      idClient: row.id_client,
      clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
      descriptionCommande: row.description,
      dateCreation: row.date_creation,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      statutCommande: row.statut
    }));

    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit commandes (read-only)
router.get("/audit/commandes", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        c.id_commande,
        c.id_client,
        c.description,
        c.date_creation,
        c.date_prevue,
        c.montant_total,
        c.montant_paye,
        c.type_habit,
        c.mesures_habit_snapshot,
        c.statut,
        cl.nom,
        cl.prenom,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' THEN op.montant ELSE 0 END), 0) AS total_paiements,
        COALESCE(COUNT(op.id_operation), 0) AS nombre_paiements
      FROM commandes c
      LEFT JOIN clients cl ON cl.id_client = c.id_client
      LEFT JOIN caisse_operation op ON op.reference_metier = c.id_commande AND op.motif = 'PAIEMENT_COMMANDE'
      GROUP BY c.id_commande, cl.nom, cl.prenom
      ORDER BY c.date_creation DESC`
    );

    res.json(
      result.rows.map((row) => ({
        idCommande: row.id_commande,
        idClient: row.id_client,
        clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
        descriptionCommande: row.description,
        dateCreation: row.date_creation,
        datePrevue: row.date_prevue,
        montantTotal: Number(row.montant_total),
        montantPaye: Number(row.montant_paye),
        typeHabit: row.type_habit,
        mesuresHabit: row.mesures_habit_snapshot,
        statutCommande: row.statut,
        totalPaiements: Number(row.total_paiements),
        nombrePaiements: Number(row.nombre_paiements)
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get commande by id
router.get("/commandes/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id_commande,
              c.id_client,
              c.description,
              c.date_creation,
              c.date_prevue,
              c.montant_total,
              c.montant_paye,
              c.type_habit,
              c.mesures_habit_snapshot,
              c.statut,
              cl.nom,
              cl.prenom
       FROM commandes c
       LEFT JOIN clients cl ON cl.id_client = c.id_client
       WHERE c.id_commande = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Commande introuvable" });

    const row = result.rows[0];
    res.json({
      idCommande: row.id_commande,
      idClient: row.id_client,
      clientNom: row.nom && row.prenom ? `${row.nom} ${row.prenom}` : null,
      descriptionCommande: row.description,
      dateCreation: row.date_creation,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      statutCommande: row.statut
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get actions autorisees for commande
router.get("/commandes/:id/actions", async (req, res) => {
  try {
    const commande = await commandeRepo.getById(req.params.id);
    if (!commande) return res.status(404).json({ error: "Commande introuvable" });
    const policyMeta = await loadCommandePolicy("commandes.actions");
    res.json(actionRulesForCommandeAvecPermissions(commande, req.auth, policyMeta.policy));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get events for commande (audit trail)
router.get("/commandes/:id/events", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_event, id_commande, type_event, payload, date_event
       FROM commande_events
       WHERE id_commande = $1
       ORDER BY date_event DESC`,
      [req.params.id]
    );
    res.json(
      result.rows.map((row) => ({
        idEvent: row.id_event,
        idCommande: row.id_commande,
        typeEvent: row.type_event,
        payload: row.payload,
        dateEvent: row.date_event
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get paiements for commande
router.get("/commandes/:id/paiements", async (req, res) => {
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

// Create a new Commande
router.post("/commandes", async (req, res) => {
  const schema = z
    .object({
      idClient: z.string().min(1),
      descriptionCommande: z.string().min(1),
      montantTotal: z.coerce.number(),
      typeHabit: z.string().min(1).optional(),
      mesuresHabit: z.any().optional(),
      datePrevue: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["idClient", "descriptionCommande", "montantTotal"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montantTotal");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req);
    const policyMeta = await loadCommandePolicy("commandes.create");
    const policyInput = policyMeta.payload || { commandes: policyMeta.policy };
    const commande = creerCommande({
      ...body,
      idCommande: generateCommandeId()
    }, {
      policy: policyInput
    });
    await commandeRepo.save(commande);
    await enregistrerEvenementCommande({
      idCommande: commande.idCommande,
      typeEvent: "COMMANDE_CREEE",
      utilisateur: acteur.utilisateur,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montantTotal: Number(commande.montantTotal || 0)
      }
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "CREER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.status(201).json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finish work
router.post("/commandes/:id/terminer", requirePermission(PERMISSIONS.TERMINER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const before = await commandeRepo.getById(req.params.id);
    const commande = await terminerTravail({
      idCommande: req.params.id,
      commandeRepo
    });
    await enregistrerEvenementCommande({
      idCommande: commande.idCommande,
      typeEvent: "TRAVAIL_TERMINE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
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
      action: "TERMINER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment
router.post("/commandes/:id/paiements", async (req, res) => {
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
    const before = await commandeRepo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.paiements");
    const commande = await appliquerPaiement({
      idCommande: req.params.id,
      montant: body.montant,
      commandeRepo,
      policy: { commandes: policyMeta.policy }
    });
    await enregistrerEvenementCommande({
      idCommande: commande.idCommande,
      typeEvent: "PAIEMENT_ENREGISTRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
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
      action: "PAYER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montant: Number(body.montant || 0)
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment via caisse (atomic)
router.post("/commandes/:id/paiements/caisse", async (req, res) => {
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
    const before = await commandeRepo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.paiements.caisse");
    const commande = await enregistrerPaiementViaCaisse({
      idCommande: req.params.id,
      montant: body.montant,
      idCaisseJour: body.idCaisseJour,
      utilisateur: acteur.utilisateur || body.utilisateur,
      modePaiement: body.modePaiement || "CASH",
      policy: { commandes: policyMeta.policy }
    });
    await enregistrerEvenementCommande({
      idCommande: commande.idCommande,
      typeEvent: "PAIEMENT_CAISSE_ENREGISTRE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
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
      action: "PAYER_COMMANDE_CAISSE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montant: Number(body.montant || 0),
        idCaisseJour: body.idCaisseJour || null
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deliver
router.post("/commandes/:id/livrer", requirePermission(PERMISSIONS.LIVRER_COMMANDE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  try {
    const acteur = resolveActeur(req, parsed.data.utilisateur);
    const before = await commandeRepo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.livrer");
    const commande = await livrerCommande({ idCommande: req.params.id, commandeRepo, policy: { commandes: policyMeta.policy } });
    await enregistrerEvenementCommande({
      idCommande: commande.idCommande,
      typeEvent: "COMMANDE_LIVREE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
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
      action: "LIVRER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel
router.post("/commandes/:id/annuler", requirePermission(PERMISSIONS.ANNULER_COMMANDE), async (req, res) => {
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
    const before = await commandeRepo.getById(req.params.id);
    const policyMeta = await loadCommandePolicy("commandes.annuler");
    const commande = await annulerCommandeViaCaisse({
      idCommande: req.params.id,
      idCaisseJour: parsed.data.idCaisseJour,
      utilisateur: acteur.utilisateur || parsed.data.utilisateur,
      modePaiement: parsed.data.modePaiement || "CASH",
      policy: { commandes: policyMeta.policy }
    });
    await enregistrerEvenementCommande({
      idCommande: commande.idCommande,
      typeEvent: "COMMANDE_ANNULEE",
      utilisateur: acteur.utilisateur,
      ancienStatut: before?.statutCommande || null,
      nouveauStatut: commande.statutCommande,
      payload: {
        utilisateurId: acteur.utilisateurId,
        utilisateurNom: acteur.utilisateurNom,
        role: acteur.role,
        montantRembourse: Number(before?.montantPaye || 0),
        idCaisseJour: parsed.data.idCaisseJour || null,
        modePaiement: parsed.data.modePaiement || "CASH"
      }
    });
    if (Number(before?.montantPaye || 0) > 0) {
      await enregistrerEvenementCommande({
        idCommande: commande.idCommande,
        typeEvent: "REMBOURSEMENT_COMMANDE_ANNULEE",
        utilisateur: acteur.utilisateur,
        ancienStatut: before?.statutCommande || null,
        nouveauStatut: commande.statutCommande,
        payload: {
          utilisateurId: acteur.utilisateurId,
          utilisateurNom: acteur.utilisateurNom,
          role: acteur.role,
          montant: Number(before?.montantPaye || 0),
          idCaisseJour: parsed.data.idCaisseJour || null,
          modePaiement: parsed.data.modePaiement || "CASH"
        }
      });
    }
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ANNULER_COMMANDE",
      entite: "COMMANDE",
      entiteId: commande.idCommande,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        montantRembourse: Number(before?.montantPaye || 0)
      }
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
