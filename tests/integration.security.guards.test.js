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
    atelierId: "ATELIER",
    role: ROLES.PROPRIETAIRE,
    permissions: [PERMISSIONS.GERER_UTILISATEURS, PERMISSIONS.MODIFIER_PARAMETRES],
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

  const selfDisable = await client
    .patch(`/api/auth/users/${encodeURIComponent(owner.id)}/activation`)
    .set("Authorization", `Bearer ${token}`)
    .send({ actif: false });
  assert.equal(selfDisable.status, 400, "auto-desactivation du proprietaire doit etre refusee");
  assert.equal(selfDisable.body?.error, "Vous ne pouvez pas desactiver votre propre compte");

  const removeOwnerManagePermission = await client
    .put(`/api/auth/role-permissions/${encodeURIComponent(ROLES.PROPRIETAIRE)}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ permissions: [PERMISSIONS.MODIFIER_PARAMETRES] });
  assert.equal(removeOwnerManagePermission.status, 400, "suppression permission critique du proprietaire doit etre refusee");
  assert.equal(removeOwnerManagePermission.body?.error, "Le role proprietaire doit conserver la permission GERER_UTILISATEURS");
}

run()
  .then(() => {
    console.log("OK: integration security guards");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
