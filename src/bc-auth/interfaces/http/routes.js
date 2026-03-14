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

function mapSystemAtelierRow(row) {
  return {
    idAtelier: row.id_atelier,
    nom: row.nom,
    slug: row.slug,
    actif: row.actif !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    proprietaire: row.proprietaire_id
      ? {
          id: row.proprietaire_id,
          nom: row.proprietaire_nom || "",
          email: row.proprietaire_email || ""
        }
      : null,
    nombreUtilisateurs: Number(row.total_utilisateurs || 0)
  };
}

function mapSystemAtelierDetailRow(row) {
  if (!row) return null;
  return {
    idAtelier: row.id_atelier,
    nom: row.nom,
    slug: row.slug,
    actif: row.actif !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    proprietaire: row.proprietaire_id
      ? {
          id: row.proprietaire_id,
          nom: row.proprietaire_nom || "",
          email: row.proprietaire_email || "",
          actif: row.proprietaire_actif !== false,
          etatCompte: normalizeAccountState(row.proprietaire_etat_compte || (row.proprietaire_actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)),
          sessions: {
            totalActives: 0,
            lastSessionAt: null,
            recentSessions: []
          }
        }
      : null,
    stats: {
      totalUtilisateurs: Number(row.total_utilisateurs || 0),
      utilisateursActifs: Number(row.utilisateurs_actifs || 0),
      utilisateursInactifs: Number(row.utilisateurs_inactifs || 0)
    },
    utilisateurs: [],
    health: {
      signal: row.actif === false ? "warning" : "idle",
      message: row.actif === false ? "Atelier inactif: acces bloque pour les utilisateurs atelier." : "Aucune activite auditee recente.",
      lastEventAt: null,
      eventsLast7Days: 0,
      eventsLast30Days: 0
    },
    recentActivity: []
  };
}

function mapAuthSessionRow(row) {
  if (!row) return null;
  return {
    createdAt: row.createdAt || row.created_at || null,
    expiresAt: row.expiresAt || row.expire_at || null
  };
}

async function resolveSystemAtelierOwner(atelierId) {
  const normalizedAtelierId = String(atelierId || "").trim();
  if (!normalizedAtelierId) return null;
  if (normalizedAtelierId.toUpperCase() === SYSTEM_ATELIER_ID) return null;

  const result = await pool.query(
    `SELECT a.id_atelier,
            a.nom,
            a.slug,
            owner.id_utilisateur AS proprietaire_id,
            owner.nom AS proprietaire_nom,
            owner.email AS proprietaire_email,
            owner.actif AS proprietaire_actif,
            owner.etat_compte AS proprietaire_etat_compte
     FROM ateliers a
     LEFT JOIN LATERAL (
       SELECT u.id_utilisateur, u.nom, u.email, u.actif, u.etat_compte, u.role_id
       FROM utilisateurs u
       WHERE u.atelier_id = a.id_atelier
         AND UPPER(u.role_id) = 'PROPRIETAIRE'
       ORDER BY u.date_creation ASC
       LIMIT 1
     ) owner ON true
     WHERE a.id_atelier = $1
       AND a.id_atelier <> $2
     LIMIT 1`,
    [normalizedAtelierId, SYSTEM_ATELIER_ID]
  );

  const row = result.rows[0] || null;
  if (!row || !row.proprietaire_id) return null;

  return {
    atelierId: row.id_atelier,
    atelierNom: row.nom || "",
    atelierSlug: row.slug || "",
    proprietaire: {
      id: row.proprietaire_id,
      nom: row.proprietaire_nom || "",
      email: row.proprietaire_email || "",
      actif: row.proprietaire_actif !== false,
      etatCompte: normalizeAccountState(
        row.proprietaire_etat_compte || (row.proprietaire_actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)
      )
    }
  };
}

async function resolveSystemAtelierContext(atelierId) {
  const normalizedAtelierId = String(atelierId || "").trim();
  if (!normalizedAtelierId) return null;
  if (normalizedAtelierId.toUpperCase() === SYSTEM_ATELIER_ID) return null;
  return atelierRepo.getById(normalizedAtelierId);
}

async function resolveSystemAtelierUserContext(atelierId, utilisateurId) {
  const atelier = await resolveSystemAtelierContext(atelierId);
  if (!atelier) return null;
  const user = await utilisateurRepo.getByIdAndAtelier(utilisateurId, atelier.idAtelier);
  if (!user) return null;
  return {
    atelier,
    utilisateur: user
  };
}

