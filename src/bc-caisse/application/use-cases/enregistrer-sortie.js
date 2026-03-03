// Enregistrer une sortie
export async function enregistrerSortie({ idCaisseJour, input, caisseRepo, parametresRepo }) {
  const caisse = await caisseRepo.getById(idCaisseJour);
  if (!caisse) throw new Error("Caisse introuvable");

  let rolesAutorises = [];
  if (parametresRepo && typeof parametresRepo.getCurrent === "function") {
    const current = await parametresRepo.getCurrent();
    rolesAutorises = current?.payload?.securite?.rolesAutorises || [];
  }

  caisse.enregistrerSortie({ ...input, rolesAutorises });
  await caisseRepo.save(caisse);

  return caisse;
}
