// Appliquer un paiement sur une retouche
export async function appliquerPaiement({ idRetouche, montant, retoucheRepo }) {
  const retouche = await retoucheRepo.getById(idRetouche);
  if (!retouche) throw new Error("Retouche introuvable");

  retouche.appliquerPaiement(montant);
  await retoucheRepo.save(retouche);

  return retouche;
}
