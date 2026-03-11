import assert from "node:assert/strict";

import {
  createAuthenticatedSession,
  createClientViaApi,
  createCommandeViaApi,
  createRetoucheViaApi,
  withAuth
} from "./helpers/integration-fixtures.js";

async function run() {
  const session = await createAuthenticatedSession({
    atelierId: `ATELIER_PAYMENTS_${Date.now()}`,
    emailPrefix: "payments",
    nom: "Payments Owner"
  });

  const clientResponse = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Client",
    prenom: "Atomic",
    telephone: "+243810000010"
  });
  assert.equal(clientResponse.status, 201, "creation client prealable attendue");
  const idClient = String(clientResponse.body?.client?.idClient || "");

  const commandeResponse = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient,
    descriptionCommande: "Commande atomic"
  });
  assert.equal(commandeResponse.status, 201, "creation commande attendue");
  const idCommande = String(commandeResponse.body?.idCommande || "");

  const retoucheResponse = await createRetoucheViaApi({
    client: session.client,
    token: session.token,
    idClient,
    descriptionRetouche: "Retouche atomic"
  });
  assert.equal(retoucheResponse.status, 201, "creation retouche attendue");
  const idRetouche = String(retoucheResponse.body?.idRetouche || "");

  const invalidCommandePayment = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/paiements/caisse`),
    session.token
  ).send({
    montant: 25,
    idCaisseJour: "CAISSE-ABSENTE",
    utilisateur: "Payments Owner"
  });
  assert.equal(invalidCommandePayment.status, 400, "paiement commande sur caisse absente doit etre refuse");
  assert.equal(invalidCommandePayment.body?.error, "Caisse introuvable");

  const commande = await withAuth(session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}`), session.token);
  assert.equal(commande.status, 200, "detail commande doit rester accessible");
  assert.equal(Number(commande.body?.montantPaye), 0, "paiement commande ne doit pas etre applique");
  assert.equal(commande.body?.statutCommande, "CREEE", "statut commande ne doit pas changer");

  const commandePayments = await withAuth(session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/paiements`), session.token);
  assert.equal(commandePayments.status, 200, "liste paiements commande doit repondre 200");
  assert.deepEqual(commandePayments.body, [], "aucune operation caisse ne doit etre creee pour la commande");

  const invalidRetouchePayment = await withAuth(
    session.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements/caisse`),
    session.token
  ).send({
    montant: 15,
    idCaisseJour: "CAISSE-ABSENTE",
    utilisateur: "Payments Owner"
  });
  assert.equal(invalidRetouchePayment.status, 400, "paiement retouche sur caisse absente doit etre refuse");
  assert.equal(invalidRetouchePayment.body?.error, "Caisse introuvable");

  const retouche = await withAuth(session.client.get(`/api/retouches/${encodeURIComponent(idRetouche)}`), session.token);
  assert.equal(retouche.status, 200, "detail retouche doit rester accessible");
  assert.equal(Number(retouche.body?.montantPaye), 0, "paiement retouche ne doit pas etre applique");
  assert.equal(retouche.body?.statutRetouche, "DEPOSEE", "statut retouche ne doit pas changer");

  const retouchePayments = await withAuth(session.client.get(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements`), session.token);
  assert.equal(retouchePayments.status, 200, "liste paiements retouche doit repondre 200");
  assert.deepEqual(retouchePayments.body, [], "aucune operation caisse ne doit etre creee pour la retouche");
}

run()
  .then(() => {
    console.log("OK: integration paiements atomic");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
