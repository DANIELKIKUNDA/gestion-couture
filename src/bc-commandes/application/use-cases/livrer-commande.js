// Livrer une commande terminee et payee
export async function livrerCommande({ idCommande, commandeRepo }) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.livrerCommande();
  await commandeRepo.save(commande);

  return commande;
}
