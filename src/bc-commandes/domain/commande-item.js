import { createMesuresCommande } from "../../shared/domain/mesures-habit.js";
import { resolveCommandePolicy } from "./commande-policy.js";
import { assertNonEmpty } from "./value-objects.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function hasMeasureValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.valeurs && typeof value.valeurs === "object") {
    return Object.values(value.valeurs).some((entry) => entry !== undefined && entry !== null && entry !== "");
  }
  return Object.values(value).some((entry) => entry !== undefined && entry !== null && entry !== "");
}

export class CommandeItem {
  constructor({
    idItem,
    idCommande = null,
    typeHabit,
    description = "",
    prix,
    montantPaye = 0,
    ordreAffichage = 1,
    mesures = null,
    dateCreation = null,
    policy = null,
    rehydrate = false
  }) {
    assertNonEmpty(idItem, "idItem");
    assertNonEmpty(typeHabit, "typeHabit");
    if (!Number.isFinite(Number(prix)) || Number(prix) < 0) {
      throw new Error("prix item doit etre >= 0");
    }
    if (!Number.isFinite(Number(montantPaye)) || Number(montantPaye) < 0) {
      throw new Error("montantPaye item doit etre >= 0");
    }
    if (Number(montantPaye) > Number(prix || 0)) {
      throw new Error("montantPaye item > prix");
    }

    this.idItem = normalizeText(idItem);
    this.idCommande = normalizeText(idCommande) || null;
    this.description = normalizeText(description);
    this.prix = Number(prix || 0);
    this.montantPaye = Number(montantPaye || 0);
    this.ordreAffichage = Number(ordreAffichage || 1) || 1;
    this.dateCreation = dateCreation || null;

    const resolvedPolicy = resolveCommandePolicy(policy);
    const normalizedTypeHabit = normalizeText(typeHabit).toUpperCase();
    const requireMesures = resolvedPolicy.mesuresObligatoiresPourCommande;
    const hasMesuresInput = hasMeasureValues(mesures);

    if (!hasMesuresInput && !requireMesures) {
      this.typeHabit = normalizedTypeHabit;
      this.mesures = null;
      return;
    }

    try {
      const snapshot = createMesuresCommande(
        mesures?.typeHabit || normalizedTypeHabit,
        mesures?.valeurs || mesures || {},
        {
          requireComplete: requireMesures && resolvedPolicy.interdireEnregistrementSansToutesMesuresUtiles,
          requireAtLeastOne: requireMesures,
          allowDecimals: resolvedPolicy.valeursDecimalesAutorisees,
          unit: mesures?.unite || resolvedPolicy.uniteMesure,
          habitDefinitions: resolvedPolicy.habits
        }
      );
      this.typeHabit = snapshot.typeHabit;
      this.mesures = snapshot;
    } catch (error) {
      if (!rehydrate) throw error;
      this.typeHabit = normalizedTypeHabit;
      this.mesures = mesures || null;
    }
  }

  toJSON() {
    return {
      idItem: this.idItem,
      idCommande: this.idCommande,
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
