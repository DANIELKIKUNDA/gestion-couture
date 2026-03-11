import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";

async function run() {
  const client = request(createApp());
  const response = await client.get("/health");

  assert.equal(response.status, 200, "/health doit repondre 200");
  assert.deepEqual(response.body, {
    ok: true,
    service: "atelier-backend"
  });
}

run()
  .then(() => {
    console.log("OK: integration health");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
