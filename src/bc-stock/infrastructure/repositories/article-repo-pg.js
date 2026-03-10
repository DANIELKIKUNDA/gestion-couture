import { pool } from "../../../shared/infrastructure/db.js";
import { Article } from "../../domain/article.js";

export class ArticleRepoPg {
  constructor(atelierId = "ATELIER") {
    this.atelierId = String(atelierId || "ATELIER");
  }

  forAtelier(atelierId) {
    return new ArticleRepoPg(atelierId);
  }

  async getById(idArticle) {
    const res = await pool.query(
      "SELECT id_article, nom_article, categorie_article, unite_stock, quantite_disponible, prix_achat_moyen, prix_vente_unitaire, seuil_alerte, actif FROM articles WHERE id_article = $1 AND atelier_id = $2",
      [idArticle, this.atelierId]
    );
    if (res.rowCount === 0) return null;

    const movRes = await pool.query(
      "SELECT id_mouvement, type_mouvement, quantite, motif, date_mouvement, effectue_par, reference_metier, fournisseur_id, fournisseur, reference_achat, prix_achat_unitaire, montant_achat_total FROM mouvements_stock WHERE id_article = $1 AND atelier_id = $2",
      [idArticle, this.atelierId]
    );

    const row = res.rows[0];
    return new Article({
      idArticle: row.id_article,
      nomArticle: row.nom_article,
      categorieArticle: row.categorie_article,
      uniteStock: row.unite_stock,
      quantiteDisponible: Number(row.quantite_disponible),
      prixAchatMoyen: Number(row.prix_achat_moyen || 0),
      prixVenteUnitaire: Number(row.prix_vente_unitaire),
      seuilAlerte: Number(row.seuil_alerte),
      actif: row.actif,
      mouvements: movRes.rows.map((m) => ({
        idMouvement: m.id_mouvement,
        typeMouvement: m.type_mouvement,
        quantite: Number(m.quantite),
        motif: m.motif,
        dateMouvement: m.date_mouvement,
        effectuePar: m.effectue_par,
        referenceMetier: m.reference_metier,
        fournisseurId: m.fournisseur_id || null,
        fournisseur: m.fournisseur,
        referenceAchat: m.reference_achat,
        prixAchatUnitaire: m.prix_achat_unitaire === null ? null : Number(m.prix_achat_unitaire),
        montantAchatTotal: m.montant_achat_total === null ? null : Number(m.montant_achat_total)
      }))
    });
  }

  async save(article) {
    await pool.query(
      `INSERT INTO articles (id_article, atelier_id, nom_article, categorie_article, unite_stock, quantite_disponible, prix_achat_moyen, prix_vente_unitaire, seuil_alerte, actif)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id_article)
       DO UPDATE SET atelier_id=$2, nom_article=$3, categorie_article=$4, unite_stock=$5, quantite_disponible=$6,
         prix_achat_moyen=$7, prix_vente_unitaire=$8, seuil_alerte=$9, actif=$10`,
      [
        article.idArticle,
        this.atelierId,
        article.nomArticle,
        article.categorieArticle,
        article.uniteStock,
        article.quantiteDisponible,
        article.prixAchatMoyen,
        article.prixVenteUnitaire,
        article.seuilAlerte,
        article.actif
      ]
    );

    for (const m of article.mouvements) {
      await pool.query(
        `INSERT INTO mouvements_stock (
           id_mouvement, atelier_id, id_article, type_mouvement, quantite, motif, date_mouvement, effectue_par,
           reference_metier, fournisseur_id, fournisseur, reference_achat, prix_achat_unitaire, montant_achat_total
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id_mouvement)
         DO UPDATE SET
           atelier_id=$2,
           type_mouvement=$4,
           quantite=$5,
           motif=$6,
           date_mouvement=$7,
           effectue_par=$8,
           reference_metier=$9,
           fournisseur_id=$10,
           fournisseur=$11,
           reference_achat=$12,
           prix_achat_unitaire=$13,
           montant_achat_total=$14`,
        [
          m.idMouvement,
          this.atelierId,
          article.idArticle,
          m.typeMouvement,
          m.quantite,
          m.motif,
          m.dateMouvement,
          m.effectuePar,
          m.referenceMetier,
          m.fournisseurId || null,
          m.fournisseur || null,
          m.referenceAchat || null,
          m.prixAchatUnitaire === null || m.prixAchatUnitaire === undefined ? null : m.prixAchatUnitaire,
          m.montantAchatTotal === null || m.montantAchatTotal === undefined ? null : m.montantAchatTotal
        ]
      );
    }
  }
}
