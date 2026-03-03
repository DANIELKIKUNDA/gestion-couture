import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { validateSchema } from "../../../shared/interfaces/validation.js";
import { ROLES } from "../../domain/roles.js";
import { DEFAULT_ROLE_PERMISSIONS } from "../../domain/default-role-permissions.js";
import { validatePasswordPolicy } from "../../domain/password-policy.js";
import { Utilisateur } from "../../domain/utilisateur.js";
import { hashPassword } from "../../infrastructure/security/password-hasher.js";
import { signAccessToken, createOpaqueToken } from "../../infrastructure/security/jwt-service.js";
import { sendPasswordResetNotification } from "../../infrastructure/notifications/reset-notification-service.js";

import { UtilisateurRepoPg } from "../../infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../../infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { AuthSessionRepoPg } from "../../infrastructure/repositories/auth-session-repo-pg.js";
import { PasswordResetTokenRepoPg } from "../../infrastructure/repositories/password-reset-token-repo-pg.js";

import { seConnecterUtilisateur } from "../../application/use-cases/se-connecter-utilisateur.js";
import { seDeconnecterUtilisateur } from "../../application/use-cases/se-deconnecter-utilisateur.js";
import { reinitialiserMotDePasse } from "../../application/use-cases/reinitialiser-mot-de-passe.js";
import { gererUtilisateurs } from "../../application/use-cases/gerer-utilisateurs.js";
import { requireAuth } from "./middlewares/auth-guard.js";

const router = express.Router();
const utilisateurRepo = new UtilisateurRepoPg();
const rolePermissionRepo = new RolePermissionAtelierRepoPg();
const authSessionRepo = new AuthSessionRepoPg();
const resetTokenRepo = new PasswordResetTokenRepoPg();

const REFRESH_COOKIE = process.env.AUTH_REFRESH_COOKIE_NAME || "atelier_refresh_token";
const COOKIE_SAMESITE = process.env.AUTH_COOKIE_SAMESITE || "lax";
const COOKIE_SECURE = String(process.env.AUTH_COOKIE_SECURE || "false").toLowerCase() === "true";

function getCookie(req, name) {
  const header = String(req.headers?.cookie || "");
  if (!header) return null;
  const items = header.split(";").map((v) => v.trim());
  for (const item of items) {
    const [k, ...rest] = item.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

async function ensureRolePermissions() {
  const existing = await rolePermissionRepo.listByAtelier("ATELIER");
  if (existing.length > 0) return;
  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await rolePermissionRepo.save({ atelierId: "ATELIER", role, permissions, updatedBy: "system" });
  }
}

async function withPermissions(user) {
  await ensureRolePermissions();
  const rolePerm = await rolePermissionRepo.get(user.atelierId || "ATELIER", user.roleId);
  const permissions = rolePerm?.permissions || [];
  return {
    id: user.id,
    nom: user.nom,
    email: user.email,
    roleId: user.roleId,
    actif: user.actif !== false,
    permissions
  };
}

function setRefreshCookie(res, value) {
  res.cookie(REFRESH_COOKIE, value, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: Number(process.env.AUTH_REFRESH_TTL_SECONDS || 31536000) * 1000
  });
}

