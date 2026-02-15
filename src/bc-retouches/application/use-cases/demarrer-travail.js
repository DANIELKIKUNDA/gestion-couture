// Demarrer le travail d'une retouche
export async function demarrerTravail({ idRetouche, parametresAtelier, retoucheRepo }) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.demarrerTravail(parametresAtelier);
  await retoucheRepo.save(retouche);

  return retouche;
}
