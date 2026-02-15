// Enregistrer une entree
export async function enregistrerEntree({ idCaisseJour, input, caisseRepo }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  caisse.enregistrerEntree(input);
  await caisseRepo.save(caisse);

  return caisse;
}
