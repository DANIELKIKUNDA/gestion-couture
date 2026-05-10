import assert from "node:assert/strict";

import { pool } from "../src/shared/infrastructure/db.js";
import {
  createAuthenticatedSession,
  createClientViaApi,
  createCommandeViaApi,
  createRetoucheViaApi,
  openCaisseViaApi,
  withAuth
} from "./helpers/integration-fixtures.js";

async function countOperations({ atelierId, idCaisseJour, idempotencyKey }) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM caisse_operation
     WHERE atelier_id = $1
       AND id_caisse_jour = $2
       AND idempotency_key = $3`,
    [atelierId, idCaisseJour, idempotencyKey]
  );
  return Number(result.rows[0]?.total || 0);
}

async function createStockArticle(session) {
  const response = await withAuth(session.client.post("/api/stock/articles"), session.token).send({
    nomArticle: `Pagne idem ${Date.now()}`,
    categorieArticle: "TISSU",
    uniteStock: "PIECE",
    quantiteDisponible: 5,
    prixAchatInitial: 20,
    prixVenteUnitaire: 30,
    seuilAlerte: 1
  });
  assert.equal(response.status, 201);
  return response.body;
}

async function run() {
  const session = await createAuthenticatedSession({
    atelierId: `ATELIER_IDEM_${Date.now()}`,
    emailPrefix: "idem",
    nom: "Idem Owner"
  });

  const clientResponse = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Client",
    prenom: "Idem"
  });
  assert.equal(clientResponse.status, 201);
  const idClient = clientResponse.body?.client?.idClient || clientResponse.body?.idClient;
  assert.ok(idClient);

  const caisseResponse = await openCaisseViaApi({ client: session.client, token: session.token, soldeOuverture: 500 });
  assert.equal(caisseResponse.status, 201);
  const idCaisseJour = caisseResponse.body?.idCaisseJour;
  assert.ok(idCaisseJour);

  const commandeResponse = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient,
    montantTotal: 100
  });
  assert.equal(commandeResponse.status, 201);
  const idCommande = commandeResponse.body?.idCommande || commandeResponse.body?.commande?.idCommande;
  const commandeKey = `idem-commande-${Date.now()}`;
  const commandePayload = { montant: 40, idCaisseJour, utilisateur: "integration", idempotencyKey: commandeKey };
  const commandePay1 = await withAuth(session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/paiements/caisse`), session.token).send(commandePayload);
  assert.equal(commandePay1.status, 200);
  const commandePay2 = await withAuth(session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/paiements/caisse`), session.token).send(commandePayload);
  assert.equal(commandePay2.status, 200);
  assert.equal(await countOperations({ atelierId: session.atelierId, idCaisseJour, idempotencyKey: commandeKey }), 1);
  const commandeConflict = await withAuth(session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/paiements/caisse`), session.token).send({
    ...commandePayload,
    montant: 45
  });
  assert.equal(commandeConflict.status, 409);

  const retoucheResponse = await createRetoucheViaApi({
    client: session.client,
    token: session.token,
    idClient,
    montantTotal: 60
  });
  assert.equal(retoucheResponse.status, 201);
  const idRetouche = retoucheResponse.body?.idRetouche || retoucheResponse.body?.retouche?.idRetouche;
  const retoucheKey = `idem-retouche-${Date.now()}`;
  const retouchePayload = { montant: 20, idCaisseJour, utilisateur: "integration", idempotencyKey: retoucheKey };
  const retouchePay1 = await withAuth(session.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements/caisse`), session.token).send(retouchePayload);
  assert.equal(retouchePay1.status, 200);
  const retouchePay2 = await withAuth(session.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements/caisse`), session.token).send(retouchePayload);
  assert.equal(retouchePay2.status, 200);
  assert.equal(await countOperations({ atelierId: session.atelierId, idCaisseJour, idempotencyKey: retoucheKey }), 1);

  const article = await createStockArticle(session);
  const venteCreate = await withAuth(session.client.post("/api/ventes"), session.token).send({
    lignesVente: [{ idArticle: article.idArticle, quantite: 1 }]
  });
  assert.equal(venteCreate.status, 201);
  const venteKey = `idem-vente-${Date.now()}`;
  const ventePayload = { idCaisseJour, modePaiement: "CASH", utilisateur: "integration", idempotencyKey: venteKey };
  const ventePay1 = await withAuth(session.client.post(`/api/ventes/${encodeURIComponent(venteCreate.body.idVente)}/valider`), session.token).send(ventePayload);
  assert.equal(ventePay1.status, 200);
  const ventePay2 = await withAuth(session.client.post(`/api/ventes/${encodeURIComponent(venteCreate.body.idVente)}/valider`), session.token).send(ventePayload);
  assert.equal(ventePay2.status, 200);
  assert.equal(await countOperations({ atelierId: session.atelierId, idCaisseJour, idempotencyKey: venteKey }), 1);

  const encaisserKey = `idem-vente-encaisser-${Date.now()}`;
  const encaisserPayload = {
    lignesVente: [{ idArticle: article.idArticle, quantite: 1 }],
    acheteurNom: "Acheteur integration",
    idCaisseJour,
    modePaiement: "CASH",
    utilisateur: "integration",
    idempotencyKey: encaisserKey
  };
  const encaisser1 = await withAuth(session.client.post("/api/ventes/encaisser"), session.token).send(encaisserPayload);
  assert.equal(encaisser1.status, 201);
  assert.ok(encaisser1.body?.vente?.idVente);
  assert.ok(encaisser1.body?.facture?.idFacture);
  const encaisser2 = await withAuth(session.client.post("/api/ventes/encaisser"), session.token).send(encaisserPayload);
  assert.equal(encaisser2.status, 200);
  assert.equal(encaisser2.body?.vente?.idVente, encaisser1.body?.vente?.idVente);
  assert.equal(await countOperations({ atelierId: session.atelierId, idCaisseJour, idempotencyKey: encaisserKey }), 1);

  const sortieKey = `idem-sortie-${Date.now()}`;
  const sortiePayload = {
    montant: 10,
    motif: "DEPENSE_TEST",
    typeDepense: "QUOTIDIENNE",
    justification: "",
    idempotencyKey: sortieKey
  };
  const sortie1 = await withAuth(session.client.post(`/api/caisse/${encodeURIComponent(idCaisseJour)}/sorties`), session.token).send(sortiePayload);
  assert.equal(sortie1.status, 200);
  const sortie2 = await withAuth(session.client.post(`/api/caisse/${encodeURIComponent(idCaisseJour)}/sorties`), session.token).send(sortiePayload);
  assert.equal(sortie2.status, 200);
  assert.equal(await countOperations({ atelierId: session.atelierId, idCaisseJour, idempotencyKey: sortieKey }), 1);
}

run()
  .then(() => {
    console.log("OK: integration caisse idempotency");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
