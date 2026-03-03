import { ACCOUNT_STATES, normalizeAccountState } from "../../../domain/account-state.js";
import { logSecurityAudit } from "../security-audit.js";

export function hasPermission(auth, permission) {
  if (!permission) return true;
  const role = String(auth?.role || auth?.roleId || "").toUpperCase();
  if (role === "PROPRIETAIRE") return true;
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : [];
  return perms.map((p) => String(p || "").toUpperCase()).includes(String(permission).toUpperCase());
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.auth) {
      await logSecurityAudit({
        action: "AUTH_REFUS",
        entite: req.path,
        succes: false,
        raison: "connexion_requise"
      });
      return res.status(401).json({ error: "Connexion requise" });
    }

    const etatCompte = normalizeAccountState(req.auth.etatCompte || ACCOUNT_STATES.ACTIVE);
    if (etatCompte === ACCOUNT_STATES.DISABLED) {
      await logSecurityAudit({
        utilisateurId: req.auth.utilisateurId,
        role: req.auth.roleId || req.auth.role,
        action: "PERMISSION_REFUS",
        entite: req.path,
        succes: false,
        raison: "compte_desactive"
      });
      return res.status(403).json({ error: "Acces non autorise" });
    }

    if (!hasPermission(req.auth, permission)) {
      await logSecurityAudit({
        utilisateurId: req.auth.utilisateurId,
        role: req.auth.roleId || req.auth.role,
        action: "PERMISSION_REFUS",
        entite: req.path,
        succes: false,
        raison: `permission_manquante:${permission}`
      });
      return res.status(403).json({ error: "Acces non autorise" });
    }

    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      logSecurityAudit({
        utilisateurId: req.auth.utilisateurId,
        role: req.auth.roleId || req.auth.role,
        action: "PERMISSION_AUTORISEE",
        entite: req.path,
        succes: true,
        raison: permission
      });
    });

    next();
  };
}
