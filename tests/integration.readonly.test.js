import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { createAuthenticatedSession, withAuth } from "./helpers/integration-fixtures.js";

async function run() {
  const session = await createAuthenticatedSession({
    atelierId: `ATELIER_READONLY_${Date.now()}`,
    role: ROLES.COUTURIER,
    permissions: [PERMISSIONS.VOIR_CLIENTS, PERMISSIONS.VOIR_COMMANDES, PERMISSIONS.VOIR_RETOUCHES],
    emailPrefix: "readonly",
    nom: "Readonly User"
  });

  const clients = await withAuth(session.client.get("/api/clients"), session.token);
  assert.equal(clients.status, 200, "lecture clients doit etre autorisee");
  assert.equal(Array.isArray(clients.body), true, "liste clients doit etre un tableau");

  const commandes = await withAuth(session.client.get("/api/commandes"), session.token);
  assert.equal(commandes.status, 200, "lecture commandes doit etre autorisee");
  assert.equal(Array.isArray(commandes.body), true, "liste commandes doit etre un tableau");

  const retouches = await withAuth(session.client.get("/api/retouches"), session.token);
  assert.equal(retouches.status, 200, "lecture retouches doit etre autorisee");
  assert.equal(Array.isArray(retouches.body), true, "liste retouches doit etre un tableau");

  const createClient = await withAuth(session.client.post("/api/clients"), session.token).send({
    nom: "Refus",
    prenom: "Client",
    telephone: "+243810000001"
  });
  assert.equal(createClient.status, 403, "creation client doit etre refusee en mode lecture seule");

  const createCommande = await withAuth(session.client.post("/api/commandes"), session.token).send({
    idClient: "CL-READONLY",
    descriptionCommande: "Commande interdite",
    montantTotal: 150
  });
  assert.equal(createCommande.status, 403, "creation commande doit etre refusee en mode lecture seule");

  const createRetouche = await withAuth(session.client.post("/api/retouches"), session.token).send({
    idClient: "CL-READONLY",
    descriptionRetouche: "Retouche interdite",
    typeRetouche: "OURLET",
    montantTotal: 30,
    typeHabit: "ROBE",
    mesuresHabit: { longueur: 98 }
  });
  assert.equal(createRetouche.status, 403, "creation retouche doit etre refusee en mode lecture seule");
}

run()
  .then(() => {
    console.log("OK: integration readonly");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
