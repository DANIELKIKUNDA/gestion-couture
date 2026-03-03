import { StatutVente, assertPositive, assertNonEmpty } from "./value-objects.js";
import { VenteDejaValidee, VenteDejaAnnulee, VenteInvalide } from "./errors.js";

function calculerTotal(lignesVente = []) {
  return lignesVente.reduce((sum, ligne) => sum + Number(ligne.quantite || 0) * Number(ligne.prixUnitaire || 0), 0);
}

function normalizeLignes(lignesVente = []) {
  if (!Array.isArray(lignesVente) || lignesVente.length === 0) {
    throw new VenteInvalide("lignesVente must contain at least one line");
  }

  return lignesVente.map((ligne) => {
    assertNonEmpty(ligne.idArticle, "idArticle");
    assertNonEmpty(ligne.libelleArticle, "libelleArticle");
    assertNonEmpty(ligne.idLigne, "idLigne");
    assertPositive(Number(ligne.quantite), "quantite");
    const prix = Number(ligne.prixUnitaire);
    if (Number.isNaN(prix) || prix < 0) {
      throw new VenteInvalide("prixUnitaire must be >= 0");
    }
    return {
      idLigne: ligne.idLigne,
      idArticle: ligne.idArticle,
      libelleArticle: ligne.libelleArticle,
      quantite: Number(ligne.quantite),
      prixUnitaire: prix
    };
  });
}

export class Vente {
  constructor({ idVente, date, lignesVente, total = null, statut = StatutVente.BROUILLON, referenceCaisse = null, motifAnnulation = null }) {
    assertNonEmpty(idVente, "idVente");
    this.idVente = idVente;
    this.date = date || new Date().toISOString();
    this.statut = statut;
    this.referenceCaisse = referenceCaisse || null;
    this.motifAnnulation = motifAnnulation || null;

    this.lignesVente = normalizeLignes(lignesVente);
    const computedTotal = calculerTotal(this.lignesVente);
    this.total = total === null || total === undefined ? computedTotal : Number(total);
    if (Number.isNaN(this.total) || this.total < 0) {
      throw new VenteInvalide("total must be >= 0");
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
