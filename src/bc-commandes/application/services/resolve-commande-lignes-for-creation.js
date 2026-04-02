import { generateCommandeLigneId } from "../../../shared/domain/id-generator.js";
import { createMesuresCommande } from "../../../shared/domain/mesures-habit.js";
import { resolveCommandePolicy } from "../../domain/commande-policy.js";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function sameIdentity(line = {}, client = null) {
  if (!client) return false;
  const expected = resolveClientLabel(client);
  const current = resolveClientLabel(null, line);
  return Boolean(expected.nom && expected.prenom && expected.nom === current.nom && expected.prenom === current.prenom);
}

export async function resolveCommandeLignesForCreation({
  body = {},
  clientPayeurResolution,
  policy = null
} = {}) {
  const commandePolicy = resolveCommandePolicy(policy);
  const hasExplicitLines = Array.isArray(body.lignesCommande) && body.lignesCommande.length > 0;
  const sourceLines = hasExplicitLines ? body.lignesCommande : createLegacySingleLine(body);
  if (sourceLines.length > 1) {
    throw new Error("Une commande ne peut concerner qu'un seul client. Utilisez le dossier pour plusieurs personnes.");
  }

  const rawLine = normalizeLineInput(sourceLines[0], 0);
  if (!rawLine.typeHabit) {
    throw new Error("Type d'habit obligatoire pour la commande.");
  }

  if (!rawLine.utiliseClientPayeur) {
    if (rawLine.idClient && rawLine.idClient !== String(clientPayeurResolution?.idClient || "").trim()) {
      throw new Error("Une commande doit etre rattachee au client selectionne. Utilisez le dossier pour plusieurs personnes.");
    }
    if ((rawLine.nomAffiche || rawLine.prenomAffiche) && !sameIdentity(rawLine, clientPayeurResolution?.client)) {
      throw new Error("Une commande doit concerner un seul client. Les informations du client de ligne ne correspondent pas au client principal.");
    }
  }

  const mesuresHabit = createMesuresCommande(rawLine.typeHabit, rawLine.mesuresHabit, {
    requireComplete: commandePolicy.mesuresObligatoiresPourCommande && commandePolicy.interdireEnregistrementSansToutesMesuresUtiles,
    requireAtLeastOne: commandePolicy.mesuresObligatoiresPourCommande,
    allowDecimals: commandePolicy.valeursDecimalesAutorisees,
    unit: commandePolicy.uniteMesure,
    habitDefinitions: commandePolicy.habits
  });

  const label = resolveClientLabel(clientPayeurResolution?.client, rawLine);
  const ligne = {
    idLigne: rawLine.idLigne || generateCommandeLigneId(),
    idClient: clientPayeurResolution?.client?.idClient || null,
    role: validateRole(rawLine.role, "PAYEUR_BENEFICIAIRE"),
    nomAffiche: label.nom,
    prenomAffiche: label.prenom,
    typeHabit: mesuresHabit.typeHabit,
    mesuresHabit,
    ordreAffichage: 1,
    dateCreation: new Date().toISOString()
  };

  return {
    lignesCommande: [ligne],
    typeHabitReference: ligne.typeHabit,
    mesuresHabitReference: ligne.mesuresHabit,
    nombreLignes: 1,
    nombreBeneficiaires: 1
  };
}
