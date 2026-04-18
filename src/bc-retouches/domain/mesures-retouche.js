function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFieldType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "text" || type === "select") return type;
  return "number";
}

function normalizeMeasureDefinitions(definitions = []) {
  if (!Array.isArray(definitions)) return [];
  return definitions
    .map((row, index) => {
      const code = String(row?.code || "").trim();
      if (!code) return null;
      return {
        code,
        label: String(row?.label || code).trim() || code,
        unite: String(row?.unite || (normalizeFieldType(row?.typeChamp) === "number" ? "cm" : "")).trim(),
        typeChamp: normalizeFieldType(row?.typeChamp),
        obligatoire: normalizeBoolean(row?.obligatoire, false),
        actif: row?.actif !== false,
        ordre: Number.isFinite(Number(row?.ordre)) ? Number(row.ordre) : index + 1
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.ordre || 0) - Number(right.ordre || 0));
}

function buildFreeMeasureDefinitions(source = {}) {
  if (!source || typeof source !== "object") return [];
  return Object.entries(source)
    .map(([code, value], index) => {
      const normalizedCode = String(code || "").trim();
      if (!normalizedCode || value === undefined || value === null || value === "") return null;
      const parsed = Number(value);
      return {
        code: normalizedCode,
        label: normalizedCode,
        unite: Number.isFinite(parsed) ? "cm" : "",
        typeChamp: Number.isFinite(parsed) ? "number" : "text",
        obligatoire: false,
        actif: true,
        ordre: index + 1
      };
    })
    .filter(Boolean);
}

function parseNumberMeasure(raw, label) {
  const value = Number(raw);
  if (Number.isNaN(value) || value <= 0) throw new Error(`Mesure invalide: ${label}`);
  if (value > 400) throw new Error(`Mesure aberrante: ${label}`);
  return value;
}

function parseTextMeasure(raw, label) {
  const value = String(raw || "").trim();
  if (!value) throw new Error(`Mesure invalide: ${label}`);
  return value;
}

export function createRetoucheMesuresSnapshot(mesures, { definitions = [], requireAtLeastOne = true, requireComplete = false } = {}) {
  const source = mesures && typeof mesures === "object" ? mesures : {};
  const configuredDefinitions = normalizeMeasureDefinitions(definitions).filter((row) => row.actif !== false);
  const normalizedDefinitions = configuredDefinitions.length > 0 ? configuredDefinitions : buildFreeMeasureDefinitions(source);
  const valeurs = {};

  for (const definition of normalizedDefinitions) {
    const raw = source[definition.code];
    if (raw === undefined || raw === null || raw === "") {
      if (requireComplete && definition.obligatoire) {
        throw new Error(`Mesure obligatoire: ${definition.label}`);
      }
      continue;
    }
    valeurs[definition.code] =
      definition.typeChamp === "number" ? parseNumberMeasure(raw, definition.label) : parseTextMeasure(raw, definition.label);
  }

  if (requireAtLeastOne && Object.keys(valeurs).length === 0) {
    throw new Error("Mesures requises pour ce type de retouche");
  }

  return {
    unite: normalizedDefinitions.find((row) => row.unite)?.unite || "cm",
    valeurs,
    definitions: normalizedDefinitions.map((row) => ({
      code: row.code,
      label: row.label,
      unite: row.unite,
      typeChamp: row.typeChamp,
      obligatoire: row.obligatoire
    }))
  };
}
