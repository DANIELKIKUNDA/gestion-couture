import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../../src/interfaces/http/app.js";
import { pool } from "../../src/shared/infrastructure/db.js";
import { Utilisateur } from "../../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../../src/bc-auth/domain/account-state.js";
import { hashPassword } from "../../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../../src/bc-auth/infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { AtelierParametresRepoPg } from "../../src/bc-parametres/infrastructure/repositories/atelier-parametres-repo-pg.js";
import { cloneDefaultRetoucheTypes } from "../../src/bc-retouches/domain/retouche-policy.js";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  if (!base || typeof base !== "object") {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  if (!override || typeof override !== "object") return out;
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = current && value && typeof current === "object" && typeof value === "object" && !Array.isArray(current) && !Array.isArray(value)
      ? deepMerge(current, value)
      : value;
  }
  return out;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRetryAfterMs(response, fallbackMs = 2_000) {
  const rawRetryAfter = response?.headers?.["retry-after"];
  const retryAfterSeconds = Number(rawRetryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.max(fallbackMs, retryAfterSeconds * 1000 + 250);
  }

  const rawRateLimitReset =
    response?.headers?.["ratelimit-reset"] ??
    response?.headers?.["x-ratelimit-reset"];
  const rateLimitResetSeconds = Number(rawRateLimitReset);
  if (Number.isFinite(rateLimitResetSeconds) && rateLimitResetSeconds > 0) {
    return Math.max(fallbackMs, rateLimitResetSeconds * 1000 + 250);
  }

  return fallbackMs;
}

export async function ensureAtelier(idAtelier, slug = null, nom = null) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ateliers (
      id_atelier TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      actif BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const resolvedSlug = slug || slugify(idAtelier) || "atelier";
  await pool.query(
    `INSERT INTO ateliers (id_atelier, slug, nom, actif)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (id_atelier) DO UPDATE
     SET slug = EXCLUDED.slug,
         nom = EXCLUDED.nom,
         actif = true,
         updated_at = NOW()`,
    [idAtelier, resolvedSlug, nom || `Atelier ${idAtelier}`]
  );
}

export async function ensureCommandeFamilleSchema() {
  await pool.query(`
    ALTER TABLE clients
    ALTER COLUMN telephone DROP NOT NULL
  `).catch(() => {});

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.commande_lignes') IS NULL THEN
        BEGIN
          CREATE TABLE public.commande_lignes (
            id_ligne TEXT PRIMARY KEY,
            atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
            id_commande TEXT NOT NULL,
            id_client TEXT NULL,
            role TEXT NOT NULL CHECK (role IN ('BENEFICIAIRE', 'PAYEUR_BENEFICIAIRE')),
            nom_affiche TEXT NOT NULL DEFAULT '',
            prenom_affiche TEXT NOT NULL DEFAULT '',
            type_habit TEXT NOT NULL,
            mesures_habit_snapshot JSONB NOT NULL,
            ordre_affichage INTEGER NOT NULL DEFAULT 1 CHECK (ordre_affichage > 0),
            date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        EXCEPTION
          WHEN duplicate_table OR duplicate_object THEN
            NULL;
        END;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_commande_lignes_atelier_commande
    ON commande_lignes (atelier_id, id_commande, ordre_affichage)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_commande_lignes_atelier_client
    ON commande_lignes (atelier_id, id_client)
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commande_lignes_commande_atelier_fk'
      ) THEN
        ALTER TABLE commande_lignes
          ADD CONSTRAINT commande_lignes_commande_atelier_fk
          FOREIGN KEY (atelier_id, id_commande)
          REFERENCES commandes(atelier_id, id_commande)
          ON DELETE CASCADE;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commande_lignes_client_atelier_fk'
      ) THEN
        ALTER TABLE commande_lignes
          ADD CONSTRAINT commande_lignes_client_atelier_fk
          FOREIGN KEY (atelier_id, id_client)
          REFERENCES clients(atelier_id, id_client);
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `);
}

export async function ensureDossierSchema() {
  await ensureCommandeFamilleSchema();

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.dossiers') IS NULL THEN
        BEGIN
          CREATE TABLE public.dossiers (
            id_dossier TEXT PRIMARY KEY,
            atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
            id_responsable_client TEXT NOT NULL,
            nom_responsable_snapshot TEXT NOT NULL DEFAULT '',
            prenom_responsable_snapshot TEXT NOT NULL DEFAULT '',
            telephone_responsable_snapshot TEXT NOT NULL DEFAULT '',
            type_dossier TEXT NOT NULL DEFAULT 'INDIVIDUEL',
            statut TEXT NOT NULL DEFAULT 'ACTIF',
            notes TEXT NULL,
            cree_par TEXT NULL,
            modifie_par_dernier TEXT NULL,
            date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            date_derniere_activite TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        EXCEPTION
          WHEN duplicate_table OR duplicate_object THEN
            NULL;
        END;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'commandes'
          AND column_name = 'id_dossier'
      ) THEN
        ALTER TABLE commandes ADD COLUMN id_dossier TEXT NULL;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `).catch(() => {});

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'retouches'
          AND column_name = 'id_dossier'
      ) THEN
        ALTER TABLE retouches ADD COLUMN id_dossier TEXT NULL;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `).catch(() => {});

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.commande_items') IS NULL THEN
        CREATE TABLE public.commande_items (
          id_item TEXT PRIMARY KEY,
          atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
          id_commande TEXT NOT NULL,
          type_habit TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
          ordre_affichage INTEGER NOT NULL DEFAULT 1 CHECK (ordre_affichage > 0),
          mesures_snapshot_json JSONB NULL,
          date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      END IF;
      IF to_regclass('public.commande_items') IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'commande_items'
          AND column_name = 'mesures_snapshot_json'
      ) THEN
        ALTER TABLE public.commande_items ADD COLUMN mesures_snapshot_json JSONB NULL;
      END IF;
      IF to_regclass('public.retouche_items') IS NULL THEN
        CREATE TABLE public.retouche_items (
          id_item TEXT PRIMARY KEY,
          atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
          id_retouche TEXT NOT NULL,
          type_retouche TEXT NOT NULL,
          type_habit TEXT NULL,
          description TEXT NOT NULL DEFAULT '',
          prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
          ordre_affichage INTEGER NOT NULL DEFAULT 1 CHECK (ordre_affichage > 0),
          mesures_snapshot_json JSONB NULL,
          date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      END IF;
      IF to_regclass('public.retouche_items') IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'retouche_items'
          AND column_name = 'type_habit'
      ) THEN
        ALTER TABLE public.retouche_items ADD COLUMN type_habit TEXT NULL;
      END IF;
      IF to_regclass('public.retouche_items') IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'retouche_items'
          AND column_name = 'mesures_snapshot_json'
      ) THEN
        ALTER TABLE public.retouche_items ADD COLUMN mesures_snapshot_json JSONB NULL;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `);
}

