import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { RetoucheRepoPg } from "../../infrastructure/repositories/retouche-repo-pg.js";
import { deposerRetouche } from "../../application/use-cases/deposer-retouche.js";
import { demarrerTravail } from "../../application/use-cases/demarrer-travail.js";
import { terminerTravail } from "../../application/use-cases/terminer-travail.js";
import { appliquerPaiement } from "../../application/use-cases/appliquer-paiement.js";
import { livrerRetouche } from "../../application/use-cases/livrer-retouche.js";
import { annulerRetouche } from "../../application/use-cases/annuler-retouche.js";
import { requireFields, requireNumber } from "../../../shared/interfaces/validation.js";
import { generateRetoucheId } from "../../../shared/domain/id-generator.js";

const router = express.Router();
const retoucheRepo = new RetoucheRepoPg();

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

// Audit retouches (read-only)
router.get("/audit/retouches", async (req, res) => {
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
  const r1 = requireFields(req.body, ["idClient", "descriptionRetouche", "typeRetouche", "montantTotal", "typeHabit", "mesuresHabit"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "montantTotal");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const retouche = deposerRetouche({
      ...req.body,
      idRetouche: generateRetoucheId()
    });
    await retoucheRepo.save(retouche);
    res.status(201).json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start work
router.post("/retouches/:id/demarrer", async (req, res) => {
  try {
    const retouche = await demarrerTravail({
      idRetouche: req.params.id,
      parametresAtelier: req.body.parametresAtelier || {},
      retoucheRepo
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finish work
router.post("/retouches/:id/terminer", async (req, res) => {
  try {
    const retouche = await terminerTravail({
      idRetouche: req.params.id,
      retoucheRepo
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment
router.post("/retouches/:id/paiements", async (req, res) => {
  const r1 = requireFields(req.body, ["montant"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const retouche = await appliquerPaiement({
      idRetouche: req.params.id,
      montant: req.body.montant,
      retoucheRepo
    });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deliver
router.post("/retouches/:id/livrer", async (req, res) => {
  try {
    const retouche = await livrerRetouche({ idRetouche: req.params.id, retoucheRepo });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel
router.post("/retouches/:id/annuler", async (req, res) => {
  try {
    const retouche = await annulerRetouche({ idRetouche: req.params.id, retoucheRepo });
    res.json(retouche);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
