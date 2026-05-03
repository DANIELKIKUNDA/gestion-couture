import { pool } from "../../../shared/infrastructure/db.js";

function mapVenteRow(row) {
  return {
    idVente: row.id_vente,
    date: row.date_vente,
    acheteurNom: row.acheteur_nom || "",
    total: Number(row.total),
    totalPrixAchat: Number(row.total_prix_achat || 0),
    beneficeTotal: Number(row.benefice_total || 0),
    statut: row.statut,
    referenceCaisse: row.reference_caisse,
    motifAnnulation: row.motif_annulation || null
  };
}

export class VenteReadRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new VenteReadRepoPg(atelierId);
  }

  async ensureAcheteurColumns() {
    await pool.query("ALTER TABLE ventes ADD COLUMN IF NOT EXISTS acheteur_nom TEXT");
  }

  async listVentes() {
    await this.ensureAcheteurColumns();
    const result = await pool.query(
      `SELECT id_vente, date_vente, acheteur_nom, total, statut, reference_caisse, motif_annulation, total_prix_achat, benefice_total
       FROM ventes
       WHERE atelier_id = $1
       ORDER BY date_vente DESC`,
      [this.atelierId]
    );
    return result.rows.map(mapVenteRow);
  }
}
