// Annuler une operation
export async function annulerOperation({ idCaisseJour, input, caisseRepo }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  caisse.annulerOperation(input);
  await caisseRepo.save(caisse);

  return caisse;
}
