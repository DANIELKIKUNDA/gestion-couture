// Livrer une commande terminee et payee
export async function livrerCommande({ idCommande, commandeRepo, policy = null }) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.livrerCommande({ policy });
  await commandeRepo.save(commande);

  return commande;
}
