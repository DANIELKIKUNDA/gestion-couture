import { pool } from "../../../shared/infrastructure/db.js";
import { Retouche } from "../../domain/retouche.js";

export class RetoucheRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new RetoucheRepoPg(atelierId, this.db);
  }

  withExecutor(db) {
    return new RetoucheRepoPg(this.atelierId, db || pool);
  }

  async getById(idRetouche) {
    const res = await this.db.query(
      "SELECT id_retouche, id_client, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot FROM retouches WHERE id_retouche = $1 AND atelier_id = $2",
      [idRetouche, this.atelierId]
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
      mesuresHabit: row.mesures_habit_snapshot,
      rehydrate: true
    });
  }

  async save(retouche) {
    await this.db.query(
      `INSERT INTO retouches (id_retouche, atelier_id, id_client, description, type_retouche, date_depot, date_prevue, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id_retouche)
       DO UPDATE SET atelier_id=$2, id_client=$3, description=$4, type_retouche=$5, date_depot=$6, date_prevue=$7,
         montant_total=$8, montant_paye=$9, statut=$10, type_habit=$11, mesures_habit_snapshot=$12`,
      [
        retouche.idRetouche,
        this.atelierId,
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