function mapAtelierActivityRow(row) {
  return {
    idEvenement: row.id_evenement,
    utilisateurId: row.utilisateur_id || null,
    utilisateurNom: row.utilisateur_nom || row.payload?.utilisateurNom || null,
    utilisateurEmail: row.utilisateur_email || null,
    role: row.role || null,
    action: row.action || "",
    entite: row.entite || "",
    entiteId: row.entite_id || null,
    payload: row.payload || {},
    dateEvenement: row.date_evenement || null
  };
}

function mapSystemAtelierUserRow(row) {
  if (!row) return null;
  const etatCompte = normalizeAccountState(row.etat_compte || (row.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
  return {
    id: row.id_utilisateur,
    nom: row.nom || "",
    email: row.email || "",
    roleId: String(row.role_id || "").trim().toUpperCase(),
    actif: row.actif !== false,
    etatCompte,
    tokenVersion: Number(row.token_version || 1)
  };
}

function mapSystemDashboardAtelierRow(row) {
  return {
    ...mapSystemAtelierRow(row),
    proprietaire: row.proprietaire_id
      ? {
          id: row.proprietaire_id,
          nom: row.proprietaire_nom || "",
          email: row.proprietaire_email || "",
          actif: row.proprietaire_actif !== false,
          etatCompte: normalizeAccountState(
            row.proprietaire_etat_compte || (row.proprietaire_actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE)
          )
        }
      : null
  };
}

function toTimeValue(value) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function severityRank(level) {
  if (level === "warning") return 0;
  if (level === "info") return 1;
  return 2;
}

const SYSTEM_ATELIER_SORT_MAP = {
  createdAt: "a.created_at",
  nom: "LOWER(a.nom)",
  slug: "LOWER(a.slug)",
  utilisateurs: "COALESCE(stats.total_utilisateurs, 0)"
};
// Le role proprietaire est partage par tous les proprietaires de l'atelier:
// ces permissions ne doivent donc jamais disparaitre de ce role.
const OWNER_CRITICAL_PERMISSIONS = Object.freeze([PERMISSIONS.MODIFIER_PARAMETRES, PERMISSIONS.GERER_UTILISATEURS]);

function normalizePermissionCodes(permissions = []) {
  return Array.from(new Set((permissions || []).map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)));
}

function getMissingOwnerCriticalPermissions(permissions = []) {
  const granted = new Set(normalizePermissionCodes(permissions));
  return OWNER_CRITICAL_PERMISSIONS.filter((permission) => !granted.has(permission));
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

router.get("/system/dashboard", requireSystemManager, async (_req, res) => {
  try {
    const ateliersResult = await pool.query(
      `SELECT a.id_atelier,
              a.nom,
              a.slug,
              a.actif,
              a.created_at,
              a.updated_at,
              owner.id_utilisateur AS proprietaire_id,
              owner.nom AS proprietaire_nom,
              owner.email AS proprietaire_email,
              owner.actif AS proprietaire_actif,
              owner.etat_compte AS proprietaire_etat_compte,
              COALESCE(stats.total_utilisateurs, 0)::int AS total_utilisateurs
       FROM ateliers a
       LEFT JOIN LATERAL (
         SELECT u.id_utilisateur, u.nom, u.email, u.actif, u.etat_compte
         FROM utilisateurs u
         WHERE u.atelier_id = a.id_atelier
           AND UPPER(u.role_id) = 'PROPRIETAIRE'
         ORDER BY u.date_creation ASC
         LIMIT 1
       ) owner ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_utilisateurs
         FROM utilisateurs u
         WHERE u.atelier_id = a.id_atelier
       ) stats ON true
       WHERE a.id_atelier <> $1
       ORDER BY a.created_at DESC`,
      [SYSTEM_ATELIER_ID]
    );
    const ateliers = ateliersResult.rows.map(mapSystemDashboardAtelierRow);

    await ensureEvenementAuditSchema();
    const activityResult = await pool.query(
      `SELECT ea.atelier_id,
              MAX(ea.date_evenement) AS last_event_at,
              COUNT(*) FILTER (WHERE ea.date_evenement >= NOW() - INTERVAL '7 days')::int AS events_last_7_days,
              COUNT(*) FILTER (WHERE ea.date_evenement >= NOW() - INTERVAL '30 days')::int AS events_last_30_days
       FROM evenement_audit ea
       WHERE ea.atelier_id <> $1
       GROUP BY ea.atelier_id`,
      [SYSTEM_ATELIER_ID]
    );

    const activityMap = new Map(
      activityResult.rows.map((row) => [
        row.atelier_id,
        {
          lastEventAt: row.last_event_at || null,
          eventsLast7Days: Number(row.events_last_7_days || 0),
          eventsLast30Days: Number(row.events_last_30_days || 0)
        }
      ])
    );

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const total = ateliers.length;
    const actifs = ateliers.filter((atelier) => atelier.actif).length;
    const inactifs = ateliers.filter((atelier) => !atelier.actif).length;
    const utilisateurs = ateliers.reduce((sum, atelier) => sum + Number(atelier.nombreUtilisateurs || 0), 0);
    const sansProprietaire = ateliers.filter((atelier) => !atelier.proprietaire).length;
    const proprietairesInactifs = ateliers.filter(
      (atelier) => atelier.proprietaire && (atelier.proprietaire.actif === false || atelier.proprietaire.etatCompte !== ACCOUNT_STATES.ACTIVE)
    ).length;
    const sansUtilisateur = ateliers.filter((atelier) => Number(atelier.nombreUtilisateurs || 0) === 0).length;
    const nouveaux7J = ateliers.filter((atelier) => toTimeValue(atelier.createdAt) >= sevenDaysAgo).length;
    const nouveaux30J = ateliers.filter((atelier) => toTimeValue(atelier.createdAt) >= thirtyDaysAgo).length;
    const ateliersActifsAvecActivite7J = ateliers.filter((atelier) => {
      const activity = activityMap.get(atelier.idAtelier);
      return atelier.actif && Number(activity?.eventsLast7Days || 0) > 0;
    }).length;

    const alerts = ateliers
      .flatMap((atelier) => {
        const activity = activityMap.get(atelier.idAtelier) || {
          lastEventAt: null,
          eventsLast7Days: 0,
          eventsLast30Days: 0
        };
        const items = [];

        if (!atelier.proprietaire) {
          items.push({
            code: "ATELIER_SANS_PROPRIETAIRE",
            severity: "warning",
            title: "Atelier sans proprietaire",
            description: `${atelier.nom} n'a aucun proprietaire initialise.`,
            atelierId: atelier.idAtelier,
            atelierNom: atelier.nom,
            createdAt: atelier.createdAt || null
          });
        }

        if (atelier.proprietaire && (atelier.proprietaire.actif === false || atelier.proprietaire.etatCompte !== ACCOUNT_STATES.ACTIVE)) {
          items.push({
            code: "PROPRIETAIRE_INACTIF",
            severity: "warning",
            title: "Proprietaire inactif",
            description: `${atelier.proprietaire.nom || "Le proprietaire"} ne peut plus administrer ${atelier.nom}.`,
            atelierId: atelier.idAtelier,
            atelierNom: atelier.nom,
            createdAt: atelier.createdAt || null
          });
        }

        if (!atelier.actif) {
          items.push({
            code: "ATELIER_INACTIF",
            severity: "info",
            title: "Atelier desactive",
            description: `${atelier.nom} est actuellement inactif.`,
            atelierId: atelier.idAtelier,
            atelierNom: atelier.nom,
            createdAt: atelier.createdAt || null
          });
        }

        if (Number(atelier.nombreUtilisateurs || 0) === 0) {
          items.push({
            code: "ATELIER_SANS_UTILISATEUR",
            severity: "info",
            title: "Aucun utilisateur",
            description: `${atelier.nom} n'a encore aucun utilisateur rattache.`,
            atelierId: atelier.idAtelier,
            atelierNom: atelier.nom,
            createdAt: atelier.createdAt || null
          });
        }

        if (atelier.actif && !activity.lastEventAt) {
          items.push({
            code: "ATELIER_SANS_ACTIVITE",
            severity: "info",
            title: "Aucune activite detectee",
            description: `${atelier.nom} est actif mais sans evenement audite.`,
            atelierId: atelier.idAtelier,
            atelierNom: atelier.nom,
            createdAt: atelier.createdAt || null
          });
        } else if (atelier.actif && Number(activity.eventsLast30Days || 0) === 0) {
          items.push({
            code: "ATELIER_INACTIF_30J",
            severity: "info",
            title: "Aucune activite sur 30 jours",
            description: `${atelier.nom} n'a aucune activite recente sur 30 jours.`,
            atelierId: atelier.idAtelier,
            atelierNom: atelier.nom,
            createdAt: atelier.createdAt || null
          });
        }

        return items;
      })
      .sort((left, right) => {
        const rankGap = severityRank(left.severity) - severityRank(right.severity);
        if (rankGap !== 0) return rankGap;
        return toTimeValue(right.createdAt) - toTimeValue(left.createdAt);
      })
      .slice(0, 8);

    const recentAteliers = ateliers.slice(0, 6).map((atelier) => {
      const activity = activityMap.get(atelier.idAtelier) || {
        lastEventAt: null,
        eventsLast7Days: 0,
        eventsLast30Days: 0
      };
      return {
        idAtelier: atelier.idAtelier,
        nom: atelier.nom,
        slug: atelier.slug,
        actif: atelier.actif,
        createdAt: atelier.createdAt || null,
        proprietaire: atelier.proprietaire
          ? {
              nom: atelier.proprietaire.nom || "",
              email: atelier.proprietaire.email || ""
            }
          : null,
        nombreUtilisateurs: Number(atelier.nombreUtilisateurs || 0),
        lastEventAt: activity.lastEventAt,
        eventsLast7Days: Number(activity.eventsLast7Days || 0)
      };
    });

    res.json({
      summary: {
        total,
        actifs,
        inactifs,
        utilisateurs,
        sansProprietaire,
        proprietairesInactifs,
        sansUtilisateur,
        nouveaux7J,
        nouveaux30J,
        ateliersActifsAvecActivite7J
      },
      alerts,
      recentAteliers
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/system/ateliers", requireSystemManager, async (req, res) => {
  try {
    const schema = z
      .object({
        search: z.string().trim().max(120).optional(),
        status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).optional(),
        sortBy: z.enum(["createdAt", "nom", "slug", "utilisateurs"]).optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional()
      })
      .passthrough();
    const parsed = validateSchema(schema, req.query || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const requestedSearch = String(parsed.data.search || "").trim().toLowerCase();
    const requestedStatus = String(parsed.data.status || "ALL").trim().toUpperCase();
    const requestedSortBy = String(parsed.data.sortBy || "createdAt").trim();
    const requestedSortDir = String(parsed.data.sortDir || "desc").trim().toLowerCase();
    const requestedPage = Number(parsed.data.page || 1);
    const requestedPageSize = Number(parsed.data.pageSize || 10);
    const hasPaginatedQuery =
      Object.prototype.hasOwnProperty.call(req.query || {}, "search") ||
      Object.prototype.hasOwnProperty.call(req.query || {}, "status") ||
      Object.prototype.hasOwnProperty.call(req.query || {}, "sortBy") ||
      Object.prototype.hasOwnProperty.call(req.query || {}, "sortDir") ||
      Object.prototype.hasOwnProperty.call(req.query || {}, "page") ||
      Object.prototype.hasOwnProperty.call(req.query || {}, "pageSize");

    const params = [SYSTEM_ATELIER_ID];
    const filters = ["a.id_atelier <> $1"];

    if (requestedSearch) {
      params.push(`%${requestedSearch}%`);
      const searchParamIndex = params.length;
      filters.push(
        `(LOWER(a.nom) LIKE $${searchParamIndex}
          OR LOWER(a.slug) LIKE $${searchParamIndex}
          OR LOWER(a.id_atelier) LIKE $${searchParamIndex}
          OR LOWER(COALESCE(owner.nom, '')) LIKE $${searchParamIndex}
          OR LOWER(COALESCE(owner.email, '')) LIKE $${searchParamIndex})`
      );
    }

    if (requestedStatus === "ACTIVE") {
      filters.push("a.actif = true");
    }
    if (requestedStatus === "INACTIVE") {
      filters.push("a.actif = false");
    }

    const sortColumn = SYSTEM_ATELIER_SORT_MAP[requestedSortBy] || SYSTEM_ATELIER_SORT_MAP.createdAt;
    const sortDirection = requestedSortDir === "asc" ? "ASC" : "DESC";
    const orderByClause = `ORDER BY ${sortColumn} ${sortDirection}, a.created_at DESC`;

    const fromClause = `
      FROM ateliers a
      LEFT JOIN LATERAL (
        SELECT u.id_utilisateur, u.nom, u.email
        FROM utilisateurs u
        WHERE u.atelier_id = a.id_atelier
          AND UPPER(u.role_id) = 'PROPRIETAIRE'
        ORDER BY u.date_creation ASC
        LIMIT 1
      ) owner ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_utilisateurs
        FROM utilisateurs u
        WHERE u.atelier_id = a.id_atelier
      ) stats ON true
      WHERE ${filters.join("\n        AND ")}
    `;

    const selectClause = `
      SELECT a.id_atelier,
             a.nom,
             a.slug,
             a.actif,
             a.created_at,
             a.updated_at,
             owner.id_utilisateur AS proprietaire_id,
             owner.nom AS proprietaire_nom,
             owner.email AS proprietaire_email,
             COALESCE(stats.total_utilisateurs, 0)::int AS total_utilisateurs
    `;

    if (!hasPaginatedQuery) {
      const result = await pool.query(`${selectClause} ${fromClause} ORDER BY a.created_at DESC`, params);
      return res.json(result.rows.map(mapSystemAtelierRow));
    }

    const totalResult = await pool.query(`SELECT COUNT(*)::int AS total ${fromClause}`, params);
    const total = Number(totalResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
    const page = Math.min(requestedPage, totalPages);

    const pagedParams = [...params, requestedPageSize, (page - 1) * requestedPageSize];
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;

    const result = await pool.query(
      `${selectClause}
       ${fromClause}
       ${orderByClause}
       LIMIT $${limitParamIndex}
       OFFSET $${offsetParamIndex}`,
      pagedParams
    );

    const summaryResult = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.actif = true)::int AS actifs,
              COUNT(*) FILTER (WHERE a.actif = false)::int AS inactifs,
              COALESCE(SUM(stats.total_utilisateurs), 0)::int AS utilisateurs
       FROM ateliers a
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_utilisateurs
         FROM utilisateurs u
         WHERE u.atelier_id = a.id_atelier
       ) stats ON true
       WHERE a.id_atelier <> $1`,
      [SYSTEM_ATELIER_ID]
    );

    res.json({
      items: result.rows.map(mapSystemAtelierRow),
      pagination: {
        page,
        pageSize: requestedPageSize,
        total,
        totalPages
      },
      summary: {
        total: Number(summaryResult.rows[0]?.total || 0),
        actifs: Number(summaryResult.rows[0]?.actifs || 0),
        inactifs: Number(summaryResult.rows[0]?.inactifs || 0),
        utilisateurs: Number(summaryResult.rows[0]?.utilisateurs || 0)
      },
      filters: {
        search: requestedSearch,
        status: requestedStatus,
        sortBy: requestedSortBy,
        sortDir: requestedSortDir
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/system/ateliers/:id", requireSystemManager, async (req, res) => {
  try {
    const atelierId = String(req.params.id || "").trim();
    if (!atelierId) return res.status(400).json({ error: "Atelier introuvable" });
    if (atelierId.toUpperCase() === SYSTEM_ATELIER_ID) {
      return res.status(400).json({ error: "Atelier reserve" });
    }

    const result = await pool.query(
      `SELECT a.id_atelier,
              a.nom,
              a.slug,
              a.actif,
              a.created_at,
              a.updated_at,
              owner.id_utilisateur AS proprietaire_id,
              owner.nom AS proprietaire_nom,
              owner.email AS proprietaire_email,
              owner.actif AS proprietaire_actif,
              owner.etat_compte AS proprietaire_etat_compte,
              COALESCE(stats.total_utilisateurs, 0)::int AS total_utilisateurs,
              COALESCE(stats.utilisateurs_actifs, 0)::int AS utilisateurs_actifs,
              COALESCE(stats.utilisateurs_inactifs, 0)::int AS utilisateurs_inactifs
       FROM ateliers a
       LEFT JOIN LATERAL (
         SELECT u.id_utilisateur, u.nom, u.email, u.actif, u.etat_compte
         FROM utilisateurs u
         WHERE u.atelier_id = a.id_atelier
           AND UPPER(u.role_id) = 'PROPRIETAIRE'
         ORDER BY u.date_creation ASC
         LIMIT 1
       ) owner ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_utilisateurs,
                COUNT(*) FILTER (
                  WHERE u.actif = true
                    AND UPPER(COALESCE(u.etat_compte, 'ACTIVE')) = 'ACTIVE'
                )::int AS utilisateurs_actifs,
                COUNT(*) FILTER (
                  WHERE u.actif = false
                     OR UPPER(COALESCE(u.etat_compte, 'ACTIVE')) <> 'ACTIVE'
                )::int AS utilisateurs_inactifs
         FROM utilisateurs u
         WHERE u.atelier_id = a.id_atelier
       ) stats ON true
       WHERE a.id_atelier = $1
       LIMIT 1`,
      [atelierId]
    );

    const detail = mapSystemAtelierDetailRow(result.rows[0] || null);
    if (!detail) return res.status(404).json({ error: "Atelier introuvable" });
    await ensureEvenementAuditSchema();
    const activityResult = await pool.query(
      `SELECT ea.id_evenement, ea.utilisateur_id, ea.role, ea.action, ea.entite, ea.entite_id, ea.payload, ea.date_evenement,
              u.nom AS utilisateur_nom, u.email AS utilisateur_email
       FROM evenement_audit ea
       LEFT JOIN utilisateurs u ON u.id_utilisateur = ea.utilisateur_id
       WHERE ea.atelier_id = $1
       ORDER BY ea.date_evenement DESC
      LIMIT 8`,
      [atelierId]
    );
    detail.recentActivity = activityResult.rows.map(mapAtelierActivityRow);
    const healthResult = await pool.query(
      `SELECT MAX(ea.date_evenement) AS last_event_at,
              COUNT(*) FILTER (WHERE ea.date_evenement >= NOW() - INTERVAL '7 days')::int AS events_last_7_days,
              COUNT(*) FILTER (WHERE ea.date_evenement >= NOW() - INTERVAL '30 days')::int AS events_last_30_days
       FROM evenement_audit ea
       WHERE ea.atelier_id = $1`,
      [atelierId]
    );
    const usersResult = await pool.query(
      `SELECT u.id_utilisateur, u.nom, u.email, u.role_id, u.actif, u.etat_compte, u.token_version
       FROM utilisateurs u
       WHERE u.atelier_id = $1
       ORDER BY
         CASE WHEN UPPER(u.role_id) = 'PROPRIETAIRE' THEN 0 ELSE 1 END,
         u.date_creation ASC`,
      [atelierId]
    );
    const healthRow = healthResult.rows[0] || {};
    const lastEventAt = healthRow.last_event_at || null;
    const eventsLast7Days = Number(healthRow.events_last_7_days || 0);
    const eventsLast30Days = Number(healthRow.events_last_30_days || 0);
    detail.utilisateurs = usersResult.rows.map(mapSystemAtelierUserRow).filter(Boolean);
    if (detail.proprietaire?.id) {
      const [activeSessions, totalActives] = await Promise.all([
        authSessionRepo.listActiveByUtilisateurId(detail.proprietaire.id, { limit: 5 }),
        authSessionRepo.countActiveByUtilisateurId(detail.proprietaire.id)
      ]);
      detail.proprietaire.sessions = {
        totalActives,
        lastSessionAt: activeSessions[0]?.createdAt || null,
        recentSessions: activeSessions.map(mapAuthSessionRow).filter(Boolean)
      };
    }
    detail.health = {
      signal: detail.actif ? (lastEventAt ? "ok" : "idle") : "warning",
      message: detail.actif
        ? lastEventAt
          ? "Atelier actif avec activite auditee recente."
          : "Atelier actif mais aucune activite auditee n'a encore ete detectee."
        : "Atelier inactif: acces bloque pour les utilisateurs atelier.",
      lastEventAt,
      eventsLast7Days,
      eventsLast30Days
    };
    res.json(detail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/system/ateliers/:id/proprietaire/activation", requireSystemManager, async (req, res) => {
  try {
    const schema = z.object({ actif: z.boolean() }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const ownerContext = await resolveSystemAtelierOwner(req.params.id);
    if (!ownerContext) return res.status(404).json({ error: "Proprietaire introuvable" });

    const targetState = parsed.data.actif ? ACCOUNT_STATES.ACTIVE : ACCOUNT_STATES.DISABLED;
    const user = await changerStatutUtilisateur({
      utilisateurRepo,
      id: ownerContext.proprietaire.id,
      etatCompte: targetState
    });

    let revokedSessions = 0;
    if (parsed.data.actif === false) {
      revokedSessions = await authSessionRepo.revokeByUtilisateurId(user.id);
    }

    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: ownerContext.atelierId,
      action: parsed.data.actif ? "SYSTEM_OWNER_ACTIVATED" : "SYSTEM_OWNER_DEACTIVATED",
      entite: "system/ateliers/proprietaire",
      entiteId: user.id,
      succes: true,
      details: {
        atelierNom: ownerContext.atelierNom,
        proprietaireEmail: user.email || ownerContext.proprietaire.email || null,
        revokedSessions
      }
    });

    res.json({
      proprietaire: await withPermissions(user),
      revokedSessions
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/ateliers/:id/proprietaire/reset-password", requireSystemManager, async (req, res) => {
  try {
    const schema = z.object({ motDePasse: z.string().min(8) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const ownerContext = await resolveSystemAtelierOwner(req.params.id);
    if (!ownerContext) return res.status(404).json({ error: "Proprietaire introuvable" });

    validatePasswordPolicy(parsed.data.motDePasse);
    const current = await utilisateurRepo.getById(ownerContext.proprietaire.id);
    if (!current) return res.status(404).json({ error: "Proprietaire introuvable" });

    const updated = await utilisateurRepo.save({
      ...current,
      motDePasseHash: hashPassword(parsed.data.motDePasse),
      tokenVersion: Number(current.tokenVersion || 1) + 1
    });
    const revokedSessions = await authSessionRepo.revokeByUtilisateurId(updated.id);

    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: ownerContext.atelierId,
      action: "SYSTEM_OWNER_PASSWORD_RESET",
      entite: "system/ateliers/proprietaire/password",
      entiteId: updated.id,
      succes: true,
      details: {
        atelierNom: ownerContext.atelierNom,
        proprietaireEmail: updated.email || ownerContext.proprietaire.email || null,
        revokedSessions
      }
    });

    res.json({
      proprietaire: await withPermissions(updated),
      revokedSessions
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/ateliers/:id/proprietaire/revoke-sessions", requireSystemManager, async (req, res) => {
  try {
    const ownerContext = await resolveSystemAtelierOwner(req.params.id);
    if (!ownerContext) return res.status(404).json({ error: "Proprietaire introuvable" });

    const revokedSessions = await authSessionRepo.revokeByUtilisateurId(ownerContext.proprietaire.id);

    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: ownerContext.atelierId,
      action: "SYSTEM_OWNER_SESSIONS_REVOKED",
      entite: "system/ateliers/proprietaire/sessions",
      entiteId: ownerContext.proprietaire.id,
      succes: true,
      details: {
        atelierNom: ownerContext.atelierNom,
        proprietaireEmail: ownerContext.proprietaire.email || null,
        revokedSessions
      }
    });

    res.json({
      proprietaireId: ownerContext.proprietaire.id,
      revokedSessions
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/system/ateliers/:id/utilisateurs/:userId/role", requireSystemManager, async (req, res) => {
  try {
    const schema = z.object({ roleId: z.enum(ALLOWED_ROLES) }).passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const atelierId = String(req.params.id || "").trim();
    if (!atelierId) return res.status(400).json({ error: "Atelier introuvable" });
    if (atelierId.toUpperCase() === SYSTEM_ATELIER_ID) return res.status(400).json({ error: "Atelier reserve" });

    const context = await resolveSystemAtelierUserContext(atelierId, req.params.userId);
    if (!context) return res.status(404).json({ error: "Utilisateur introuvable" });

    const current = context.utilisateur;
    const nextRole = String(parsed.data.roleId || "").toUpperCase();
    const currentRole = String(current.roleId || "").toUpperCase();
    const promotesToOwner = currentRole !== ROLES.PROPRIETAIRE && nextRole === ROLES.PROPRIETAIRE;
    const demotesOwner = currentRole === ROLES.PROPRIETAIRE && nextRole !== ROLES.PROPRIETAIRE;

    if (!promotesToOwner && !demotesOwner) {
      return res.status(400).json({ error: "Operation limitee a la promotion ou a la retrogradation du proprietaire" });
    }

    const currentState = normalizeAccountState(current.etatCompte || (current.actif === false ? ACCOUNT_STATES.DISABLED : ACCOUNT_STATES.ACTIVE));
    const isActiveOwner = currentRole === ROLES.PROPRIETAIRE && currentState === ACCOUNT_STATES.ACTIVE;
    if (demotesOwner && isActiveOwner) {
      const activeOwners = await utilisateurRepo.countActiveOwners(context.atelier.idAtelier);
      if (activeOwners <= 1) {
        return res.status(400).json({ error: "Operation refusee: dernier proprietaire actif" });
      }
    }

    const updated = await utilisateurRepo.save({
      ...current,
      roleId: nextRole
    });

    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: context.atelier.idAtelier,
      action: promotesToOwner ? "SYSTEM_USER_PROMOTED_TO_OWNER" : "SYSTEM_OWNER_DEMOTED",
      entite: "system/ateliers/utilisateurs/role",
      entiteId: updated.id,
      succes: true,
      details: {
        atelierNom: context.atelier.nom || "",
        before: summarizeUser(current),
        after: summarizeUser(updated)
      }
    });

    res.json({
      utilisateur: await withPermissions(updated)
    });
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: String(req.params?.id || "").trim() || null,
      action: "SYSTEM_USER_ROLE_UPDATE_FAILED",
      entite: "system/ateliers/utilisateurs/role",
      entiteId: req.params?.userId || null,
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/ateliers/:id/utilisateurs/:userId/reactivation", requireSystemManager, async (req, res) => {
  try {
    const atelierId = String(req.params.id || "").trim();
    if (!atelierId) return res.status(400).json({ error: "Atelier introuvable" });
    if (atelierId.toUpperCase() === SYSTEM_ATELIER_ID) return res.status(400).json({ error: "Atelier reserve" });

    const context = await resolveSystemAtelierUserContext(atelierId, req.params.userId);
    if (!context) return res.status(404).json({ error: "Utilisateur introuvable" });

    const current = context.utilisateur;
    const updated = await changerStatutUtilisateur({
      utilisateurRepo,
      id: current.id,
      etatCompte: ACCOUNT_STATES.ACTIVE
    });

    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: context.atelier.idAtelier,
      action: "SYSTEM_USER_REACTIVATED",
      entite: "system/ateliers/utilisateurs/reactivation",
      entiteId: updated.id,
      succes: true,
      details: {
        atelierNom: context.atelier.nom || "",
        before: summarizeUser(current),
        after: summarizeUser(updated)
      }
    });

    res.json({
      utilisateur: await withPermissions(updated)
    });
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: String(req.params?.id || "").trim() || null,
      action: "SYSTEM_USER_REACTIVATION_FAILED",
      entite: "system/ateliers/utilisateurs/reactivation",
      entiteId: req.params?.userId || null,
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
    res.status(400).json({ error: err.message });
  }
});

router.post("/system/ateliers/:id/proprietaires", requireSystemManager, async (req, res) => {
  try {
    const schema = z
      .object({
        nom: z.string().min(1),
        email: z.string().email(),
        motDePasse: z.string().min(8)
      })
      .passthrough();
    const parsed = validateSchema(schema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const atelierId = String(req.params.id || "").trim();
    if (!atelierId) return res.status(400).json({ error: "Atelier introuvable" });
    if (atelierId.toUpperCase() === SYSTEM_ATELIER_ID) return res.status(400).json({ error: "Atelier reserve" });

    const atelier = await resolveSystemAtelierContext(atelierId);
    if (!atelier) return res.status(404).json({ error: "Atelier introuvable" });

    const created = await gererUtilisateurs({
      utilisateurRepo,
      input: {
        action: "create",
        nom: parsed.data.nom,
        email: parsed.data.email,
        motDePasse: parsed.data.motDePasse,
        roleId: ROLES.PROPRIETAIRE,
        atelierId: atelier.idAtelier,
        actif: true
      }
    });

    await ensureRolePermissionsForAtelier(atelier.idAtelier);

    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: atelier.idAtelier,
      action: "SYSTEM_OWNER_CREATED",
      entite: "system/ateliers/proprietaires",
      entiteId: created.id,
      succes: true,
      details: {
        atelierNom: atelier.nom || "",
        createdUser: summarizeUser(created)
      }
    });

    res.status(201).json({
      proprietaire: await withPermissions(created)
    });
  } catch (err) {
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: String(req.params?.id || "").trim() || null,
      action: "SYSTEM_OWNER_CREATE_FAILED",
      entite: "system/ateliers/proprietaires",
      succes: false,
      raison: err.message || "erreur_inconnue"
    });
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
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: out.atelier?.idAtelier || null,
      action: "SYSTEM_ATELIER_CREATED",
      entite: "system/ateliers",
      entiteId: out.atelier?.idAtelier || null,
      succes: true,
      details: {
        nomAtelier: out.atelier?.nom || parsed.data.nomAtelier,
        slug: out.atelier?.slug || parsed.data.slug,
        proprietaireEmail: out.proprietaire?.email || parsed.data.proprietaire?.email || null
      }
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
    await logSecurityAudit({
      utilisateurId: req.auth?.utilisateurId || null,
      role: req.auth?.roleId || req.auth?.role || null,
      atelierId: updated.idAtelier || req.params.id,
      action: parsed.data.actif ? "SYSTEM_ATELIER_ACTIVATED" : "SYSTEM_ATELIER_DEACTIVATED",
      entite: "system/ateliers",
      entiteId: updated.idAtelier || req.params.id,
      succes: true,
      details: {
        actif: updated.actif !== false,
        slug: updated.slug || null
      }
    });
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
    const normalizedPermissions = normalizePermissionCodes(parsed.data.permissions || []);
    const missingOwnerCriticalPermissions = role === ROLES.PROPRIETAIRE ? getMissingOwnerCriticalPermissions(normalizedPermissions) : [];
    if (missingOwnerCriticalPermissions.length > 0) {
      return res.status(400).json({
        error: `Le role proprietaire doit conserver les permissions critiques: ${missingOwnerCriticalPermissions.join(", ")}`
      });
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
