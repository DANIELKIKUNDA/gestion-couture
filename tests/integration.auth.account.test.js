import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { createAuthenticatedSession } from "./helpers/integration-fixtures.js";
import { verifyAccessToken } from "../src/bc-auth/infrastructure/security/jwt-service.js";

async function run() {
  const app = createApp();
  const fixture = await createAuthenticatedSession({
    app,
    emailPrefix: "account-self-service",
    nom: "Utilisateur Compte",
    password: "Passw0rd!Compte"
  });

  const agentOne = request.agent(app);
  const agentTwo = request.agent(app);

  const loginOne = await agentOne.post("/api/auth/login").send({ email: fixture.email, motDePasse: fixture.password });
  const loginTwo = await agentTwo.post("/api/auth/login").send({ email: fixture.email, motDePasse: fixture.password });
  assert.equal(loginOne.status, 200);
  assert.equal(loginTwo.status, 200);
  let tokenOne = String(loginOne.body?.token || "");
  const tokenTwo = String(loginTwo.body?.token || "");
  assert.ok(tokenOne && tokenTwo);
  assert.equal(Number(verifyAccessToken(tokenOne).tokenVersion), 1);

  const account = await agentOne.get("/api/auth/account").set("Authorization", `Bearer ${tokenOne}`);
  assert.equal(account.status, 200);
  assert.equal(account.body.profile.nom, "Utilisateur Compte");
  assert.ok(Number(account.body.security.activeSessionCount) >= 2);

  const preferences = await agentOne
    .put("/api/auth/account/preferences")
    .set("Authorization", `Bearer ${tokenOne}`)
    .send({ pageAccueil: "caisse", restaurerDernierePage: false });
  assert.equal(preferences.status, 200);
  assert.equal(preferences.body.preferences.pageAccueil, "caisse");
  assert.equal(preferences.body.preferences.restaurerDernierePage, false);

  const profile = await agentOne
    .patch("/api/auth/account/profile")
    .set("Authorization", `Bearer ${tokenOne}`)
    .send({
      nom: "Utilisateur Compte Modifie",
      telephone: "+243990000001",
      email: fixture.email,
      motDePasseActuel: fixture.password
    });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.profile.nom, "Utilisateur Compte Modifie");
  assert.equal(profile.body.profile.telephone, "+243990000001");
  tokenOne = String(profile.body.token || tokenOne);

  const badEmailChange = await agentOne
    .patch("/api/auth/account/profile")
    .set("Authorization", `Bearer ${tokenOne}`)
    .send({
      nom: "Utilisateur Compte Modifie",
      telephone: "+243990000001",
      email: `nouveau.${fixture.email}`,
      motDePasseActuel: "incorrect"
    });
  assert.equal(badEmailChange.status, 400);

  const revokeOthers = await agentOne
    .post("/api/auth/account/sessions/revoke-others")
    .set("Authorization", `Bearer ${tokenOne}`)
    .send({});
  assert.equal(revokeOthers.status, 200);
  assert.ok(Number(revokeOthers.body.revoked) >= 1);
  const tokenAfterRevocation = String(revokeOthers.body.token || "");
  assert.ok(tokenAfterRevocation);
  assert.ok(Number(verifyAccessToken(tokenAfterRevocation).tokenVersion) > Number(verifyAccessToken(tokenTwo).tokenVersion));

  const oldOtherSession = await agentTwo.get("/api/auth/me").set("Authorization", `Bearer ${tokenTwo}`);
  assert.equal(oldOtherSession.status, 401, "une autre session versionnee doit etre invalidee immediatement");

  const currentStillWorks = await agentOne.get("/api/auth/me").set("Authorization", `Bearer ${tokenAfterRevocation}`);
  assert.equal(currentStillWorks.status, 200);

  const newPassword = "NouveauPassw0rd!Compte";
  const passwordChange = await agentOne
    .post("/api/auth/account/password")
    .set("Authorization", `Bearer ${tokenAfterRevocation}`)
    .send({ motDePasseActuel: fixture.password, nouveauMotDePasse: newPassword });
  assert.equal(passwordChange.status, 200);
  const tokenAfterPassword = String(passwordChange.body.token || "");
  assert.ok(tokenAfterPassword);

  const obsoleteCurrentToken = await agentOne.get("/api/auth/me").set("Authorization", `Bearer ${tokenAfterRevocation}`);
  assert.equal(obsoleteCurrentToken.status, 401);
  const refreshedCurrentToken = await agentOne.get("/api/auth/me").set("Authorization", `Bearer ${tokenAfterPassword}`);
  assert.equal(refreshedCurrentToken.status, 200);

  const oldPasswordLogin = await request(app).post("/api/auth/login").send({ email: fixture.email, motDePasse: fixture.password });
  assert.equal(oldPasswordLogin.status, 401);
  const newPasswordLogin = await request(app).post("/api/auth/login").send({ email: fixture.email, motDePasse: newPassword });
  assert.equal(newPasswordLogin.status, 200);
}

run()
  .then(() => console.log("OK: integration auth account self-service"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
