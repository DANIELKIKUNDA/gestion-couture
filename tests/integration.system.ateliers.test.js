import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../src/bc-auth/infrastructure/repositories/role-permission-atelier-repo-pg.js";
import { ensureAtelier, withAuth } from "./helpers/integration-fixtures.js";

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  await ensureAtelier("SYSTEME", "systeme-interne", "Administration systeme");
  await rolePermissionRepo.save({
    atelierId: "SYSTEME",
    role: ROLES.MANAGER_SYSTEME,
    permissions: [PERMISSIONS.GERER_ATELIERS],
    updatedBy: "integration-test"
  });

  const managerEmail = `manager.system.ateliers.${Date.now()}@atelier.local`;
  const managerPassword = "Passw0rd!SystemRoutes";
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Manager Systeme Routes",
      email: managerEmail,
      roleId: ROLES.MANAGER_SYSTEME,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: "SYSTEME",
      motDePasseHash: hashPassword(managerPassword)
    })
  );

  const managerLogin = await client.post("/api/auth/login").send({
    email: managerEmail,
    motDePasse: managerPassword
  });
  assert.equal(managerLogin.status, 200, "login manager systeme doit repondre 200");
  assert.equal(managerLogin.body?.utilisateur?.roleId, ROLES.MANAGER_SYSTEME, "role manager systeme login incorrect");
  const managerToken = String(managerLogin.body?.token || "");
  assert.ok(managerToken, "token manager systeme manquant");

  const listBefore = await withAuth(client.get("/api/system/ateliers"), managerToken);
  assert.equal(listBefore.status, 200, "liste ateliers systeme doit repondre 200");
  assert.equal(listBefore.body.some((row) => row.idAtelier === "SYSTEME"), false, "atelier systeme reserve ne doit pas etre expose");

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const sharedPrefix = `tenant-sort-${suffix}`;
  const ownerEmail = `owner.system.ateliers.${suffix}@atelier.local`;
  const ownerPassword = "Passw0rd!OwnerTenant";
  const slug = `${sharedPrefix}-zeta`;

  const createAtelier = await withAuth(client.post("/api/system/ateliers"), managerToken).send({
    nomAtelier: "Atelier Manager Systeme Zeta",
    slug,
    proprietaire: {
      nom: "Owner Tenant Systeme",
      email: ownerEmail,
      motDePasse: ownerPassword
    }
  });
  assert.equal(createAtelier.status, 201, "creation atelier par manager systeme doit repondre 201");
  const atelierId = String(createAtelier.body?.atelier?.idAtelier || "");
  assert.ok(atelierId, "id atelier cree par manager systeme manquant");

  const listAfter = await withAuth(client.get("/api/system/ateliers"), managerToken);
  assert.equal(listAfter.status, 200, "liste ateliers apres creation doit repondre 200");
  assert.equal(listAfter.body.some((row) => row.idAtelier === atelierId), true, "atelier cree doit apparaitre dans la liste systeme");
  const createdRow = listAfter.body.find((row) => row.idAtelier === atelierId);
  assert.equal(createdRow?.proprietaire?.email, ownerEmail, "proprietaire atelier liste systeme incorrect");
  assert.equal(Number(createdRow?.nombreUtilisateurs || 0) >= 1, true, "nombre utilisateurs atelier liste systeme incorrect");

  const ownerEmailTwo = `owner.system.ateliers.second.${suffix}@atelier.local`;
  const slugTwo = `${sharedPrefix}-alpha`;
  const createAtelierTwo = await withAuth(client.post("/api/system/ateliers"), managerToken).send({
    nomAtelier: "Atelier Manager Systeme Alpha",
    slug: slugTwo,
    proprietaire: {
      nom: "Owner Tenant Systeme Second",
      email: ownerEmailTwo,
      motDePasse: ownerPassword
    }
  });
  assert.equal(createAtelierTwo.status, 201, "creation second atelier systeme doit repondre 201");
  const atelierIdTwo = String(createAtelierTwo.body?.atelier?.idAtelier || "");
  assert.ok(atelierIdTwo, "id second atelier cree par manager systeme manquant");

  const pagedSearch = await withAuth(
    client.get("/api/system/ateliers").query({
      search: sharedPrefix,
      sortBy: "nom",
      sortDir: "asc",
      page: 1,
      pageSize: 2
    }),
    managerToken
  );
  assert.equal(pagedSearch.status, 200, "liste ateliers paginee doit repondre 200");
  assert.equal(Array.isArray(pagedSearch.body?.items), true, "payload pagine doit exposer items");
  assert.equal(pagedSearch.body?.pagination?.page, 1, "page paginee incorrecte");
  assert.equal(pagedSearch.body?.pagination?.pageSize, 2, "taille page paginee incorrecte");
  assert.equal(pagedSearch.body?.pagination?.total, 2, "total pagine recherche systeme incorrect");
  assert.equal(pagedSearch.body?.pagination?.totalPages, 1, "total pages pagine recherche systeme incorrect");
  assert.equal(pagedSearch.body?.items?.[0]?.nom, "Atelier Manager Systeme Alpha", "tri systeme par nom asc incorrect");
  assert.equal(pagedSearch.body?.items?.[1]?.nom, "Atelier Manager Systeme Zeta", "tri systeme par nom asc incorrect");
  assert.equal(Number(pagedSearch.body?.summary?.total || 0) >= 1, true, "resume systeme pagine incorrect");

  const detail = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detail.status, 200, "detail atelier systeme doit repondre 200");
  assert.equal(detail.body?.idAtelier, atelierId, "detail atelier systeme id incorrect");
  assert.equal(detail.body?.proprietaire?.email, ownerEmail, "detail atelier systeme proprietaire incorrect");
  assert.equal(Number(detail.body?.stats?.totalUtilisateurs || 0) >= 1, true, "detail atelier systeme stats incorrectes");
  assert.equal(Array.isArray(detail.body?.recentActivity), true, "detail atelier systeme doit exposer recentActivity");
  assert.equal(detail.body?.recentActivity?.some((row) => row.action === "SYSTEM_ATELIER_CREATED"), true, "creation atelier doit etre auditée");
  assert.equal(typeof detail.body?.health?.signal, "string", "detail atelier systeme doit exposer un signal de sante");
  assert.equal(Number(detail.body?.health?.eventsLast7Days || 0) >= 1, true, "detail atelier systeme doit exposer le volume recent");
  assert.ok(detail.body?.health?.lastEventAt, "detail atelier systeme doit exposer la date du dernier evenement");

  const ownerLogin = await client.post("/api/auth/login").send({
    email: ownerEmail,
    motDePasse: ownerPassword,
    atelierSlug: slug
  });
  assert.equal(ownerLogin.status, 200, "login owner atelier cree doit repondre 200");
  const ownerToken = String(ownerLogin.body?.token || "");
  assert.ok(ownerToken, "token owner atelier cree manquant");

  const ownerSystemList = await withAuth(client.get("/api/system/ateliers"), ownerToken);
  assert.equal(ownerSystemList.status, 403, "owner tenant ne doit pas acceder aux routes systeme");
  const ownerSystemDetail = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), ownerToken);
  assert.equal(ownerSystemDetail.status, 403, "owner tenant ne doit pas acceder au detail systeme");

  const deactivateSystemAtelier = await withAuth(client.patch("/api/system/ateliers/SYSTEME/activation"), managerToken).send({ actif: false });
  assert.equal(deactivateSystemAtelier.status, 400, "atelier systeme reserve ne doit pas etre desactivable");
  assert.equal(deactivateSystemAtelier.body?.error, "Atelier reserve");

  const deactivate = await withAuth(client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/activation`), managerToken).send({ actif: false });
  assert.equal(deactivate.status, 200, "desactivation atelier doit repondre 200");
  assert.equal(deactivate.body?.actif, false, "etat atelier desactive incorrect");

  const inactiveFiltered = await withAuth(
    client.get("/api/system/ateliers").query({
      search: sharedPrefix,
      status: "INACTIVE",
      sortBy: "createdAt",
      sortDir: "desc",
      page: 1,
      pageSize: 10
    }),
    managerToken
  );
  assert.equal(inactiveFiltered.status, 200, "filtre ateliers inactifs doit repondre 200");
  assert.equal(inactiveFiltered.body?.pagination?.total, 1, "filtre ateliers inactifs doit retourner un seul atelier");
  assert.equal(inactiveFiltered.body?.items?.[0]?.idAtelier, atelierId, "filtre ateliers inactifs incorrect");

  const detailAfterDeactivate = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detailAfterDeactivate.status, 200, "detail atelier desactive doit repondre 200");
  assert.equal(detailAfterDeactivate.body?.actif, false, "detail atelier desactive incorrect");
  assert.equal(detailAfterDeactivate.body?.recentActivity?.[0]?.action, "SYSTEM_ATELIER_DEACTIVATED", "desactivation atelier doit remonter en tete de l'activite");
  assert.equal(detailAfterDeactivate.body?.health?.signal, "warning", "detail atelier desactive doit remonter un signal warning");

  const meAfterDeactivate = await client.get("/api/auth/me").set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(meAfterDeactivate.status, 401, "session owner atelier inactif doit etre refusee");
  assert.equal(meAfterDeactivate.body?.error, "Atelier inactif");

  const ownerLoginAfterDeactivate = await client.post("/api/auth/login").send({
    email: ownerEmail,
    motDePasse: ownerPassword,
    atelierSlug: slug
  });
  assert.equal(ownerLoginAfterDeactivate.status, 401, "login atelier inactif doit etre refuse");

  const reactivate = await withAuth(client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/activation`), managerToken).send({ actif: true });
  assert.equal(reactivate.status, 200, "reactivation atelier doit repondre 200");
  assert.equal(reactivate.body?.actif, true, "etat atelier reactive incorrect");

  const ownerLoginAfterReactivate = await client.post("/api/auth/login").send({
    email: ownerEmail,
    motDePasse: ownerPassword,
    atelierSlug: slug
  });
  assert.equal(ownerLoginAfterReactivate.status, 200, "login atelier reactive doit repondre 200");
}

run()
  .then(() => {
    console.log("OK: integration system ateliers");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
