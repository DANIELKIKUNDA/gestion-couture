import express from "express";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { validateSchema } from "../../../shared/interfaces/validation.js";
import { ROLES } from "../../domain/roles.js";
import { DEFAULT_ROLE_PERMISSIONS } from "../../domain/default-role-permissions.js";
import { ACCOUNT_STATES, normalizeAccountState } from "../../domain/account-state.js";
import { resolveGrantedPermissions } from "../../domain/granted-permissions.js";
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
import { AtelierRepoPg } from "../../../shared/infrastructure/repositories/atelier-repo-pg.js";
import { ensureEvenementAuditSchema } from "../../../shared/infrastructure/audit-log.js";
import { buildDefaultAtelierParametresPayload } from "../../../bc-parametres/domain/default-parametres.js";
import { requireAuth } from "./middlewares/auth-guard.js";
import { requirePermission } from "./middlewares/require-permission.js";
import { requireSystemManager } from "./middlewares/require-system-manager.js";
import { PERMISSIONS } from "../../domain/permissions.js";
import { logSecurityAudit } from "./security-audit.js";

const router = express.Router();
const utilisateurRepo = new UtilisateurRepoPg();
const rolePermissionRepo = new RolePermissionAtelierRepoPg();
const authSessionRepo = new AuthSessionRepoPg();
const resetTokenRepo = new PasswordResetTokenRepoPg();
const revocationRepo = new AccessTokenRevocationRepoPg();
const atelierRepo = new AtelierRepoPg();

const LEGACY_ATELIER_ID = "ATELIER";
const LEGACY_ATELIER_SLUG = "atelier-historique";
const SYSTEM_ATELIER_ID = "SYSTEME";
const SYSTEM_ATELIER_SLUG = "systeme-interne";

const REFRESH_COOKIE = process.env.AUTH_REFRESH_COOKIE_NAME || "atelier_refresh_token";
const IS_PROD = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const COOKIE_SAMESITE = String(process.env.AUTH_COOKIE_SAMESITE || "lax").trim().toLowerCase();
const COOKIE_SECURE = String(process.env.AUTH_COOKIE_SECURE || "false").toLowerCase() === "true";
const REFRESH_COOKIE_MAX_AGE_MS = Math.max(
  60_000,
  Number(process.env.AUTH_REFRESH_COOKIE_MAX_AGE_MS || 1000 * 60 * 60 * 24 * 400)
);
const ALLOWED_ROLES = [ROLES.PROPRIETAIRE, ROLES.COUTURIER, ROLES.CAISSIER];

if (!["lax", "strict", "none"].includes(COOKIE_SAMESITE)) {
  throw new Error("AUTH_COOKIE_SAMESITE invalide");
}
if (IS_PROD && !COOKIE_SECURE) {
  throw new Error("AUTH_COOKIE_SECURE doit etre active en production");
}
if (COOKIE_SAMESITE === "none" && !COOKIE_SECURE) {
  throw new Error("AUTH_COOKIE_SECURE doit etre active lorsque SameSite=None");
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS
  };
}

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

function normalizeAtelierSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidAtelierSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ""));
}

function isReservedAtelierSlug(slug) {
  const normalized = normalizeAtelierSlug(slug);
  return normalized === LEGACY_ATELIER_SLUG || normalized === SYSTEM_ATELIER_SLUG;
}

function isSystemAtelier(atelier) {
  return String(atelier?.idAtelier || "").trim().toUpperCase() === SYSTEM_ATELIER_ID;
}

