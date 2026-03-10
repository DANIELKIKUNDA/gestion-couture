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

async function run() {
  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();

  const ownerEmail = `owner.integration.${Date.now()}@atelier.local`;
  const ownerPassword = "Passw0rd!owner";
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Owner Integration",
      email: ownerEmail,
      roleId: ROLES.PROPRIETAIRE,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: "ATELIER",
      motDePasseHash: hashPassword(ownerPassword)
    })
  );

  const loginOwner = await client.post("/api/auth/login").send({ email: ownerEmail, motDePasse: ownerPassword });
  assert.equal(loginOwner.status, 200, "1) /api/auth/login doit repondre 200");
  const ownerToken = loginOwner.body?.token || "";
  assert.ok(ownerToken, "token proprietaire manquant");

  const me = await client.get("/api/auth/me").set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(me.status, 200, "2) /api/auth/me avec token doit repondre 200");
  assert.ok(Array.isArray(me.body?.permissions), "permissions[] manquant dans /auth/me");
  assert.equal(me.body?.user?.atelierId, "ATELIER", "atelierId manquant dans /auth/me");

  const commandesNoToken = await client.get("/api/commandes");
  assert.equal(commandesNoToken.status, 401, "3) /api/commandes sans token doit repondre 401");

  const originalPoolQuery = pool.query.bind(pool);
  pool.query = async (text, params) => {
    const sql = String(text || "");
    if (sql.includes("FROM commandes")) return { rows: [], rowCount: 0 };
    return originalPoolQuery(text, params);
  };

  const commandesOwner = await client.get("/api/commandes").set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(commandesOwner.status, 200, "4) /api/commandes avec token proprietaire doit repondre 200");

  const couturierEmail = `couturier.integration.${Date.now()}@atelier.local`;
  const couturierPassword = "Passw0rd!couturier";
  const createUser = await client
    .post("/api/auth/users")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      nom: "Couturier Integration",
      email: couturierEmail,
      motDePasse: couturierPassword,
      roleId: "COUTURIER",
      actif: true
    });
  assert.equal(createUser.status, 201, "creation utilisateur couturier impossible");

  const loginCouturier = await client.post("/api/auth/login").send({ email: couturierEmail, motDePasse: couturierPassword });
  assert.equal(loginCouturier.status, 200, "login couturier impossible");
  const couturierToken = loginCouturier.body?.token || "";
  assert.ok(couturierToken, "token couturier manquant");

  const parametresForbidden = await client
    .get("/api/parametres-atelier")
    .set("Authorization", `Bearer ${couturierToken}`);
  assert.equal(parametresForbidden.status, 403, "5) /api/parametres-atelier non autorise doit repondre 403");

  pool.query = originalPoolQuery;
}

run()
  .then(() => {
    console.log("OK: integration auth/commandes/parametres");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
