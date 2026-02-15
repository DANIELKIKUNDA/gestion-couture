// Livrer une retouche terminee et payee
export async function livrerRetouche({ idRetouche, retoucheRepo }) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.livrerRetouche();
  await retoucheRepo.save(retouche);

  return retouche;
}