function generateAtelierId() {
  return `ATL-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function readHeader(req, name) {
  const raw = req.headers?.[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

function extractAtelierSlug(req, payload = null) {
  const fromHeader = readHeader(req, "x-atelier-slug");
  const fromPayload = payload && typeof payload === "object" ? payload.atelierSlug : req.body?.atelierSlug;
  const fromQuery = req.query?.atelierSlug;
  return normalizeAtelierSlug(fromHeader || fromPayload || fromQuery || "");
}

function summarizeAtelier(atelier) {
  if (!atelier) return null;
  return {
    idAtelier: atelier.idAtelier,
    nom: atelier.nom,
    slug: atelier.slug,
    actif: atelier.actif !== false,
    createdAt: atelier.createdAt || null,
    updatedAt: atelier.updatedAt || null
  };
}

function defaultRolePermissionEntriesForAtelier(atelierId = LEGACY_ATELIER_ID) {
  const normalizedAtelierId = String(atelierId || LEGACY_ATELIER_ID).trim().toUpperCase();
  return Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(([role]) => {
    if (normalizedAtelierId === SYSTEM_ATELIER_ID) {
      return role === ROLES.MANAGER_SYSTEME;
    }
    return role !== ROLES.MANAGER_SYSTEME;
  });
}

async function ensureLegacyAtelier() {
  const existing = await atelierRepo.getById(LEGACY_ATELIER_ID);
  if (existing) return existing;
  return atelierRepo.save({
    idAtelier: LEGACY_ATELIER_ID,
    nom: "Atelier historique",
    slug: LEGACY_ATELIER_SLUG,
    actif: true
  });
}

async function ensureSystemAtelier() {
  const existing = await atelierRepo.getById(SYSTEM_ATELIER_ID);
  if (existing) return existing;
  return atelierRepo.save({
    idAtelier: SYSTEM_ATELIER_ID,
    nom: "Administration systeme",
    slug: SYSTEM_ATELIER_SLUG,
    actif: true
  });
}

async function resolveRequestedAtelier(req, { payload = null, allowDefault = true, requireExisting = false, requireActive = false } = {}) {
  const slug = extractAtelierSlug(req, payload);
  if (!slug) {
    if (!allowDefault) return null;
    const legacy = await ensureLegacyAtelier();
    if (requireActive && legacy.actif === false) {
      const err = new Error("Atelier inactif");
      err.code = "ATELIER_INACTIVE";
      throw err;
    }
    return legacy;
  }

  const atelier = await atelierRepo.getBySlug(slug);
  if (!atelier) {
    if (!requireExisting) return null;
    const err = new Error("Atelier introuvable");
    err.code = "ATELIER_NOT_FOUND";
    throw err;
  }
  if (requireActive && atelier.actif === false) {
    const err = new Error("Atelier inactif");
    err.code = "ATELIER_INACTIVE";
    throw err;
  }
  return atelier;
}

async function insertDefaultRolePermissionsForAtelier(dbClient, atelierId, updatedBy = "system") {
  for (const [role, permissions] of defaultRolePermissionEntriesForAtelier(atelierId)) {
    const normalizedPermissions = Array.from(new Set((permissions || []).map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)));
    for (const permission of normalizedPermissions) {
      await dbClient.query(
        `INSERT INTO role_permission_atelier (id_role_permission, atelier_id, role, permission_code, actif)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (atelier_id, role, permission_code)
         DO UPDATE SET actif = true`,
        [randomUUID(), atelierId, role, permission]
      );
    }
    if (normalizedPermissions.length === 0) {
      await dbClient.query(`DELETE FROM role_permission_atelier WHERE atelier_id = $1 AND role = $2`, [atelierId, role]);
    }
  }
  return updatedBy;
}

async function insertDefaultAtelierParametres(dbClient, atelierId, nomAtelier, updatedBy = "system") {
  const payload = buildDefaultAtelierParametresPayload({ nomAtelier });
  await dbClient.query(
    `INSERT INTO atelier_parametres (id, atelier_id, payload, version, updated_at, updated_by)
     VALUES (COALESCE((SELECT MAX(ap.id) + 1 FROM atelier_parametres ap), 1), $1, $2, 1, NOW(), $3)
     ON CONFLICT (atelier_id) DO NOTHING`,
    [atelierId, payload, updatedBy]
  );
}

async function ensureRolePermissions() {
  const existing = await rolePermissionRepo.listByAtelier(LEGACY_ATELIER_ID);
  if (existing.length > 0) return;
  for (const [role, permissions] of defaultRolePermissionEntriesForAtelier(LEGACY_ATELIER_ID)) {
    await rolePermissionRepo.save({ atelierId: LEGACY_ATELIER_ID, role, permissions, updatedBy: "system" });
  }
}

async function ensureRolePermissionsForAtelier(atelierId = LEGACY_ATELIER_ID) {
  const existing = await rolePermissionRepo.listByAtelier(atelierId);
  if (existing.length > 0) return;
  for (const [role, permissions] of defaultRolePermissionEntriesForAtelier(atelierId)) {
    await rolePermissionRepo.save({ atelierId, role, permissions, updatedBy: "system" });
  }
}

async function ensureSystemRolePermissions() {
  await ensureSystemAtelier();
  const existing = await rolePermissionRepo.get(SYSTEM_ATELIER_ID, ROLES.MANAGER_SYSTEME);
  if (existing?.permissions?.length) return existing;
  return rolePermissionRepo.save({
    atelierId: SYSTEM_ATELIER_ID,
    role: ROLES.MANAGER_SYSTEME,
    permissions: [PERMISSIONS.GERER_ATELIERS],
    updatedBy: "system"
  });
}

async function hasAnySystemManager() {
  await ensureSystemRolePermissions();
  const rows = await utilisateurRepo.listByAtelier(SYSTEM_ATELIER_ID);
  return rows.some((row) => String(row.roleId || "").trim().toUpperCase() === ROLES.MANAGER_SYSTEME);
}

function assertTenantAtelier(atelier) {
  if (!isSystemAtelier(atelier)) return;
  const err = new Error("Atelier reserve");
  err.code = "ATELIER_RESERVED";
  throw err;
}

async function withPermissions(user) {
  if (String(user.roleId || "").trim().toUpperCase() === ROLES.MANAGER_SYSTEME) {
    await ensureSystemRolePermissions();
  } else {
    await ensureRolePermissionsForAtelier(user.atelierId || LEGACY_ATELIER_ID);
  }
  const rolePerm = await rolePermissionRepo.get(user.atelierId || LEGACY_ATELIER_ID, user.roleId);
  const permissions = resolveGrantedPermissions(user.roleId, rolePerm?.permissions || []);
  const etatCompte = normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  return {
    id: user.id,
    nom: user.nom,
    email: user.email,
    roleId: user.roleId,
    atelierId: user.atelierId || LEGACY_ATELIER_ID,
    actif: user.actif !== false,
    etatCompte,
    tokenVersion: Number(user.tokenVersion || 1),
    permissions
  };
}

async function createAtelierWithOwner({ nomAtelier, slug, ownerNom, ownerEmail, ownerPassword, createdBy = "system" }) {
  const atelierNom = String(nomAtelier || "").trim();
  const atelierSlug = normalizeAtelierSlug(slug);
  const proprietaireNom = String(ownerNom || "").trim();
  const proprietaireEmail = String(ownerEmail || "").trim().toLowerCase();
  const proprietairePassword = String(ownerPassword || "");

  if (!isValidAtelierSlug(atelierSlug)) {
    throw new Error("Slug atelier invalide");
  }
  if (isReservedAtelierSlug(atelierSlug)) {
    throw new Error("Slug atelier reserve");
  }

  await rolePermissionRepo.listByAtelier(LEGACY_ATELIER_ID);

  const existingAtelier = await atelierRepo.getBySlug(atelierSlug);
  if (existingAtelier) {
    const err = new Error("Slug atelier deja utilise");
    err.code = "ATELIER_CONFLICT";
    throw err;
  }

  const existingUser = await utilisateurRepo.findByEmail(proprietaireEmail);
  if (existingUser) {
    const err = new Error("Email deja utilise");
    err.code = "EMAIL_CONFLICT";
    throw err;
  }

  validatePasswordPolicy(proprietairePassword);

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    const scopedAtelierRepo = new AtelierRepoPg(dbClient);
    const atelier = await scopedAtelierRepo.save({
      idAtelier: generateAtelierId(),
      nom: atelierNom,
      slug: atelierSlug,
      actif: true
    });

    const ownerId = randomUUID();
    const ownerHash = hashPassword(proprietairePassword);
    await dbClient.query(
      `INSERT INTO utilisateurs (id_utilisateur, nom, email, role_id, atelier_id, actif, etat_compte, token_version, mot_de_passe_hash, date_mise_a_jour)
       VALUES ($1, $2, $3, $4, $5, true, $6, 1, $7, NOW())`,
      [ownerId, proprietaireNom, proprietaireEmail, ROLES.PROPRIETAIRE, atelier.idAtelier, ACCOUNT_STATES.ACTIVE, ownerHash]
    );

    await insertDefaultRolePermissionsForAtelier(dbClient, atelier.idAtelier, createdBy || ownerId);
    await insertDefaultAtelierParametres(dbClient, atelier.idAtelier, atelier.nom, createdBy || ownerId);

    await dbClient.query("COMMIT");

    return {
      atelier,
      proprietaire: {
        id: ownerId,
        nom: proprietaireNom,
        email: proprietaireEmail,
        roleId: ROLES.PROPRIETAIRE,
        atelierId: atelier.idAtelier,
        actif: true,
        etatCompte: ACCOUNT_STATES.ACTIVE,
        tokenVersion: 1
      }
    };
  } catch (err) {
    await dbClient.query("ROLLBACK");
    throw err;
  } finally {
    dbClient.release();
  }
}

function summarizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || null,
    roleId: user.roleId || null,
    atelierId: user.atelierId || LEGACY_ATELIER_ID,
    etatCompte: normalizeAccountState(user.etatCompte || (user.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
    actif: user.actif !== false,
    tokenVersion: Number(user.tokenVersion || 1)
  };
}

function setRefreshCookie(res, value) {
  res.cookie(REFRESH_COOKIE, value, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

function createAuthRateLimiter({ windowMs, max, action, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.ip || req.headers["x-forwarded-for"] || "unknown"),
    handler: async (req, res) => {
      await logSecurityAudit({
        utilisateurId: req.auth?.utilisateurId || null,
        role: req.auth?.roleId || req.auth?.role || null,
        action,
        entite: req.path,
        succes: false,
        raison: "rate_limit_depasse"
      });
      res.status(429).json({ error: message });
    }
  });
}

const loginRateLimit = createAuthRateLimiter({
  windowMs: 60_000,
  max: 5,
  action: "AUTH_RATE_LIMIT_LOGIN",
  message: "Trop de tentatives de connexion. Reessayez dans une minute."
});

const forgotPasswordRateLimit = createAuthRateLimiter({
  windowMs: 60_000,
  max: 5,
  action: "AUTH_RATE_LIMIT_FORGOT_PASSWORD",
  message: "Trop de demandes de reinitialisation. Reessayez dans une minute."
});

const resetPasswordRateLimit = createAuthRateLimiter({
  windowMs: 60_000,
  max: 5,
  action: "AUTH_RATE_LIMIT_RESET_PASSWORD",
  message: "Trop de tentatives de reinitialisation. Reessayez dans une minute."
});

const refreshRateLimit = createAuthRateLimiter({
  windowMs: 60_000,
  max: 20,
  action: "AUTH_RATE_LIMIT_REFRESH",
  message: "Trop de rafraichissements de session. Reessayez dans une minute."
});

router.post("/ateliers", async (req, res) => {
  const schema = z
    .object({
      nomAtelier: z.string().min(1),
      slug: z.string().min(2).max(64),
      proprietaire: z.object({
        nom: z.string().min(1),
        email: z.string().email(),
        motDePasse: z.string().min(8)
      })
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const out = await createAtelierWithOwner({
      nomAtelier: parsed.data.nomAtelier,
      slug: parsed.data.slug,
      ownerNom: parsed.data.proprietaire?.nom,
      ownerEmail: parsed.data.proprietaire?.email,
      ownerPassword: parsed.data.proprietaire?.motDePasse
    });
    return res.status(201).json({
      atelier: summarizeAtelier(out.atelier),
      proprietaire: out.proprietaire
    });
  } catch (err) {
    if (err?.code === "ATELIER_CONFLICT") return res.status(409).json({ error: err.message });
    if (err?.code === "EMAIL_CONFLICT") return res.status(409).json({ error: err.message });
    return res.status(400).json({ error: err.message });
  }
});

router.get("/ateliers/current", requireAuth, async (req, res) => {
  try {
    const atelier = await atelierRepo.getById(req.auth?.atelierId || LEGACY_ATELIER_ID);
    if (!atelier) return res.status(404).json({ error: "Atelier introuvable" });
    res.json(summarizeAtelier(atelier));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/system/bootstrap-manager/status", async (_req, res) => {
  try {
    const initialized = await hasAnySystemManager();
    res.json({ initialized });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/bootstrap-manager", async (req, res) => {
  try {
    const schema = z.object({ nom: z.string().min(1), email: z.string().email(), motDePasse: z.string().min(8) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    await ensureSystemRolePermissions();
    if (await hasAnySystemManager()) {
      return res.status(409).json({ error: "Manager systeme deja initialise" });
    }

    const email = String(parsed.data.email || "").trim().toLowerCase();
    const existingUser = await utilisateurRepo.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email deja utilise" });
    }

    validatePasswordPolicy(parsed.data.motDePasse);
    const user = new Utilisateur({
      id: randomUUID(),
      nom: parsed.data.nom,
      email,
      roleId: ROLES.MANAGER_SYSTEME,
      actif: true,
      motDePasseHash: hashPassword(parsed.data.motDePasse),
      atelierId: SYSTEM_ATELIER_ID
    });
    await utilisateurRepo.save(user);
    res.status(201).json({ utilisateur: await withPermissions(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/system/ateliers", requireSystemManager, async (_req, res) => {
  try {
    const rows = await atelierRepo.listAll();
    res.json(rows.filter((row) => !isSystemAtelier(row)).map(summarizeAtelier));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/ateliers", requireSystemManager, async (req, res) => {
  const schema = z
    .object({
      nomAtelier: z.string().min(1),
      slug: z.string().min(2).max(64),
      proprietaire: z.object({
        nom: z.string().min(1),
        email: z.string().email(),
        motDePasse: z.string().min(8)
      })
    })
    .passthrough();
  const parsed = validateSchema(schema, req.body || {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    const out = await createAtelierWithOwner({
      nomAtelier: parsed.data.nomAtelier,
      slug: parsed.data.slug,
      ownerNom: parsed.data.proprietaire?.nom,
      ownerEmail: parsed.data.proprietaire?.email,
      ownerPassword: parsed.data.proprietaire?.motDePasse,
      createdBy: req.auth?.utilisateurId || "system"
    });
    res.status(201).json({
      atelier: summarizeAtelier(out.atelier),
      proprietaire: out.proprietaire
    });
  } catch (err) {
    if (err?.code === "ATELIER_CONFLICT") return res.status(409).json({ error: err.message });
    if (err?.code === "EMAIL_CONFLICT") return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.patch("/system/ateliers/:id/activation", requireSystemManager, async (req, res) => {
  try {
    const schema = z.object({ actif: z.boolean() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (String(req.params.id || "").trim().toUpperCase() === SYSTEM_ATELIER_ID) {
      return res.status(400).json({ error: "Atelier reserve" });
    }
    const updated = await atelierRepo.setActive(req.params.id, parsed.data.actif);
    if (!updated) return res.status(404).json({ error: "Atelier introuvable" });
    res.json(summarizeAtelier(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/auth/bootstrap-owner", async (req, res) => {
  try {
    const schema = z.object({ nom: z.string().min(1), email: z.string().email(), motDePasse: z.string().min(8), atelierSlug: z.string().optional() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const atelier = await resolveRequestedAtelier(req, { payload: parsed.data, allowDefault: true, requireExisting: true, requireActive: true });
    assertTenantAtelier(atelier);
    if (await utilisateurRepo.hasAnyOwner(atelier.idAtelier)) {
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
      atelierId: atelier.idAtelier
    });
    await utilisateurRepo.save(user);
    await ensureRolePermissionsForAtelier(atelier.idAtelier);
    await pool.query(
      `INSERT INTO atelier_parametres (id, atelier_id, payload, version, updated_at, updated_by)
       VALUES (COALESCE((SELECT MAX(ap.id) + 1 FROM atelier_parametres ap), 1), $1, $2, 1, NOW(), $3)
       ON CONFLICT (atelier_id) DO NOTHING`,
      [atelier.idAtelier, buildDefaultAtelierParametresPayload({ nomAtelier: atelier.nom }), user.id]
    );
    res.status(201).json({ utilisateur: await withPermissions(user) });
  } catch (err) {
    if (err?.code === "ATELIER_RESERVED") return res.status(403).json({ error: err.message });
    if (err?.code === "ATELIER_NOT_FOUND") return res.status(404).json({ error: err.message });
    if (err?.code === "ATELIER_INACTIVE") return res.status(403).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.get("/auth/bootstrap-owner/status", async (req, res) => {
  try {
    const slug = extractAtelierSlug(req);
    if (slug) {
      const atelier = await atelierRepo.getBySlug(slug);
      if (!atelier || isSystemAtelier(atelier)) {
        return res.json({ initialized: false, atelierExists: false, atelier: null });
      }
      const initialized = await utilisateurRepo.hasAnyOwner(atelier.idAtelier);
      return res.json({ initialized, atelierExists: true, atelier: summarizeAtelier(atelier) });
    }
    const legacy = await ensureLegacyAtelier();
    const initialized = await utilisateurRepo.hasAnyOwner(legacy.idAtelier);
    res.json({ initialized, atelierExists: true, atelier: summarizeAtelier(legacy) });
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

router.post("/auth/login", loginRateLimit, async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email(), motDePasse: z.string().min(1), atelierSlug: z.string().optional() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const requestedSlug = extractAtelierSlug(req, parsed.data);
    const requestedAtelier = requestedSlug ? await atelierRepo.getBySlug(requestedSlug) : null;
    if (requestedSlug && (!requestedAtelier || requestedAtelier.actif === false)) {
      throw new Error("Identifiants invalides");
    }

    const loginUser = requestedAtelier
      ? await utilisateurRepo.findByEmailInAtelier(parsed.data.email, requestedAtelier.idAtelier)
      : await utilisateurRepo.findByEmail(parsed.data.email);

    if (requestedAtelier && loginUser && loginUser.atelierId !== requestedAtelier.idAtelier) {
      throw new Error("Identifiants invalides");
    }

    if (String(loginUser?.roleId || "").trim().toUpperCase() === ROLES.MANAGER_SYSTEME) {
      await ensureSystemRolePermissions();
    } else {
      await ensureRolePermissionsForAtelier(requestedAtelier?.idAtelier || loginUser?.atelierId || LEGACY_ATELIER_ID);
    }
    const out = await seConnecterUtilisateur({
      utilisateurRepo,
      rolePermissionRepo,
      authSessionRepo,
      email: parsed.data.email,
      motDePasse: parsed.data.motDePasse,
      atelierId: requestedAtelier?.idAtelier || null
    });

    setRefreshCookie(res, out.refreshToken);
    res.json({ token: out.token, utilisateur: out.utilisateur });
  } catch (err) {
    if (err?.message === "Compte inactif: connexion refusee") {
      return res.status(401).json({ error: err.message });
    }
    res.status(401).json({ error: "Identifiants invalides" });
  }
});

router.post("/auth/refresh", refreshRateLimit, async (req, res) => {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE);
    if (!refreshToken) return res.status(401).json({ error: "Session invalide" });
    const session = await authSessionRepo.findByRefreshToken(refreshToken);
    if (!session) return res.status(401).json({ error: "Session invalide" });

    const user = await utilisateurRepo.getById(session.utilisateurId);
    const etatCompte = normalizeAccountState(user?.etatCompte || (user?.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    if (!user) return res.status(401).json({ error: "Session invalide" });
    if (etatCompte !== ACCOUNT_STATES.ACTIVE) return res.status(401).json({ error: "Compte inactif: connexion refusee" });

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.roleId,
      atelierId: user.atelierId || LEGACY_ATELIER_ID
    });

    setRefreshCookie(res, refreshToken);
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
    clearRefreshCookie(res);
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
        atelierId: me.atelierId || LEGACY_ATELIER_ID,
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

router.post("/auth/password/forgot", forgotPasswordRateLimit, async (req, res) => {
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

router.post("/auth/password/reset", resetPasswordRateLimit, async (req, res) => {
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
    await ensureRolePermissionsForAtelier(_req.auth?.atelierId || LEGACY_ATELIER_ID);
    const rows = await rolePermissionRepo.listByAtelier(_req.auth?.atelierId || LEGACY_ATELIER_ID);
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
      atelierId: req.auth?.atelierId || LEGACY_ATELIER_ID,
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
    const rows = await gererUtilisateurs({
      utilisateurRepo,
      input: { action: "list", atelierId: _req.auth?.atelierId || LEGACY_ATELIER_ID }
    });
    res.json(
      rows.map((u) => ({
        id: u.id,
        nom: u.nom,
        email: u.email,
        roleId: u.roleId,
        atelierId: u.atelierId || LEGACY_ATELIER_ID,
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
        atelierId: req.auth?.atelierId || LEGACY_ATELIER_ID,
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
      atelierId: user.atelierId || LEGACY_ATELIER_ID,
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
    const current = await utilisateurRepo.getByIdAndAtelier(req.params.id, req.auth?.atelierId || LEGACY_ATELIER_ID);
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
      const activeOwners = await utilisateurRepo.countActiveOwners(req.auth?.atelierId || LEGACY_ATELIER_ID);
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
      atelierId: user.atelierId || LEGACY_ATELIER_ID,
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

    const current = await utilisateurRepo.getByIdAndAtelier(req.params.id, req.auth?.atelierId || LEGACY_ATELIER_ID);
    if (!current) return res.status(404).json({ error: "Utilisateur introuvable" });
    const currentState = normalizeAccountState(current.etatCompte || (current.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const isActiveOwner = String(current.roleId || "").toUpperCase() === ROLES.PROPRIETAIRE && currentState === ACCOUNT_STATES.ACTIVE;
    if (isActiveOwner && parsed.data.actif === false) {
      const activeOwners = await utilisateurRepo.countActiveOwners(req.auth?.atelierId || LEGACY_ATELIER_ID);
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
      atelierId: user.atelierId || LEGACY_ATELIER_ID,
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
