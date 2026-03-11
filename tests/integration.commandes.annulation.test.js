import assert from "node:assert/strict";

import {
  createAuthenticatedSession,
  createClientViaApi,
  createCommandeViaApi,
  openCaisseViaApi,
  createDefaultParametresPayload,
  saveAtelierParametres,
  withAuth
} from "./helpers/integration-fixtures.js";

async function run() {
  const atelierId = `ATELIER_CANCEL_CMD_${Date.now()}`;
  const session = await createAuthenticatedSession({
    atelierId,
    emailPrefix: "cancel-commande",
    nom: "Commande Cancel Owner"
  });

  await saveAtelierParametres({
    atelierId,
    payload: createDefaultParametresPayload({
      commandes: {
        autoriserAnnulationApresPaiement: true
      }
    })
  });

  const clientResponse = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Client",
    prenom: "Commande",
    telephone: "+243810000020"
  });
  assert.equal(clientResponse.status, 201, "creation client attendue");
  const idClient = String(clientResponse.body?.client?.idClient || "");

  const commandeResponse = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient,
    descriptionCommande: "Commande a annuler"
  });
  assert.equal(commandeResponse.status, 201, "creation commande attendue");
  const idCommande = String(commandeResponse.body?.idCommande || "");

  const caisseResponse = await openCaisseViaApi({
    client: session.client,
    token: session.token,
    utilisateur: "Commande Cancel Owner",
    soldeOuverture: 200
  });
  assert.equal(caisseResponse.status, 201, "ouverture caisse attendue");
  const idCaisseJour = String(caisseResponse.body?.idCaisseJour || "");

  const payment = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/paiements/caisse`),
    session.token
  ).send({
    montant: 50,
    idCaisseJour,
    utilisateur: "Commande Cancel Owner"
  });
  assert.equal(payment.status, 200, "paiement commande via caisse attendu");
  assert.equal(Number(payment.body?.montantPaye), 50);
  assert.equal(payment.body?.statutCommande, "EN_COURS");

  const cancel = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/annuler`),
    session.token
  ).send({
    idCaisseJour,
    utilisateur: "Commande Cancel Owner"
  });
  assert.equal(cancel.status, 200, "annulation commande attendue");
  assert.equal(cancel.body?.statutCommande, "ANNULEE");

  const detail = await withAuth(session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}`), session.token);
  assert.equal(detail.status, 200, "detail commande annulee doit rester accessible");
  assert.equal(detail.body?.statutCommande, "ANNULEE");

  const payments = await withAuth(session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/paiements`), session.token);
  assert.equal(payments.status, 200, "liste operations commande attendue");
  assert.equal(payments.body.length, 2, "paiement + remboursement attendus");
  assert.equal(payments.body.some((row) => row.motif === "PAIEMENT_COMMANDE" && row.typeOperation === "ENTREE"), true);
  assert.equal(payments.body.some((row) => row.motif === "REMBOURSEMENT_COMMANDE_ANNULEE" && row.typeOperation === "SORTIE"), true);
}

run()
  .then(() => {
    console.log("OK: integration commandes annulation");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
