export async function obtenirUtilisateurConnecte({ utilisateurRepo, utilisateurId }) {
  if (!utilisateurId) return null;
  return utilisateurRepo.getById(utilisateurId);
}
