import { ACCOUNT_STATES, normalizeAccountState } from "../../../domain/account-state.js";
import { resolveGrantedPermissions } from "../../../domain/granted-permissions.js";
import { UtilisateurRepoPg } from "../../../infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../../../infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { AccessTokenRevocationRepoPg } from "../../../infrastructure/repositories/access-token-revocation-repo-pg.js";
import { AtelierRepoPg } from "../../../../shared/infrastructure/repositories/atelier-repo-pg.js";
import { logSecurityAudit } from "../security-audit.js";

const utilisateurRepo = new UtilisateurRepoPg();
const rolePermissionRepo = new RolePermissionAtelierRepoPg();
const revocationRepo = new AccessTokenRevocationRepoPg();
const atelierRepo = new AtelierRepoPg();
const SYSTEM_ATELIER_ID = "SYSTEME";

function parseBearer(req) {
  const auth = String(req.headers?.authorization || "");
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function authError(res, message = "Session invalide") {
  return res.status(401).json({ error: message });
}

function permissionError(res, message = "Acces non autorise") {
  return res.status(403).json({ error: message });
}

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

export async function securityPolicy(req, res, next) {
  req.isReadOnly = false;
  if (!req.auth?.utilisateurId) return next();

  const token = parseBearer(req);
  if (token && (await revocationRepo.isRevoked(token))) {
    await logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      atelierId: req.auth.atelierId || null,
      action: "TOKEN_REVOQUE_REFUS",
      entite: req.path,
      succes: false,
      raison: "token_revoque"
    });
    return authError(res, "Session invalide");
  }

  const user = await utilisateurRepo.getById(req.auth.utilisateurId);
  if (!user) {
    await logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      atelierId: req.auth.atelierId || null,
      action: "UTILISATEUR_INTROUVABLE_REFUS",
      entite: req.path,
      succes: false,
      raison: "utilisateur_introuvable"
    });
    return authError(res, "Session invalide");
  }

  const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  if (etatCompte !== ACCOUNT_STATES.ACTIVE) {
    await logSecurityAudit({
      utilisateurId: user.id,
      role: user.roleId,
      atelierId: user.atelierId || null,
      action: "COMPTE_INACTIF_REFUS",
      entite: req.path,
      succes: false,
      raison: `compte_${etatCompte.toLowerCase()}`
    });
    return authError(res, "Compte inactif: connexion refusee");
  }

  req.isReadOnly = false;

  if (String(user.atelierId || "").trim().toUpperCase() !== SYSTEM_ATELIER_ID) {
    const atelier = await atelierRepo.getById(user.atelierId || "ATELIER");
    if (atelier && atelier.actif === false) {
      await logSecurityAudit({
        utilisateurId: user.id,
        role: user.roleId,
        atelierId: user.atelierId || null,
        action: "ATELIER_INACTIF_REFUS",
        entite: req.path,
        succes: false,
        raison: `atelier_${String(user.atelierId || "").trim().toUpperCase()}_inactif`
      });
      return authError(res, "Atelier inactif");
    }
  }

  const rolePerm = await rolePermissionRepo.get(user.atelierId || "ATELIER", user.roleId);
  req.auth = {
    ...req.auth,
    nom: user.nom,
    role: user.roleId,
    roleId: user.roleId,
    atelierId: user.atelierId || "ATELIER",
    etatCompte,
    permissions: resolveGrantedPermissions(user.roleId, rolePerm?.permissions || [])
  };

  next();
}
