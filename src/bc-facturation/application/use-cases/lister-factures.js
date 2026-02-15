import { FactureIntrouvable } from "../../domain/errors.js";

export async function listerFactures({ factureRepo }) {
  return factureRepo.listWithPaiements();
}

export async function obtenirFacture({ idFacture, factureRepo }) {
  const facture = await factureRepo.getByIdWithPaiements(idFacture);
  if (!facture) throw new FactureIntrouvable("Facture introuvable");
  return facture;
}
