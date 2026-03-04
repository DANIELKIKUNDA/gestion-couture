import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { validateSchema } from "../../../shared/interfaces/validation.js";
import { ROLES } from "../../domain/roles.js";
import { DEFAULT_ROLE_PERMISSIONS } from "../../domain/default-role-permissions.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";
import { validatePasswordPolicy } from "../../domain/password-policy.js";
import { Utilisateur } from "../../domain/utilisateur.js";
import { hashPassword } from "../../infrastructure/security/password-hasher.js";
import { signAccessToken, createOpaqueToken } from "../../infrastructure/security/jwt-service.js";
import { sendPasswordResetNotification } from "../../infrastructure/notifications/reset-notification-service.js";

import { UtilisateurRepoPg } from "../../infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../../infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { AuthSessionRepoPg } from "../../infrastructure/repositories/auth-session-repo-pg.js";
import { PasswordResetTokenRepoPg } from "../../infrastructure/repositories/password-reset-token-repo-pg.js";
import { AccessTokenRevocationRepoPg } from "../../infrastructure/repositories/access-token-revocation-repo-pg.js";

import { seConnecterUtilisateur } from "../../application/use-cases/se-connecter-utilisateur.js";
import { seDeconnecterUtilisateur } from "../../application/use-cases/se-deconnecter-utilisateur.js";
import { reinitialiserMotDePasse } from "../../application/use-cases/reinitialiser-mot-de-passe.js";
import { gererUtilisateurs } from "../../application/use-cases/gerer-utilisateurs.js";
import { changerStatutUtilisateur } from "../../application/use-cases/changer-statut-utilisateur.js";
import { pool } from "../../../shared/infrastructure/db.js";
import { ensureEvenementAuditSchema } from "../../../shared/infrastructure/audit-log.js";
import { requireAuth } from "./middlewares/auth-guard.js";
import { requirePermission } from "./middlewares/require-permission.js";
import { PERMISSIONS } from "../../domain/permissions.js";
import { logSecurityAudit } from "./security-audit.js";

const router = express.Router();
const utilisateurRepo = new UtilisateurRepoPg();
const rolePermissionRepo = new RolePermissionAtelierRepoPg();
const authSessionRepo = new AuthSessionRepoPg();
const resetTokenRepo = new PasswordResetTokenRepoPg();
const revocationRepo = new AccessTokenRevocationRepoPg();

const REFRESH_COOKIE = process.env.AUTH_REFRESH_COOKIE_NAME || "atelier_refresh_token";
const COOKIE_SAMESITE = process.env.AUTH_COOKIE_SAMESITE || "lax";
const COOKIE_SECURE = String(process.env.AUTH_COOKIE_SECURE || "false").toLowerCase() === "true";
const ALLOWED_ROLES = [ROLES.PROPRIETAIRE, ROLES.COUTURIER, ROLES.CAISSIER];

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

function getBearerToken(req) {
  const auth = String(req.headers?.authorization || "");
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
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
  const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  return {
    id: user.id,
    nom: user.nom,
    email: user.email,
    roleId: user.roleId,
    actif: user.actif !== false,
    etatCompte,
    tokenVersion: Number(user.tokenVersion || 1),
    permissions
  };
}

function summarizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    roleId: user.roleId || null,
    etatCompte: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
    actif: user.actif !== false,
    tokenVersion: Number(user.tokenVersion || 1)
  };
}

