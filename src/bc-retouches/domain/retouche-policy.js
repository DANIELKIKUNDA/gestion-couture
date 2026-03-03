const DEFAULT_RETOUCHE_TYPES = [
  {
    code: "OURLET_PANTALON",
    libelle: "Ourlet pantalon",
    actif: true,
    ordreAffichage: 1,
    necessiteMesures: true,
    mesuresCibles: ["longueur", "largeurBas"],
    descriptionObligatoire: false,
    habitsCompatibles: ["PANTALON"]
  },
  {
    code: "REPARATION_DECHIRURE",
    libelle: "Reparation dechirure",
    actif: true,
    ordreAffichage: 2,
    necessiteMesures: false,
    mesuresCibles: [],
    descriptionObligatoire: true,
    habitsCompatibles: ["*"]
  },
  {
    code: "REPARATION",
    libelle: "Reparation",
    actif: true,
    ordreAffichage: 3,
    necessiteMesures: false,
    mesuresCibles: [],
    descriptionObligatoire: false,
    habitsCompatibles: ["*"]
  },
  {
    code: "OURLET",
    libelle: "Ourlet",
    actif: true,
    ordreAffichage: 4,
    necessiteMesures: true,
    mesuresCibles: [],
    descriptionObligatoire: false,
    habitsCompatibles: ["*"]
  }
];

function normalizeTypeRetoucheRow(row) {
  if (!row || typeof row !== "object") return null;
  const code = String(row.code || "").trim().toUpperCase();
  if (!code) return null;
  const libelle = String(row.libelle || code).trim() || code;
  const mesuresCibles = Array.isArray(row.mesuresCibles)
    ? row.mesuresCibles.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const habitsCompatibles = Array.isArray(row.habitsCompatibles)
    ? row.habitsCompatibles.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)
    : ["*"];
  return {
    code,
    libelle,
    actif: row.actif !== false,
    ordreAffichage: Number.isFinite(Number(row.ordreAffichage)) ? Number(row.ordreAffichage) : null,
    necessiteMesures: row.necessiteMesures === true,
    mesuresCibles,
    descriptionObligatoire: row.descriptionObligatoire === true,
    habitsCompatibles: habitsCompatibles.length > 0 ? habitsCompatibles : ["*"]
  };
}

export function resolveRetouchePolicy(payload = null) {
  const retouches = payload?.retouches || payload || {};
  const configuredTypesSource = Array.isArray(retouches.typesRetouche) ? retouches.typesRetouche : retouches.typesRetouches;
  const configuredTypes = Array.isArray(configuredTypesSource) ? configuredTypesSource : [];
  const mergedTypes = [...DEFAULT_RETOUCHE_TYPES, ...configuredTypes];
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

export function isRetoucheHabitCompatible(typeDefinition, typeHabit) {
  const habit = String(typeHabit || "").trim().toUpperCase();
  if (!habit) return false;
  const allowed = typeDefinition?.habitsCompatibles || ["*"];
  return allowed.includes("*") || allowed.includes(habit);
}

export function resolveMesureTargetsForHabit({ typeDefinition }) {
  return Array.isArray(typeDefinition?.mesuresCibles) ? typeDefinition.mesuresCibles : [];
}
