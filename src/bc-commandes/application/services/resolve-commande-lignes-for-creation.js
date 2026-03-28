import { generateCommandeLigneId } from "../../../shared/domain/id-generator.js";
import { createMesuresCommande } from "../../../shared/domain/mesures-habit.js";
import { resolveClientForCreation } from "../../../bc-clients/application/services/resolve-client-for-creation.js";
import { resolveCommandePolicy } from "../../domain/commande-policy.js";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createLineConflictError(err, lineIndex) {
  if (!err || typeof err !== "object") return err;
  err.details = {
    ...(err.details && typeof err.details === "object" ? err.details : {}),
    lineIndex: Number(lineIndex)
  };
  return err;
}

function resolveClientLabel(client = null, fallback = {}) {
  const nom = normalizeText(client?.nom || fallback?.nomAffiche || fallback?.nom || "");
  const prenom = normalizeText(client?.prenom || fallback?.prenomAffiche || fallback?.prenom || "");
  return { nom, prenom };
}

function normalizeLineInput(raw = {}, index = 0) {
  const line = raw && typeof raw === "object" ? raw : {};
  return {
    idLigne: normalizeText(line.idLigne),
    idClient: normalizeText(line.idClient),
    role: normalizeText(line.role).toUpperCase(),
    utiliseClientPayeur: line.utiliseClientPayeur === true || line.source === "PAYEUR",
    nouveauClient: line.nouveauClient && typeof line.nouveauClient === "object" ? line.nouveauClient : null,
    doublonDecision: line.doublonDecision && typeof line.doublonDecision === "object" ? line.doublonDecision : null,
    nomAffiche: normalizeText(line.nomAffiche),
    prenomAffiche: normalizeText(line.prenomAffiche),
    typeHabit: normalizeText(line.typeHabit).toUpperCase(),
    mesuresHabit: line.mesuresHabit && typeof line.mesuresHabit === "object" ? line.mesuresHabit : {},
    ordreAffichage: Number(line.ordreAffichage || index + 1) || index + 1
  };
}

function createLegacySingleLine(body = {}) {
  return [
    {
      utiliseClientPayeur: true,
      role: "PAYEUR_BENEFICIAIRE",
      typeHabit: normalizeText(body.typeHabit).toUpperCase(),
      mesuresHabit: body.mesuresHabit && typeof body.mesuresHabit === "object" ? body.mesuresHabit : {},
      ordreAffichage: 1
    }
  ];
}

function validateRole(value, fallback = "BENEFICIAIRE") {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "PAYEUR_BENEFICIAIRE") return normalized;
  return fallback;
}

export async function resolveCommandeLignesForCreation({
  body = {},
  clientPayeurResolution,
  clientRepo,
  policy = null
} = {}) {
  const commandePolicy = resolveCommandePolicy(policy);
  const hasExplicitLines = Array.isArray(body.lignesCommande) && body.lignesCommande.length > 0;
  const sourceLines = hasExplicitLines ? body.lignesCommande : createLegacySingleLine(body);
  const lignes = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const rawLine = normalizeLineInput(sourceLines[index], index);
    if (!rawLine.typeHabit) {
      throw new Error(`Type d'habit obligatoire pour le beneficiaire ${index + 1}.`);
    }

    const mesuresHabit = createMesuresCommande(rawLine.typeHabit, rawLine.mesuresHabit, {
      requireComplete: commandePolicy.mesuresObligatoiresPourCommande && commandePolicy.interdireEnregistrementSansToutesMesuresUtiles,
      requireAtLeastOne: commandePolicy.mesuresObligatoiresPourCommande,
      allowDecimals: commandePolicy.valeursDecimalesAutorisees,
      unit: commandePolicy.uniteMesure,
      habitDefinitions: commandePolicy.habits
    });

    let resolvedClient = null;
    let role = validateRole(rawLine.role);

    if (rawLine.utiliseClientPayeur) {
      resolvedClient = clientPayeurResolution.client;
      role = "PAYEUR_BENEFICIAIRE";
    } else if (rawLine.idClient || rawLine.nouveauClient) {
      try {
        const resolution = await resolveClientForCreation({
          idClient: rawLine.idClient,
          nouveauClient: rawLine.nouveauClient,
          doublonDecision: rawLine.doublonDecision,
          clientRepo
        });
        resolvedClient = resolution.client;
      } catch (err) {
        throw createLineConflictError(err, index);
      }
    }

    const label = resolveClientLabel(resolvedClient, rawLine);
    if (!resolvedClient && (!label.nom || !label.prenom)) {
      throw new Error(`Renseignez l'identite du beneficiaire ${index + 1}.`);
    }

    lignes.push({
      idLigne: rawLine.idLigne || generateCommandeLigneId(),
      idClient: resolvedClient?.idClient || null,
      role,
      nomAffiche: label.nom,
      prenomAffiche: label.prenom,
      typeHabit: mesuresHabit.typeHabit,
      mesuresHabit,
      ordreAffichage: rawLine.ordreAffichage,
      dateCreation: new Date().toISOString()
    });
  }

  if (lignes.length === 0) {
    throw new Error("Ajoutez au moins un beneficiaire a cette commande.");
  }

  const typeHabitReference = lignes[0]?.typeHabit || null;
  const mesuresHabitReference = lignes[0]?.mesuresHabit || null;
  const uniqueBeneficiaires = new Set(
    lignes.map((ligne) => {
      if (ligne.idClient) return `client:${ligne.idClient}`;
      return `label:${ligne.nomAffiche.toLowerCase()}::${ligne.prenomAffiche.toLowerCase()}`;
    })
  );

  return {
    lignesCommande: lignes,
    typeHabitReference,
    mesuresHabitReference,
    nombreLignes: lignes.length,
    nombreBeneficiaires: uniqueBeneficiaires.size
  };
}
