import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { CaisseRepoPg } from "../../infrastructure/repositories/caisse-repo-pg.js";
import { BilanCaisseRepoPg } from "../../infrastructure/repositories/bilan-caisse-repo-pg.js";
import { AtelierParametresRepoPg } from "../../../bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { ouvrirCaisseDuJour } from "../../application/use-cases/ouvrir-caisse-du-jour.js";
import { preparerOuvertureCaisseDuJour } from "../../application/use-cases/preparer-ouverture-caisse.js";
import { enregistrerEntree } from "../../application/use-cases/enregistrer-entree.js";
import { enregistrerEntreeManuelle } from "../../application/use-cases/enregistrer-entree-manuelle.js";
import { enregistrerSortie } from "../../application/use-cases/enregistrer-sortie.js";
import { annulerOperation } from "../../application/use-cases/annuler-operation.js";
import { cloturerCaisse } from "../../application/use-cases/cloturer-caisse.js";
import { genererBilansApresCloture } from "../../application/use-cases/creer-bilan-caisse.js";
import { requireFields, requireNumber, validateSchema } from "../../../shared/interfaces/validation.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";
import { z } from "zod";
import { PERMISSIONS } from "../../../bc-auth/domain/permissions.js";
import { MotifOperation } from "../../domain/value-objects.js";
import { requireAnyPermission, requirePermission } from "../../../bc-auth/interfaces/http/middlewares/require-permission.js";
import { enregistrerEvenementAudit } from "../../../shared/infrastructure/audit-log.js";
import { PermissionInsuffisante } from "../../domain/errors.js";

