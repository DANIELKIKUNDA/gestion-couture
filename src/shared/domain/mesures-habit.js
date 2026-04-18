export const TypeHabit = Object.freeze({
  PANTALON: "PANTALON",
  CHEMISE: "CHEMISE",
  CHEMISIER: "CHEMISIER",
  VESTE: "VESTE",
  GILET: "GILET",
  JACKET: "JACKET",
  BOUBOU: "BOUBOU",
  ROBE: "ROBE",
  JUPE: "JUPE",
  VESTE_FEMME: "VESTE_FEMME",
  LIBAYA: "LIBAYA",
  ENSEMBLE: "ENSEMBLE",
  AUTRES: "AUTRES"
});

const MAX_CM = 400;

const DEFINITIONS = Object.freeze({
  PANTALON: {
    required: ["longueur", "tourTaille", "tourHanche", "largeurBas", "hauteurFourche"],
    optional: []
  },
  CHEMISE: {
    required: ["poitrine", "longueurChemise", "typeManches", "poignet", "carrure"],
    optional: ["longueurManches"]
  },
  CHEMISIER: {
    required: ["poitrine", "longueurChemise", "typeManches", "poignet", "carrure"],
    optional: ["longueurManches"]
  },
  VESTE: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  GILET: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  JACKET: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  ROBE: {
    required: ["poitrine", "taille", "hanche", "longueur"],
    optional: ["largeurBas"]
  },
  JUPE: {
    required: ["poitrine", "taille", "hanche", "longueur"],
    optional: ["largeurBas"]
  },
  LIBAYA: {
    required: ["poitrine", "taille", "hanche", "longueur"],
    optional: ["largeurBas"]
  },
  BOUBOU: {
    required: ["poitrine", "longueur", "largeur", "ouvertureManches"],
    optional: []
  },
  VESTE_FEMME: {
    required: ["poitrine", "taille", "longueurVeste", "longueurManches", "carrure", "poignet"],
    optional: []
  },
  ENSEMBLE: {
    required: ["poitrine", "taille", "hanche", "longueur", "tourTaille", "tourHanche", "largeurBas"],
    optional: []
  },
  AUTRES: {
    required: [],
    optional: []
  }
});

function assertTypeHabit(typeHabit, habitDefinitions = null) {
  const value = String(typeHabit || "").trim().toUpperCase();
  const fromEnum = Object.values(TypeHabit).includes(value);
  const fromConfig =
    !!habitDefinitions &&
    typeof habitDefinitions === "object" &&
    Object.prototype.hasOwnProperty.call(habitDefinitions, value);
  if (!fromEnum && !fromConfig) {
    throw new Error("typeHabit invalide");
  }
  return value;
}

function resolveDefinition(typeHabit, habitDefinitions = null) {
  const type = assertTypeHabit(typeHabit, habitDefinitions);
  const configured = habitDefinitions && typeof habitDefinitions === "object" ? habitDefinitions[type] : null;
  if (configured && Array.isArray(configured.mesures)) {
    const required = [];
    const optional = [];
    const fieldTypes = {};
    for (const row of configured.mesures) {
      const code = String(row?.code || "").trim();
      if (!code) continue;
      if (row?.obligatoire === true) required.push(code);
      else optional.push(code);
      const typeChamp = String(row?.typeChamp || "").trim().toLowerCase();
      fieldTypes[code] = typeChamp === "text" || typeChamp === "select" ? typeChamp : "number";
    }
    return {
      type,
      definition: {
        required: Array.from(new Set(required)),
        optional: Array.from(new Set(optional)),
        fieldTypes
      }
    };
  }
  const fallback = DEFINITIONS[type];
  const fallbackTypes = {};
  for (const field of [...fallback.required, ...fallback.optional]) {
    fallbackTypes[field] = field === "typeManches" ? "select" : "number";
  }
  return {
    type,
    definition: {
      ...fallback,
      fieldTypes: fallbackTypes
    }
  };
}

