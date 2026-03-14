export async function listerCommandeMedia({ idCommande, mediaRepo }) {
  return mediaRepo.listByCommande(idCommande);
}
