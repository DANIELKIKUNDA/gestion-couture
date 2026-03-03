import { validatePasswordPolicy } from "../../domain/password-policy.js";
import { hashPassword } from "../../infrastructure/security/password-hasher.js";

export async function reinitialiserMotDePasse({ utilisateurRepo, resetTokenRepo, token, nouveauMotDePasse }) {
  const row = await resetTokenRepo.findValid(token);
  if (!row) throw new Error("Token invalide ou expire");
  const user = await utilisateurRepo.getById(row.utilisateurId);
  if (!user) throw new Error("Utilisateur introuvable");
  validatePasswordPolicy(nouveauMotDePasse);
  user.motDePasseHash = hashPassword(nouveauMotDePasse);
  await utilisateurRepo.save(user);
  await resetTokenRepo.markUsed(token);
  return true;
}
