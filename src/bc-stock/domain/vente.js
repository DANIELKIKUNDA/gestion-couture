import { StatutVente, assertPositive, assertNonEmpty } from "./value-objects.js";
import { VenteDejaValidee, VenteDejaAnnulee, VenteInvalide } from "./errors.js";

function calculerTotal(lignesVente = []) {
  return lignesVente.reduce((sum, ligne) => sum + Number(ligne.quantite || 0) * Number(ligne.prixUnitaire || 0), 0);
}

function calculerTotalPrixAchat(lignesVente = []) {
  return lignesVente.reduce((sum, ligne) => sum + Number(ligne.quantite || 0) * Number(ligne.prixAchatUnitaire || 0), 0);
}

function normalizeLignes(lignesVente = []) {
  if (!Array.isArray(lignesVente) || lignesVente.length === 0) {
    throw new VenteInvalide("lignesVente doit contenir au moins une ligne");
  }

  return lignesVente.map((ligne) => {
    assertNonEmpty(ligne.idArticle, "idArticle");
    assertNonEmpty(ligne.libelleArticle, "libelleArticle");
    assertNonEmpty(ligne.idLigne, "idLigne");
    assertPositive(Number(ligne.quantite), "quantite");
    const prix = Number(ligne.prixUnitaire);
    if (Number.isNaN(prix) || prix < 0) {
      throw new VenteInvalide("prixUnitaire doit etre >= 0");
    }
    const prixAchat = Number(ligne.prixAchatUnitaire ?? 0);
    if (Number.isNaN(prixAchat) || prixAchat < 0) {
      throw new VenteInvalide("prixAchatUnitaire doit etre >= 0");
    }
    const beneficeUnitaire = Number(ligne.beneficeUnitaire ?? prix - prixAchat);
    const beneficeTotal = Number(ligne.beneficeTotal ?? beneficeUnitaire * Number(ligne.quantite));
    return {
      idLigne: ligne.idLigne,
      idArticle: ligne.idArticle,
      libelleArticle: ligne.libelleArticle,
      quantite: Number(ligne.quantite),
      prixUnitaire: prix,
      prixAchatUnitaire: prixAchat,
      beneficeUnitaire,
      beneficeTotal
    };
  });
}

export class Vente {
  constructor({
    idVente,
    date,
    lignesVente,
    total = null,
    totalPrixAchat = null,
    beneficeTotal = null,
    statut = StatutVente.BROUILLON,
    referenceCaisse = null,
    motifAnnulation = null
  }) {
    assertNonEmpty(idVente, "idVente");
    this.idVente = idVente;
    this.date = date || new Date().toISOString();
    this.statut = statut;
    this.referenceCaisse = referenceCaisse || null;
    this.motifAnnulation = motifAnnulation || null;

    this.lignesVente = normalizeLignes(lignesVente);
    const computedTotal = calculerTotal(this.lignesVente);
    const computedTotalPrixAchat = calculerTotalPrixAchat(this.lignesVente);
    this.total = total === null || total === undefined ? computedTotal : Number(total);
    this.totalPrixAchat =
      totalPrixAchat === null || totalPrixAchat === undefined ? computedTotalPrixAchat : Number(totalPrixAchat);
    this.beneficeTotal =
      beneficeTotal === null || beneficeTotal === undefined ? this.total - this.totalPrixAchat : Number(beneficeTotal);
    if (Number.isNaN(this.total) || this.total < 0) {
      throw new VenteInvalide("total doit etre >= 0");
    }
    if (Number.isNaN(this.totalPrixAchat) || this.totalPrixAchat < 0) {
      throw new VenteInvalide("totalPrixAchat doit etre >= 0");
    }
    if (Number.isNaN(this.beneficeTotal)) {
      throw new VenteInvalide("beneficeTotal invalide");
    }
  }

  assertBrouillon() {
    if (this.statut === StatutVente.VALIDEE) {
      throw new VenteDejaValidee("Vente deja validee");
    }
    if (this.statut === StatutVente.ANNULEE) {
      throw new VenteDejaAnnulee("Vente deja annulee");
    }
  }

  setLignes(lignesVente) {
    this.assertBrouillon();
    this.lignesVente = normalizeLignes(lignesVente);
    this.total = calculerTotal(this.lignesVente);
    this.totalPrixAchat = calculerTotalPrixAchat(this.lignesVente);
    this.beneficeTotal = this.total - this.totalPrixAchat;
  }

  appliquerPrixAchatParArticle(mapPrixAchat = new Map()) {
    this.assertBrouillon();
    this.lignesVente = this.lignesVente.map((ligne) => {
      const prixAchatUnitaire = Number(mapPrixAchat.get(ligne.idArticle) ?? ligne.prixAchatUnitaire ?? 0);
      const beneficeUnitaire = Number(ligne.prixUnitaire) - prixAchatUnitaire;
      const beneficeTotal = beneficeUnitaire * Number(ligne.quantite);
      return {
        ...ligne,
        prixAchatUnitaire,
        beneficeUnitaire,
        beneficeTotal
      };
    });
    this.total = calculerTotal(this.lignesVente);
    this.totalPrixAchat = calculerTotalPrixAchat(this.lignesVente);
    this.beneficeTotal = this.total - this.totalPrixAchat;
  }

  valider({ referenceCaisse }) {
    this.assertBrouillon();
    this.statut = StatutVente.VALIDEE;
    this.referenceCaisse = referenceCaisse || null;
  }

  annuler({ motif } = {}) {
    this.assertBrouillon();
    this.statut = StatutVente.ANNULEE;
    this.motifAnnulation = motif || null;
  }
}
