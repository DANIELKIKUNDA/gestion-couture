import { pool } from "../../../shared/infrastructure/db.js";

export class BilanCaisseRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new BilanCaisseRepoPg(atelierId);
  }

  async getLatest(typeBilan) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 AND atelier_id = $2 ORDER BY date_fin DESC LIMIT 1",
      [typeBilan, this.atelierId]
    );
    return res.rowCount === 0 ? null : res.rows[0];
  }

  async listByPeriod(typeBilan, dateDebut, dateFin) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 AND date_debut = $2 AND date_fin = $3 AND atelier_id = $4",
      [typeBilan, dateDebut, dateFin, this.atelierId]
    );
    return res.rows;
  }

  async listByType(typeBilan, limit = 100) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 AND atelier_id = $2 ORDER BY date_fin DESC LIMIT $3",
      [typeBilan, this.atelierId, limit]
    );
    return res.rows;
  }

  async getByPeriod(typeBilan, dateDebut, dateFin) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 AND date_debut = $2 AND date_fin = $3 AND atelier_id = $4 LIMIT 1",
      [typeBilan, dateDebut, dateFin, this.atelierId]
    );
    return res.rowCount === 0 ? null : res.rows[0];
  }

  async save(bilan) {
    await pool.query(
      `INSERT INTO caisse_bilan (
         id_bilan, atelier_id, type_bilan, semaine_iso, mois, annee, date_debut, date_fin,
         solde_ouverture, total_entrees, total_sorties, solde_cloture,
         nombre_jours, nombre_operations, cree_par, date_creation
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (atelier_id, type_bilan, date_debut, date_fin) DO NOTHING`,
      [
        bilan.idBilan,
        this.atelierId,
        bilan.typeBilan,
        bilan.semaine === undefined ? null : bilan.semaine,
        bilan.mois === undefined ? null : bilan.mois,
        bilan.annee === undefined ? null : bilan.annee,
        bilan.dateDebut,
        bilan.dateFin,
        bilan.soldeOuverture,
        bilan.totalEntrees,
        bilan.totalSorties,
        bilan.soldeCloture,
        bilan.nombreJours || 0,
        bilan.nombreOperations || 0,
        bilan.creePar || null,
        bilan.dateCreation
      ]
    );
  }
}
