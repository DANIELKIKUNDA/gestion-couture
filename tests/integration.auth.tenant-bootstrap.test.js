import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { ensureAtelier } from "./helpers/integration-fixtures.js";

async function run() {
  const app = createApp();
  const client = request(app);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const atelierId = `ATL_BOOT_${Date.now()}`;
  const slug = `bootstrap-${suffix}`;
  const email = `owner.bootstrap.slug.${suffix}@atelier.local`;
  const password = "Passw0rd!Bootstrap";

  await ensureAtelier(atelierId, slug, "Atelier Bootstrap");

  const initialStatus = await client.get("/api/auth/bootstrap-owner/status").set("X-Atelier-Slug", slug);
  assert.equal(initialStatus.status, 200, "status bootstrap-owner cible doit repondre 200");
  assert.equal(initialStatus.body?.atelierExists, true, "atelier cible doit exister");
  assert.equal(initialStatus.body?.initialized, false, "atelier cible ne doit pas etre initialise avant bootstrap");
  assert.equal(initialStatus.body?.atelier?.idAtelier, atelierId, "atelier status cible incorrect");

  const bootstrap = await client
    .post("/api/auth/bootstrap-owner")
    .set("X-Atelier-Slug", slug)
    .send({
      nom: "Owner Bootstrap Slug",
      email,
      motDePasse: password
    });
  assert.equal(bootstrap.status, 201, "bootstrap owner cible par slug doit repondre 201");
  assert.equal(bootstrap.body?.utilisateur?.atelierId, atelierId, "atelierId utilisateur bootstrap incorrect");

  const secondBootstrap = await client
    .post("/api/auth/bootstrap-owner")
    .set("X-Atelier-Slug", slug)
    .send({
      nom: "Owner Bootstrap Slug",
      email: `owner.second.${suffix}@atelier.local`,
      motDePasse: password
    });
  assert.equal(secondBootstrap.status, 409, "second bootstrap du meme atelier doit etre refuse");

  const login = await client.post("/api/auth/login").send({
    email,
    motDePasse: password,
    atelierSlug: slug
  });
  assert.equal(login.status, 200, "login bootstrap avec slug doit repondre 200");
  assert.equal(login.body?.utilisateur?.atelierId, atelierId, "atelierId login bootstrap incorrect");
  const token = String(login.body?.token || "");
  assert.ok(token, "token login bootstrap manquant");

  const me = await client.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(me.status, 200, "/auth/me apres login slug doit repondre 200");
  assert.equal(me.body?.user?.atelierId, atelierId, "atelierId /auth/me incorrect");

  const currentAtelier = await client.get("/api/ateliers/current").set("Authorization", `Bearer ${token}`);
  assert.equal(currentAtelier.status, 200, "/ateliers/current apres login slug doit repondre 200");
  assert.equal(currentAtelier.body?.slug, slug, "slug atelier courant incorrect");

  const wrongSlugLogin = await client.post("/api/auth/login").send({
    email,
    motDePasse: password,
    atelierSlug: "slug-introuvable"
  });
  assert.equal(wrongSlugLogin.status, 401, "login avec slug inexistant doit etre refuse");
}

run()
  .then(() => {
    console.log("OK: integration auth tenant bootstrap");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
