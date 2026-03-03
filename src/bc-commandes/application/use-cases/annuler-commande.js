// Annuler une commande (si non livree)
export async function annulerCommande({ idCommande, commandeRepo }) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.annulerCommande();
  await commandeRepo.save(commande);

  return commande;
}
