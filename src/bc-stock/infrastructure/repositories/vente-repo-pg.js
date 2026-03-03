import { pool } from "../../../shared/infrastructure/db.js";
import { Vente } from "../../domain/vente.js";

export class VenteRepoPg {
  async getById(idVente) {
    const res = await pool.query(
      "SELECT id_vente, date_vente, total, statut, reference_caisse, motif_annulation FROM ventes WHERE id_vente = $1",
      [idVente]
    );
    if (res.rowCount === 0) return null;

    const lignesRes = await pool.query(
      `SELECT id_ligne, id_article, libelle_article, quantite, prix_unitaire
       FROM vente_lignes
       WHERE id_vente = $1
       ORDER BY id_ligne ASC`,
      [idVente]
    );

    const row = res.rows[0];
    return new Vente({
      idVente: row.id_vente,
      date: row.date_vente,
      total: Number(row.total),
      statut: row.statut,
      referenceCaisse: row.reference_caisse,
      motifAnnulation: row.motif_annulation || null,
      lignesVente: lignesRes.rows.map((l) => ({
        idLigne: l.id_ligne,
        idArticle: l.id_article,
        libelleArticle: l.libelle_article,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prix_unitaire)
      }))
    });
  }

  async save(vente) {
    await pool.query(
      `INSERT INTO ventes (id_vente, date_vente, total, statut, reference_caisse, motif_annulation)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id_vente)
       DO UPDATE SET date_vente=$2, total=$3, statut=$4, reference_caisse=$5, motif_annulation=$6`,
      [vente.idVente, vente.date, vente.total, vente.statut, vente.referenceCaisse, vente.motifAnnulation || null]
    );

    await pool.query("DELETE FROM vente_lignes WHERE id_vente = $1", [vente.idVente]);

    for (const ligne of vente.lignesVente) {
      await pool.query(
        `INSERT INTO vente_lignes (id_ligne, id_vente, id_article, libelle_article, quantite, prix_unitaire)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          ligne.idLigne,
          vente.idVente,
          ligne.idArticle,
          ligne.libelleArticle,
          ligne.quantite,
          ligne.prixUnitaire
        ]
      );
    }
  }
}
