import { pool } from "../../../shared/infrastructure/db.js";
import { Commande } from "../../domain/commande.js";

export class CommandeRepoPg {
  // Fetch a Commande by ID and rehydrate the aggregate
  async getById(idCommande) {
    const res = await pool.query(
      "SELECT id_commande, id_client, description, date_creation, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot FROM commandes WHERE id_commande = $1",
      [idCommande]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return new Commande({
      idCommande: row.id_commande,
      idClient: row.id_client,
      descriptionCommande: row.description,
      dateCreation: row.date_creation,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      statutCommande: row.statut,
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot
    });
  }

  // Upsert Commande
  async save(commande) {
    await pool.query(
      `INSERT INTO commandes (id_commande, id_client, description, date_creation, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id_commande)
       DO UPDATE SET id_client=$2, description=$3, date_creation=$4, date_prevue=$5,
         montant_total=$6, montant_paye=$7, statut=$8, type_habit=$9, mesures_habit_snapshot=$10`,
      [
        commande.idCommande,
        commande.idClient,
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
