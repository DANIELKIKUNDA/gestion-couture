import { pool } from "../../../shared/infrastructure/db.js";
import { Article } from "../../domain/article.js";

export class ArticleRepoPg {
  async getById(idArticle) {
    const res = await pool.query(
      "SELECT id_article, nom_article, categorie_article, unite_stock, quantite_disponible, prix_vente_unitaire, seuil_alerte, actif FROM articles WHERE id_article = $1",
      [idArticle]
    );
    if (res.rowCount === 0) return null;

    const movRes = await pool.query(
      "SELECT id_mouvement, type_mouvement, quantite, motif, date_mouvement, effectue_par, reference_metier FROM mouvements_stock WHERE id_article = $1",
      [idArticle]
    );

    const row = res.rows[0];
    return new Article({
      idArticle: row.id_article,
      nomArticle: row.nom_article,
      categorieArticle: row.categorie_article,
      uniteStock: row.unite_stock,
      quantiteDisponible: Number(row.quantite_disponible),
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
        referenceMetier: m.reference_metier
      }))
    });
  }

  async save(article) {
    await pool.query(
      `INSERT INTO articles (id_article, nom_article, categorie_article, unite_stock, quantite_disponible, prix_vente_unitaire, seuil_alerte, actif)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id_article)
       DO UPDATE SET nom_article=$2, categorie_article=$3, unite_stock=$4, quantite_disponible=$5,
         prix_vente_unitaire=$6, seuil_alerte=$7, actif=$8`,
      [
        article.idArticle,
        article.nomArticle,
        article.categorieArticle,
        article.uniteStock,
        article.quantiteDisponible,
        article.prixVenteUnitaire,
        article.seuilAlerte,
        article.actif
      ]
    );

    for (const m of article.mouvements) {
      await pool.query(
        `INSERT INTO mouvements_stock (id_mouvement, id_article, type_mouvement, quantite, motif, date_mouvement, effectue_par, reference_metier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id_mouvement)
         DO UPDATE SET type_mouvement=$3, quantite=$4, motif=$5, date_mouvement=$6, effectue_par=$7, reference_metier=$8`,
        [
          m.idMouvement,
          article.idArticle,
          m.typeMouvement,
          m.quantite,
          m.motif,
          m.dateMouvement,
          m.effectuePar,
          m.referenceMetier
        ]
      );
    }
  }
}
