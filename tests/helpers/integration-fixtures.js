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

  await ensureAtelier(atelierId, slugify(atelierId), `Atelier ${atelierId}`);
  await rolePermissionRepo.save({
    atelierId,
    role,
    permissions,
    updatedBy: "integration-test"
  });

  const email = `${emailPrefix}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}@atelier.local`;
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
  await utilisateurRepo.save(user);

  const login = await client.post("/api/auth/login").send({ email, motDePasse: password });
  if (login.status !== 200) {
    throw new Error(`Login integration impossible pour ${email}: ${login.status} ${login.body?.error || ""}`.trim());
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
    telephone: telephone || `+243${Date.now().toString().slice(-9)}`
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
  }
}) {
  const response = await withAuth(client.post("/api/commandes"), token).send({
    idClient,
    descriptionCommande,
    montantTotal,
    typeHabit,
    mesuresHabit
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
      typesRetouche: [
        {
          code: "OURLET",
          libelle: "Ourlet",
          actif: true,
          ordreAffichage: 1,
          necessiteMesures: true,
          descriptionObligatoire: false,
          habitsCompatibles: ["PANTALON", "ROBE"],
          mesures: ["longueur"]
        }
      ]
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
