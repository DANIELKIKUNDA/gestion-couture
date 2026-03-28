import { enregistrerSerieMesures } from "../use-cases/enregistrer-serie-mesures.js";
import { generateSerieMesuresId } from "../../../shared/domain/id-generator.js";
import { normalizeMesuresSnapshot } from "../../domain/consultation-client.js";

function toIsoString(value) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeMeasureValue(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw === "courtes" || raw === "longues") return raw;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return raw;
}

export function buildEnsembleMesuresFromSnapshot(snapshot, typeHabit = "") {
  const normalized = normalizeMesuresSnapshot(snapshot, typeHabit);
  if (!normalized) return [];
  return Object.entries(normalized.valeurs)
    .map(([nomMesure, rawValue]) => {
      const valeur = normalizeMeasureValue(rawValue);
      if (valeur === null) return null;
      return {
        nomMesure,
        valeur
      };
    })
    .filter(Boolean);
}

export function buildMeasurePrefillPayload(serie = null) {
  if (!serie) return null;
  const mesures = Array.isArray(serie.ensembleMesures) ? serie.ensembleMesures : [];
  const valeurs = {};
  for (const item of mesures) {
    const key = String(item?.nomMesure || "").trim();
    const value = normalizeMeasureValue(item?.valeur);
    if (!key || value === null) continue;
    valeurs[key] = value;
  }
  if (Object.keys(valeurs).length === 0) return null;
  return {
    idSerieMesures: serie.idSerieMesures,
    typeHabit: serie.typeVetement,
    dateDerniereUtilisation: toIsoString(serie.datePrise),
    mesuresHabit: {
      typeHabit: serie.typeVetement,
      unite: "cm",
      valeurs
    }
  };
}

export async function getLatestMeasuresForClientAndType({
  idClient,
  typeHabit,
  serieRepo
} = {}) {
  const normalizedClientId = String(idClient || "").trim();
  const normalizedTypeHabit = String(typeHabit || "").trim().toUpperCase();
  if (!normalizedClientId || !normalizedTypeHabit || !serieRepo) return null;
  const serie = await serieRepo.getActiveByClientAndType(normalizedClientId, normalizedTypeHabit);
  return buildMeasurePrefillPayload(serie);
}

export async function saveLatestMeasuresForClientAndType({
  idClient,
  typeHabit,
  mesuresSnapshot,
  prisePar = null,
  observations = null,
  serieRepo
} = {}) {
  const normalizedClientId = String(idClient || "").trim();
  const normalizedTypeHabit = String(typeHabit || "").trim().toUpperCase();
  const ensembleMesures = buildEnsembleMesuresFromSnapshot(mesuresSnapshot, normalizedTypeHabit);
  if (!normalizedClientId || !normalizedTypeHabit || ensembleMesures.length === 0 || !serieRepo) {
    return null;
  }

  await serieRepo.deactivateActiveByClientAndType(normalizedClientId, normalizedTypeHabit);
  const serie = enregistrerSerieMesures({
    idSerieMesures: generateSerieMesuresId(),
    idClient: normalizedClientId,
    typeVetement: normalizedTypeHabit,
    ensembleMesures,
    prisePar,
    observations
  });
  serie.activer();
  await serieRepo.save(serie);
  return buildMeasurePrefillPayload(serie);
}
