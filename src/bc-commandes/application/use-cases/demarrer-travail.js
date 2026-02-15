// Demarrer le travail d'une commande
export async function demarrerTravail({ idCommande, parametresAtelier, commandeRepo }) {
  const commande = await commandeRepo.getById(idCommande);
  if (!commande) throw new Error("Commande introuvable");

  commande.demarrerTravail(parametresAtelier);
  await commandeRepo.save(commande);

  return commande;
}
