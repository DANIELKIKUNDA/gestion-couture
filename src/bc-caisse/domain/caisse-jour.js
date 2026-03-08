// Aggregate root: CaisseJour
import {
  StatutCaisse,
  TypeOperation,
  StatutOperation,
  TypeDepense,
  assertPositive
} from "./value-objects.js";
import {
  CaisseCloturee,
  SoldeInsuffisant,
  MontantInvalide,
  OperationInexistante,
  OperationDejaAnnulee,
  TypeDepenseInvalide,
  JustificationObligatoire,
  PermissionInsuffisante,
  SoldeJournalierInsuffisant
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
      throw new CaisseCloturee("La caisse est cloturee");
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

  totauxJour() {
    let totalEntrees = 0;
    let totalSorties = 0;
    let totalSortiesQuotidiennes = 0;

    for (const op of this.operations) {
      if (op.statutOperation === StatutOperation.ANNULEE) continue;
      if (op.typeOperation === TypeOperation.ENTREE) {
        totalEntrees += op.montant;
        continue;
      }
      if (op.typeOperation !== TypeOperation.SORTIE) continue;
      totalSorties += op.montant;
      const depenseType = op.typeDepense || TypeDepense.QUOTIDIENNE;
      if (depenseType === TypeDepense.QUOTIDIENNE) {
        totalSortiesQuotidiennes += op.montant;
      }
    }

    return {
      totalEntrees,
      totalSorties,
      totalSortiesQuotidiennes,
      resultatJournalier: totalEntrees - totalSortiesQuotidiennes
    };
  }

  soldeJournalierCourant() {
    const totals = this.totauxJour();
    return totals.resultatJournalier;
  }

  ouvrirCaisse({ soldeOuverture, utilisateur, dateOuverture, ouvertureAnticipee, motifOuvertureAnticipee, autoriseePar }) {
    if (this.statutCaisse === StatutCaisse.OUVERTE) return;
    if (soldeOuverture < 0) throw new MontantInvalide("soldeOuverture doit etre >= 0");
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

  enregistrerSortie({
    idOperation,
    montant,
    motif,
    referenceMetier,
    utilisateur,
    dateOperation,
    typeDepense = null,
    justification = null,
    role = "",
    rolesAutorises = []
  }) {
    this.assertOuverte();
    assertPositive(montant, "montant");
    const normalizedType = typeDepense ? String(typeDepense || "").toUpperCase() : TypeDepense.QUOTIDIENNE;
    if (![TypeDepense.QUOTIDIENNE, TypeDepense.EXCEPTIONNELLE].includes(normalizedType)) {
      throw new TypeDepenseInvalide("typeDepense invalide");
    }
    const soldeGlobal = this.soldeCourant();
    if (soldeGlobal < montant) throw new SoldeInsuffisant("Solde insuffisant");

    if (normalizedType === TypeDepense.QUOTIDIENNE) {
      const soldeJournalier = this.soldeJournalierCourant();
      if (soldeJournalier < montant) {
        throw new SoldeJournalierInsuffisant("Solde journalier insuffisant");
      }
    }

    if (normalizedType === TypeDepense.EXCEPTIONNELLE) {
      const justificationValue = String(justification || "").trim();
      if (!justificationValue) {
        throw new JustificationObligatoire("Justification obligatoire");
      }
      const roleValue = String(role || "").trim();
      const roleUpper = roleValue.toUpperCase();
      const allowed = Array.isArray(rolesAutorises) ? rolesAutorises.map((r) => String(r || "").toUpperCase()) : [];
      const isAdmin = roleUpper === "ADMIN";
      if (!isAdmin && !allowed.includes(roleUpper)) {
        throw new PermissionInsuffisante("Permission insuffisante");
      }
    }

    this.operations.push({
      idOperation,
      typeOperation: TypeOperation.SORTIE,
      montant,
      motif,
      referenceMetier: referenceMetier || null,
      dateOperation: dateOperation || new Date().toISOString(),
      effectuePar: utilisateur,
      statutOperation: StatutOperation.VALIDE,
      typeDepense: normalizedType,
      justification: normalizedType === TypeDepense.EXCEPTIONNELLE ? String(justification || "").trim() : null,
      impactJournalier: normalizedType === TypeDepense.QUOTIDIENNE,
      impactGlobal: true
    });
  }

  annulerOperation({ idOperation, motifAnnulation, utilisateur }) {
    this.assertOuverte();
    const op = this.operations.find((o) => o.idOperation === idOperation);
    if (!op) throw new OperationInexistante("Operation introuvable");
    if (op.statutOperation === StatutOperation.ANNULEE) {
      throw new OperationDejaAnnulee("Operation deja annulee");
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
