import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { verifyAccessToken } from "../src/bc-auth/infrastructure/security/jwt-service.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../src/bc-auth/infrastructure/repositories/role-permission-atelier-repo-pg.js";

async function run() {
  const app = createApp();
  const agent = request.agent(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  await rolePermissionRepo.save({
    atelierId: "ATELIER",
    role: ROLES.PROPRIETAIRE,
    permissions: [],
    updatedBy: "integration-test"
  });
  await rolePermissionRepo.save({
    atelierId: "ATELIER",
    role: ROLES.COUTURIER,
    permissions: [PERMISSIONS.VOIR_COMMANDES],
    updatedBy: "integration-test"
  });

  const ownerEmail = `owner.session.${Date.now()}@atelier.local`;
  const ownerPassword = "Passw0rd!OwnerSession";
  const owner = new Utilisateur({
    id: randomUUID(),
    nom: "Owner Session Consistency",
    email: ownerEmail,
    roleId: ROLES.PROPRIETAIRE,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    atelierId: "ATELIER",
    motDePasseHash: hashPassword(ownerPassword)
  });
  await utilisateurRepo.save(owner);

  const loginOne = await agent.post("/api/auth/login").send({ email: ownerEmail, motDePasse: ownerPassword });
  assert.equal(loginOne.status, 200, "login initial proprietaire doit repondre 200");
  const firstToken = String(loginOne.body?.token || "");
  assert.ok(firstToken, "premier token proprietaire manquant");
  const firstPayload = verifyAccessToken(firstToken);
  assert.equal(firstPayload.sub, owner.id, "payload token doit contenir user_id");
  assert.equal(firstPayload.email, ownerEmail, "payload token doit contenir email");
  assert.equal(firstPayload.role, ROLES.PROPRIETAIRE, "payload token doit contenir role");
  assert.equal("permissions" in firstPayload, false, "permissions ne doivent pas etre stockees dans le token");

  const firstUsersList = await agent.get("/api/auth/users").set("Authorization", `Bearer ${firstToken}`);
  assert.equal(firstUsersList.status, 200, "liste utilisateurs apres premier login doit repondre 200");

  const updateCouturierPermissions = await agent
    .put(`/api/auth/role-permissions/${encodeURIComponent(ROLES.COUTURIER)}`)
    .set("Authorization", `Bearer ${firstToken}`)
    .send({ permissions: [PERMISSIONS.VOIR_COMMANDES, PERMISSIONS.CREER_COMMANDE] });
  assert.equal(updateCouturierPermissions.status, 200, "mise a jour permissions couturier doit repondre 200");

  const logout = await agent.post("/api/auth/logout").set("Authorization", `Bearer ${firstToken}`).send({});
  assert.equal(logout.status, 200, "logout proprietaire doit repondre 200");

  const revokedTokenUsersList = await agent.get("/api/auth/users").set("Authorization", `Bearer ${firstToken}`);
  assert.equal(revokedTokenUsersList.status, 401, "un token revoque doit etre refuse comme session invalide");

  const loginTwo = await agent.post("/api/auth/login").send({ email: ownerEmail, motDePasse: ownerPassword });
  assert.equal(loginTwo.status, 200, "second login proprietaire doit repondre 200");
  const secondToken = String(loginTwo.body?.token || "");
  assert.ok(secondToken, "second token proprietaire manquant");
  assert.notEqual(secondToken, firstToken, "chaque login doit produire un nouveau token");

  const usersListAfterRelogin = await agent.get("/api/auth/users").set("Authorization", `Bearer ${secondToken}`);
  assert.equal(usersListAfterRelogin.status, 200, "liste utilisateurs apres relogin doit repondre 200");

  const rolePermissionsAfterRelogin = await agent
    .get("/api/auth/role-permissions")
    .set("Authorization", `Bearer ${secondToken}`);
  assert.equal(rolePermissionsAfterRelogin.status, 200, "liste permissions roles apres relogin doit repondre 200");

  const parametresAfterRelogin = await agent
    .get("/api/parametres-atelier")
    .set("Authorization", `Bearer ${secondToken}`);
  assert.equal(parametresAfterRelogin.status, 200, "route protegee parametres doit rester accessible au proprietaire");
}

run()
  .then(() => {
    console.log("OK: integration auth session consistency");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