function assertPositiveCm(value, field, { allowDecimals = true } = {}) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) throw new Error(`Mesure invalide: ${field}`);
  if (n > MAX_CM) throw new Error(`Mesure aberrante: ${field}`);
  if (!allowDecimals && !Number.isInteger(n)) {
    throw new Error(`Mesure decimale interdite: ${field}`);
  }
  return n;
}

function normalizeCustomMeasureValue(value, field, { allowDecimals = true } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value || "").trim();
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return assertPositiveCm(parsed, field, { allowDecimals });
  if (!raw) return null;
  return raw;
}

function normalizeTypeManches(value, required = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    if (required) throw new Error("Mesure manquante: typeManches");
    return null;
  }
  if (normalized !== "courtes" && normalized !== "longues") {
    throw new Error("typeManches invalide");
  }
  return normalized;
}

function normalizeMesures(typeHabit, mesures, { requireComplete, requireAtLeastOne = true, allowDecimals = true, unit = "cm", habitDefinitions = null }) {
  const resolved = resolveDefinition(typeHabit, habitDefinitions);
  const type = resolved.type;
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  if (normalizedUnit !== "cm") {
    throw new Error(`Unite de mesure non supportee: ${normalizedUnit || "inconnue"}`);
  }
  const definition = resolved.definition;
  const source = mesures && typeof mesures === "object" ? mesures : {};
  const out = {};

  const measureFields = new Set([...definition.required, ...definition.optional].filter((f) => f !== "typeManches"));
  for (const field of measureFields) {
    const fieldType = definition.fieldTypes?.[field] || "number";
    const raw = source[field];
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete && definition.required.includes(field)) {
        throw new Error(`Mesure manquante: ${field}`);
      }
      continue;
    }
    if (fieldType === "number") {
      out[field] = assertPositiveCm(raw, field, { allowDecimals });
    } else {
      const normalizedText = String(raw || "").trim();
      if (!normalizedText) throw new Error(`Mesure invalide: ${field}`);
      out[field] = normalizedText;
    }
  }

  if (definition.required.includes("typeManches") || definition.optional.includes("typeManches")) {
    const typeManches = normalizeTypeManches(source.typeManches, requireComplete);
    if (typeManches) out.typeManches = typeManches;
    if (typeManches === "longues") {
      if (source.longueurManches === undefined || source.longueurManches === null || source.longueurManches === "") {
        if (requireComplete) throw new Error("Mesure manquante: longueurManches");
      } else {
        out.longueurManches = assertPositiveCm(source.longueurManches, "longueurManches", { allowDecimals });
      }
    } else if (source.longueurManches !== undefined && source.longueurManches !== null && source.longueurManches !== "") {
      out.longueurManches = assertPositiveCm(source.longueurManches, "longueurManches", { allowDecimals });
    }
  }

  const knownFields = new Set([...definition.required, ...definition.optional]);
  for (const [field, value] of Object.entries(source)) {
    if (!field || knownFields.has(field)) continue;
    const normalized = normalizeCustomMeasureValue(value, field, { allowDecimals });
    if (normalized !== null) out[field] = normalized;
  }

  if (!requireComplete && requireAtLeastOne) {
    const hasAtLeastOne = Object.keys(out).length > 0;
    if (!hasAtLeastOne) throw new Error("Au moins une mesure est requise");
  }

  return {
    typeHabit: type,
    unite: normalizedUnit,
    valeurs: out
  };
}

export function createMesuresCommande(typeHabit, mesures, options = {}) {
  return normalizeMesures(typeHabit, mesures, {
    requireComplete: options.requireComplete !== false,
    requireAtLeastOne: options.requireAtLeastOne !== false,
    allowDecimals: options.allowDecimals !== false,
    unit: options.unit || "cm",
    habitDefinitions: options.habitDefinitions || null
  });
}

export function createMesuresRetouche(typeHabit, mesures, options = {}) {
  return normalizeMesures(typeHabit, mesures, {
    requireComplete: false,
    requireAtLeastOne: options.requireAtLeastOne !== false,
    allowDecimals: options.allowDecimals !== false,
    unit: options.unit || "cm"
  });
}
