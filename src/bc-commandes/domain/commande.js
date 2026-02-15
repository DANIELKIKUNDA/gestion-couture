// Aggregate root: Commande
import { StatutCommande, assertNonEmpty } from "./value-objects.js";
import {
  PaiementExcedentaire,
  CommandeDejaLivree,
  CommandeNonTerminee,
  CommandeNonPayee,
  CommandeAnnulee,
  AvanceInsuffisante
} from "./errors.js";
import { createMesuresCommande } from "../../shared/domain/mesures-habit.js";

export class Commande {
  constructor({
    idCommande,
    idClient,
    descriptionCommande,
    dateCreation,
    datePrevue,
    montantTotal,
    montantPaye = 0,
    statutCommande = StatutCommande.CREEE,
    typeHabit,
    mesuresHabit
  }) {
    // Basic validations at creation time
    assertNonEmpty(idCommande, "idCommande");
    assertNonEmpty(idClient, "idClient");
    assertNonEmpty(descriptionCommande, "descriptionCommande");
    if (montantTotal < 0) throw new Error("montantTotal must be >= 0");
    if (montantPaye < 0) throw new Error("montantPaye must be >= 0");
    if (montantPaye > montantTotal) throw new PaiementExcedentaire("montantPaye > montantTotal");

    this.idCommande = idCommande;
    this.idClient = idClient;
    this.descriptionCommande = descriptionCommande;
    this.dateCreation = dateCreation;
    this.datePrevue = datePrevue;
    this.montantTotal = montantTotal;
    this.montantPaye = montantPaye;
    this.statutCommande = statutCommande;
    if (typeHabit || mesuresHabit) {
      const snapshot = createMesuresCommande(typeHabit, mesuresHabit);
      this.typeHabit = snapshot.typeHabit;
      this.mesuresHabit = snapshot;
    } else {
      // Compatibility for historical rows created before mesures were enforced.
      this.typeHabit = null;
      this.mesuresHabit = null;
    }
  }

  // Domain invariant: no changes after delivery
  assertNotLivree() {
    if (this.statutCommande === StatutCommande.LIVREE) {
      throw new CommandeDejaLivree("Commande already delivered");
    }
  }

  // Use when the atelier requires a minimum advance to start work
  demarrerTravail(parametresAtelier) {
    this.assertNotLivree();
    if (this.statutCommande === StatutCommande.ANNULEE) {
      throw new CommandeAnnulee("Commande is cancelled");
    }

    if (parametresAtelier?.avanceObligatoireCommande) {
      const min = parametresAtelier.avanceMinimum ?? 0;
      if (this.montantPaye < min) {
        throw new AvanceInsuffisante("Advance is insufficient to start work");
      }
    }

    this.statutCommande = StatutCommande.EN_COURS;
  }

  terminerTravail() {
    this.assertNotLivree();
    if (this.statutCommande === StatutCommande.ANNULEE) {
      throw new CommandeAnnulee("Commande is cancelled");
    }
    this.statutCommande = StatutCommande.TERMINEE;
  }

  appliquerPaiement(montant) {
    this.assertNotLivree();
    if (this.statutCommande === StatutCommande.ANNULEE) {
      throw new CommandeAnnulee("Commande is cancelled");
    }
    if (montant <= 0) throw new Error("montant must be > 0");

    const nouveau = this.montantPaye + montant;
    if (nouveau > this.montantTotal) {
      throw new PaiementExcedentaire("Payment exceeds total");
    }
    this.montantPaye = nouveau;
  }

  livrerCommande() {
    this.assertNotLivree();
    if (this.statutCommande !== StatutCommande.TERMINEE) {
      throw new CommandeNonTerminee("Commande must be finished before delivery");
    }
    if (this.montantPaye < this.montantTotal) {
      throw new CommandeNonPayee("Commande must be fully paid before delivery");
    }
    this.statutCommande = StatutCommande.LIVREE;
  }

  annulerCommande() {
    this.assertNotLivree();
    this.statutCommande = StatutCommande.ANNULEE;
  }

  resteAPayer() {
    return this.montantTotal - this.montantPaye;
  }

  estLivrable() {
    return this.statutCommande === StatutCommande.TERMINEE && this.montantPaye >= this.montantTotal;
  }
}
