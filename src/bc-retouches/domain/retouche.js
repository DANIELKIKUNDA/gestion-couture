// Aggregate root: Retouche
import { StatutRetouche, assertNonEmpty } from "./value-objects.js";
import {
  PaiementExcedentaire,
  RetoucheDejaLivree,
  RetoucheNonTerminee,
  RetoucheNonPayee,
  RetoucheAnnulee,
  AvanceInsuffisante
} from "./errors.js";
import { createMesuresRetouche } from "../../shared/domain/mesures-habit.js";

export class Retouche {
  constructor({
    idRetouche,
    idClient,
    descriptionRetouche,
    typeRetouche,
    dateDepot,
    datePrevue,
    montantTotal,
    montantPaye = 0,
    statutRetouche = StatutRetouche.DEPOSEE,
    typeHabit,
    mesuresHabit
  }) {
    // Basic validations at creation time
    assertNonEmpty(idRetouche, "idRetouche");
    assertNonEmpty(idClient, "idClient");
    assertNonEmpty(descriptionRetouche, "descriptionRetouche");
    if (montantTotal < 0) throw new Error("montantTotal must be >= 0");
    if (montantPaye < 0) throw new Error("montantPaye must be >= 0");
    if (montantPaye > montantTotal) throw new PaiementExcedentaire("montantPaye > montantTotal");

    this.idRetouche = idRetouche;
    this.idClient = idClient;
    this.descriptionRetouche = descriptionRetouche;
    this.typeRetouche = typeRetouche;
    this.dateDepot = dateDepot;
    this.datePrevue = datePrevue;
    this.montantTotal = montantTotal;
    this.montantPaye = montantPaye;
    this.statutRetouche = statutRetouche;
    if (typeHabit || mesuresHabit) {
      const snapshot = createMesuresRetouche(typeHabit, mesuresHabit);
      this.typeHabit = snapshot.typeHabit;
      this.mesuresHabit = snapshot;
    } else {
      // Compatibility for historical rows created before mesures were enforced.
      this.typeHabit = null;
      this.mesuresHabit = null;
    }
  }

  assertNotLivree() {
    if (this.statutRetouche === StatutRetouche.LIVREE) {
      throw new RetoucheDejaLivree("Retouche already delivered");
    }
  }

  demarrerTravail(parametresAtelier) {
    this.assertNotLivree();
    if (this.statutRetouche === StatutRetouche.ANNULEE) {
      throw new RetoucheAnnulee("Retouche is cancelled");
    }

    if (parametresAtelier?.avanceObligatoireRetouche) {
      const min = parametresAtelier.avanceMinimum ?? 0;
      if (this.montantPaye < min) {
        throw new AvanceInsuffisante("Advance is insufficient to start work");
      }
    }

    this.statutRetouche = StatutRetouche.EN_COURS;
  }

  terminerTravail() {
    this.assertNotLivree();
    if (this.statutRetouche === StatutRetouche.ANNULEE) {
      throw new RetoucheAnnulee("Retouche is cancelled");
    }
    this.statutRetouche = StatutRetouche.TERMINEE;
  }

  appliquerPaiement(montant) {
    this.assertNotLivree();
    if (this.statutRetouche === StatutRetouche.ANNULEE) {
      throw new RetoucheAnnulee("Retouche is cancelled");
    }
    if (montant <= 0) throw new Error("montant must be > 0");

    const nouveau = this.montantPaye + montant;
    if (nouveau > this.montantTotal) {
      throw new PaiementExcedentaire("Payment exceeds total");
    }
    this.montantPaye = nouveau;
  }

  livrerRetouche() {
    this.assertNotLivree();
    if (this.statutRetouche !== StatutRetouche.TERMINEE) {
      throw new RetoucheNonTerminee("Retouche must be finished before delivery");
    }
    if (this.montantPaye < this.montantTotal) {
      throw new RetoucheNonPayee("Retouche must be fully paid before delivery");
    }
    this.statutRetouche = StatutRetouche.LIVREE;
  }

  annulerRetouche() {
    this.assertNotLivree();
    this.statutRetouche = StatutRetouche.ANNULEE;
  }

  resteAPayer() {
    return this.montantTotal - this.montantPaye;
  }

  estLivrable() {
    return this.statutRetouche === StatutRetouche.TERMINEE && this.montantPaye >= this.montantTotal;
  }
}
