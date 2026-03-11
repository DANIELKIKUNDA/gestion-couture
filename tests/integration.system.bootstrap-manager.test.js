import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";

async function run() {
  const app = createApp();
  const client = request(app);

  const status = await client.get("/api/system/bootstrap-manager/status");
  assert.equal(status.status, 200, "status bootstrap manager systeme doit repondre 200");
  assert.equal(typeof status.body?.initialized, "boolean", "status bootstrap manager systeme doit exposer initialized");

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const email = `manager.system.bootstrap.${suffix}@atelier.local`;
  const password = "Passw0rd!ManagerSysteme";

  const bootstrap = await client.post("/api/system/bootstrap-manager").send({
    nom: "Manager Systeme Bootstrap",
    email,
    motDePasse: password
  });

  if (status.body?.initialized === true) {
    assert.equal(bootstrap.status, 409, "bootstrap manager systeme doit etre refuse si deja initialise");
    assert.equal(bootstrap.body?.error, "Manager systeme deja initialise");
    return;
  }

  assert.equal(bootstrap.status, 201, "bootstrap manager systeme doit creer le premier manager");
  assert.equal(bootstrap.body?.utilisateur?.roleId, ROLES.MANAGER_SYSTEME, "role bootstrap manager systeme incorrect");

  const login = await client.post("/api/auth/login").send({
    email,
    motDePasse: password
  });
  assert.equal(login.status, 200, "login manager systeme bootstrap doit repondre 200");
  assert.equal(login.body?.utilisateur?.roleId, ROLES.MANAGER_SYSTEME, "role login manager systeme incorrect");

  const token = String(login.body?.token || "");
  assert.ok(token, "token manager systeme bootstrap manquant");

  const ateliers = await client.get("/api/system/ateliers").set("Authorization", `Bearer ${token}`);
  assert.equal(ateliers.status, 200, "liste ateliers manager systeme doit repondre 200");
}

run()
  .then(() => {
    console.log("OK: integration system bootstrap manager");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
