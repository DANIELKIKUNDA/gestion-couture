import {
  getTypeRetoucheDefinition,
  isRetoucheHabitCompatible,
  resolveRetoucheMeasureDefinitions,
  resolveRetouchePolicy
} from "./retouche-policy.js";
import { createRetoucheMesuresSnapshot } from "./mesures-retouche.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMeasuresSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (snapshot.valeurs && typeof snapshot.valeurs === "object") return snapshot;
  return { valeurs: snapshot };
}

export class RetoucheItem {
  constructor({
    idItem,
    idRetouche = null,
    typeRetouche,
    typeHabit = null,
    description = "",
    prix = 0,
    montantPaye = 0,
    ordreAffichage = 1,
    mesures = null,
    dateCreation = null,
    policy = null,
    rehydrate = false
  }) {
    const normalizedId = normalizeText(idItem);
    const normalizedTypeRetouche = normalizeText(typeRetouche).toUpperCase();
    if (!normalizedId) throw new Error("idItem obligatoire");
    if (!normalizedTypeRetouche) throw new Error("typeRetouche obligatoire");
    const normalizedPrice = Number(prix || 0);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      throw new Error("prix item retouche invalide");
    }
    const normalizedPaid = Number(montantPaye || 0);
    if (!Number.isFinite(normalizedPaid) || normalizedPaid < 0) {
      throw new Error("montantPaye item retouche invalide");
    }
    if (normalizedPaid > normalizedPrice) {
      throw new Error("montantPaye item retouche > prix");
    }

    const resolvedPolicy = resolveRetouchePolicy(policy);
    const typeDefinition = getTypeRetoucheDefinition(normalizedTypeRetouche, resolvedPolicy, { allowInactive: rehydrate });
    const normalizedTypeHabit = normalizeText(typeHabit || mesures?.typeHabit).toUpperCase() || null;
    if (normalizedTypeHabit && !isRetoucheHabitCompatible(typeDefinition, normalizedTypeHabit)) {
      throw new Error("Type d'habit incompatible avec ce type de retouche");
    }

    const definitions = resolveRetoucheMeasureDefinitions({ typeDefinition });
    const shouldRequireMeasures = typeDefinition.necessiteMesures === true;
    const normalizedMeasuresInput = normalizeMeasuresSnapshot(mesures);
    let normalizedMeasures = null;

    if (normalizedMeasuresInput) {
      try {
        if (!shouldRequireMeasures && Object.keys(normalizedMeasuresInput.valeurs || {}).length > 0) {
          throw new Error("Mesures non autorisees pour ce type de retouche");
        }
        normalizedMeasures = shouldRequireMeasures
          ? createRetoucheMesuresSnapshot(normalizedMeasuresInput.valeurs, {
              definitions,
              requireAtLeastOne: true,
              requireComplete: resolvedPolicy.saisiePartielle !== true
            })
          : null;
      } catch (error) {
        if (!rehydrate) throw error;
        normalizedMeasures = normalizedMeasuresInput;
      }
    } else if (!rehydrate && shouldRequireMeasures) {
      throw new Error("Mesures requises pour ce type de retouche");
    }

    this.idItem = normalizedId;
    this.idRetouche = normalizeText(idRetouche) || null;
    this.typeRetouche = typeDefinition.code;
    this.typeHabit = normalizedTypeHabit;
    this.description = normalizeText(description);
    this.prix = normalizedPrice;
    this.montantPaye = normalizedPaid;
    this.ordreAffichage = Number(ordreAffichage || 1) || 1;
    this.mesures = normalizedMeasures
      ? {
          ...normalizedMeasures,
          typeHabit: normalizedTypeHabit,
          typeRetouche: typeDefinition.code
        }
      : null;
    this.dateCreation = dateCreation || null;
  }

  toJSON() {
    return {
      idItem: this.idItem,
      idRetouche: this.idRetouche,
      typeRetouche: this.typeRetouche,
      typeHabit: this.typeHabit,
      description: this.description,
      prix: this.prix,
      montantPaye: this.montantPaye,
      ordreAffichage: this.ordreAffichage,
      mesures: this.mesures,
      dateCreation: this.dateCreation
    };
  }
}
