import assert from "node:assert/strict";

import {
  createAuthenticatedSession,
  createClientViaApi,
  createRetoucheViaApi,
  openCaisseViaApi,
  withAuth
} from "./helpers/integration-fixtures.js";

async function run() {
  const session = await createAuthenticatedSession({
    atelierId: `ATELIER_CANCEL_RET_${Date.now()}`,
    emailPrefix: "cancel-retouche",
    nom: "Retouche Cancel Owner"
  });

  const clientResponse = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Client",
    prenom: "Retouche",
    telephone: "+243810000030"
  });
  assert.equal(clientResponse.status, 201, "creation client attendue");
  const idClient = String(clientResponse.body?.client?.idClient || "");

  const retoucheResponse = await createRetoucheViaApi({
    client: session.client,
    token: session.token,
    idClient,
    descriptionRetouche: "Retouche a annuler"
  });
  assert.equal(retoucheResponse.status, 201, "creation retouche attendue");
  const idRetouche = String(retoucheResponse.body?.idRetouche || "");

  const caisseResponse = await openCaisseViaApi({
    client: session.client,
    token: session.token,
    utilisateur: "Retouche Cancel Owner",
    soldeOuverture: 200
  });
  assert.equal(caisseResponse.status, 201, "ouverture caisse attendue");
  const idCaisseJour = String(caisseResponse.body?.idCaisseJour || "");

  const payment = await withAuth(
    session.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements/caisse`),
    session.token
  ).send({
    montant: 15,
    idCaisseJour,
    utilisateur: "Retouche Cancel Owner"
  });
  assert.equal(payment.status, 200, "paiement retouche via caisse attendu");
  assert.equal(Number(payment.body?.montantPaye), 15);
  assert.equal(payment.body?.statutRetouche, "EN_COURS");

  const cancel = await withAuth(
    session.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/annuler`),
    session.token
  ).send({
    idCaisseJour,
    utilisateur: "Retouche Cancel Owner"
  });
  assert.equal(cancel.status, 200, "annulation retouche attendue");
  assert.equal(cancel.body?.statutRetouche, "ANNULEE");

  const detail = await withAuth(session.client.get(`/api/retouches/${encodeURIComponent(idRetouche)}`), session.token);
  assert.equal(detail.status, 200, "detail retouche annulee doit rester accessible");
  assert.equal(detail.body?.statutRetouche, "ANNULEE");

  const payments = await withAuth(session.client.get(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements`), session.token);
  assert.equal(payments.status, 200, "liste operations retouche attendue");
  assert.equal(payments.body.length, 2, "paiement + remboursement attendus");
  assert.equal(payments.body.some((row) => row.motif === "PAIEMENT_RETOUCHE" && row.typeOperation === "ENTREE"), true);
  assert.equal(payments.body.some((row) => row.motif === "REMBOURSEMENT_RETOUCHE_ANNULEE" && row.typeOperation === "SORTIE"), true);
}

run()
  .then(() => {
    console.log("OK: integration retouches annulation");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
