import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../src/shared/infrastructure/db.js";
import { createAuthenticatedSession, createClientViaApi, withAuth } from "./helpers/integration-fixtures.js";

const pantalonMesuresCompletes = {
  longueur: 105,
  tourTaille: 82,
  tourHanche: 96,
  largeurBas: 20,
  hauteurFourche: 28
};

function buildTestId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function countClientsByTelephone(atelierId, telephone) {
  const normalizedTelephone = String(telephone || "").replace(/\D/g, "");
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM clients
     WHERE atelier_id = $1
       AND regexp_replace(COALESCE(telephone, ''), '[^0-9]', '', 'g') = $2`,
    [atelierId, normalizedTelephone]
  );
  return Number(result.rows[0]?.total || 0);
}

async function findClientsByIdentity(atelierId, nom, prenom) {
  const result = await pool.query(
    `SELECT id_client, telephone
     FROM clients
     WHERE atelier_id = $1
       AND LOWER(TRIM(nom)) = LOWER(TRIM($2))
       AND LOWER(TRIM(prenom)) = LOWER(TRIM($3))
     ORDER BY date_creation DESC`,
    [atelierId, String(nom || "").trim(), String(prenom || "").trim()]
  );
  return result.rows;
}

async function countCommandesById(atelierId, idCommande) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM commandes
     WHERE atelier_id = $1 AND id_commande = $2`,
    [atelierId, idCommande]
  );
  return Number(result.rows[0]?.total || 0);
}

async function run() {
  const atelierId = `ATELIER_CMD_WIZ_${Date.now()}`;
  const session = await createAuthenticatedSession({
    atelierId,
    emailPrefix: "cmd-wizard",
    nom: "Commande Wizard Owner"
  });

  const createPayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Alice",
      prenom: "Moke",
      telephone: "+243810001001"
    },
    descriptionCommande: "Commande wizard client nouveau",
    montantTotal: 140,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes
  };

  const created = await withAuth(session.client.post("/api/commandes"), session.token).send(createPayload);
  assert.equal(created.status, 201, "creation commande + client attendue");
  assert.equal(created.body?.commande?.idCommande, createPayload.idCommande);
  assert.equal(created.body?.client?.idClient, createPayload.nouveauClient.idClient);
  assert.equal(await countClientsByTelephone(atelierId, createPayload.nouveauClient.telephone), 1, "le client doit exister une seule fois");
  assert.equal(await countCommandesById(atelierId, createPayload.idCommande), 1, "la commande doit exister une seule fois");

  const replay = await withAuth(session.client.post("/api/commandes"), session.token).send(createPayload);
  assert.equal(replay.status, 200, "rejouer la meme creation doit renvoyer la commande existante");
  assert.equal(await countClientsByTelephone(atelierId, createPayload.nouveauClient.telephone), 1, "aucun doublon client ne doit etre cree");
  assert.equal(await countCommandesById(atelierId, createPayload.idCommande), 1, "aucun doublon commande ne doit etre cree");

  const invalidPayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Client",
      prenom: "Orphelin",
      telephone: "+243810001002"
    },
    descriptionCommande: "Commande invalide",
    montantTotal: 120,
    typeHabit: "PANTALON",
    mesuresHabit: {
      longueur: 102
    }
  };

  const invalidCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(invalidPayload);
  assert.equal(invalidCreation.status, 400, "la commande invalide doit etre refusee");
  assert.equal(await countClientsByTelephone(atelierId, invalidPayload.nouveauClient.telephone), 0, "aucun client orphelin ne doit etre cree");
  assert.equal(await countCommandesById(atelierId, invalidPayload.idCommande), 0, "aucune commande invalide ne doit etre creee");

  const duplicatePhoneClient = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Jean",
    prenom: "Diallo",
    telephone: "+243810001003"
  });
  assert.equal(duplicatePhoneClient.status, 201, "client prealable attendu pour le test doublon telephone");
  const existingPhoneClientId = String(duplicatePhoneClient.body?.client?.idClient || "");

  const duplicatePhonePayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Jean",
      prenom: "Diallo",
      telephone: "+243810001003"
    },
    descriptionCommande: "Commande doublon telephone",
    montantTotal: 150,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes
  };

  const duplicatePhone = await withAuth(session.client.post("/api/commandes"), session.token).send(duplicatePhonePayload);
  assert.equal(duplicatePhone.status, 409, "le doublon telephone doit etre bloque");
  assert.equal(duplicatePhone.body?.code, "CLIENT_DUPLICATE_PHONE");
  assert.equal(duplicatePhone.body?.existingClient?.idClient, existingPhoneClientId);
  assert.equal(await countClientsByTelephone(atelierId, duplicatePhonePayload.nouveauClient.telephone), 1, "aucun nouveau client ne doit etre cree");
  assert.equal(await countCommandesById(atelierId, duplicatePhonePayload.idCommande), 0, "aucune commande ne doit etre creee sur conflit telephone");

  const probableDuplicateClient = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Marie",
    prenom: "Samba",
    telephone: "+243810001004"
  });
  assert.equal(probableDuplicateClient.status, 201, "client prealable attendu pour le test doublon probable");
  const probableDuplicateClientId = String(probableDuplicateClient.body?.client?.idClient || "");

  const probableDuplicatePayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Marie",
      prenom: "Samba",
      telephone: "+243810009999"
    },
    descriptionCommande: "Commande doublon probable",
    montantTotal: 165,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes
  };

  const probableDuplicate = await withAuth(session.client.post("/api/commandes"), session.token).send(probableDuplicatePayload);
  assert.equal(probableDuplicate.status, 409, "le doublon probable doit etre signale");
  assert.equal(probableDuplicate.body?.code, "CLIENT_DUPLICATE_POSSIBLE");
  assert.equal(Array.isArray(probableDuplicate.body?.probableDuplicates), true);
  assert.equal(probableDuplicate.body?.probableDuplicates.some((row) => row.idClient === probableDuplicateClientId), true);
  assert.equal((await findClientsByIdentity(atelierId, "Marie", "Samba")).length, 1, "aucun doublon nom/prenom ne doit etre cree avant resolution");

  const resolvedDuplicate = await withAuth(session.client.post("/api/commandes"), session.token).send({
    ...probableDuplicatePayload,
    doublonDecision: {
      action: "UPDATE_EXISTING_PHONE",
      idClient: probableDuplicateClientId
    }
  });
  assert.equal(resolvedDuplicate.status, 201, "la resolution du doublon probable doit permettre la creation");
  assert.equal(resolvedDuplicate.body?.commande?.idCommande, probableDuplicatePayload.idCommande);
  assert.equal(resolvedDuplicate.body?.client?.idClient, probableDuplicateClientId, "le client existant doit etre reutilise");
  assert.equal(resolvedDuplicate.body?.client?.telephone, probableDuplicatePayload.nouveauClient.telephone, "le numero doit etre mis a jour");

  const marieClients = await findClientsByIdentity(atelierId, "Marie", "Samba");
  assert.equal(marieClients.length, 1, "la mise a jour numero ne doit pas creer de doublon client");
  assert.equal(String(marieClients[0]?.telephone || "").trim(), probableDuplicatePayload.nouveauClient.telephone);
}

run()
  .then(() => {
    console.log("OK: integration commandes wizard atomic");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
