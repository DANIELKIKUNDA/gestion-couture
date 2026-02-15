// Enregistrer une sortie
export async function enregistrerSortie({ idCaisseJour, input, caisseRepo }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  caisse.enregistrerSortie(input);
  await caisseRepo.save(caisse);

  return caisse;
}
