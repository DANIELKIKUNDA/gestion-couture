// Value objects & enums for Clients & Mesures
export const TypeVetement = Object.freeze({
  ROBE: "ROBE",
  PANTALON: "PANTALON",
  CHEMISE: "CHEMISE",
  JUPE: "JUPE",
  UNIFORME: "UNIFORME",
  AUTRE: "AUTRE"
});

export function assertNonEmpty(value, label) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

export function assertPhone(value) {
  // Simple phone validation (can be improved)
  if (!value || !/^\+?[0-9]{6,15}$/.test(String(value))) {
    throw new Error("telephone invalid");
  }
}

export function assertMesures(ensembleMesures) {
  if (!Array.isArray(ensembleMesures) || ensembleMesures.length === 0) {
    throw new Error("ensembleMesures must be non-empty array");
  }
  for (const m of ensembleMesures) {
    if (!m.nomMesure || typeof m.valeur !== "number" || m.valeur <= 0) {
      throw new Error("mesure invalide");
    }
  }
}
