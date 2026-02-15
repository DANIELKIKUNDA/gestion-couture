export const TypeOrigineFacture = Object.freeze({
  COMMANDE: "COMMANDE",
  RETOUCHE: "RETOUCHE",
  VENTE: "VENTE"
});

export const StatutFacture = Object.freeze({
  EMISE: "EMISE",
  PARTIELLEMENT_PAYEE: "PARTIELLEMENT_PAYEE",
  SOLDEE: "SOLDEE"
});

export function assertTypeOrigine(value) {
  if (!Object.values(TypeOrigineFacture).includes(value)) {
    throw new Error("typeOrigine invalide");
  }
}

export function assertNumeroFacture(value) {
  if (!value || !/^FAC-\d{4}-\d+$/.test(value)) throw new Error("numeroFacture invalide");
}

export function assertClientSnapshot(value) {
  if (!value || typeof value !== "object") throw new Error("client snapshot requis");
  if (!String(value.nom || "").trim()) throw new Error("client.nom requis");
}

export function assertLignesFacture(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("lignes facture requises");
  for (const ligne of value) {
    if (!String(ligne.description || "").trim()) throw new Error("ligne.description requis");
    if (typeof ligne.quantite !== "number" || Number.isNaN(ligne.quantite) || ligne.quantite <= 0) {
      throw new Error("ligne.quantite invalide");
    }
    if (typeof ligne.prix !== "number" || Number.isNaN(ligne.prix) || ligne.prix < 0) {
      throw new Error("ligne.prix invalide");
    }
  }
}
