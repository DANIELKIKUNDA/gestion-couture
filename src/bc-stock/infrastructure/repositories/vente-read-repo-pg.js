import { pool } from "../../../shared/infrastructure/db.js";

function mapVenteRow(row) {
  return {
    idVente: row.id_vente,
    date: row.date_vente,
    total: Number(row.total),
    totalPrixAchat: Number(row.total_prix_achat || 0),
    beneficeTotal: Number(row.benefice_total || 0),
    statut: row.statut,
    referenceCaisse: row.reference_caisse,
    motifAnnulation: row.motif_annulation || null
  };
}

export class VenteReadRepoPg {
  async listVentes() {
    const result = await pool.query(
      `SELECT id_vente, date_vente, total, statut, reference_caisse, motif_annulation, total_prix_achat, benefice_total
       FROM ventes
       ORDER BY date_vente DESC`
    );
    return result.rows.map(mapVenteRow);
  }
}
