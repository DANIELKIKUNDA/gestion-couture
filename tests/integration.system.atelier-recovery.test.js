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

function errorMessage(response) {
  return response.body?.error || response.body?.message;
}

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

  const managerEmail = `manager.system.recovery.${Date.now()}@atelier.local`;
  const managerPassword = "Passw0rd!SystemRecovery";
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Manager Systeme Recovery",
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
  assert.equal(managerLogin.status, 200, "login manager systeme recovery doit repondre 200");
  const managerToken = String(managerLogin.body?.token || "");
  assert.ok(managerToken, "token manager systeme recovery manquant");

  const atelierId = `ATL_RECOVERY_${Date.now()}`;
  await ensureAtelier(atelierId, `atelier-recovery-${Date.now()}`, "Atelier Recovery");

  const owner = await utilisateurRepo.save({
    id: randomUUID(),
    nom: "Owner Recovery",
    email: `owner.recovery.${Date.now()}@atelier.local`,
    roleId: ROLES.PROPRIETAIRE,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    atelierId,
    motDePasseHash: hashPassword("Passw0rd!OwnerRecovery")
  });

  const disabledUser = await utilisateurRepo.save({
    id: randomUUID(),
    nom: "Disabled User Recovery",
    email: `disabled.recovery.${Date.now()}@atelier.local`,
    roleId: ROLES.COUTURIER,
    actif: false,
    etatCompte: ACCOUNT_STATES.DISABLED,
    atelierId,
    motDePasseHash: hashPassword("Passw0rd!DisabledRecovery")
  });

  const reactivateUser = await withAuth(
    client.post(`/api/system/ateliers/${encodeURIComponent(atelierId)}/utilisateurs/${encodeURIComponent(disabledUser.id)}/reactivation`),
    managerToken
  );
  assert.equal(reactivateUser.status, 200, "reactivation utilisateur atelier par manager systeme doit repondre 200");
  assert.equal(reactivateUser.body?.utilisateur?.actif, true, "utilisateur reactive doit etre actif");
  assert.equal(reactivateUser.body?.utilisateur?.etatCompte, ACCOUNT_STATES.ACTIVE, "etat utilisateur reactive incorrect");

  const promoteUser = await withAuth(
    client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/utilisateurs/${encodeURIComponent(disabledUser.id)}/role`),
    managerToken
  ).send({ roleId: ROLES.PROPRIETAIRE });
  assert.equal(promoteUser.status, 200, "promotion utilisateur en proprietaire doit repondre 200");
  assert.equal(promoteUser.body?.utilisateur?.roleId, ROLES.PROPRIETAIRE, "promotion en proprietaire incorrecte");

  const demoteFormerOwner = await withAuth(
    client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/utilisateurs/${encodeURIComponent(owner.id)}/role`),
    managerToken
  ).send({ roleId: ROLES.COUTURIER });
  assert.equal(demoteFormerOwner.status, 200, "retrogradation proprietaire avec autre proprietaire actif doit repondre 200");
  assert.equal(demoteFormerOwner.body?.utilisateur?.roleId, ROLES.COUTURIER, "retrogradation proprietaire incorrecte");

  const demoteLastOwner = await withAuth(
    client.patch(`/api/system/ateliers/${encodeURIComponent(atelierId)}/utilisateurs/${encodeURIComponent(disabledUser.id)}/role`),
    managerToken
  ).send({ roleId: ROLES.CAISSIER });
  assert.equal(demoteLastOwner.status, 400, "retrogradation du dernier proprietaire actif doit etre refusee");
  assert.equal(errorMessage(demoteLastOwner), "Operation refusee: dernier proprietaire actif");

  const createOwner = await withAuth(client.post(`/api/system/ateliers/${encodeURIComponent(atelierId)}/proprietaires`), managerToken).send({
    nom: "Owner Recovery Created",
    email: `created.owner.recovery.${Date.now()}@atelier.local`,
    motDePasse: "Passw0rd!CreatedOwner"
  });
  assert.equal(createOwner.status, 201, "creation d'un nouveau proprietaire atelier doit repondre 201");
  assert.equal(createOwner.body?.proprietaire?.roleId, ROLES.PROPRIETAIRE, "nouveau proprietaire cree incorrect");
  assert.equal(createOwner.body?.proprietaire?.actif, true, "nouveau proprietaire cree doit etre actif");

  const detail = await withAuth(client.get(`/api/system/ateliers/${encodeURIComponent(atelierId)}`), managerToken);
  assert.equal(detail.status, 200, "detail atelier recovery doit repondre 200");
  const activityActions = (detail.body?.recentActivity || []).map((row) => row.action);
  assert.equal(activityActions.includes("SYSTEM_USER_REACTIVATED"), true, "reactivation systeme doit etre auditee");
  assert.equal(activityActions.includes("SYSTEM_USER_PROMOTED_TO_OWNER"), true, "promotion proprietaire systeme doit etre auditee");
  assert.equal(activityActions.includes("SYSTEM_OWNER_DEMOTED"), true, "retrogradation proprietaire systeme doit etre auditee");
  assert.equal(activityActions.includes("SYSTEM_OWNER_CREATED"), true, "creation proprietaire systeme doit etre auditee");
}

run()
  .then(() => {
    console.log("OK: integration system atelier recovery");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
