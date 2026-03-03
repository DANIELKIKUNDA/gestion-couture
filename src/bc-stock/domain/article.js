import { TypeMouvement, assertPositive } from "./value-objects.js";
import { StockInsuffisant, ArticleInactif } from "./errors.js";

export class Article {
  constructor({
    idArticle,
    nomArticle,
    categorieArticle,
    uniteStock,
    quantiteDisponible = 0,
    prixVenteUnitaire = 0,
    seuilAlerte = 0,
    actif = true,
    mouvements = []
  }) {
    if (!idArticle) throw new Error("idArticle required");
    if (!nomArticle) throw new Error("nomArticle required");
    this.idArticle = idArticle;
    this.nomArticle = nomArticle;
    this.categorieArticle = categorieArticle;
    this.uniteStock = uniteStock;
    this.quantiteDisponible = quantiteDisponible;
    this.prixVenteUnitaire = prixVenteUnitaire;
    this.seuilAlerte = seuilAlerte;
    this.actif = actif;
    this.mouvements = mouvements;
  }

  assertActif() {
    if (!this.actif) throw new ArticleInactif("Article inactif");
  }

  entrerStock({ idMouvement, quantite, motif, utilisateur, referenceMetier }) {
    this.assertActif();
    assertPositive(quantite, "quantite");

    this.quantiteDisponible += quantite;
    this.mouvements.push({
      idMouvement,
      typeMouvement: TypeMouvement.ENTREE,
      quantite,
      motif,
      dateMouvement: new Date().toISOString(),
      effectuePar: utilisateur,
      referenceMetier: referenceMetier || null
    });
  }

  sortirStock({ idMouvement, quantite, motif, utilisateur, referenceMetier }) {
    this.assertActif();
    assertPositive(quantite, "quantite");
    if (this.quantiteDisponible < quantite) throw new StockInsuffisant("Stock insuffisant");

    this.quantiteDisponible -= quantite;
    this.mouvements.push({
      idMouvement,
      typeMouvement: TypeMouvement.SORTIE,
      quantite,
      motif,
      dateMouvement: new Date().toISOString(),
      effectuePar: utilisateur,
      referenceMetier: referenceMetier || null
    });
  }

  ajusterStock({ idMouvement, quantite, motif, utilisateur, referenceMetier }) {
    this.assertActif();
    assertPositive(Math.abs(quantite), "quantite");

    if (quantite >= 0) {
      this.entrerStock({ idMouvement, quantite, motif, utilisateur, referenceMetier });
    } else {
      this.sortirStock({ idMouvement, quantite: Math.abs(quantite), motif, utilisateur, referenceMetier });
    }
  }

  activer() {
    this.actif = true;
  }

  desactiver() {
    this.actif = false;
  }
}
