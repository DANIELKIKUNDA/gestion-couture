import { pool } from "../../../shared/infrastructure/db.js";
import { Vente } from "../../domain/vente.js";

export class VenteRepoPg {
  constructor(atelierId = "ATELIER", db = pool) {
    this.atelierId = String(atelierId || "ATELIER");
    this.db = db;
  }

  forAtelier(atelierId) {
    return new VenteRepoPg(atelierId, this.db);
  }

  async ensureAcheteurColumns() {
    await this.db.query("ALTER TABLE ventes ADD COLUMN IF NOT EXISTS acheteur_nom TEXT");
  }

  async getById(idVente) {
    await this.ensureAcheteurColumns();
    const res = await this.db.query(
      "SELECT id_vente, date_vente, acheteur_nom, total, total_prix_achat, benefice_total, statut, reference_caisse, motif_annulation FROM ventes WHERE id_vente = $1 AND atelier_id = $2",
      [idVente, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const lignesRes = await this.db.query(
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
      acheteurNom: row.acheteur_nom || "",
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
    await this.ensureAcheteurColumns();
    await this.db.query(
      `INSERT INTO ventes (id_vente, atelier_id, date_vente, acheteur_nom, total, total_prix_achat, benefice_total, statut, reference_caisse, motif_annulation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id_vente)
       DO UPDATE SET atelier_id=$2, date_vente=$3, acheteur_nom=$4, total=$5, total_prix_achat=$6, benefice_total=$7, statut=$8, reference_caisse=$9, motif_annulation=$10`,
      [
        vente.idVente,
        this.atelierId,
        vente.date,
        vente.acheteurNom || null,
        vente.total,
        vente.totalPrixAchat,
        vente.beneficeTotal,
        vente.statut,
        vente.referenceCaisse,
        vente.motifAnnulation || null
      ]
    );

    await this.db.query("DELETE FROM vente_lignes WHERE id_vente = $1 AND atelier_id = $2", [vente.idVente, this.atelierId]);

    for (const ligne of vente.lignesVente) {
      await this.db.query(
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
