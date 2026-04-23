// Aggregate root: Commande
import { StatutCommande, assertNonEmpty } from "./value-objects.js";
import {
  PaiementExcedentaire,
  CommandeDejaLivree,
  CommandeAnnulee,
  CommandeNonTerminee,
  CommandeNonPayee,
  TransitionStatutCommandeInvalide
} from "./errors.js";
import { createMesuresCommande } from "../../shared/domain/mesures-habit.js";
import { resolveCommandePolicy } from "./commande-policy.js";
import { CommandeItem } from "./commande-item.js";

function normalizePrioriteCommande(value = "NORMALE") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "URGENTE" || normalized === "TRES_URGENTE") return normalized;
  return "NORMALE";
}

export class Commande {
  constructor({
    idCommande,
    idClient,
    dossierId = null,
    descriptionCommande,
    dateCreation,
    datePrevue,
    priorite = "NORMALE",
    montantTotal,
    montantPaye = 0,
    statutCommande = StatutCommande.CREEE,
    typeHabit,
    mesuresHabit,
    items = [],
    policy = null,
    rehydrate = false
  }) {
    // Basic validations at creation time
    assertNonEmpty(idCommande, "idCommande");
    assertNonEmpty(idClient, "idClient");
    assertNonEmpty(descriptionCommande, "descriptionCommande");
    if (montantTotal < 0) throw new Error("montantTotal doit etre >= 0");
    if (montantPaye < 0) throw new Error("montantPaye doit etre >= 0");
    if (montantPaye > montantTotal) throw new PaiementExcedentaire("montantPaye > montantTotal");
    if (
      statutCommande !== StatutCommande.CREEE &&
      statutCommande !== StatutCommande.EN_COURS &&
      statutCommande !== StatutCommande.TERMINEE &&
      statutCommande !== StatutCommande.LIVREE &&
      statutCommande !== StatutCommande.ANNULEE
    ) {
      throw new TransitionStatutCommandeInvalide("Statut de commande invalide");
    }

    this.idCommande = idCommande;
    this.idClient = idClient;
    this.dossierId = dossierId ? String(dossierId).trim() : null;
    this.descriptionCommande = descriptionCommande;
    this.dateCreation = dateCreation;
    this.datePrevue = datePrevue;
    this.priorite = normalizePrioriteCommande(priorite);
    this.habitDefinitions = policy?.habits && typeof policy.habits === "object" ? policy.habits : null;
    this.commandePolicy = resolveCommandePolicy(policy);
    this.items = Array.isArray(items)
      ? items.map((item, index) =>
          item instanceof CommandeItem
            ? item
            : new CommandeItem({
                ...item,
                ordreAffichage: item?.ordreAffichage ?? item?.ordre_affichage ?? index + 1,
                policy,
                rehydrate
              })
        )
      : [];
    const totalFromItems = this.items.reduce((sum, item) => sum + Number(item?.prix || 0), 0);
    this.montantTotal = this.items.length > 0 ? totalFromItems : montantTotal;
    this.montantPaye = montantPaye;
    this.statutCommande = statutCommande;
    if (this.montantTotal < 0) throw new Error("montantTotal doit etre >= 0");
    if (this.montantPaye < 0) throw new Error("montantPaye doit etre >= 0");
    if (this.montantPaye > this.montantTotal) throw new PaiementExcedentaire("montantPaye > montantTotal");
    const primaryItemWithMeasures = this.items.find((item) => item?.mesures) || null;
    const primaryItem = primaryItemWithMeasures || this.items[0] || null;
    const effectiveTypeHabit = primaryItem?.typeHabit || typeHabit;
    const effectiveMesuresHabit = primaryItemWithMeasures?.mesures || mesuresHabit;
    const effectiveMesuresPayload =
      effectiveMesuresHabit && typeof effectiveMesuresHabit === "object" && effectiveMesuresHabit.valeurs && typeof effectiveMesuresHabit.valeurs === "object"
        ? effectiveMesuresHabit.valeurs
        : effectiveMesuresHabit;
    const hasMesuresInput =
      effectiveMesuresPayload &&
      typeof effectiveMesuresPayload === "object" &&
      Object.values(effectiveMesuresPayload).some((value) => value !== undefined && value !== null && value !== "");
    if (effectiveTypeHabit || effectiveMesuresHabit) {
      if (!hasMesuresInput && !this.commandePolicy.mesuresObligatoiresPourCommande) {
        this.typeHabit = effectiveTypeHabit ? String(effectiveTypeHabit).trim().toUpperCase() : null;
        this.mesuresHabit = null;
        return;
      }
      try {
        const requireMesures = this.commandePolicy.mesuresObligatoiresPourCommande;
        const snapshot = createMesuresCommande(effectiveTypeHabit, effectiveMesuresPayload, {
          requireComplete: requireMesures && this.commandePolicy.interdireEnregistrementSansToutesMesuresUtiles,
          requireAtLeastOne: requireMesures,
          allowDecimals: this.commandePolicy.valeursDecimalesAutorisees,
          unit: this.commandePolicy.uniteMesure,
          habitDefinitions: this.habitDefinitions
        });
        this.typeHabit = snapshot.typeHabit;
        this.mesuresHabit = snapshot;
      } catch (err) {
        if (!rehydrate) throw err;
        // Compatibility for historical rows with incomplete measures.
        this.typeHabit = effectiveTypeHabit || effectiveMesuresHabit?.typeHabit || null;
        this.mesuresHabit = effectiveMesuresHabit || null;
      }
    } else {
      // Compatibility for historical rows created before mesures were enforced.
      if (!rehydrate && this.commandePolicy.mesuresObligatoiresPourCommande) {
        throw new Error("Mesures obligatoires pour cette commande");
      }
      this.typeHabit = null;
      this.mesuresHabit = null;
    }
  }

