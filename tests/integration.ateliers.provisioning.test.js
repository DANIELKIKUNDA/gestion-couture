import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";

async function run() {
  const app = createApp();
  const client = request(app);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const slug = `atelier-${suffix}`;
  const email = `owner.provisioning.${suffix}@atelier.local`;
  const password = "Passw0rd!Provisioning";

  const create = await client.post("/api/ateliers").send({
    nomAtelier: "Atelier Provisioning",
    slug,
    proprietaire: {
      nom: "Owner Provisioning",
      email,
      motDePasse: password
    }
  });
  assert.equal(create.status, 201, "creation atelier doit repondre 201");
  assert.ok(String(create.body?.atelier?.idAtelier || "").startsWith("ATL-"), "id atelier genere incorrect");
  assert.equal(create.body?.atelier?.slug, slug, "slug atelier retourne incorrect");
  assert.equal(create.body?.proprietaire?.email, email, "email proprietaire retourne incorrect");
  assert.equal(create.body?.proprietaire?.atelierId, create.body?.atelier?.idAtelier, "atelier du proprietaire incorrect");

  const duplicateSlug = await client.post("/api/ateliers").send({
    nomAtelier: "Atelier Duplicate",
    slug,
    proprietaire: {
      nom: "Owner Duplicate",
      email: `other.${suffix}@atelier.local`,
      motDePasse: password
    }
  });
  assert.equal(duplicateSlug.status, 409, "slug atelier duplique doit etre refuse");

  const status = await client.get("/api/auth/bootstrap-owner/status").set("X-Atelier-Slug", slug);
  assert.equal(status.status, 200, "status bootstrap-owner pour atelier cree doit repondre 200");
  assert.equal(status.body?.atelierExists, true, "atelier cree doit etre detecte");
  assert.equal(status.body?.initialized, true, "atelier provisionne doit etre initialise");
  assert.equal(status.body?.atelier?.slug, slug, "slug atelier status incorrect");

  const loginWrongSlug = await client.post("/api/auth/login").send({
    email,
    motDePasse: password,
    atelierSlug: `${slug}-absent`
  });
  assert.equal(loginWrongSlug.status, 401, "login avec mauvais slug doit etre refuse");

  const login = await client.post("/api/auth/login").send({
    email,
    motDePasse: password,
    atelierSlug: slug
  });
  assert.equal(login.status, 200, "login avec slug atelier doit repondre 200");
  assert.equal(login.body?.utilisateur?.atelierId, create.body?.atelier?.idAtelier, "atelierId utilisateur login incorrect");
  const token = String(login.body?.token || "");
  assert.ok(token, "token login atelier manquant");

  const current = await client.get("/api/ateliers/current").set("Authorization", `Bearer ${token}`);
  assert.equal(current.status, 200, "recuperation atelier courant doit repondre 200");
  assert.equal(current.body?.slug, slug, "atelier courant incorrect");
  assert.equal(current.body?.idAtelier, create.body?.atelier?.idAtelier, "id atelier courant incorrect");
}

run()
  .then(() => {
    console.log("OK: integration ateliers provisioning");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
