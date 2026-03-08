// Aggregate root: Retouche
import { StatutRetouche, assertNonEmpty } from "./value-objects.js";
import {
  PaiementExcedentaire,
  RetoucheDejaLivree,
  RetoucheNonTerminee,
  RetoucheNonPayee,
  RetoucheAnnulee,
  AvanceInsuffisante,
  TransitionStatutRetoucheInvalide
} from "./errors.js";
import {
  getTypeRetoucheDefinition,
  isRetoucheHabitCompatible,
  resolveMesureTargetsForHabit,
  resolveRetoucheMeasureDefinitions,
  resolveRetouchePolicy
} from "./retouche-policy.js";
import { createRetoucheMesuresSnapshot } from "./mesures-retouche.js";

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
    mesuresHabit,
    policy = null,
    rehydrate = false
  }) {
    // Basic validations at creation time
    assertNonEmpty(idRetouche, "idRetouche");
    assertNonEmpty(idClient, "idClient");
    assertNonEmpty(descriptionRetouche, "descriptionRetouche");
    if (montantTotal < 0) throw new Error("montantTotal doit etre >= 0");
    if (montantPaye < 0) throw new Error("montantPaye doit etre >= 0");
    if (montantPaye > montantTotal) throw new PaiementExcedentaire("montantPaye > montantTotal");
    if (
      statutRetouche !== StatutRetouche.DEPOSEE &&
      statutRetouche !== StatutRetouche.EN_COURS &&
      statutRetouche !== StatutRetouche.TERMINEE &&
      statutRetouche !== StatutRetouche.LIVREE &&
      statutRetouche !== StatutRetouche.ANNULEE
    ) {
      throw new TransitionStatutRetoucheInvalide("Statut de retouche invalide");
    }

    this.idRetouche = idRetouche;
    this.idClient = idClient;
    this.descriptionRetouche = descriptionRetouche;
    this.dateDepot = dateDepot;
    this.datePrevue = datePrevue;
    this.montantTotal = montantTotal;
    this.montantPaye = montantPaye;
    this.statutRetouche = statutRetouche;
    const resolvedPolicy = resolveRetouchePolicy(policy);
    const typeDef = getTypeRetoucheDefinition(typeRetouche, resolvedPolicy);
    this.typeRetouche = typeDef.code;
    if (!isRetoucheHabitCompatible(typeDef, typeHabit)) {
      throw new Error("Type d'habit incompatible avec ce type de retouche");
    }
    const descriptionRequired = typeDef.descriptionObligatoire || resolvedPolicy.descriptionObligatoire;
    if (descriptionRequired && !String(descriptionRetouche || "").trim()) {
      throw new Error("Description retouche obligatoire");
    }

    const shouldRequireMeasures = typeDef.necessiteMesures === true;
    const mesureTargets = resolveMesureTargetsForHabit({ typeDefinition: typeDef, typeHabit });
    const mesureDefinitions = resolveRetoucheMeasureDefinitions({ typeDefinition: typeDef });

    if (typeHabit || mesuresHabit) {
      try {
        const rawValues = mesuresHabit?.valeurs && typeof mesuresHabit.valeurs === "object" ? mesuresHabit.valeurs : mesuresHabit;
        if (!shouldRequireMeasures && rawValues && Object.keys(rawValues).length > 0) {
          throw new Error("Mesures non autorisees pour ce type de retouche");
        }
        if (shouldRequireMeasures && mesureDefinitions.length === 0) {
          throw new Error("Configuration invalide: aucune mesure definie pour ce type de retouche");
        }
        const snapshot = shouldRequireMeasures
          ? createRetoucheMesuresSnapshot(rawValues, {
              definitions: mesureDefinitions,
              requireAtLeastOne: true,
              requireComplete: resolvedPolicy.saisiePartielle !== true
            })
          : null;
        const values = snapshot?.valeurs || {};
        if (shouldRequireMeasures) {
          if (resolvedPolicy.saisiePartielle) {
            const hasAnyTarget = mesureTargets.some((key) => values[key] !== undefined && values[key] !== null && values[key] !== "");
            if (!hasAnyTarget) throw new Error("Mesures requises pour ce type de retouche");
          } else {
            for (const key of mesureTargets) {
              if (values[key] === undefined || values[key] === null || values[key] === "") {
                throw new Error(`Mesure obligatoire: ${key}`);
              }
            }
          }
        }
        this.typeHabit = String(typeHabit || mesuresHabit?.typeHabit || "").trim().toUpperCase() || null;
        this.mesuresHabit = snapshot ? { ...snapshot, typeHabit: this.typeHabit, typeRetouche: this.typeRetouche } : null;
      } catch (err) {
        if (!rehydrate) throw err;
        // Compatibility for historical rows with incomplete measures.
        this.typeHabit = typeHabit || mesuresHabit?.typeHabit || null;
        this.mesuresHabit = mesuresHabit || null;
      }
    } else {
      // Compatibility for historical rows created before mesures were enforced.
      if (!rehydrate && shouldRequireMeasures) {
        throw new Error("Mesures requises pour ce type de retouche");
      }
      this.typeHabit = null;
      this.mesuresHabit = null;
    }
  }

  assertNotLivree() {
    if (this.statutRetouche === StatutRetouche.LIVREE) {
      throw new RetoucheDejaLivree("Retouche deja livree");
    }
  }

  assertNotAnnulee() {
    if (this.statutRetouche === StatutRetouche.ANNULEE) {
      throw new RetoucheAnnulee("Retouche annulee");
    }
  }

  demarrerTravail(parametresAtelier) {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (this.statutRetouche !== StatutRetouche.DEPOSEE || this.montantPaye <= 0) {
      throw new TransitionStatutRetoucheInvalide("Transition invalide: premier paiement requis");
    }

    if (parametresAtelier?.avanceObligatoireRetouche) {
      const min = parametresAtelier.avanceMinimum ?? 0;
      if (this.montantPaye < min) {
        throw new AvanceInsuffisante("L'avance est insuffisante pour demarrer le travail");
      }
    }

    this.statutRetouche = StatutRetouche.EN_COURS;
  }

  terminerTravail() {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (this.statutRetouche !== StatutRetouche.EN_COURS) {
      throw new TransitionStatutRetoucheInvalide("Transition invalide: seule une retouche EN_COURS peut etre terminee");
    }
    this.statutRetouche = StatutRetouche.TERMINEE;
  }

  appliquerPaiement(montant) {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (montant <= 0) throw new Error("montant doit etre > 0");

    const nouveau = this.montantPaye + montant;
    if (nouveau > this.montantTotal) {
      throw new PaiementExcedentaire("Le paiement depasse le montant total");
    }
    this.montantPaye = nouveau;

    // Transition metier automatique: premier paiement -> EN_COURS.
    if (this.statutRetouche === StatutRetouche.DEPOSEE) {
      this.statutRetouche = StatutRetouche.EN_COURS;
    }
  }

  livrerRetouche() {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (this.statutRetouche !== StatutRetouche.TERMINEE) {
      throw new RetoucheNonTerminee("Livraison interdite: retouche non terminee");
    }
    if (this.montantPaye < this.montantTotal) {
      throw new RetoucheNonPayee("Livraison interdite: solde restant > 0");
    }
    this.statutRetouche = StatutRetouche.LIVREE;
  }

  annulerRetouche() {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (this.statutRetouche !== StatutRetouche.DEPOSEE && this.statutRetouche !== StatutRetouche.EN_COURS) {
      throw new TransitionStatutRetoucheInvalide("Transition invalide: annulation autorisee uniquement pour DEPOSEE ou EN_COURS");
    }
    this.statutRetouche = StatutRetouche.ANNULEE;
  }

  resteAPayer() {
    return this.montantTotal - this.montantPaye;
  }

  estLivrable() {
    return this.statutRetouche === StatutRetouche.TERMINEE && this.montantPaye >= this.montantTotal;
  }
}