export function withAuth(req, token) {
  return req.set("Authorization", `Bearer ${token}`);
}

export async function createAuthenticatedSession({
  app = createApp(),
  atelierId = `ATELIER_IT_${Date.now()}`,
  role = ROLES.PROPRIETAIRE,
  permissions = [],
  emailPrefix = "integration",
  nom = "Integration User",
  password = "Passw0rd!Test"
} = {}) {
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  await ensureCommandeFamilleSchema();
  await ensureAtelier(atelierId, slugify(atelierId), `Atelier ${atelierId}`);
  await rolePermissionRepo.save({
    atelierId,
    role,
    permissions,
    updatedBy: "integration-test"
  });

  const uniqueSuffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `${emailPrefix}.${slugify(atelierId) || "atelier"}.${uniqueSuffix}@atelier.local`;
  const user = new Utilisateur({
    id: randomUUID(),
    nom,
    email,
    roleId: role,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    atelierId,
    motDePasseHash: hashPassword(password)
  });
  let lastSaveError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await ensureAtelier(atelierId, slugify(atelierId), `Atelier ${atelierId}`);
      await utilisateurRepo.save(user);
      lastSaveError = null;
      break;
    } catch (error) {
      lastSaveError = error;
      try {
        const existingUser = await utilisateurRepo.getByIdAndAtelier(user.id, atelierId);
        if (existingUser) {
          lastSaveError = null;
          break;
        }
      } catch {
        // Keep the original save error as the meaningful one.
      }
      if (attempt === 4) break;
      await wait(200 * (attempt + 1));
    }
  }
  if (lastSaveError) {
    throw lastSaveError;
  }

  let login = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    login = await client.post("/api/auth/login").send({ email, motDePasse: password });
    if (login.status === 200) break;
    if (login.status !== 429 || attempt === 11) {
      throw new Error(`Login integration impossible pour ${email}: ${login.status} ${login.body?.error || ""}`.trim());
    }
    await wait(resolveRetryAfterMs(login, 1_500 + attempt * 500));
  }

  return {
    app,
    client,
    token: String(login.body?.token || ""),
    user,
    email,
    password,
    atelierId
  };
}

