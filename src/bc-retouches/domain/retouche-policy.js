export const DEFAULT_RETOUCHE_TYPES = [
  {
    code: "OURLET_PANTALON",
    libelle: "Ourlet pantalon",
    actif: true,
    ordreAffichage: 1,
    necessiteMesures: true,
    mesures: [
      { code: "longueur", label: "Longueur", unite: "cm", typeChamp: "number", obligatoire: true, actif: true, ordre: 1 },
      { code: "largeurBas", label: "Largeur bas", unite: "cm", typeChamp: "number", obligatoire: false, actif: true, ordre: 2 }
    ],
    descriptionObligatoire: false,
    habitsCompatibles: ["PANTALON"]
  },
  {
    code: "REPARATION_DECHIRURE",
    libelle: "Reparation dechirure",
    actif: true,
    ordreAffichage: 2,
    necessiteMesures: false,
    mesures: [],
    descriptionObligatoire: true,
    habitsCompatibles: ["*"]
  },
  {
    code: "REPARATION",
    libelle: "Reparation",
    actif: true,
    ordreAffichage: 3,
    necessiteMesures: false,
    mesures: [],
    descriptionObligatoire: false,
    habitsCompatibles: ["*"]
  },
  {
    code: "OURLET",
    libelle: "Ourlet",
    actif: true,
    ordreAffichage: 4,
    necessiteMesures: true,
    mesures: [
      { code: "longueur", label: "Longueur", unite: "cm", typeChamp: "number", obligatoire: true, actif: true, ordre: 1 }
    ],
    descriptionObligatoire: false,
    habitsCompatibles: ["*"]
  }
];

export const SYSTEM_RETOUCHE_LIBRE_CODE = "LIBRE";
export const SYSTEM_RETOUCHE_LIBRE_TYPE = Object.freeze({
  code: SYSTEM_RETOUCHE_LIBRE_CODE,
  libelle: "Libre",
  actif: true,
  ordreAffichage: 0,
  necessiteMesures: false,
  mesures: [],
  descriptionObligatoire: true,
  habitsCompatibles: ["*"]
});

export function cloneDefaultRetoucheTypes() {
  return DEFAULT_RETOUCHE_TYPES.map((row) => ({
    ...row,
    habitsCompatibles: Array.isArray(row.habitsCompatibles) ? [...row.habitsCompatibles] : ["*"],
    mesures: Array.isArray(row.mesures) ? row.mesures.map((mesure) => ({ ...mesure })) : []
  }));
}

function normalizeMeasureRow(row, fallbackOrder = 1) {
  if (!row || typeof row !== "object") return null;
  const code = String(row.code || "").trim();
  if (!code) return null;
  const typeChamp = String(row.typeChamp || "").trim().toLowerCase();
  return {
    code,
    label: String(row.label || code).trim() || code,
    unite: String(row.unite || (typeChamp === "text" || typeChamp === "select" ? "" : "cm")).trim(),
    typeChamp: typeChamp === "text" || typeChamp === "select" ? typeChamp : "number",
    obligatoire: row.obligatoire === true,
    actif: row.actif !== false,
    ordre: Number.isFinite(Number(row.ordre)) ? Number(row.ordre) : fallbackOrder
  };
}

function normalizeTypeRetoucheRow(row) {
  if (!row || typeof row !== "object") return null;
  const code = String(row.code || "").trim().toUpperCase();
  if (!code) return null;
  const libelle = String(row.libelle || code).trim() || code;
  const habitsCompatibles = Array.isArray(row.habitsCompatibles)
    ? row.habitsCompatibles.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : ["*"];
  const mesuresSource = Array.isArray(row.mesures)
    ? row.mesures
    : Array.isArray(row.mesuresCibles)
      ? row.mesuresCibles.map((item, index) => ({
          code: String(item || "").trim(),
          label: String(item || "").trim(),
          unite: "cm",
          typeChamp: "number",
          obligatoire: true,
          actif: true,
          ordre: index + 1
        }))
      : [];
  const mesures = mesuresSource
    .map((item, index) => normalizeMeasureRow(item, index + 1))
    .filter(Boolean)
    .sort((left, right) => Number(left.ordre || 0) - Number(right.ordre || 0));
  return {
    code,
    libelle,
    actif: row.actif !== false,
    ordreAffichage: Number.isFinite(Number(row.ordreAffichage)) ? Number(row.ordreAffichage) : null,
    necessiteMesures: row.necessiteMesures === true,
    mesures,
    descriptionObligatoire: row.descriptionObligatoire === true,
    habitsCompatibles: habitsCompatibles.length > 0 ? habitsCompatibles : ["*"]
  };
}

