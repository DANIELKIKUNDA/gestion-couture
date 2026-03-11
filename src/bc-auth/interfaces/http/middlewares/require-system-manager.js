import { ROLES } from "../../../domain/roles.js";
import { logSecurityAudit } from "../security-audit.js";

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

export function requireSystemManager(req, res, next) {
  if (!req.auth) {
    logSecurityAudit({
      action: "SYSTEM_MANAGER_REFUS",
      entite: req.path,
      succes: false,
      raison: "connexion_requise"
    });
    return res.status(401).json({ error: "Connexion requise" });
  }

  if (normalizeRole(req.auth.roleId || req.auth.role) !== ROLES.MANAGER_SYSTEME) {
    logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "SYSTEM_MANAGER_REFUS",
      entite: req.path,
      succes: false,
      raison: "role_manager_systeme_requis"
    });
    return res.status(403).json({ error: "Acces non autorise" });
  }

  next();
}
