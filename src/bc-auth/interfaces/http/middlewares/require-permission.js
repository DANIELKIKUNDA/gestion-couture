import { ACCOUNT_STATES, normalizeAccountState } from "../../../domain/account-state.js";
import { logSecurityAudit } from "../security-audit.js";

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function isOwnerRole(auth) {
  return normalizeRole(auth?.role || auth?.roleId) === "PROPRIETAIRE";
}

export function hasPermission(auth, permission) {
  if (!permission) return true;
  if (isOwnerRole(auth)) return true;
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : [];
  return perms.map((p) => String(p || "").trim().toUpperCase()).includes(String(permission).trim().toUpperCase());
}

export function hasAnyPermission(auth, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) return true;
  return permissions.some((permission) => hasPermission(auth, permission));
}

function withPermissionGuard({ req, res, permissions = [], mode = "all" }) {
  if (!req.auth) {
    logSecurityAudit({
      action: "AUTH_REFUS",
      entite: req.path,
      succes: false,
      raison: "connexion_requise"
    });
    res.status(401).json({ error: "Connexion requise" });
    return false;
  }

  const etatCompte = normalizeAccountState(req.auth.etatCompte || ACCOUNT_STATES.ACTIVE);
  if (etatCompte === ACCOUNT_STATES.DISABLED) {
    logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "PERMISSION_REFUS",
      entite: req.path,
      succes: false,
      raison: "compte_desactive"
    });
    res.status(403).json({ error: "Acces non autorise" });
    return false;
  }

  const authorized =
    mode === "any" ? hasAnyPermission(req.auth, permissions) : permissions.every((permission) => hasPermission(req.auth, permission));
  if (!authorized) {
    logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "PERMISSION_REFUS",
      entite: req.path,
      succes: false,
      raison: `permission_manquante:${permissions.join("|")}`
    });
    res.status(403).json({ error: "Acces non autorise" });
    return false;
  }

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "PERMISSION_AUTORISEE",
      entite: req.path,
      succes: true,
      raison: permissions.join("|")
    });
  });

  return true;
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!withPermissionGuard({ req, res, permissions: [permission] })) return;
    next();
  };
}

export function requireAnyPermission(permissions = []) {
  return async (req, res, next) => {
    if (!withPermissionGuard({ req, res, permissions, mode: "any" })) return;
    next();
  };
}