export function resolveRetouchePolicy(payload = null) {
  const retouches = payload?.retouches || payload || {};
  const configuredTypesSource = Array.isArray(retouches.typesRetouche) ? retouches.typesRetouche : retouches.typesRetouches;
  const configuredTypes = Array.isArray(configuredTypesSource) ? configuredTypesSource : [];
  const mergedTypes = configuredTypes.length > 0 ? configuredTypes : DEFAULT_RETOUCHE_TYPES;
  const byCode = new Map();
  let fallbackOrder = 1;
  for (const row of mergedTypes) {
    const normalized = normalizeTypeRetoucheRow(row);
    if (!normalized) continue;
    if (!Number.isFinite(Number(normalized.ordreAffichage)) || Number(normalized.ordreAffichage) <= 0) {
      normalized.ordreAffichage = fallbackOrder;
    }
    fallbackOrder += 1;
    byCode.set(normalized.code, normalized);
  }
  byCode.set(SYSTEM_RETOUCHE_LIBRE_CODE, { ...SYSTEM_RETOUCHE_LIBRE_TYPE });
  const normalizedTypes = Array.from(byCode.values()).sort((a, b) => {
    const left = Number(a.ordreAffichage || 0);
    const right = Number(b.ordreAffichage || 0);
    if (left !== right) return left - right;
    return String(a.libelle || a.code).localeCompare(String(b.libelle || b.code));
  });
  return {
    mesuresOptionnelles: retouches.mesuresOptionnelles !== false,
    saisiePartielle: retouches.saisiePartielle === true,
    descriptionObligatoire: retouches.descriptionObligatoire === true,
    typesRetouche: normalizedTypes,
    typesRetoucheByCode: new Map(normalizedTypes.map((row) => [row.code, row]))
  };
}

export function getTypeRetoucheDefinition(typeRetouche, policy, { allowInactive = false } = {}) {
  const resolvedPolicy = policy?.typesRetoucheByCode ? policy : resolveRetouchePolicy(policy);
  const code = String(typeRetouche || "").trim().toUpperCase();
  const definition = resolvedPolicy.typesRetoucheByCode.get(code);
  if (!definition) throw new Error("Type de retouche invalide");
  if (!allowInactive && definition.actif === false) throw new Error("Type de retouche inactif");
  return definition;
}

function buildFallbackMeasureDefinitions(snapshot = null) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const existingDefinitions = Array.isArray(snapshot.definitions) ? snapshot.definitions : [];
  if (existingDefinitions.length > 0) {
    return existingDefinitions
      .map((row, index) => normalizeMeasureRow(row, index + 1))
      .filter(Boolean);
  }
  const values = snapshot?.valeurs && typeof snapshot.valeurs === "object" ? snapshot.valeurs : snapshot;
  if (!values || typeof values !== "object") return [];
  return Object.keys(values)
    .filter(Boolean)
    .map((code, index) =>
      normalizeMeasureRow(
        {
          code,
          label: code,
          unite: "cm",
          typeChamp: "number",
          obligatoire: false,
          actif: true,
          ordre: index + 1
        },
        index + 1
      )
    )
    .filter(Boolean);
}

export function getTypeRetoucheDefinitionSafe(
  typeRetouche,
  policy,
  { allowInactive = false, rehydrate = false, fallbackTypeHabit = null, fallbackMeasures = null } = {}
) {
  try {
    return getTypeRetoucheDefinition(typeRetouche, policy, { allowInactive });
  } catch (error) {
    if (!rehydrate) throw error;
    const code = String(typeRetouche || "").trim().toUpperCase();
    if (!code) throw error;
    const normalizedHabit = String(fallbackTypeHabit || "").trim().toUpperCase();
    const measures = buildFallbackMeasureDefinitions(fallbackMeasures);
    return {
      code,
      libelle: code,
      actif: true,
      ordreAffichage: 1,
      necessiteMesures: measures.length > 0,
      mesures,
      descriptionObligatoire: false,
      habitsCompatibles: normalizedHabit ? [normalizedHabit] : ["*"]
    };
  }
}

export function isRetoucheHabitCompatible(typeDefinition, typeHabit) {
  const habit = String(typeHabit || "").trim().toUpperCase();
  if (!habit) return false;
  const allowed = typeDefinition?.habitsCompatibles || ["*"];
  return allowed.includes("*") || allowed.includes(habit);
}

export function resolveMesureTargetsForHabit({ typeDefinition }) {
  return Array.isArray(typeDefinition?.mesures) ? typeDefinition.mesures.map((row) => row.code).filter(Boolean) : [];
}

export function resolveRetoucheMeasureDefinitions({ typeDefinition }) {
  return Array.isArray(typeDefinition?.mesures) ? typeDefinition.mesures.filter((row) => row.actif !== false) : [];
}
