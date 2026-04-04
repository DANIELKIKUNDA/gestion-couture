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
import { RetoucheItem } from "./retouche-item.js";

export class Retouche {
  constructor({
    idRetouche,
    idClient,
    dossierId = null,
    descriptionRetouche,
    typeRetouche,
    dateDepot,
    datePrevue,
    montantTotal,
    montantPaye = 0,
    statutRetouche = StatutRetouche.DEPOSEE,
    typeHabit,
    mesuresHabit,
    items = [],
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
    this.dossierId = dossierId ? String(dossierId).trim() : null;
    this.descriptionRetouche = descriptionRetouche;
    this.dateDepot = dateDepot;
    this.datePrevue = datePrevue;
    this.montantPaye = montantPaye;
    this.statutRetouche = statutRetouche;
    const resolvedPolicy = resolveRetouchePolicy(policy);
    this.items = Array.isArray(items)
      ? items.map((item, index) =>
          item instanceof RetoucheItem
            ? item
            : new RetoucheItem({
                ...item,
                ordreAffichage: item?.ordreAffichage ?? index + 1,
                policy: resolvedPolicy,
                rehydrate
              })
        )
      : [];
    this.montantTotal =
      this.items.length > 0
        ? this.items.reduce((sum, item) => sum + Number(item.prix || 0), 0)
        : montantTotal;
    const primaryItem = this.items.find((item) => item?.mesures) || this.items[0] || null;
    const effectiveTypeRetouche = primaryItem?.typeRetouche || typeRetouche;
    const typeDef = getTypeRetoucheDefinition(typeRetouche, resolvedPolicy);
    const effectiveTypeDef = primaryItem
      ? getTypeRetoucheDefinition(effectiveTypeRetouche, resolvedPolicy, { allowInactive: rehydrate })
      : typeDef;
    this.typeRetouche = effectiveTypeDef.code;
    const effectiveTypeHabit = primaryItem?.typeHabit || typeHabit;
    if (!isRetoucheHabitCompatible(effectiveTypeDef, effectiveTypeHabit)) {
      throw new Error("Type d'habit incompatible avec ce type de retouche");
    }
    const descriptionRequired = effectiveTypeDef.descriptionObligatoire || resolvedPolicy.descriptionObligatoire;
    if (descriptionRequired && !String(descriptionRetouche || "").trim()) {
      throw new Error("Description retouche obligatoire");
    }

    const shouldRequireMeasures = effectiveTypeDef.necessiteMesures === true;
    const mesureTargets = resolveMesureTargetsForHabit({ typeDefinition: effectiveTypeDef, typeHabit: effectiveTypeHabit });
    const mesureDefinitions = resolveRetoucheMeasureDefinitions({ typeDefinition: effectiveTypeDef });
    const effectiveMesuresHabit = primaryItem?.mesures || mesuresHabit;

    if (effectiveTypeHabit || effectiveMesuresHabit) {
      try {
        const rawValues =
          effectiveMesuresHabit?.valeurs && typeof effectiveMesuresHabit.valeurs === "object"
            ? effectiveMesuresHabit.valeurs
            : effectiveMesuresHabit;
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
        this.typeHabit = String(effectiveTypeHabit || effectiveMesuresHabit?.typeHabit || "").trim().toUpperCase() || null;
        this.mesuresHabit = snapshot ? { ...snapshot, typeHabit: this.typeHabit, typeRetouche: this.typeRetouche } : null;
      } catch (err) {
        if (!rehydrate) throw err;
        // Compatibility for historical rows with incomplete measures.
        this.typeHabit = effectiveTypeHabit || effectiveMesuresHabit?.typeHabit || null;
        this.mesuresHabit = effectiveMesuresHabit || null;
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

  assertModifiableAvantPaiement() {
    this.assertNotLivree();
    this.assertNotAnnulee();
    if (Number(this.montantPaye || 0) > 0) {
      throw new TransitionStatutRetoucheInvalide("Modification interdite apres paiement");
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
