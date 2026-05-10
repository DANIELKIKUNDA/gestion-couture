import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { pool } from "../src/shared/infrastructure/db.js";
import {
  createAuthenticatedSession,
  createClientViaApi,
  createCommandeViaApi,
  createRetoucheViaApi,
  withAuth
} from "./helpers/integration-fixtures.js";

async function countRows(tableName, atelierId, idempotencyKey) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM ${tableName}
     WHERE atelier_id = $1 AND idempotency_key = $2`,
    [atelierId, idempotencyKey]
  );
  return Number(result.rows[0]?.count || 0);
}

async function main() {
  const session = await createAuthenticatedSession({
    permissions: [
      PERMISSIONS.CREER_CLIENT,
      PERMISSIONS.CREER_COMMANDE,
      PERMISSIONS.CREER_RETOUCHE,
      PERMISSIONS.VOIR_CLIENTS,
      PERMISSIONS.VOIR_COMMANDES,
      PERMISSIONS.VOIR_RETOUCHES
    ],
    emailPrefix: "offline-idem"
  });

  const clientKey = `client-idem-${Date.now()}`;
  const clientOne = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Idem",
    prenom: "Client",
    telephone: "+243810000001",
    idempotencyKey: clientKey
  });
  assert.equal(clientOne.status, 201, clientOne.text);

  const clientReplay = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Idem",
    prenom: "Client",
    telephone: "+243810000001",
    idempotencyKey: clientKey
  });
  assert.equal(clientReplay.status, 200, clientReplay.text);
  assert.equal(clientReplay.body.client.idClient, clientOne.body.client.idClient);
  assert.equal(await countRows("clients", session.atelierId, clientKey), 1);

  const clientConflict = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Autre",
    prenom: "Client",
    telephone: "+243810000001",
    idempotencyKey: clientKey
  });
  assert.equal(clientConflict.status, 409, clientConflict.text);

  const clientId = clientOne.body.client.idClient;
  const commandeKey = `commande-idem-${Date.now()}`;
  const commandeOne = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient: clientId,
    descriptionCommande: "Commande idem offline",
    montantTotal: 150,
    idempotencyKey: commandeKey
  });
  assert.equal(commandeOne.status, 201, commandeOne.text);

  const commandeReplay = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient: clientId,
    descriptionCommande: "Commande idem offline",
    montantTotal: 150,
    idempotencyKey: commandeKey
  });
  assert.equal(commandeReplay.status, 200, commandeReplay.text);
  assert.equal(commandeReplay.body.idCommande, commandeOne.body.idCommande);
  assert.equal(await countRows("commandes", session.atelierId, commandeKey), 1);

  const commandeConflict = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient: clientId,
    descriptionCommande: "Commande idem offline",
    montantTotal: 151,
    idempotencyKey: commandeKey
  });
  assert.equal(commandeConflict.status, 409, commandeConflict.text);

  const retoucheKey = `retouche-idem-${Date.now()}`;
  const retoucheOne = await createRetoucheViaApi({
    client: session.client,
    token: session.token,
    idClient: clientId,
    descriptionRetouche: "Retouche idem offline",
    montantTotal: 45,
    idempotencyKey: retoucheKey
  });
  assert.equal(retoucheOne.status, 201, retoucheOne.text);

  const retoucheReplay = await createRetoucheViaApi({
    client: session.client,
    token: session.token,
    idClient: clientId,
    descriptionRetouche: "Retouche idem offline",
    montantTotal: 45,
    idempotencyKey: retoucheKey
  });
  assert.equal(retoucheReplay.status, 200, retoucheReplay.text);
  assert.equal(retoucheReplay.body.idRetouche, retoucheOne.body.idRetouche);
  assert.equal(await countRows("retouches", session.atelierId, retoucheKey), 1);

  const retoucheConflict = await createRetoucheViaApi({
    client: session.client,
    token: session.token,
    idClient: clientId,
    descriptionRetouche: "Retouche idem offline",
    montantTotal: 46,
    idempotencyKey: retoucheKey
  });
  assert.equal(retoucheConflict.status, 409, retoucheConflict.text);

  const oldClient = await withAuth(session.client.post("/api/clients"), session.token).send({
    nom: "Ancien",
    prenom: "Compatible",
    telephone: "+243810000002"
  });
  assert.equal(oldClient.status, 201, oldClient.text);

  console.log("OK: integration offline creations idempotency");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
