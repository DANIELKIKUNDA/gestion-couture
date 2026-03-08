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
    throw new Error(`${label} ne doit pas etre vide`);
  }
}

export function assertPhone(value) {
  // Simple phone validation (can be improved)
  if (!value || !/^\+?[0-9]{6,15}$/.test(String(value))) {
    throw new Error("Telephone invalide");
  }
}

export function assertMesures(ensembleMesures) {
  if (!Array.isArray(ensembleMesures) || ensembleMesures.length === 0) {
    throw new Error("L'ensemble des mesures doit etre un tableau non vide");
  }
  for (const m of ensembleMesures) {
    if (!m.nomMesure || typeof m.valeur !== "number" || m.valeur <= 0) {
      throw new Error("mesure invalide");
    }
  }
}
