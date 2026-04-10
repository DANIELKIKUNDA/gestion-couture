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

function errorMessage(response) {
  return response.body?.error || response.body?.message;
}

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  await rolePermissionRepo.save({
    atelierId: "ATELIER",
    role: ROLES.PROPRIETAIRE,
    permissions: [],
    updatedBy: "integration-test"
  });

  const ownerEmail = `owner.security.guards.${Date.now()}@atelier.local`;
  const ownerPassword = "Passw0rd!Owner";
  const owner = new Utilisateur({
    id: randomUUID(),
    nom: "Owner Security Guards",
    email: ownerEmail,
    roleId: ROLES.PROPRIETAIRE,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    atelierId: "ATELIER",
    motDePasseHash: hashPassword(ownerPassword)
  });
  await utilisateurRepo.save(owner);

  const login = await client.post("/api/auth/login").send({ email: ownerEmail, motDePasse: ownerPassword });
  assert.equal(login.status, 200, "login proprietaire doit repondre 200");
  const token = String(login.body?.token || "");
  assert.ok(token, "token proprietaire manquant");

  const usersList = await client.get("/api/auth/users").set("Authorization", `Bearer ${token}`);
  assert.equal(usersList.status, 200, "proprietaire doit lister les utilisateurs meme sans permissions stockees");

  const selfDisable = await client
    .patch(`/api/auth/users/${encodeURIComponent(owner.id)}/activation`)
    .set("Authorization", `Bearer ${token}`)
    .send({ actif: false });
  assert.equal(selfDisable.status, 400, "auto-desactivation du proprietaire doit etre refusee");
  assert.equal(errorMessage(selfDisable), "Vous ne pouvez pas desactiver votre propre compte");

  const removeOwnerManagePermission = await client
    .put(`/api/auth/role-permissions/${encodeURIComponent(ROLES.PROPRIETAIRE)}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ permissions: [PERMISSIONS.MODIFIER_PARAMETRES] });
  assert.equal(removeOwnerManagePermission.status, 400, "suppression permission critique du proprietaire doit etre refusee");
  assert.equal(
    errorMessage(removeOwnerManagePermission),
    "Le role proprietaire doit conserver les permissions critiques: GERER_UTILISATEURS"
  );

  const removeOwnerSettingsPermission = await client
    .put(`/api/auth/role-permissions/${encodeURIComponent(ROLES.PROPRIETAIRE)}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ permissions: [PERMISSIONS.GERER_UTILISATEURS] });
  assert.equal(removeOwnerSettingsPermission.status, 400, "retrait permission parametres du proprietaire doit etre refuse");
  assert.equal(
    errorMessage(removeOwnerSettingsPermission),
    "Le role proprietaire doit conserver les permissions critiques: MODIFIER_PARAMETRES"
  );

  const keepOnlyCriticalOwnerPermissions = await client
    .put(`/api/auth/role-permissions/${encodeURIComponent(ROLES.PROPRIETAIRE)}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ permissions: [PERMISSIONS.MODIFIER_PARAMETRES, PERMISSIONS.GERER_UTILISATEURS] });
  assert.equal(keepOnlyCriticalOwnerPermissions.status, 200, "les permissions critiques seules doivent rester autorisees");
  assert.deepEqual(
    keepOnlyCriticalOwnerPermissions.body?.permissions || [],
    [PERMISSIONS.MODIFIER_PARAMETRES, PERMISSIONS.GERER_UTILISATEURS],
    "les autres permissions du proprietaire doivent rester configurables"
  );
}

run()
  .then(() => {
    console.log("OK: integration security guards");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
