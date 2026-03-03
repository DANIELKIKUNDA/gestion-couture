import express from "express";
import { pool } from "../../../shared/infrastructure/db.js";
import { CommandeRepoPg } from "../../infrastructure/repositories/commande-repo-pg.js";
import { creerCommande } from "../../application/use-cases/creer-commande.js";
import { demarrerTravail } from "../../application/use-cases/demarrer-travail.js";
import { terminerTravail } from "../../application/use-cases/terminer-travail.js";
import { appliquerPaiement } from "../../application/use-cases/appliquer-paiement.js";
import { livrerCommande } from "../../application/use-cases/livrer-commande.js";
import { annulerCommande } from "../../application/use-cases/annuler-commande.js";
import { requireFields, requireNumber } from "../../../shared/interfaces/validation.js";
import { generateCommandeId } from "../../../shared/domain/id-generator.js";

const router = express.Router();
const commandeRepo = new CommandeRepoPg();

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
router.get("/audit/commandes", async (req, res) => {
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
  const r1 = requireFields(req.body, ["idClient", "descriptionCommande", "montantTotal", "typeHabit", "mesuresHabit"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "montantTotal");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const commande = creerCommande({
      ...req.body,
      idCommande: generateCommandeId()
    });
    await commandeRepo.save(commande);
    res.status(201).json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start work
router.post("/commandes/:id/demarrer", async (req, res) => {
  try {
    const commande = await demarrerTravail({
      idCommande: req.params.id,
      parametresAtelier: req.body.parametresAtelier || {},
      commandeRepo
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finish work
router.post("/commandes/:id/terminer", async (req, res) => {
  try {
    const commande = await terminerTravail({
      idCommande: req.params.id,
      commandeRepo
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Apply payment
router.post("/commandes/:id/paiements", async (req, res) => {
  const r1 = requireFields(req.body, ["montant"]);
  if (!r1.ok) return res.status(400).json({ error: r1.error });
  const r2 = requireNumber(req.body, "montant");
  if (!r2.ok) return res.status(400).json({ error: r2.error });

  try {
    const commande = await appliquerPaiement({
      idCommande: req.params.id,
      montant: req.body.montant,
      commandeRepo
    });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deliver
router.post("/commandes/:id/livrer", async (req, res) => {
  try {
    const commande = await livrerCommande({ idCommande: req.params.id, commandeRepo });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel
router.post("/commandes/:id/annuler", async (req, res) => {
  try {
    const commande = await annulerCommande({ idCommande: req.params.id, commandeRepo });
    res.json(commande);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
