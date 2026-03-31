import { pool } from "../../../shared/infrastructure/db.js";
import { Commande } from "../../domain/commande.js";

export class CommandeRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new CommandeRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new CommandeRepoPg(this.atelierId, db || pool);
  }

  async existsByTypeHabit(typeHabit) {
    const normalized = String(typeHabit || "").trim().toUpperCase();
    if (!normalized) return false;
    const res = await pool.query("SELECT 1 FROM commandes WHERE atelier_id = $1 AND UPPER(type_habit) = $2 LIMIT 1", [this.atelierId, normalized]);
    return res.rowCount > 0;
  }

  // Fetch a Commande by ID and rehydrate the aggregate
  async getById(idCommande) {
    const res = await this.db.query(
      "SELECT id_commande, id_client, id_dossier, description, date_creation, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot FROM commandes WHERE id_commande = $1 AND atelier_id = $2",
      [idCommande, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return new Commande({
      idCommande: row.id_commande,
      idClient: row.id_client,
      dossierId: row.id_dossier,
      descriptionCommande: row.description,
      dateCreation: row.date_creation,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      statutCommande: row.statut,
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot,
      rehydrate: true
    });
  }

  // Upsert Commande
  async save(commande) {
    await this.db.query(
      `INSERT INTO commandes (id_commande, atelier_id, id_client, id_dossier, description, date_creation, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id_commande)
       DO UPDATE SET atelier_id=$2, id_client=$3, id_dossier=$4, description=$5, date_creation=$6, date_prevue=$7,
         montant_total=$8, montant_paye=$9, statut=$10, type_habit=$11, mesures_habit_snapshot=$12`,
      [
        commande.idCommande,
        this.atelierId,
        commande.idClient,
        commande.dossierId,
        commande.descriptionCommande,
        commande.dateCreation,
        commande.datePrevue,
        commande.montantTotal,
        commande.montantPaye,
        commande.statutCommande,
        commande.typeHabit,
        JSON.stringify(commande.mesuresHabit)
      ]
    );
  }
}
