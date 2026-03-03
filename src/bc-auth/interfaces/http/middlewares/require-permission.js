export function hasPermission(auth, permission) {
  if (!permission) return true;
  const role = String(auth?.role || auth?.roleId || "").toUpperCase();
  if (role === "PROPRIETAIRE" || role === "ADMIN") return true;
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : [];
  return perms.map((p) => String(p || "").toUpperCase()).includes(String(permission).toUpperCase());
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Connexion requise" });
    }
    if (!hasPermission(req.auth, permission)) {
      return res.status(403).json({ error: "Permission insuffisante" });
    }
    next();
  };
}
