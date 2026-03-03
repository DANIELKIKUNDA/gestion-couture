import { pool } from "../../../shared/infrastructure/db.js";
import { Retouche } from "../../domain/retouche.js";

export class RetoucheRepoPg {
  async getById(idRetouche) {
    const res = await pool.query(
      "SELECT id_retouche, id_client, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot FROM retouches WHERE id_retouche = $1",
      [idRetouche]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return new Retouche({
      idRetouche: row.id_retouche,
      idClient: row.id_client,
      descriptionRetouche: row.description,
      typeRetouche: row.type_retouche,
      dateDepot: row.date_depot,
      datePrevue: row.date_prevue,
      montantTotal: Number(row.montant_total),
      montantPaye: Number(row.montant_paye),
      statutRetouche: row.statut,
      typeHabit: row.type_habit,
      mesuresHabit: row.mesures_habit_snapshot
    });
  }

  async save(retouche) {
    await pool.query(
      `INSERT INTO retouches (id_retouche, id_client, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id_retouche)
       DO UPDATE SET id_client=$2, description=$3, type_retouche=$4, date_depot=$5, date_prevue=$6,
         montant_total=$7, montant_paye=$8, statut=$9, type_habit=$10, mesures_habit_snapshot=$11`,
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
  }
}