export async function createClientViaApi({ client, token, nom = "Client", prenom = "Test", telephone }) {
  const response = await withAuth(client.post("/api/clients"), token).send({
    nom,
    prenom,
    telephone: telephone === undefined ? `+243${Date.now().toString().slice(-9)}` : telephone
  });
  return response;
}

export async function createCommandeViaApi({
  client,
  token,
  idClient,
  descriptionCommande = "Commande integration",
  montantTotal = 120,
  typeHabit = "PANTALON",
  mesuresHabit = {
    longueur: 105,
    tourTaille: 82,
    tourHanche: 96,
    largeurBas: 20,
    hauteurFourche: 28
  },
  ...extraPayload
}) {
  const response = await withAuth(client.post("/api/commandes"), token).send({
    idClient,
    descriptionCommande,
    montantTotal,
    typeHabit,
    mesuresHabit,
    ...extraPayload
  });
  return response;
}

export async function createRetoucheViaApi({
  client,
  token,
  idClient,
  descriptionRetouche = "Retouche integration",
  typeRetouche = "OURLET",
  montantTotal = 40,
  typeHabit = "ROBE",
  mesuresHabit = { longueur: 98 }
}) {
  const response = await withAuth(client.post("/api/retouches"), token).send({
    idClient,
    descriptionRetouche,
    typeRetouche,
    montantTotal,
    typeHabit,
    mesuresHabit
  });
  return response;
}

export async function openCaisseViaApi({ client, token, utilisateur = "Integration User", soldeOuverture = 100 }) {
  const response = await withAuth(client.post("/api/caisse/ouvrir"), token).send({
    soldeOuverture,
    utilisateur,
    overrideHeureOuverture: true,
    role: "manager",
    motifOverride: "integration-tests"
  });
  return response;
}

export function createDefaultParametresPayload(overrides = {}) {
  const base = {
    meta: {
      version: 1
    },
    identite: {
      nomAtelier: "Atelier Test",
      adresse: "",
      telephone: "",
      email: "",
      devise: "FC",
      logoUrl: ""
    },
    commandes: {
      mesuresObligatoires: true,
      interdictionSansMesures: true,
      uniteMesure: "cm",
      decimalesAutorisees: true,
      delaiDefautJours: 7
    },
    retouches: {
      mesuresOptionnelles: true,
      saisiePartielle: true,
      descriptionObligatoire: false,
      typesRetouche: cloneDefaultRetoucheTypes()
    },
    habits: {
      PANTALON: {
        label: "Pantalon",
        actif: true,
        ordre: 1,
        mesures: [
          { code: "longueur", label: "Longueur", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
          { code: "tourTaille", label: "Tour taille", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" },
          { code: "tourHanche", label: "Tour hanche", obligatoire: true, actif: true, ordre: 3, typeChamp: "number" },
          { code: "largeurBas", label: "Largeur bas", obligatoire: true, actif: true, ordre: 4, typeChamp: "number" },
          { code: "hauteurFourche", label: "Hauteur fourche", obligatoire: true, actif: true, ordre: 5, typeChamp: "number" }
        ]
      },
      ROBE: {
        label: "Robe",
        actif: true,
        ordre: 2,
        mesures: [
          { code: "poitrine", label: "Poitrine", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
          { code: "taille", label: "Taille", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" },
          { code: "hanche", label: "Hanche", obligatoire: true, actif: true, ordre: 3, typeChamp: "number" },
          { code: "longueur", label: "Longueur", obligatoire: true, actif: true, ordre: 4, typeChamp: "number" },
          { code: "largeurBas", label: "Largeur bas", obligatoire: false, actif: true, ordre: 5, typeChamp: "number" }
        ]
      }
    },
    caisse: {
      ouvertureAuto: "07:30",
      ouvertureDimanche: "08:00",
      clotureAutoMinuit: false,
      clotureAutoActive: false,
      heureClotureAuto: "23:59",
      paiementAvantLivraison: true,
      livraisonExpress: false
    },
    facturation: {
      prefixeNumero: "FAC",
      mentions: "",
      afficherLogo: true
    },
    securite: {
      rolesAutorises: ["PROPRIETAIRE"],
      confirmationAvantSauvegarde: false,
      verrouillageActif: false,
      auditLog: []
    }
  };

  return deepMerge(base, overrides);
}

export async function saveAtelierParametres({ atelierId, payload, updatedBy = "integration-test" }) {
  const repo = new AtelierParametresRepoPg(atelierId);
  return repo.save({ payload, updatedBy });
}
