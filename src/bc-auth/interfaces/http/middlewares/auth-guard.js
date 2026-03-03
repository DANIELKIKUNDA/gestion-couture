import { verifyAccessToken } from "../../../infrastructure/security/jwt-service.js";
import { buildAuthContext } from "../auth-context.js";

export function authGuard(req, _res, next) {
  const auth = String(req.headers?.authorization || "");
  if (!auth.toLowerCase().startsWith("bearer ")) {
    req.auth = null;
    return next();
  }
  const token = auth.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    req.auth = buildAuthContext(payload);
  } catch {
    req.auth = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: "Connexion requise" });
  next();
}
