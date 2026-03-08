import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";

async function hit(client, path, body = {}) {
  return client.post(path).send(body);
}

async function run() {
  const app = createApp();
  const client = request(app);

  let response = null;
  for (let i = 0; i < 6; i += 1) {
    response = await hit(client, "/api/auth/login", {
      email: "nobody@example.com",
      motDePasse: "bad-password"
    });
  }
  assert.equal(response.status, 429, "la 6e tentative de login doit etre limitee");

  for (let i = 0; i < 5; i += 1) {
    response = await hit(client, "/api/auth/password/forgot", {
      email: `reset-forgot-${Date.now()}-${i}@atelier.local`
    });
    assert.notEqual(response.status, 429, "les 5 premieres demandes forgot ne doivent pas etre bloquees");
  }
  response = await hit(client, "/api/auth/password/forgot", {
    email: `reset-forgot-${Date.now()}-overflow@atelier.local`
  });
  assert.equal(response.status, 429, "la 6e demande forgot doit etre limitee");

  for (let i = 0; i < 5; i += 1) {
    response = await hit(client, "/api/auth/password/reset", {
      token: `token-${i}`,
      nouveauMotDePasse: "Passw0rd!"
    });
    assert.notEqual(response.status, 429, "les 5 premieres demandes reset ne doivent pas etre bloquees");
  }
  response = await hit(client, "/api/auth/password/reset", {
    token: "token-overflow",
    nouveauMotDePasse: "Passw0rd!"
  });
  assert.equal(response.status, 429, "la 6e demande reset doit etre limitee");

  for (let i = 0; i < 20; i += 1) {
    response = await hit(client, "/api/auth/refresh");
    assert.notEqual(response.status, 429, "les 20 premiers refresh ne doivent pas etre bloques");
  }
  response = await hit(client, "/api/auth/refresh");
  assert.equal(response.status, 429, "le 21e refresh doit etre limite");
}

run()
  .then(() => {
    console.log("OK: integration auth rate limit");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