const router = express.Router();
const caisseRepo = new CaisseRepoPg();
const bilanRepo = new BilanCaisseRepoPg();
const parametresRepo = new AtelierParametresRepoPg();
const requireCaisseOpenAccess = requireAnyPermission([
  PERMISSIONS.OUVRIR_CAISSE,
  PERMISSIONS.CLOTURER_CAISSE,
  PERMISSIONS.VOIR_BILANS_GLOBAUX
]);
const requireCaisseEntreeAccess = requireAnyPermission([
  PERMISSIONS.ENREGISTRER_ENTREE_CAISSE,
  PERMISSIONS.CLOTURER_CAISSE,
  PERMISSIONS.VOIR_BILANS_GLOBAUX
]);
const requireCaisseSortieAccess = requireAnyPermission([
  PERMISSIONS.ENREGISTRER_SORTIE_CAISSE,
  PERMISSIONS.CLOTURER_CAISSE,
  PERMISSIONS.VOIR_BILANS_GLOBAUX
]);
const requireCaisseAnnulationAccess = requireAnyPermission([
  PERMISSIONS.ANNULER_OPERATION_CAISSE,
  PERMISSIONS.CLOTURER_CAISSE,
  PERMISSIONS.VOIR_BILANS_GLOBAUX
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

function scopedCaisseRepo(req) {
  return caisseRepo.forAtelier(atelierIdFromReq(req));
}

function scopedBilanRepo(req) {
  return bilanRepo.forAtelier(atelierIdFromReq(req));
}

function scopedParametresRepo(req) {
  return parametresRepo.forAtelier(atelierIdFromReq(req));
}

function isRoleForbiddenForManualEntry(role = "") {
  return String(role || "").trim().toUpperCase() === "COUTURIER";
}

function resolveCaisseOperationSource(op = {}) {
  const typeOperation = String(op.typeOperation || op.type_operation || "").trim().toUpperCase();
  if (typeOperation === "SORTIE") return "DEPENSE";

  const motif = String(op.motif || "").trim().toUpperCase();
  if ([MotifOperation.PAIEMENT_COMMANDE, MotifOperation.PAIEMENT_COMMANDE_ITEM].includes(motif)) return "COMMANDE";
  if ([MotifOperation.PAIEMENT_RETOUCHE, MotifOperation.PAIEMENT_RETOUCHE_ITEM].includes(motif)) return "RETOUCHE";
  if ([MotifOperation.VENTE_STOCK, MotifOperation.PAIEMENT_STOCK].includes(motif)) return "VENTE";
  if (motif === MotifOperation.ENTREE_MANUELLE) return "MANUEL";
  return typeOperation === "ENTREE" ? "AUTRE_ENTREE" : "AUTRE";
}

function normalizeCaisse(caisse) {
  const operations = caisse.operations || [];
  const soldeCourant = operations.reduce((sum, op) => {
    if (op.statutOperation === "ANNULEE") return sum;
    if (op.typeOperation === "ENTREE") return sum + Number(op.montant || 0);
    if (op.typeOperation === "SORTIE") return sum - Number(op.montant || 0);
    return sum;
  }, Number(caisse.soldeOuverture || 0));
  const totalEntreesJour = operations.reduce((sum, op) => {
    if (op.statutOperation === "ANNULEE") return sum;
    if (op.typeOperation === "ENTREE") return sum + Number(op.montant || 0);
    return sum;
  }, 0);
  const totalSortiesQuotidiennesJour = operations.reduce((sum, op) => {
    if (op.statutOperation === "ANNULEE") return sum;
    if (op.typeOperation !== "SORTIE") return sum;
    const typeDepense = op.typeDepense || "QUOTIDIENNE";
    if (typeDepense === "QUOTIDIENNE") return sum + Number(op.montant || 0);
    return sum;
  }, 0);
  const resultatJournalier = totalEntreesJour - totalSortiesQuotidiennesJour;
  const totauxParSource = {
    totalCommandes: 0,
    totalRetouches: 0,
    totalVentes: 0,
    totalEntreesManuelles: 0,
    totalDepenses: 0,
    totalGlobal: 0
  };

  const normalizedOperations = operations.map((op) => {
    const sourceFlux = resolveCaisseOperationSource(op);
    const montant = Number(op.montant || 0);
    if (op.statutOperation !== "ANNULEE") {
      if (sourceFlux === "COMMANDE") totauxParSource.totalCommandes += montant;
      else if (sourceFlux === "RETOUCHE") totauxParSource.totalRetouches += montant;
      else if (sourceFlux === "VENTE") totauxParSource.totalVentes += montant;
      else if (sourceFlux === "MANUEL") totauxParSource.totalEntreesManuelles += montant;
      else if (sourceFlux === "DEPENSE") totauxParSource.totalDepenses += montant;
    }
    return {
      ...op,
      sourceFlux
    };
  });
  totauxParSource.totalGlobal =
    totauxParSource.totalCommandes +
    totauxParSource.totalRetouches +
    totauxParSource.totalVentes +
    totauxParSource.totalEntreesManuelles;

  return {
    idCaisseJour: caisse.idCaisseJour,
    date: caisse.date,
    statutCaisse: caisse.statutCaisse,
    soldeOuverture: Number(caisse.soldeOuverture || 0),
    soldeCloture: caisse.soldeCloture === null ? null : Number(caisse.soldeCloture),
    soldeCourant,
    totalEntreesJour,
    totalSortiesQuotidiennesJour,
    resultatJournalier,
    soldeJournalierRestant: resultatJournalier,
    ouvertePar: caisse.ouvertePar,
    clotureePar: caisse.clotureePar,
    dateOuverture: caisse.dateOuverture,
    dateCloture: caisse.dateCloture,
    ouvertureAnticipee: caisse.ouvertureAnticipee === true,
    motifOuvertureAnticipee: caisse.motifOuvertureAnticipee || null,
    autoriseePar: caisse.autoriseePar || null,
    operations: normalizedOperations,
    totauxParSource
  };
}

// List caisse days
router.get("/caisse", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_caisse_jour, date_jour, statut, solde_ouverture, solde_cloture, ouverte_par, cloturee_par, date_ouverture, date_cloture
       FROM caisse_jour
       WHERE atelier_id = $1
       ORDER BY date_jour DESC`
      ,
      [atelierIdFromReq(req)]
    );

    res.json(
      result.rows.map((row) => ({
        idCaisseJour: row.id_caisse_jour,
        date: row.date_jour,
        statutCaisse: row.statut,
        soldeOuverture: Number(row.solde_ouverture),
        soldeCloture: row.solde_cloture === null ? null : Number(row.solde_cloture),
        ouvertePar: row.ouverte_par,
        clotureePar: row.cloturee_par,
        dateOuverture: row.date_ouverture,
        dateCloture: row.date_cloture
      }))
    );
  } catch (err) {
    if (err instanceof PermissionInsuffisante) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// Get caisse day by id with operations
router.get("/caisse/:id", async (req, res, next) => {
  const reserved = new Set(["bilans", "audit", "ouvrir", "ouverture-info"]);
  if (reserved.has(String(req.params.id || "").toLowerCase())) return next();
  try {
    const caisse = await scopedCaisseRepo(req).getById(req.params.id);
    if (!caisse) return res.status(404).json({ error: "Caisse introuvable" });
    res.json(normalizeCaisse(caisse));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Info ouverture caisse du jour (preview)
router.get("/caisse/ouverture-info", async (req, res) => {
  const overrideHeureOuverture = req.query.overrideHeureOuverture === "true";
  const role = req.query.role || "";
  const motifOverride = req.query.motifOverride || "";
  const soldeInitial = req.query.soldeInitial ? Number(req.query.soldeInitial) : 0;

  try {
    const info = await preparerOuvertureCaisseDuJour({
      soldeInitial,
      caisseRepo: scopedCaisseRepo(req),
      parametresRepo: scopedParametresRepo(req),
      overrideHeureOuverture,
      role,
      motifOverride
    });
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get bilans caisse
router.get("/caisse/bilans", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  const typeBilan = req.query.type;
  const dateDebut = req.query.dateDebut;
  const dateFin = req.query.dateFin;
  const mode = req.query.mode || "";
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  if (!typeBilan) return res.status(400).json({ error: "type requis" });

  try {
    let rows = [];
    if (mode === "all") {
      rows = await scopedBilanRepo(req).listByType(typeBilan, limit);
    } else {
      if (!dateDebut || !dateFin) {
        return res.status(400).json({ error: "dateDebut et dateFin requis" });
      }
      rows = await scopedBilanRepo(req).listByPeriod(typeBilan, dateDebut, dateFin);
    }
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get dernier bilan
router.get("/caisse/bilans/dernier", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  const typeBilan = req.query.type;
  if (!typeBilan) return res.status(400).json({ error: "type requis" });

  try {
    const row = await scopedBilanRepo(req).getLatest(typeBilan);
    if (!row) return res.status(404).json({ error: "Bilan introuvable" });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit: bilan journalier (caisses cloturees)
router.get("/caisse/audit/journalier", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        cj.id_caisse_jour,
        cj.date_ouverture,
        cj.date_cloture,
        to_char(cj.date_ouverture, 'Day') AS jour_semaine,
        to_char(cj.date_ouverture, 'HH24:MI') AS heure_ouverture,
        to_char(cj.date_cloture, 'HH24:MI') AS heure_cloture,
        cj.solde_ouverture,
        cj.solde_cloture,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'ENTREE' THEN op.montant ELSE 0 END), 0) AS total_entrees,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'SORTIE' THEN op.montant ELSE 0 END), 0) AS total_sorties,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'SORTIE' AND (op.type_depense = 'QUOTIDIENNE' OR op.type_depense IS NULL) THEN op.montant ELSE 0 END), 0) AS total_sorties_quotidiennes,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'ENTREE' THEN op.montant ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'SORTIE' AND (op.type_depense = 'QUOTIDIENNE' OR op.type_depense IS NULL) THEN op.montant ELSE 0 END), 0) AS resultat_journalier,
        COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'ENTREE' THEN op.montant ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN op.statut_operation <> 'ANNULEE' AND op.type_operation = 'SORTIE' AND (op.type_depense = 'QUOTIDIENNE' OR op.type_depense IS NULL) THEN op.montant ELSE 0 END), 0) AS solde_journalier_restant,
        COALESCE(COUNT(op.id_operation), 0) AS nombre_operations
      FROM caisse_jour cj
      LEFT JOIN caisse_operation op ON op.id_caisse_jour = cj.id_caisse_jour AND op.atelier_id = cj.atelier_id
      WHERE cj.statut = 'CLOTUREE' AND cj.atelier_id = $1
      GROUP BY cj.id_caisse_jour
      ORDER BY cj.date_jour DESC`,
      [atelierIdFromReq(req)]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit: journal global des operations
router.get("/caisse/audit/operations", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        op.id_operation,
        op.date_operation,
        op.type_operation,
        op.montant,
        op.mode_paiement,
        op.motif,
        op.reference_metier,
        op.effectue_par,
        op.statut_operation,
        op.type_depense,
        op.justification,
        op.impact_journalier,
        op.impact_global,
        op.id_caisse_jour
      FROM caisse_operation op
      WHERE op.atelier_id = $1
      ORDER BY op.date_operation DESC`
      ,
      [atelierIdFromReq(req)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a caisse jour
router.post("/caisse", requireCaisseOpenAccess, async (req, res) => {
  const schema = z
    .object({
      soldeOuverture: z.coerce.number(),
      utilisateur: z.string().min(1).optional(),
      overrideHeureOuverture: z.boolean().optional(),
      role: z.string().optional(),
      motifOverride: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["soldeOuverture"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "soldeOuverture");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const caisse = await ouvrirCaisseDuJour({
      utilisateur: acteur.utilisateur || body.utilisateur,
      soldeInitial: body.soldeOuverture,
      overrideHeureOuverture: body.overrideHeureOuverture === true,
      role: body.role || "",
      motifOverride: body.motifOverride || "",
      caisseRepo: scopedCaisseRepo(req),
      parametresRepo: scopedParametresRepo(req)
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "OUVRIR_CAISSE",
      entite: "CAISSE_JOUR",
      entiteId: caisse.idCaisseJour,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        soldeOuverture: Number(body.soldeOuverture || 0)
      }
    });
    res.status(201).json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Open caisse du jour (server date)
router.post("/caisse/ouvrir", requireCaisseOpenAccess, async (req, res) => {
  const schema = z
    .object({
      soldeOuverture: z.coerce.number(),
      utilisateur: z.string().min(1).optional(),
      overrideHeureOuverture: z.boolean().optional(),
      role: z.string().optional(),
      motifOverride: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["soldeOuverture"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "soldeOuverture");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const caisse = await ouvrirCaisseDuJour({
      utilisateur: acteur.utilisateur || body.utilisateur,
      soldeInitial: body.soldeOuverture,
      overrideHeureOuverture: body.overrideHeureOuverture === true,
      role: body.role || "",
      motifOverride: body.motifOverride || "",
      caisseRepo: scopedCaisseRepo(req),
      parametresRepo: scopedParametresRepo(req)
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "OUVRIR_CAISSE",
      entite: "CAISSE_JOUR",
      entiteId: caisse.idCaisseJour,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        soldeOuverture: Number(body.soldeOuverture || 0)
      }
    });
    res.status(201).json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Enregistrer entree
router.post("/caisse/:id/entrees", requireCaisseEntreeAccess, async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      modePaiement: z.string().min(1),
      motif: z.string().min(1),
      utilisateur: z.string().min(1).optional(),
      referenceMetier: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant", "modePaiement", "motif"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const caisse = await enregistrerEntree({
      idCaisseJour: req.params.id,
      input: {
        idOperation: generateOperationId(),
        montant: body.montant,
        modePaiement: body.modePaiement,
        motif: body.motif,
        referenceMetier: body.referenceMetier || null,
        utilisateur: acteur.utilisateur || body.utilisateur
      },
      caisseRepo: scopedCaisseRepo(req)
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ENREGISTRER_ENTREE_CAISSE",
      entite: "CAISSE_OPERATION",
      entiteId: null,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        idCaisseJour: req.params.id,
        montant: Number(body.montant || 0),
        motif: body.motif || null
      }
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/caisse/:id/entrees/manuelles", requireCaisseEntreeAccess, async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      justification: z.string().min(1),
      utilisateur: z.string().min(1).optional(),
      modePaiement: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant", "justification"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    if (isRoleForbiddenForManualEntry(acteur.role)) {
      return res.status(403).json({ error: "Permission insuffisante" });
    }

    const caisse = await enregistrerEntreeManuelle({
      idCaisseJour: req.params.id,
      input: {
        idOperation: generateOperationId(),
        montant: body.montant,
        modePaiement: body.modePaiement || "CASH",
        justification: body.justification,
        utilisateur: acteur.utilisateur || body.utilisateur
      },
      caisseRepo: scopedCaisseRepo(req)
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ENREGISTRER_ENTREE_MANUELLE_CAISSE",
      entite: "CAISSE_OPERATION",
      entiteId: null,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        idCaisseJour: req.params.id,
        montant: Number(body.montant || 0),
        sourceFlux: "MANUEL",
        justification: String(body.justification || "").trim()
      }
    });
    res.json(normalizeCaisse(caisse));
  } catch (err) {
    if (err instanceof PermissionInsuffisante) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// Enregistrer sortie
router.post("/caisse/:id/sorties", requireCaisseSortieAccess, async (req, res) => {
  const schema = z
    .object({
      montant: z.coerce.number(),
      motif: z.string().min(1),
      utilisateur: z.string().min(1).optional(),
      referenceMetier: z.string().optional(),
      typeDepense: z.string().min(1),
      justification: z.string().optional(),
      role: z.string().optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["montant", "motif", "typeDepense"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const caisse = await enregistrerSortie({
      idCaisseJour: req.params.id,
      input: {
        idOperation: generateOperationId(),
        montant: body.montant,
        motif: body.motif,
        referenceMetier: body.referenceMetier || null,
        utilisateur: acteur.utilisateur || body.utilisateur,
        typeDepense: body.typeDepense,
        justification: body.justification || null,
        role: acteur.role || body.role || ""
      },
      caisseRepo: scopedCaisseRepo(req),
      parametresRepo: scopedParametresRepo(req)
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ENREGISTRER_SORTIE_CAISSE",
      entite: "CAISSE_OPERATION",
      entiteId: null,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        idCaisseJour: req.params.id,
        montant: Number(body.montant || 0),
        motif: body.motif || null,
        typeDepense: body.typeDepense || null,
        justification: body.justification || null,
        impactJournalier: String(body.typeDepense || "").toUpperCase() !== "EXCEPTIONNELLE",
        impactGlobal: true
      }
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Annuler operation
router.post("/caisse/:id/operations/:opId/annuler", requireCaisseAnnulationAccess, async (req, res) => {
  const schema = z
    .object({
      motifAnnulation: z.string().min(1),
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;
  const r1 = requireFields(body, ["motifAnnulation"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const caisse = await annulerOperation({
      idCaisseJour: req.params.id,
      input: {
        idOperation: req.params.opId,
        motifAnnulation: body.motifAnnulation,
        utilisateur: acteur.utilisateur || body.utilisateur
      },
      caisseRepo: scopedCaisseRepo(req)
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "ANNULER_OPERATION_CAISSE",
      entite: "CAISSE_OPERATION",
      entiteId: req.params.opId,
      payload: {
        utilisateurNom: acteur.utilisateurNom,
        idCaisseJour: req.params.id,
        motifAnnulation: body.motifAnnulation || null
      }
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cloturer caisse
router.post("/caisse/:id/cloturer", requirePermission(PERMISSIONS.CLOTURER_CAISSE), async (req, res) => {
  const schema = z
    .object({
      utilisateur: z.string().min(1).optional()
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const body = parsed.data;

  try {
    const acteur = resolveActeur(req, body.utilisateur);
    const caisse = await cloturerCaisse({
      idCaisseJour: req.params.id,
      input: { utilisateur: acteur.utilisateur || body.utilisateur },
      caisseRepo: scopedCaisseRepo(req)
    });
    await genererBilansApresCloture({
      caisseCloturee: caisse,
      caisseRepo: scopedCaisseRepo(req),
      bilanRepo: scopedBilanRepo(req),
      parametresRepo: scopedParametresRepo(req),
      utilisateur: acteur.utilisateur || body.utilisateur
    });
    await enregistrerEvenementAudit({
      utilisateurId: acteur.utilisateurId,
      role: acteur.role,
      atelierId: req.auth?.atelierId,
      action: "CLOTURER_CAISSE",
      entite: "CAISSE_JOUR",
      entiteId: req.params.id,
      payload: {
        utilisateurNom: acteur.utilisateurNom
      }
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
