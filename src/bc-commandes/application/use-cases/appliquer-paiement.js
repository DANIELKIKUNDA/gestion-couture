// Appliquer un paiement sur une commande
export async function appliquerPaiement({ idCommande, montant, commandeRepo }) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.appliquerPaiement(montant);
  await commandeRepo.save(commande);

  return commande;
}
