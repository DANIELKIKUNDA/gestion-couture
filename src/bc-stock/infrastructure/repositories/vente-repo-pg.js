import { pool } from "../../../shared/infrastructure/db.js";
import { Vente } from "../../domain/vente.js";

export class VenteRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new VenteRepoPg(atelierId);
  }

  async getById(idVente) {
    const res = await pool.query(
      "SELECT id_vente, date_vente, total, total_prix_achat, benefice_total, statut, reference_caisse, motif_annulation FROM ventes WHERE id_vente = $1 AND atelier_id = $2",
      [idVente, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const lignesRes = await pool.query(
      `SELECT id_ligne, id_article, libelle_article, quantite, prix_unitaire, prix_achat_unitaire, benefice_unitaire, benefice_total
       FROM vente_lignes
       WHERE id_vente = $1 AND atelier_id = $2
       ORDER BY id_ligne ASC`,
      [idVente, this.atelierId]
    );

    const row = res.rows[0];
    return new Vente({
      idVente: row.id_vente,
      date: row.date_vente,
      total: Number(row.total),
      totalPrixAchat: Number(row.total_prix_achat || 0),
      beneficeTotal: Number(row.benefice_total || 0),
      statut: row.statut,
      referenceCaisse: row.reference_caisse,
      motifAnnulation: row.motif_annulation || null,
      lignesVente: lignesRes.rows.map((l) => ({
        idLigne: l.id_ligne,
        idArticle: l.id_article,
        libelleArticle: l.libelle_article,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prix_unitaire),
        prixAchatUnitaire: Number(l.prix_achat_unitaire || 0),
        beneficeUnitaire: Number(l.benefice_unitaire || 0),
        beneficeTotal: Number(l.benefice_total || 0)
      }))
    });
  }

  async save(vente) {
    await pool.query(
      `INSERT INTO ventes (id_vente, atelier_id, date_vente, total, total_prix_achat, benefice_total, statut, reference_caisse, motif_annulation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id_vente)
       DO UPDATE SET atelier_id=$2, date_vente=$3, total=$4, total_prix_achat=$5, benefice_total=$6, statut=$7, reference_caisse=$8, motif_annulation=$9`,
      [vente.idVente, this.atelierId, vente.date, vente.total, vente.totalPrixAchat, vente.beneficeTotal, vente.statut, vente.referenceCaisse, vente.motifAnnulation || null]
    );

    await pool.query("DELETE FROM vente_lignes WHERE id_vente = $1 AND atelier_id = $2", [vente.idVente, this.atelierId]);

    for (const ligne of vente.lignesVente) {
      await pool.query(
        `INSERT INTO vente_lignes (
           id_ligne, atelier_id, id_vente, id_article, libelle_article, quantite, prix_unitaire, prix_achat_unitaire, benefice_unitaire, benefice_total
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          ligne.idLigne,
          this.atelierId,
          vente.idVente,
          ligne.idArticle,
          ligne.libelleArticle,
          ligne.quantite,
          ligne.prixUnitaire,
          ligne.prixAchatUnitaire,
          ligne.beneficeUnitaire,
          ligne.beneficeTotal
        ]
      );
    }
  }
}