router.post("/auth/bootstrap-owner", async (req, res) => {
  try {
    const schema = z.object({ nom: z.string().min(1), email: z.string().email(), motDePasse: z.string().min(8) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    if (await utilisateurRepo.hasAnyOwner()) {
      return res.status(409).json({ error: "Proprietaire deja initialise" });
    }

    validatePasswordPolicy(parsed.data.motDePasse);
    const user = new Utilisateur({
      id: randomUUID(),
      nom: parsed.data.nom,
      email: parsed.data.email,
      roleId: ROLES.PROPRIETAIRE,
      actif: true,
      motDePasseHash: hashPassword(parsed.data.motDePasse),
      atelierId: "ATELIER"
    });
    await utilisateurRepo.save(user);
    await ensureRolePermissions();
    res.status(201).json({ utilisateur: await withPermissions(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email(), motDePasse: z.string().min(1) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    await ensureRolePermissions();
    const out = await seConnecterUtilisateur({
      utilisateurRepo,
      rolePermissionRepo,
      authSessionRepo,
      email: parsed.data.email,
      motDePasse: parsed.data.motDePasse
    });

    setRefreshCookie(res, out.refreshToken);
    res.json({ token: out.token, utilisateur: out.utilisateur });
  } catch (err) {
    res.status(401).json({ error: err.message || "Identifiants invalides" });
  }
});

router.post("/auth/refresh", async (req, res) => {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE);
    if (!refreshToken) return res.status(401).json({ error: "Session invalide" });
    const session = await authSessionRepo.findByRefreshToken(refreshToken);
    if (!session) return res.status(401).json({ error: "Session invalide" });

    const user = await utilisateurRepo.getById(session.utilisateurId);
    if (!user || !user.actif) return res.status(401).json({ error: "Session invalide" });

    const userWithPerms = await withPermissions(user);
    const token = signAccessToken({
      sub: user.id,
      nom: user.nom,
      role: user.roleId,
      roleId: user.roleId,
      atelierId: user.atelierId || "ATELIER",
      permissions: userWithPerms.permissions
    });

    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: err.message || "Session invalide" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE);
    await seDeconnecterUtilisateur({ authSessionRepo, refreshToken });
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await utilisateurRepo.getById(req.auth.utilisateurId);
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    const me = await withPermissions(user);
    res.json({
      user: {
        id: me.id,
        nom: me.nom,
        email: me.email,
        roles: [me.roleId],
        roleId: me.roleId,
        actif: me.actif !== false
      },
      permissions: me.permissions || []
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/auth/password/forgot", async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const user = await utilisateurRepo.findByEmail(parsed.data.email);
    if (user) {
      const token = createOpaqueToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
      await resetTokenRepo.save({ token, utilisateurId: user.id, expiresAt });
      await sendPasswordResetNotification({ email: user.email, token });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/auth/password/reset", async (req, res) => {
  try {
    const schema = z.object({ token: z.string().min(1), nouveauMotDePasse: z.string().min(8) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    await reinitialiserMotDePasse({
      utilisateurRepo,
      resetTokenRepo,
      token: parsed.data.token,
      nouveauMotDePasse: parsed.data.nouveauMotDePasse
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/auth/role-permissions", requireAuth, async (_req, res) => {
  try {
    await ensureRolePermissions();
    const rows = await rolePermissionRepo.listByAtelier("ATELIER");
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/auth/role-permissions/:role", requireAuth, async (req, res) => {
  try {
    const schema = z.object({ permissions: z.array(z.string()) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const role = String(req.params.role || "").toUpperCase();
    const row = await rolePermissionRepo.save({
      atelierId: "ATELIER",
      role,
      permissions: parsed.data.permissions,
      updatedBy: req.auth.utilisateurId
    });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/auth/users", requireAuth, async (_req, res) => {
  try {
    const rows = await gererUtilisateurs({ utilisateurRepo, input: { action: "list" } });
    res.json(rows.map((u) => ({ id: u.id, nom: u.nom, email: u.email, roleId: u.roleId, actif: u.actif !== false })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/auth/users", requireAuth, async (req, res) => {
  try {
    const schema = z.object({ nom: z.string().min(1), email: z.string().email(), motDePasse: z.string().min(8), roleId: z.string().min(1), actif: z.boolean().optional() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const user = await gererUtilisateurs({ utilisateurRepo, input: { action: "create", ...parsed.data } });
    res.status(201).json({ id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, actif: user.actif !== false });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/auth/users/:id", requireAuth, async (req, res) => {
  try {
    const schema = z.object({ nom: z.string().optional(), roleId: z.string().optional(), actif: z.boolean().optional() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const user = await gererUtilisateurs({ utilisateurRepo, input: { action: "update", id: req.params.id, ...parsed.data } });
    res.json({ id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, actif: user.actif !== false });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
