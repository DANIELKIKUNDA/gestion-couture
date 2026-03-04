import { verifyPassword } from "../../infrastructure/security/password-hasher.js";
import { signAccessToken, createOpaqueToken } from "../../infrastructure/security/jwt-service.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";

export async function seConnecterUtilisateur({ utilisateurRepo, rolePermissionRepo, authSessionRepo, email, motDePasse }) {
  const user = await utilisateurRepo.findByEmail(email);
  if (!user) throw new Error("Utilisateur inexistant");
  const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  if (etatCompte !== ACCOUNT_STATES.ACTIVE) throw new Error("Compte inactif: connexion refusee");
  if (!verifyPassword(motDePasse, user.motDePasseHash)) throw new Error("Mot de passe incorrect");

  const rolePerm = await rolePermissionRepo.get(user.atelierId || "ATELIER", user.roleId);
  const permissions = rolePerm?.permissions || [];
  const token = signAccessToken({
    sub: user.id,
    nom: user.nom,
    role: user.roleId,
    roleId: user.roleId,
    atelierId: user.atelierId || "ATELIER",
    permissions,
    etatCompte,
    tokenVersion: Number(user.tokenVersion || 1)
  });

  const refreshToken = createOpaqueToken();
  const expiresAt = "9999-12-31T23:59:59.000Z";
  await authSessionRepo.save({ refreshToken, utilisateurId: user.id, expiresAt, revokedAt: null });

  return {
    token,
    refreshToken,
    utilisateur: {
      id: user.id,
      nom: user.nom,
      email: user.email,
      roleId: user.roleId,
      permissions
    }
  };
}