function setRefreshCookie(res, value) {
  res.cookie(REFRESH_COOKIE, value, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    path: "/"
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

router.get("/auth/bootstrap-owner/status", async (_req, res) => {
  try {
    const initialized = await utilisateurRepo.hasAnyOwner();
    res.json({ initialized });
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      action: "USER_CREATE_FAILED",
      entite: "auth/users",
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
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
    const etatCompte = normalizeAccountState(user?.etatCompte || (user?.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    if (!user) return res.status(401).json({ error: "Session invalide" });
    if (etatCompte !== ACCOUNT_STATES.ACTIVE) return res.status(401).json({ error: "Compte inactif: connexion refusee" });

    const userWithPerms = await withPermissions(user);
    const token = signAccessToken({
      sub: user.id,
      nom: user.nom,
      role: user.roleId,
      roleId: user.roleId,
      atelierId: user.atelierId || "ATELIER",
      permissions: userWithPerms.permissions,
      etatCompte,
      tokenVersion: Number(user.tokenVersion || 1)
    });

    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: err.message || "Session invalide" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE);
    const accessToken = getBearerToken(req);
    await seDeconnecterUtilisateur({ authSessionRepo, refreshToken });
    if (accessToken) {
      await revocationRepo.revoke({
        token: accessToken,
        utilisateurId: req.auth?.utilisateurId || null,
        reason: "logout_volontaire"
      });
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      action: "LOGOUT",
      entite: "/auth/logout",
      succes: true
    });
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
    if (me.etatCompte !== ACCOUNT_STATES.ACTIVE) {
      return res.status(401).json({ error: "Compte inactif: connexion refusee" });
    }
    res.json({
      user: {
        id: me.id,
        nom: me.nom,
        email: me.email,
        roles: [me.roleId],
        roleId: me.roleId,
        actif: me.actif !== false,
        etatCompte: me.etatCompte,
        tokenVersion: Number(me.tokenVersion || 1)
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

router.get("/auth/role-permissions", requirePermission(PERMISSIONS.GERER_UTILISATEURS), async (_req, res) => {
  try {
    await ensureRolePermissions();
    const rows = await rolePermissionRepo.listByAtelier("ATELIER");
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/auth/role-permissions/:role", requirePermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
  try {
    const schema = z.object({ permissions: z.array(z.string()) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const role = String(req.params.role || "").toUpperCase();
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Role invalide" });
    }
    const normalizedPermissions = Array.from(new Set((parsed.data.permissions || []).map((p) => String(p || "").toUpperCase())));
    if (role === ROLES.PROPRIETAIRE && !normalizedPermissions.includes(PERMISSIONS.GERER_UTILISATEURS)) {
      return res.status(400).json({ error: "Le role proprietaire doit conserver la permission GERER_UTILISATEURS" });
    }
    const row = await rolePermissionRepo.save({
      atelierId: "ATELIER",
      role,
      permissions: normalizedPermissions,
      updatedBy: req.auth.utilisateurId
    });
    await logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "ROLE_PERMISSIONS_UPDATED",
      entite: "auth/role-permissions",
      entiteId: role,
      succes: true,
      details: { role, permissions: normalizedPermissions }
    });
    res.json(row);
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      action: "ROLE_PERMISSIONS_UPDATE_FAILED",
      entite: "auth/role-permissions",
      entiteId: req.params?.role || null,
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
    res.status(400).json({ error: err.message });
  }
});

router.get("/auth/users", requirePermission(PERMISSIONS.GERER_UTILISATEURS), async (_req, res) => {
  try {
    const rows = await gererUtilisateurs({ utilisateurRepo, input: { action: "list" } });
    res.json(
      rows.map((u) => ({
        id: u.id,
        nom: u.nom,
        email: u.email,
        roleId: u.roleId,
        actif: u.actif !== false,
        etatCompte: normalizeAccountState(u.etatCompte || (u.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
        tokenVersion: Number(u.tokenVersion || 1)
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/auth/users", requirePermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
  try {
    const schema = z
      .object({
        nom: z.string().min(1),
        email: z.string().email(),
        motDePasse: z.string().min(8),
        roleId: z.enum(ALLOWED_ROLES),
        actif: z.boolean().optional(),
        etatCompte: z.enum([ACCOUNT_STATES.ACTIVE, ACCOUNT_STATES.SUSPENDED, ACCOUNT_STATES.DISABLED]).optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const etatCompte = normalizeAccountState(parsed.data.etatCompte || (parsed.data.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const created = await gererUtilisateurs({
      utilisateurRepo,
      input: {
        action: "create",
        ...parsed.data,
        actif: etatCompte !== ACCOUNT_STATES.DISABLED
      }
    });
    const user = await utilisateurRepo.save({
      ...created,
      etatCompte,
      actif: etatCompte !== ACCOUNT_STATES.DISABLED
    });
    await logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "USER_CREATED",
      entite: "auth/users",
      entiteId: user.id,
      succes: true,
      details: { createdUser: summarizeUser(user) }
    });
    res.status(201).json({
      id: user.id,
      nom: user.nom,
      email: user.email,
      roleId: user.roleId,
      actif: user.actif !== false,
      etatCompte: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
      tokenVersion: Number(user.tokenVersion || 1)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/auth/users/:id", requirePermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
  try {
    const schema = z
      .object({
        nom: z.string().optional(),
        roleId: z.enum(ALLOWED_ROLES).optional(),
        actif: z.boolean().optional(),
        etatCompte: z.enum([ACCOUNT_STATES.ACTIVE, ACCOUNT_STATES.SUSPENDED, ACCOUNT_STATES.DISABLED]).optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const current = await utilisateurRepo.getById(req.params.id);
    if (!current) return res.status(404).json({ error: "Utilisateur introuvable" });
    const isSelfUpdate = String(req.auth?.utilisateurId || "") === String(req.params.id || "");
    if (isSelfUpdate && parsed.data.roleId && String(parsed.data.roleId).toUpperCase() !== ROLES.PROPRIETAIRE) {
      return res.status(400).json({ error: "Vous ne pouvez pas retirer votre propre role proprietaire" });
    }
    const currentState = normalizeAccountState(current.etatCompte || (current.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const hasExplicitState = parsed.data.etatCompte !== undefined;
    const nextState = normalizeAccountState(
      hasExplicitState
        ? parsed.data.etatCompte
        : parsed.data.actif === undefined
          ? currentState
          : parsed.data.actif === false
            ? ACCOUNT_STATES.DISABLED
            : ACCOUNT_STATES.ACTIVE
    );
    const nextRole = String(parsed.data.roleId || current.roleId || "").toUpperCase();
    const currentRole = String(current.roleId || "").toUpperCase();
    const wasActiveOwner = currentRole === ROLES.PROPRIETAIRE && currentState === ACCOUNT_STATES.ACTIVE;
    const remainsActiveOwner = nextRole === ROLES.PROPRIETAIRE && nextState === ACCOUNT_STATES.ACTIVE;
    if (wasActiveOwner && !remainsActiveOwner) {
      const activeOwners = await utilisateurRepo.countActiveOwners();
      if (activeOwners <= 1) {
        return res.status(400).json({ error: "Operation refusee: dernier proprietaire actif" });
      }
    }
    const updated = await gererUtilisateurs({
      utilisateurRepo,
      input: {
        action: "update",
        id: req.params.id,
        ...parsed.data,
        actif: nextState !== ACCOUNT_STATES.DISABLED
      }
    });
    const user = await utilisateurRepo.save({
      ...updated,
      etatCompte: nextState,
      actif: nextState !== ACCOUNT_STATES.DISABLED,
      tokenVersion: hasExplicitState && nextState !== currentState ? Number(current.tokenVersion || 1) + 1 : Number(updated.tokenVersion || current.tokenVersion || 1)
    });
    await logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "USER_UPDATED",
      entite: "auth/users",
      entiteId: user.id,
      succes: true,
      details: {
        before: summarizeUser(current),
        after: summarizeUser(user),
        fields: {
          nom: parsed.data.nom !== undefined,
          roleId: parsed.data.roleId !== undefined,
          etatCompte: parsed.data.etatCompte !== undefined || parsed.data.actif !== undefined
        }
      }
    });
    res.json({
      id: user.id,
      nom: user.nom,
      email: user.email,
      roleId: user.roleId,
      actif: user.actif !== false,
      etatCompte: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
      tokenVersion: Number(user.tokenVersion || 1)
    });
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      action: "USER_UPDATE_FAILED",
      entite: "auth/users",
      entiteId: req.params?.id || null,
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
    res.status(400).json({ error: err.message });
  }
});

router.patch("/auth/users/:id/activation", requirePermission(PERMISSIONS.GERER_UTILISATEURS), async (req, res) => {
  try {
    const schema = z.object({ actif: z.boolean() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const isSelfUpdate = String(req.auth?.utilisateurId || "") === String(req.params.id || "");
    if (isSelfUpdate && parsed.data.actif === false) {
      return res.status(400).json({ error: "Vous ne pouvez pas desactiver votre propre compte" });
    }

    const current = await utilisateurRepo.getById(req.params.id);
    if (!current) return res.status(404).json({ error: "Utilisateur introuvable" });
    const currentState = normalizeAccountState(current.etatCompte || (current.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const isActiveOwner = String(current.roleId || "").toUpperCase() === ROLES.PROPRIETAIRE && currentState === ACCOUNT_STATES.ACTIVE;
    if (isActiveOwner && parsed.data.actif === false) {
      const activeOwners = await utilisateurRepo.countActiveOwners();
      if (activeOwners <= 1) {
        return res.status(400).json({ error: "Operation refusee: dernier proprietaire actif" });
      }
    }

    const etatCompte = parsed.data.actif ? ACCOUNT_STATES.ACTIVE : ACCOUNT_STATES.DISABLED;
    const user = await changerStatutUtilisateur({
      utilisateurRepo,
      id: req.params.id,
      etatCompte
    });
    await logSecurityAudit({
      utilisateurId: req.auth.utilisateurId,
      role: req.auth.roleId || req.auth.role,
      action: "USER_ACTIVATION_UPDATED",
      entite: "auth/users/activation",
      entiteId: user.id,
      succes: true,
      details: {
        before: summarizeUser(current),
        after: summarizeUser(user)
      }
    });

    res.json({
      id: user.id,
      nom: user.nom,
      email: user.email,
      roleId: user.roleId,
      actif: user.actif !== false,
      etatCompte: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
      tokenVersion: Number(user.tokenVersion || 1)
    });
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      action: "USER_ACTIVATION_UPDATE_FAILED",
      entite: "auth/users/activation",
      entiteId: req.params?.id || null,
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
    res.status(400).json({ error: err.message });
  }
});

router.get("/audit/utilisateurs", requirePermission(PERMISSIONS.VOIR_BILANS_GLOBAUX), async (req, res) => {
  try {
    await ensureEvenementAuditSchema();
    const q = String(req.query?.q || "").trim().toLowerCase();
    const action = String(req.query?.action || "").trim().toUpperCase();
    const statut = String(req.query?.statut || "ALL").trim().toUpperCase();
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit || 200)));

    const clauses = ["(entite LIKE 'auth/%' OR action LIKE 'USER_%' OR action LIKE 'ROLE_%' OR action LIKE 'COMPTE_%')"];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      clauses.push(`(
        LOWER(COALESCE(utilisateur_id, '')) LIKE $${params.length}
        OR LOWER(COALESCE(role, '')) LIKE $${params.length}
        OR LOWER(COALESCE(action, '')) LIKE $${params.length}
        OR LOWER(COALESCE(entite, '')) LIKE $${params.length}
        OR LOWER(COALESCE(entite_id, '')) LIKE $${params.length}
        OR LOWER(COALESCE(payload::text, '')) LIKE $${params.length}
      )`);
    }
    if (action && action !== "ALL") {
      params.push(action);
      clauses.push(`UPPER(COALESCE(action, '')) = $${params.length}`);
    }
    if (statut === "SUCCES") clauses.push(`COALESCE((payload->>'succes')::boolean, false) = true`);
    if (statut === "ECHEC") clauses.push(`COALESCE((payload->>'succes')::boolean, false) = false`);
    params.push(limit);
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT ea.id_evenement, ea.utilisateur_id, ea.role, ea.action, ea.entite, ea.entite_id, ea.payload, ea.date_evenement,
              u.nom AS utilisateur_nom, u.email AS utilisateur_email
       FROM evenement_audit ea
       LEFT JOIN utilisateurs u ON u.id_utilisateur = ea.utilisateur_id
       ${whereSql}
       ORDER BY ea.date_evenement DESC
       LIMIT $${params.length}`,
      params
    );

    res.json(
      result.rows.map((row) => ({
        idEvenement: row.id_evenement,
        utilisateurId: row.utilisateur_id,
        utilisateurNom: row.utilisateur_nom || null,
        utilisateurEmail: row.utilisateur_email || null,
        role: row.role,
        action: row.action,
        entite: row.entite,
        entiteId: row.entite_id,
        payload: row.payload || {},
        dateEvenement: row.date_evenement
      }))
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