  // Domain invariant: no changes after delivery
  assertNotLivree() {
    if (this.statutCommande === StatutCommande.LIVREE) {
      throw new CommandeDejaLivree("Commande deja livree");
    }
  }

  assertNotAnnulee() {
    if (this.statutCommande === StatutCommande.ANNULEE) {
      throw new CommandeAnnulee("Commande annulee");
    }
  }

  assertModifiableAvantPaiement() {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (Number(this.montantPaye || 0) > 0) {
      throw new TransitionStatutCommandeInvalide("Modification interdite apres paiement");
    }
  }

  terminerTravail() {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (this.statutCommande !== StatutCommande.EN_COURS) {
      throw new TransitionStatutCommandeInvalide("Transition invalide: seule une commande EN_COURS peut etre terminee");
    }
    this.statutCommande = StatutCommande.TERMINEE;
  }

  appliquerPaiement(montant, { policy = null } = {}) {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (montant <= 0) throw new Error("montant doit etre > 0");

    const nouveau = this.montantPaye + montant;
    if (nouveau > this.montantTotal) {
      throw new PaiementExcedentaire("Le paiement depasse le montant total");
    }
    this.montantPaye = nouveau;

    // Transition metier automatique: premier paiement -> EN_COURS.
    const resolvedPolicy = resolveCommandePolicy(policy || this.commandePolicy);
    if (resolvedPolicy.passageAutomatiqueEnCoursApresPremierPaiement && this.statutCommande === StatutCommande.CREEE) {
      this.statutCommande = StatutCommande.EN_COURS;
    }
  }

  livrerCommande({ policy = null } = {}) {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (this.statutCommande !== StatutCommande.TERMINEE) {
      throw new CommandeNonTerminee("Livraison interdite: commande non terminee");
    }
    const resolvedPolicy = resolveCommandePolicy(policy || this.commandePolicy);
    if (resolvedPolicy.livraisonAutoriseeSeulementSiPaiementTotal && this.montantPaye < this.montantTotal) {
      throw new CommandeNonPayee("Livraison interdite: solde restant > 0");
    }
    this.statutCommande = StatutCommande.LIVREE;
  }

  annulerCommande({ policy = null } = {}) {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (
      this.statutCommande !== StatutCommande.CREEE &&
      this.statutCommande !== StatutCommande.EN_COURS
    ) {
      throw new TransitionStatutCommandeInvalide("Transition invalide: annulation impossible pour ce statut");
    }
    this.statutCommande = StatutCommande.ANNULEE;
  }

  mettreAJourMesures({ typeHabit, mesuresHabit, policy = null }) {
    this.assertNotLivree();
    this.assertNotAnnulee();
    const resolvedPolicy = resolveCommandePolicy(policy || this.commandePolicy);
    if (!resolvedPolicy.autoriserModificationMesuresApresCreation && this.statutCommande !== StatutCommande.CREEE) {
      throw new TransitionStatutCommandeInvalide("Modification des mesures interdite apres validation de la commande");
    }
    const snapshot = createMesuresCommande(typeHabit, mesuresHabit, {
      requireComplete: resolvedPolicy.mesuresObligatoiresPourCommande && resolvedPolicy.interdireEnregistrementSansToutesMesuresUtiles,
      requireAtLeastOne: resolvedPolicy.mesuresObligatoiresPourCommande,
      allowDecimals: resolvedPolicy.valeursDecimalesAutorisees,
      unit: resolvedPolicy.uniteMesure,
      habitDefinitions: this.habitDefinitions
    });
    this.typeHabit = snapshot.typeHabit;
    this.mesuresHabit = snapshot;
  }

  resteAPayer() {
    return this.montantTotal - this.montantPaye;
  }

  estLivrable() {
    return this.statutCommande === StatutCommande.TERMINEE && this.montantPaye >= this.montantTotal;
  }

  getPrimaryItem() {
    return this.items.find((item) => item?.mesures) || this.items[0] || null;
  }
}
