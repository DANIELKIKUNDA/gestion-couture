// Cloturer la caisse
export async function cloturerCaisse({ idCaisseJour, input, caisseRepo }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  caisse.cloturerCaisse(input);
  await caisseRepo.save(caisse);

  return caisse;
}
