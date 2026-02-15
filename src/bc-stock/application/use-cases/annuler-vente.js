import { VenteIntrouvable } from "../../domain/errors.js";

export async function annulerVente({ idVente, motif, venteRepo }) {
  const vente = await venteRepo.getById(idVente);
  if (!vente) throw new VenteIntrouvable("Vente introuvable");

  vente.annuler({ motif });
  await venteRepo.save(vente);
  return vente;
}
