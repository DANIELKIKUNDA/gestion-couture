import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();

  const email = `generic.login.${Date.now()}@atelier.local`;
  const password = "Passw0rd!Owner";
  const user = new Utilisateur({
    id: randomUUID(),
    nom: "Generic Login",
    email,
    roleId: ROLES.PROPRIETAIRE,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    atelierId: "ATELIER",
    motDePasseHash: hashPassword(password)
  });
  await utilisateurRepo.save(user);

  const wrongPassword = await client.post("/api/auth/login").send({
    email,
    motDePasse: "WrongPassw0rd!"
  });
  assert.equal(wrongPassword.status, 401, "login avec mauvais mot de passe doit repondre 401");
  assert.equal(wrongPassword.body?.error, "Identifiants invalides");

  const unknownUser = await client.post("/api/auth/login").send({
    email: `missing.${Date.now()}@atelier.local`,
    motDePasse: "WrongPassw0rd!"
  });
  assert.equal(unknownUser.status, 401, "login avec utilisateur inexistant doit repondre 401");
  assert.equal(unknownUser.body?.error, "Identifiants invalides");
}

run()
  .then(() => {
    console.log("OK: integration auth login generic error");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
