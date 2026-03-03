import { verifyPassword } from "../../infrastructure/security/password-hasher.js";
import { signAccessToken, createOpaqueToken } from "../../infrastructure/security/jwt-service.js";

export async function seConnecterUtilisateur({ utilisateurRepo, rolePermissionRepo, authSessionRepo, email, motDePasse }) {
  const user = await utilisateurRepo.findByEmail(email);
  if (!user || !user.actif) throw new Error("Identifiants invalides");
  if (!verifyPassword(motDePasse, user.motDePasseHash)) throw new Error("Identifiants invalides");

  const rolePerm = await rolePermissionRepo.get(user.atelierId || "ATELIER", user.roleId);
  const permissions = rolePerm?.permissions || [];
  const token = signAccessToken({
    sub: user.id,
    nom: user.nom,
    role: user.roleId,
    roleId: user.roleId,
    atelierId: user.atelierId || "ATELIER",
    permissions
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
