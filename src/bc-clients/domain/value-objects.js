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
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!/^\+?[0-9]{6,15}$/.test(normalized)) {
    throw new Error("Telephone invalide");
  }
  return normalized;
}

export function assertMesures(ensembleMesures) {
  if (!Array.isArray(ensembleMesures) || ensembleMesures.length === 0) {
    throw new Error("L'ensemble des mesures doit etre un tableau non vide");
  }
  for (const m of ensembleMesures) {
    const nomMesure = String(m?.nomMesure || "").trim();
    const valeur = m?.valeur;
    const valeurTexte = String(valeur || "").trim();
    const valeurNumeriqueValide = typeof valeur === "number" && Number.isFinite(valeur) && valeur > 0;
    const valeurTexteValide = typeof valeur === "string" && valeurTexte.length > 0;
    if (!nomMesure || (!valeurNumeriqueValide && !valeurTexteValide)) {
      throw new Error("mesure invalide");
    }
  }
}
