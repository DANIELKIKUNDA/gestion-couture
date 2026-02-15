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
  ENSEMBLE: "ENSEMBLE"
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
  }
});

function assertTypeHabit(typeHabit) {
  const value = String(typeHabit || "").trim().toUpperCase();
  if (!Object.values(TypeHabit).includes(value)) {
    throw new Error("typeHabit invalide");
  }
  return value;
}

function assertPositiveCm(value, field) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) throw new Error(`Mesure invalide: ${field}`);
  if (n > MAX_CM) throw new Error(`Mesure aberrante: ${field}`);
  return n;
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

function normalizeMesures(typeHabit, mesures, { requireComplete }) {
  const type = assertTypeHabit(typeHabit);
  const definition = DEFINITIONS[type];
  const source = mesures && typeof mesures === "object" ? mesures : {};
  const out = {};

  const numericFields = new Set([...definition.required, ...definition.optional].filter((f) => f !== "typeManches"));
  for (const field of numericFields) {
    const raw = source[field];
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete && definition.required.includes(field)) {
        throw new Error(`Mesure manquante: ${field}`);
      }
      continue;
    }
    out[field] = assertPositiveCm(raw, field);
  }

  if (definition.required.includes("typeManches") || definition.optional.includes("typeManches")) {
    const typeManches = normalizeTypeManches(source.typeManches, requireComplete);
    if (typeManches) out.typeManches = typeManches;
    if (typeManches === "longues") {
      if (source.longueurManches === undefined || source.longueurManches === null || source.longueurManches === "") {
        if (requireComplete) throw new Error("Mesure manquante: longueurManches");
      } else {
        out.longueurManches = assertPositiveCm(source.longueurManches, "longueurManches");
      }
    } else if (source.longueurManches !== undefined && source.longueurManches !== null && source.longueurManches !== "") {
      out.longueurManches = assertPositiveCm(source.longueurManches, "longueurManches");
    }
  }

  if (!requireComplete) {
    const hasAtLeastOne = Object.keys(out).length > 0;
    if (!hasAtLeastOne) throw new Error("Au moins une mesure est requise");
  }

  return {
    typeHabit: type,
    unite: "cm",
    valeurs: out
  };
}

export function createMesuresCommande(typeHabit, mesures) {
  return normalizeMesures(typeHabit, mesures, { requireComplete: true });
}

export function createMesuresRetouche(typeHabit, mesures) {
  return normalizeMesures(typeHabit, mesures, { requireComplete: false });
}
