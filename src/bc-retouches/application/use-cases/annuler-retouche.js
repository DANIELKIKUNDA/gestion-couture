// Annuler une retouche (si non livree)
export async function annulerRetouche({ idRetouche, retoucheRepo }) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.annulerRetouche();
  await retoucheRepo.save(retouche);

  return retouche;
}
