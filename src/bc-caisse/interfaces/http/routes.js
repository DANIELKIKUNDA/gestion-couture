import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { CaisseRepoPg } from "../../infrastructure/repositories/caisse-repo-pg.js";
import { BilanCaisseRepoPg } from "../../infrastructure/repositories/bilan-caisse-repo-pg.js";
import { ouvrirCaisseDuJour } from "../../application/use-cases/ouvrir-caisse-du-jour.js";
import { preparerOuvertureCaisseDuJour } from "../../application/use-cases/preparer-ouverture-caisse.js";
import { enregistrerEntree } from "../../application/use-cases/enregistrer-entree.js";
import { enregistrerSortie } from "../../application/use-cases/enregistrer-sortie.js";
import { annulerOperation } from "../../application/use-cases/annuler-operation.js";
import { cloturerCaisse } from "../../application/use-cases/cloturer-caisse.js";
import { requireFields, requireNumber } from "../../../shared/interfaces/validation.js";
import { generateOperationId } from "../../../shared/domain/id-generator.js";

const router = express.Router();
const caisseRepo = new CaisseRepoPg();
const bilanRepo = new BilanCaisseRepoPg();

function normalizeCaisse(caisse) {
  const operations = caisse.operations || [];
  const soldeCourant = operations.reduce((sum, op) => {
    if (op.statutOperation === "ANNULEE") return sum;
    if (op.typeOperation === "ENTREE") return sum + Number(op.montant || 0);
    if (op.typeOperation === "SORTIE") return sum - Number(op.montant || 0);
    return sum;
  }, Number(caisse.soldeOuverture || 0));

  return {
    idCaisseJour: caisse.idCaisseJour,
    date: caisse.date,
    statutCaisse: caisse.statutCaisse,
    soldeOuverture: Number(caisse.soldeOuverture || 0),
    soldeCloture: caisse.soldeCloture === null ? null : Number(caisse.soldeCloture),
    soldeCourant,
    ouvertePar: caisse.ouvertePar,
    clotureePar: caisse.clotureePar,
    dateOuverture: caisse.dateOuverture,
    dateCloture: caisse.dateCloture,
    ouvertureAnticipee: caisse.ouvertureAnticipee === true,
    motifOuvertureAnticipee: caisse.motifOuvertureAnticipee || null,
    autoriseePar: caisse.autoriseePar || null,
    operations
  };
}

// List caisse days
router.get("/caisse", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_caisse_jour, date_jour, statut, solde_ouverture, solde_cloture, ouverte_par, cloturee_par, date_ouverture, date_cloture
       FROM caisse_jour
       ORDER BY date_jour DESC`
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
    res.status(400).json({ error: err.message });
  }
});

// Get caisse day by id with operations
router.get("/caisse/:id", async (req, res, next) => {
  const reserved = new Set(["bilans", "audit", "ouvrir", "ouverture-info"]);
  if (reserved.has(String(req.params.id || "").toLowerCase())) return next();
  try {
    const caisse = await caisseRepo.getById(req.params.id);
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
      caisseRepo,
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
router.get("/caisse/bilans", async (req, res) => {
  const typeBilan = req.query.type;
  const dateDebut = req.query.dateDebut;
  const dateFin = req.query.dateFin;
  const mode = req.query.mode || "";
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  if (!typeBilan) return res.status(400).json({ error: "type requis" });

  try {
    let rows = [];
    if (mode === "all") {
      rows = await bilanRepo.listByType(typeBilan, limit);
    } else {
      if (!dateDebut || !dateFin) {
        return res.status(400).json({ error: "dateDebut et dateFin requis" });
      }
      rows = await bilanRepo.listByPeriod(typeBilan, dateDebut, dateFin);
    }
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get dernier bilan
router.get("/caisse/bilans/dernier", async (req, res) => {
  const typeBilan = req.query.type;
  if (!typeBilan) return res.status(400).json({ error: "type requis" });

  try {
    const row = await bilanRepo.getLatest(typeBilan);
    if (!row) return res.status(404).json({ error: "Bilan introuvable" });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit: bilan journalier (caisses cloturees)
router.get("/caisse/audit/journalier", async (req, res) => {
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
        COALESCE(COUNT(op.id_operation), 0) AS nombre_operations
      FROM caisse_jour cj
      LEFT JOIN caisse_operation op ON op.id_caisse_jour = cj.id_caisse_jour
      WHERE cj.statut = 'CLOTUREE'
      GROUP BY cj.id_caisse_jour
      ORDER BY cj.date_jour DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Audit: journal global des operations
router.get("/caisse/audit/operations", async (req, res) => {
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
        op.id_caisse_jour
      FROM caisse_operation op
      ORDER BY op.date_operation DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a caisse jour
router.post("/caisse", async (req, res) => {
  const r1 = requireFields(req.body, ["soldeOuverture", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "soldeOuverture");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const caisse = await ouvrirCaisseDuJour({
      utilisateur: req.body.utilisateur,
      soldeInitial: req.body.soldeOuverture,
      overrideHeureOuverture: req.body.overrideHeureOuverture === true,
      role: req.body.role || "",
      motifOverride: req.body.motifOverride || "",
      caisseRepo
    });
    res.status(201).json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Open caisse du jour (server date)
router.post("/caisse/ouvrir", async (req, res) => {
  const r1 = requireFields(req.body, ["soldeOuverture", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "soldeOuverture");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const caisse = await ouvrirCaisseDuJour({
      utilisateur: req.body.utilisateur,
      soldeInitial: req.body.soldeOuverture,
      overrideHeureOuverture: req.body.overrideHeureOuverture === true,
      role: req.body.role || "",
      motifOverride: req.body.motifOverride || "",
      caisseRepo
    });
    res.status(201).json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Enregistrer entree
router.post("/caisse/:id/entrees", async (req, res) => {
  const r1 = requireFields(req.body, ["montant", "modePaiement", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const caisse = await enregistrerEntree({
      idCaisseJour: req.params.id,
      input: {
        idOperation: generateOperationId(),
        montant: req.body.montant,
        modePaiement: req.body.modePaiement,
        motif: req.body.motif,
        referenceMetier: req.body.referenceMetier || null,
        utilisateur: req.body.utilisateur
      },
      caisseRepo
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Enregistrer sortie
router.post("/caisse/:id/sorties", async (req, res) => {
  const r1 = requireFields(req.body, ["montant", "motif", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const caisse = await enregistrerSortie({
      idCaisseJour: req.params.id,
      input: {
        idOperation: generateOperationId(),
        montant: req.body.montant,
        motif: req.body.motif,
        utilisateur: req.body.utilisateur
      },
      caisseRepo
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Annuler operation
router.post("/caisse/:id/operations/:opId/annuler", async (req, res) => {
  const r1 = requireFields(req.body, ["motifAnnulation", "utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const caisse = await annulerOperation({
      idCaisseJour: req.params.id,
      input: {
        idOperation: req.params.opId,
        motifAnnulation: req.body.motifAnnulation,
        utilisateur: req.body.utilisateur
      },
      caisseRepo
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cloturer caisse
router.post("/caisse/:id/cloturer", async (req, res) => {
  const r1 = requireFields(req.body, ["utilisateur"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });

  try {
    const caisse = await cloturerCaisse({
      idCaisseJour: req.params.id,
      input: { utilisateur: req.body.utilisateur },
      caisseRepo
    });
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
