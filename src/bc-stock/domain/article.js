import { TypeMouvement, assertPositive } from "./value-objects.js";
import { StockInsuffisant, ArticleInactif } from "./errors.js";

export class Article {
  constructor({
    idArticle,
    nomArticle,
    categorieArticle,
    uniteStock,
    quantiteDisponible = 0,
    prixAchatMoyen = 0,
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
    this.prixAchatMoyen = Number(prixAchatMoyen || 0);
    this.prixVenteUnitaire = prixVenteUnitaire;
    this.seuilAlerte = seuilAlerte;
    this.actif = actif;
    this.mouvements = mouvements;
  }

  assertActif() {
    if (!this.actif) throw new ArticleInactif("Article inactif");
  }

  entrerStock({
    idMouvement,
    quantite,
    motif,
    utilisateur,
    referenceMetier,
    fournisseurId,
    fournisseur,
    referenceAchat,
    prixAchatUnitaire
  }) {
    this.assertActif();
    assertPositive(quantite, "quantite");

    const quantiteAvant = Number(this.quantiteDisponible || 0);
    this.quantiteDisponible += quantite;
    const prixAchat = typeof prixAchatUnitaire === "number" && !Number.isNaN(prixAchatUnitaire) ? prixAchatUnitaire : null;
    this.mouvements.push({
      idMouvement,
      typeMouvement: TypeMouvement.ENTREE,
      quantite,
      motif,
      dateMouvement: new Date().toISOString(),
      effectuePar: utilisateur,
      referenceMetier: referenceMetier || null,
      fournisseurId: fournisseurId || null,
      fournisseur: fournisseur || null,
      referenceAchat: referenceAchat || null,
      prixAchatUnitaire: prixAchat,
      montantAchatTotal: prixAchat === null ? null : quantite * prixAchat
    });

    if (prixAchat !== null) {
      const valeurAvant = quantiteAvant * Number(this.prixAchatMoyen || 0);
      const valeurEntree = quantite * prixAchat;
      const nouvelleQuantite = quantiteAvant + quantite;
      this.prixAchatMoyen = nouvelleQuantite <= 0 ? 0 : (valeurAvant + valeurEntree) / nouvelleQuantite;
    }
  }

  sortirStock({ idMouvement, quantite, motif, utilisateur, referenceMetier, fournisseurId, fournisseur, referenceAchat }) {
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
      referenceMetier: referenceMetier || null,
      fournisseurId: fournisseurId || null,
      fournisseur: fournisseur || null,
      referenceAchat: referenceAchat || null,
      prixAchatUnitaire: Number(this.prixAchatMoyen || 0),
      montantAchatTotal: quantite * Number(this.prixAchatMoyen || 0)
    });
  }

  ajusterStock({ idMouvement, quantite, motif, utilisateur, referenceMetier, fournisseurId, fournisseur, referenceAchat, prixAchatUnitaire }) {
    this.assertActif();
    assertPositive(Math.abs(quantite), "quantite");

    if (quantite >= 0) {
      this.entrerStock({ idMouvement, quantite, motif, utilisateur, referenceMetier, fournisseurId, fournisseur, referenceAchat, prixAchatUnitaire });
    } else {
      this.sortirStock({ idMouvement, quantite: Math.abs(quantite), motif, utilisateur, referenceMetier, fournisseurId, fournisseur, referenceAchat });
    }
  }

  activer() {
    this.actif = true;
  }

  desactiver() {
    this.actif = false;
  }
}
