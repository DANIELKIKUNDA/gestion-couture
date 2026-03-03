import { pool } from "../../../shared/infrastructure/db.js";

export class BilanCaisseRepoPg {
  async getLatest(typeBilan) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 ORDER BY date_fin DESC LIMIT 1",
      [typeBilan]
    );
    return res.rowCount === 0 ? null : res.rows[0];
  }

  async listByPeriod(typeBilan, dateDebut, dateFin) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 AND date_debut = $2 AND date_fin = $3",
      [typeBilan, dateDebut, dateFin]
    );
    return res.rows;
  }

  async listByType(typeBilan, limit = 100) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 ORDER BY date_fin DESC LIMIT $2",
      [typeBilan, limit]
    );
    return res.rows;
  }

  async getByPeriod(typeBilan, dateDebut, dateFin) {
    const res = await pool.query(
      "SELECT * FROM caisse_bilan WHERE type_bilan = $1 AND date_debut = $2 AND date_fin = $3 LIMIT 1",
      [typeBilan, dateDebut, dateFin]
    );
    return res.rowCount === 0 ? null : res.rows[0];
  }

  async save(bilan) {
    await pool.query(
      `INSERT INTO caisse_bilan (id_bilan, type_bilan, date_debut, date_fin, solde_ouverture, total_entrees, total_sorties, solde_cloture, cree_par, date_creation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (type_bilan, date_debut, date_fin) DO NOTHING`,
      [
        bilan.idBilan,
        bilan.typeBilan,
        bilan.dateDebut,
        bilan.dateFin,
        bilan.soldeOuverture,
        bilan.totalEntrees,
        bilan.totalSorties,
        bilan.soldeCloture,
        bilan.creePar || null,
        bilan.dateCreation
      ]
    );
  }
}
