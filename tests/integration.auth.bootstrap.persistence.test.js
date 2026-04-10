import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { pool } from "../src/shared/infrastructure/db.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { changerStatutUtilisateur } from "../src/bc-auth/application/use-cases/changer-statut-utilisateur.js";

function errorMessage(response) {
  return response.body?.error || response.body?.message;
}

async function run() {
  const firstApp = createApp();
  const firstClient = request(firstApp);

  const firstStatus = await firstClient.get("/api/auth/bootstrap-owner/status");
  assert.equal(firstStatus.status, 200, "status bootstrap-owner doit repondre 200");

  let bootstrapEmail = null;
  let bootstrapPassword = null;
  if (firstStatus.body?.initialized !== true) {
    bootstrapEmail = `owner.bootstrap.${Date.now()}@atelier.local`;
    bootstrapPassword = "Passw0rdBootstrap!";
    const boot = await firstClient.post("/api/auth/bootstrap-owner").send({
      nom: "Owner Bootstrap Test",
      email: bootstrapEmail,
      motDePasse: bootstrapPassword
    });
    assert.equal(boot.status, 201, "bootstrap owner doit creer le proprietaire quand non initialise");
  }

  const ownersCount = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM utilisateurs
     WHERE UPPER(role_id) = 'PROPRIETAIRE'`
  );
  assert.ok(Number(ownersCount.rows[0]?.c || 0) > 0, "au moins un proprietaire doit persister en base");

  const secondApp = createApp();
  const secondClient = request(secondApp);
  const secondStatus = await secondClient.get("/api/auth/bootstrap-owner/status");
  assert.equal(secondStatus.status, 200, "status bootstrap-owner apres restart doit repondre 200");
  assert.equal(secondStatus.body?.initialized, true, "atelier doit rester initialise apres redemarrage");

  if (bootstrapEmail && bootstrapPassword) {
    const login = await secondClient.post("/api/auth/login").send({ email: bootstrapEmail, motDePasse: bootstrapPassword });
    assert.equal(login.status, 200, "login proprietaire bootstrap apres restart doit repondre 200");

    const token = String(login.body?.token || "");
    assert.ok(token, "token proprietaire bootstrap manquant");

    const me = await secondClient.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(me.status, 200, "/auth/me du proprietaire bootstrap apres restart doit repondre 200");
  }

  const utilisateurRepo = new UtilisateurRepoPg();
  const loginEmail = `disabled.login.${Date.now()}@atelier.local`;
  const loginPassword = "Passw0rdDisabled!";
  const loginUser = new Utilisateur({
    id: randomUUID(),
    nom: "User Disabled Test",
    email: loginEmail,
    roleId: ROLES.COUTURIER,
    actif: true,
    etatCompte: ACCOUNT_STATES.ACTIVE,
    motDePasseHash: hashPassword(loginPassword),
    atelierId: "ATELIER"
  });
  await utilisateurRepo.save(loginUser);

  const loginBeforeDisable = await secondClient.post("/api/auth/login").send({ email: loginEmail, motDePasse: loginPassword });
  assert.equal(loginBeforeDisable.status, 200, "login utilisateur actif doit repondre 200");
  const tokenBeforeDisable = String(loginBeforeDisable.body?.token || "");
  assert.ok(tokenBeforeDisable, "token utilisateur actif manquant");

  await changerStatutUtilisateur({
    utilisateurRepo,
    id: loginUser.id,
    etatCompte: ACCOUNT_STATES.DISABLED
  });

  const loginAfterDisable = await secondClient.post("/api/auth/login").send({ email: loginEmail, motDePasse: loginPassword });
  assert.equal(loginAfterDisable.status, 401, "login utilisateur desactive doit etre refuse");
  assert.equal(errorMessage(loginAfterDisable), "Compte inactif: connexion refusee");

  const meAfterDisable = await secondClient.get("/api/auth/me").set("Authorization", `Bearer ${tokenBeforeDisable}`);
  assert.equal(meAfterDisable.status, 401, "/auth/me utilisateur desactive doit etre refuse");
  assert.equal(errorMessage(meAfterDisable), "Compte inactif: connexion refusee");
}

run()
  .then(() => {
    console.log("OK: integration auth bootstrap persistence + disable login");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
