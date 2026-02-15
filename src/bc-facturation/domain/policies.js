import { assertTypeOrigine, TypeOrigineFacture } from "./value-objects.js";

const MOTIF_PAIEMENT_PAR_ORIGINE = Object.freeze({
  [TypeOrigineFacture.COMMANDE]: "PAIEMENT_COMMANDE",
  [TypeOrigineFacture.RETOUCHE]: "PAIEMENT_RETOUCHE",
  [TypeOrigineFacture.VENTE]: "VENTE_STOCK"
});

const ORIGINE_READERS = Object.freeze({
  [TypeOrigineFacture.COMMANDE]: "readCommande",
  [TypeOrigineFacture.RETOUCHE]: "readRetouche",
  [TypeOrigineFacture.VENTE]: "readVente"
});

export function normaliserTypeOrigine(rawTypeOrigine) {
  const value = String(rawTypeOrigine || "").trim().toUpperCase();
  assertTypeOrigine(value);
  return value;
}

export function readerMethodByTypeOrigine(typeOrigine) {
  const value = normaliserTypeOrigine(typeOrigine);
  return ORIGINE_READERS[value];
}

export function calculerMontantPayeFacture({ typeOrigine, operations = [] }) {
  const value = normaliserTypeOrigine(typeOrigine);
  const motifAttendu = MOTIF_PAIEMENT_PAR_ORIGINE[value];

  return (operations || []).reduce((sum, op) => {
    const typeOperation = String(op?.typeOperation || op?.type_operation || "").toUpperCase();
    const statutOperation = String(op?.statutOperation || op?.statut_operation || "").toUpperCase();
    const motif = String(op?.motif || "").toUpperCase();
    const montant = Number(op?.montant || 0);

    if (typeOperation !== "ENTREE") return sum;
    if (statutOperation === "ANNULEE") return sum;
    if (motif !== motifAttendu) return sum;
    return sum + montant;
  }, 0);
}
