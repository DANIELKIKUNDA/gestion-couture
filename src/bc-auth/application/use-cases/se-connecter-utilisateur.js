import { verifyPassword } from "../../infrastructure/security/password-hasher.js";
import { signAccessToken, createOpaqueToken } from "../../infrastructure/security/jwt-service.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";
import { resolveGrantedPermissions } from "../../domain/granted-permissions.js";

// Constant-time fallback to reduce user-enumeration via timing on login.
const DUMMY_PASSWORD_HASH =
  "scrypt:7d7f5823cb8ef4d39f4fdc8ed3305f91:09ec950f0d4af9769d1f9acb6549e44f8b5c90cc1f9fca1f7df5f4a9d9b141ef";
const LEGACY_ATELIER_ID = "ATELIER";

export async function seConnecterUtilisateur({ utilisateurRepo, rolePermissionRepo, authSessionRepo, email, motDePasse, atelierId = null }) {
  const user =
    atelierId && typeof utilisateurRepo.findByEmailInAtelier === "function"
      ? await utilisateurRepo.findByEmailInAtelier(email, atelierId)
      : await utilisateurRepo.findByEmail(email);
  const passwordHash = user?.motDePasseHash || DUMMY_PASSWORD_HASH;
  const passwordValid = verifyPassword(motDePasse, passwordHash);
  if (!user || !passwordValid) throw new Error("Identifiants invalides");
  const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  if (etatCompte !== ACCOUNT_STATES.ACTIVE) throw new Error("Compte inactif: connexion refusee");

  const rolePerm = await rolePermissionRepo.get(user.atelierId || LEGACY_ATELIER_ID, user.roleId);
  const permissions = resolveGrantedPermissions(user.roleId, rolePerm?.permissions || []);
  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.roleId,
    atelierId: user.atelierId || LEGACY_ATELIER_ID
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
      atelierId: user.atelierId || LEGACY_ATELIER_ID,
      permissions
    }
  };
}
