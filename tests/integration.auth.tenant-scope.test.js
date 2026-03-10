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

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  await rolePermissionRepo.save({
    atelierId: "ATELIER_A",
    role: ROLES.PROPRIETAIRE,
    permissions: [],
    updatedBy: "integration-test"
  });
  await rolePermissionRepo.save({
    atelierId: "ATELIER_B",
    role: ROLES.PROPRIETAIRE,
    permissions: [],
    updatedBy: "integration-test"
  });
  await rolePermissionRepo.save({
    atelierId: "ATELIER_A",
    role: ROLES.COUTURIER,
    permissions: [PERMISSIONS.VOIR_COMMANDES],
    updatedBy: "integration-test"
  });
  await rolePermissionRepo.save({
    atelierId: "ATELIER_B",
    role: ROLES.COUTURIER,
    permissions: [PERMISSIONS.VOIR_CLIENTS],
    updatedBy: "integration-test"
  });

  const ownerAEmail = `owner.a.${Date.now()}@atelier.local`;
  const ownerBEmail = `owner.b.${Date.now()}@atelier.local`;
  const password = "Passw0rd!Tenant";

  const ownerA = await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Owner A",
      email: ownerAEmail,
      roleId: ROLES.PROPRIETAIRE,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: "ATELIER_A",
      motDePasseHash: hashPassword(password)
    })
  );
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Owner B",
      email: ownerBEmail,
      roleId: ROLES.PROPRIETAIRE,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: "ATELIER_B",
      motDePasseHash: hashPassword(password)
    })
  );

  const loginA = await client.post("/api/auth/login").send({ email: ownerAEmail, motDePasse: password });
  assert.equal(loginA.status, 200, "login owner A doit repondre 200");
  assert.equal(loginA.body?.utilisateur?.atelierId, "ATELIER_A", "atelierId utilisateur login A incorrect");
  const tokenA = String(loginA.body?.token || "");

  const listUsersA = await client.get("/api/auth/users").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(listUsersA.status, 200, "liste users atelier A doit repondre 200");
  assert.equal(listUsersA.body.length >= 1, true, "liste users atelier A ne doit pas etre vide");
  assert.equal(listUsersA.body.some((row) => row.email === ownerBEmail), false, "atelier A ne doit pas voir owner B");

  const rolePermsA = await client.get("/api/auth/role-permissions").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(rolePermsA.status, 200, "liste permissions atelier A doit repondre 200");
  const couturierA = rolePermsA.body.find((row) => row.role === ROLES.COUTURIER);
  assert.deepEqual(couturierA?.permissions || [], [PERMISSIONS.VOIR_COMMANDES], "permissions couturier atelier A incorrectes");

  const updateOtherAtelier = await client
    .patch(`/api/auth/users/${encodeURIComponent(ownerA.id)}`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ nom: "Owner A Renamed" });
  assert.equal(updateOtherAtelier.status, 200, "mise a jour owner A doit repondre 200");
}

run()
  .then(() => {
    console.log("OK: integration auth tenant scope");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
