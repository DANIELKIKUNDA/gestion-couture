// Terminer le travail d'une commande
export async function terminerTravail({ idCommande, commandeRepo }) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.terminerTravail();
  await commandeRepo.save(commande);

  return commande;
}
