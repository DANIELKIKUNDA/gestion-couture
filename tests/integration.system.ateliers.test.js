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
  const ownerTelephone = "+243810000001";
  const ownerPassword = "Passw0rd!OwnerTenant";
  const slug = `${sharedPrefix}-zeta`;

  const createAtelier = await withAuth(client.post("/api/system/ateliers"), managerToken).send({
    nomAtelier: "Atelier Manager Systeme Zeta",
    slug,
    proprietaire: {
      nom: "Owner Tenant Systeme",
      email: ownerEmail,
      telephone: ownerTelephone,
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
  const ownerTelephoneTwo = "+243810000002";
  const slugTwo = `${sharedPrefix}-alpha`;
  const createAtelierTwo = await withAuth(client.post("/api/system/ateliers"), managerToken).send({
    nomAtelier: "Atelier Manager Systeme Alpha",
    slug: slugTwo,
    proprietaire: {
      nom: "Owner Tenant Systeme Second",
      email: ownerEmailTwo,
      telephone: ownerTelephoneTwo,
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

  const dashboard = await withAuth(client.get("/api/system/dashboard"), managerToken);
  assert.equal(dashboard.status, 200, "dashboard systeme doit repondre 200");
  assert.equal(Number(dashboard.body?.summary?.total || 0) >= 2, true, "dashboard systeme total incorrect");
  assert.equal(Number(dashboard.body?.summary?.nouveaux30J || 0) >= 2, true, "dashboard systeme nouveaux30J incorrect");
  assert.equal(Array.isArray(dashboard.body?.alerts), true, "dashboard systeme doit exposer alerts");
  assert.equal(Array.isArray(dashboard.body?.recentAteliers), true, "dashboard systeme doit exposer recentAteliers");
  assert.equal(
    dashboard.body?.recentAteliers?.some((row) => row.idAtelier === atelierId || row.idAtelier === atelierIdTwo),
    true,
    "dashboard systeme doit exposer les ateliers recents"
  );

  const detail = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detail.status, 200, "detail atelier systeme doit repondre 200");
  assert.equal(detail.body?.idAtelier, atelierId, "detail atelier systeme id incorrect");
  assert.equal(detail.body?.proprietaire?.email, ownerEmail, "detail atelier systeme proprietaire incorrect");
  assert.equal(detail.body?.proprietaire?.telephone, ownerTelephone, "detail atelier systeme telephone proprietaire incorrect");
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

  const detailWithSessions = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detailWithSessions.status, 200, "detail atelier apres login owner doit repondre 200");
  assert.equal(Number(detailWithSessions.body?.proprietaire?.sessions?.totalActives || 0) >= 1, true, "sessions proprietaire detail systeme incorrectes");
  assert.equal(Array.isArray(detailWithSessions.body?.proprietaire?.sessions?.recentSessions), true, "recentSessions proprietaire detail systeme incorrect");

  const updatedOwnerTelephone = "+243810009999";
  const updateContact = await withAuth(
    client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/proprietaire/contact`),
    managerToken
  ).send({ telephone: updatedOwnerTelephone });
  assert.equal(updateContact.status, 200, "mise a jour telephone proprietaire doit repondre 200");
  assert.equal(updateContact.body?.proprietaire?.telephone, updatedOwnerTelephone, "telephone proprietaire mis a jour incorrect");

  const detailAfterContactUpdate = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detailAfterContactUpdate.status, 200, "detail atelier apres mise a jour telephone doit repondre 200");
  assert.equal(
    detailAfterContactUpdate.body?.proprietaire?.telephone,
    updatedOwnerTelephone,
    "detail atelier doit exposer le telephone proprietaire mis a jour"
  );

  const revokeSessions = await withAuth(client.post(`/api/system/ateliers/${encodeURIComponent(atelierId)}/proprietaire/revoke-sessions`), managerToken);
  assert.equal(revokeSessions.status, 200, "revocation sessions proprietaire doit repondre 200");
  assert.equal(Number(revokeSessions.body?.revokedSessions || 0) >= 1, true, "revocation sessions proprietaire incorrecte");

  const detailAfterSessionRevoke = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(Number(detailAfterSessionRevoke.body?.proprietaire?.sessions?.totalActives || 0), 0, "sessions proprietaire doivent etre coupees");

  const ownerPasswordV2 = "Passw0rd!OwnerTenantV2";
  const resetOwnerPassword = await withAuth(
    client.post(`/api/system/ateliers/${encodeURIComponent(atelierId)}/proprietaire/reset-password`),
    managerToken
  ).send({ motDePasse: ownerPasswordV2 });
  assert.equal(resetOwnerPassword.status, 200, "reset mot de passe proprietaire doit repondre 200");

  const ownerLoginWithOldPassword = await client.post("/api/auth/login").send({
    email: ownerEmail,
    motDePasse: ownerPassword,
    atelierSlug: slug
  });
  assert.equal(ownerLoginWithOldPassword.status, 401, "ancien mot de passe proprietaire doit etre refuse");

  const ownerLoginWithNewPassword = await client.post("/api/auth/login").send({
    email: ownerEmail,
    motDePasse: ownerPasswordV2,
    atelierSlug: slug
  });
  assert.equal(ownerLoginWithNewPassword.status, 200, "nouveau mot de passe proprietaire doit fonctionner");
  const ownerTokenAfterReset = String(ownerLoginWithNewPassword.body?.token || "");
  assert.ok(ownerTokenAfterReset, "token proprietaire apres reset manquant");

  const ownerSystemList = await withAuth(client.get("/api/system/ateliers"), ownerTokenAfterReset);
  assert.equal(ownerSystemList.status, 403, "owner tenant ne doit pas acceder aux routes systeme");
  const ownerSystemDashboard = await withAuth(client.get("/api/system/dashboard"), ownerTokenAfterReset);
  assert.equal(ownerSystemDashboard.status, 403, "owner tenant ne doit pas acceder au dashboard systeme");
  const ownerSystemDetail = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), ownerTokenAfterReset);
  assert.equal(ownerSystemDetail.status, 403, "owner tenant ne doit pas acceder au detail systeme");

  const deactivateOwner = await withAuth(
    client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/proprietaire/activation`),
    managerToken
  ).send({ actif: false });
  assert.equal(deactivateOwner.status, 200, "desactivation proprietaire par manager systeme doit repondre 200");
  assert.equal(deactivateOwner.body?.proprietaire?.actif, false, "etat proprietaire desactive incorrect");

  const detailAfterOwnerDeactivate = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detailAfterOwnerDeactivate.body?.proprietaire?.actif, false, "detail proprietaire desactive incorrect");
  assert.equal(detailAfterOwnerDeactivate.body?.proprietaire?.etatCompte, ACCOUNT_STATES.DISABLED, "etat compte proprietaire desactive incorrect");

  const meAfterOwnerDeactivate = await client.get("/api/auth/me").set("Authorization", `Bearer ${ownerTokenAfterReset}`);
  assert.equal(meAfterOwnerDeactivate.status, 401, "session proprietaire desactive doit etre refusee");

  const reactivateOwner = await withAuth(
    client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/proprietaire/activation`),
    managerToken
  ).send({ actif: true });
  assert.equal(reactivateOwner.status, 200, "reactivation proprietaire par manager systeme doit repondre 200");
  assert.equal(reactivateOwner.body?.proprietaire?.actif, true, "etat proprietaire reactive incorrect");

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

  const reactivate = await withAuth(client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/activation`), managerToken).send({ actif: true });
  assert.equal(reactivate.status, 200, "reactivation atelier doit repondre 200");
  assert.equal(reactivate.body?.actif, true, "etat atelier reactive incorrect");

  const ownerLoginAfterReactivate = await client.post("/api/auth/login").send({
    email: ownerEmail,
    motDePasse: ownerPasswordV2,
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
