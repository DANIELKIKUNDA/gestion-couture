// Aggregate root: CaisseJour
import {
  StatutCaisse,
  TypeOperation,
  StatutOperation,
  assertPositive
} from "./value-objects.js";
import {
  CaisseCloturee,
  SoldeInsuffisant,
  MontantInvalide,
  OperationInexistante,
  OperationDejaAnnulee
} from "./errors.js";

export class CaisseJour {
  constructor({
    idCaisseJour,
    date,
    statutCaisse = StatutCaisse.OUVERTE,
    soldeOuverture = 0,
    soldeCloture = null,
    ouvertePar = null,
    clotureePar = null,
    dateOuverture = null,
    dateCloture = null,
    ouvertureAnticipee = false,
    motifOuvertureAnticipee = null,
    autoriseePar = null,
    operations = []
  }) {
    this.idCaisseJour = idCaisseJour;
    this.date = date;
    this.statutCaisse = statutCaisse;
    this.soldeOuverture = soldeOuverture;
    this.soldeCloture = soldeCloture;
    this.ouvertePar = ouvertePar;
    this.clotureePar = clotureePar;
    this.dateOuverture = dateOuverture;
    this.dateCloture = dateCloture;
    this.ouvertureAnticipee = ouvertureAnticipee;
    this.motifOuvertureAnticipee = motifOuvertureAnticipee;
    this.autoriseePar = autoriseePar;
    this.operations = operations;
  }

  // Guard: no operations if closed
  assertOuverte() {
    if (this.statutCaisse === StatutCaisse.CLOTUREE) {
      throw new CaisseCloturee("Caisse is closed");
    }
  }

  // Compute current balance from valid operations
  soldeCourant() {
    let solde = this.soldeOuverture;
    for (const op of this.operations) {
      if (op.statutOperation === StatutOperation.ANNULEE) continue;
      if (op.typeOperation === TypeOperation.ENTREE) solde += op.montant;
      if (op.typeOperation === TypeOperation.SORTIE) solde -= op.montant;
    }
    return solde;
  }

  ouvrirCaisse({ soldeOuverture, utilisateur, dateOuverture, ouvertureAnticipee, motifOuvertureAnticipee, autoriseePar }) {
    if (this.statutCaisse === StatutCaisse.OUVERTE) return;
    if (soldeOuverture < 0) throw new MontantInvalide("soldeOuverture must be >= 0");
    this.statutCaisse = StatutCaisse.OUVERTE;
    this.soldeOuverture = soldeOuverture;
    this.ouvertePar = utilisateur;
    this.dateOuverture = dateOuverture || new Date().toISOString();
    this.ouvertureAnticipee = Boolean(ouvertureAnticipee);
    this.motifOuvertureAnticipee = ouvertureAnticipee ? motifOuvertureAnticipee || null : null;
    this.autoriseePar = ouvertureAnticipee ? autoriseePar || null : null;
  }

  enregistrerEntree({ idOperation, montant, modePaiement, motif, referenceMetier, utilisateur, dateOperation }) {
    this.assertOuverte();
    assertPositive(montant, "montant");
    this.operations.push({
      idOperation,
      typeOperation: TypeOperation.ENTREE,
      montant,
      modePaiement,
      motif,
      referenceMetier,
      dateOperation: dateOperation || new Date().toISOString(),
      effectuePar: utilisateur,
      statutOperation: StatutOperation.VALIDE
    });
  }

  enregistrerSortie({ idOperation, montant, motif, utilisateur, dateOperation }) {
    this.assertOuverte();
    assertPositive(montant, "montant");
    const solde = this.soldeCourant();
    if (solde < montant) throw new SoldeInsuffisant("Insufficient balance");

    this.operations.push({
      idOperation,
      typeOperation: TypeOperation.SORTIE,
      montant,
      motif,
      dateOperation: dateOperation || new Date().toISOString(),
      effectuePar: utilisateur,
      statutOperation: StatutOperation.VALIDE
    });
  }

  annulerOperation({ idOperation, motifAnnulation, utilisateur }) {
    this.assertOuverte();
    const op = this.operations.find((o) => o.idOperation === idOperation);
    if (!op) throw new OperationInexistante("Operation not found");
    if (op.statutOperation === StatutOperation.ANNULEE) {
      throw new OperationDejaAnnulee("Operation already cancelled");
    }
    op.statutOperation = StatutOperation.ANNULEE;
    op.motifAnnulation = motifAnnulation || null;
    op.annuleePar = utilisateur || null;
    op.dateAnnulation = new Date().toISOString();
  }

  cloturerCaisse({ utilisateur, dateCloture }) {
    this.assertOuverte();
    this.statutCaisse = StatutCaisse.CLOTUREE;
    this.soldeCloture = this.soldeCourant();
    this.clotureePar = utilisateur || null;
    this.dateCloture = dateCloture || new Date().toISOString();
  }
}
