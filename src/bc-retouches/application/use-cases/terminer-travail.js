// Terminer le travail d'une retouche
export async function terminerTravail({ idRetouche, retoucheRepo }) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.terminerTravail();
  await retoucheRepo.save(retouche);

  return retouche;
}
