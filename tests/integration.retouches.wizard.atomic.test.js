import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../src/shared/infrastructure/db.js";
import { RetoucheRepoPg } from "../src/bc-retouches/infrastructure/repositories/retouche-repo-pg.js";
import {
  createAuthenticatedSession,
  createClientViaApi,
  createDefaultParametresPayload,
  ensureDossierSchema,
  openCaisseViaApi,
  saveAtelierParametres,
  withAuth
} from "./helpers/integration-fixtures.js";

const robeMesuresCompletes = {
  longueur: 138
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

async function countRetouchesById(atelierId, idRetouche) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM retouches
     WHERE atelier_id = $1 AND id_retouche = $2`,
    [atelierId, idRetouche]
  );
  return Number(result.rows[0]?.total || 0);
}

async function getRetoucheItems(atelierId, idRetouche) {
  const columnsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'retouche_items'
       AND column_name IN ('mesures_snapshot_json', 'montant_paye')`
  );
  const availableColumns = new Set((columnsResult.rows || []).map((row) => String(row.column_name || "").trim()));
  const result = await pool.query(
    `SELECT id_item, type_retouche, type_habit, description, prix, ${
      availableColumns.has("montant_paye") ? "montant_paye," : "0 AS montant_paye,"
    } ${availableColumns.has("mesures_snapshot_json") ? "mesures_snapshot_json" : "NULL AS mesures_snapshot_json"}
     FROM retouche_items
     WHERE atelier_id = $1 AND id_retouche = $2
     ORDER BY ordre_affichage ASC, date_creation ASC`,
    [atelierId, idRetouche]
  );
  return result.rows;
}

async function getClientLatestMeasures(session, idClient, typeHabit) {
  const response = await withAuth(
    session.client.get(`/api/clients/${encodeURIComponent(idClient)}/mesures/derniere`).query({ typeHabit }),
    session.token
  );
  return response;
}

async function run() {
  await ensureDossierSchema();
  await pool.query("ALTER TABLE retouche_items ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(12,2) NOT NULL DEFAULT 0").catch(() => {});
  const atelierId = `ATELIER_RET_WIZ_${Date.now()}`;
  const session = await createAuthenticatedSession({
    atelierId,
    emailPrefix: "ret-wizard",
    nom: "Retouche Wizard Owner"
  });

  const createPayload = {
    idRetouche: buildTestId("RET"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Alice",
      prenom: "Moke",
      telephone: "+243810101001"
    },
    descriptionRetouche: "Retouche wizard client nouveau",
    typeRetouche: "OURLET",
    montantTotal: 40,
    typeHabit: "ROBE",
    mesuresHabit: robeMesuresCompletes
  };

  const created = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(createPayload);
  assert.equal(created.status, 201, "creation retouche + client attendue");
  assert.equal(created.body?.retouche?.idRetouche, createPayload.idRetouche);
  assert.equal(created.body?.client?.idClient, createPayload.nouveauClient.idClient);
  assert.equal(await countClientsByTelephone(atelierId, createPayload.nouveauClient.telephone), 1, "le client doit exister une seule fois");
  assert.equal(await countRetouchesById(atelierId, createPayload.idRetouche), 1, "la retouche doit exister une seule fois");
  const createdItems = await getRetoucheItems(atelierId, createPayload.idRetouche);
  assert.equal(createdItems.length, 1, "une retouche legacy doit creer un item par defaut");
  assert.equal(createdItems[0]?.type_retouche, "OURLET");

  const multiItemPayload = {
    idRetouche: buildTestId("RET"),
    idClient: createPayload.nouveauClient.idClient,
    descriptionRetouche: "Retouche plusieurs items",
    typeRetouche: "OURLET",
    montantTotal: 0,
    typeHabit: "ROBE",
    mesuresHabit: robeMesuresCompletes,
    items: [
      { typeRetouche: "OURLET", typeHabit: "ROBE", description: "Ourlet bas", prix: 25, mesures: { longueur: 144 } },
      { typeRetouche: "OURLET", typeHabit: "ROBE", description: "Ourlet cote", prix: 18, mesures: { longueur: 132 } }
    ]
  };
  const multiItemCreation = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(multiItemPayload);
  assert.equal(multiItemCreation.status, 201, "une retouche doit supporter plusieurs items pour une seule personne");
  assert.equal(Number(multiItemCreation.body?.retouche?.montantTotal || 0), 43);
  const multiItems = await getRetoucheItems(atelierId, multiItemPayload.idRetouche);
  assert.equal(multiItems.length, 2, "les items retouche doivent etre persistés atomiquement");

  const itemPatched = await withAuth(
    session.client.patch(`/api/retouches/${encodeURIComponent(multiItemPayload.idRetouche)}/items/${encodeURIComponent(multiItems[0].id_item)}`),
    session.token
  ).send({
    description: "Ourlet bas corrige",
    prix: 27,
    mesures: { longueur: 146 }
  });
  assert.equal(itemPatched.status, 200, "un item retouche doit etre modifiable avant paiement");
  const patchedItems = await getRetoucheItems(atelierId, multiItemPayload.idRetouche);
  assert.equal(String(patchedItems[0]?.description || ""), "Ourlet bas corrige");
  assert.equal(Number(patchedItems[0]?.prix || 0), 27);
  assert.equal(Number(patchedItems[0]?.mesures_snapshot_json?.valeurs?.longueur || 0), 146);

  const caisseResponse = await openCaisseViaApi({
    client: session.client,
    token: session.token,
    utilisateur: "integration-test"
  });
  assert.equal(caisseResponse.status, 201, "ouverture caisse attendue");
  const idCaisseJour = String(caisseResponse.body?.idCaisseJour || "");

  const paiementRetouche = await withAuth(
    session.client.post(`/api/retouches/${encodeURIComponent(multiItemPayload.idRetouche)}/paiements/caisse`),
    session.token
  ).send({
    montant: 10,
    idItem: multiItems[1].id_item,
    idCaisseJour,
    utilisateur: "integration-test"
  });
  assert.equal(paiementRetouche.status, 200, "le paiement retouche cible doit reussir");
  const paidItems = await getRetoucheItems(atelierId, multiItemPayload.idRetouche);
  assert.equal(Number(paidItems[0]?.montant_paye || 0), 0, "le paiement cible ne doit pas toucher le premier item retouche");
  assert.equal(Number(paidItems[1]?.montant_paye || 0), 10, "le paiement cible doit etre stocke sur l'item retouche vise");

  const forbiddenPatch = await withAuth(
    session.client.patch(`/api/retouches/${encodeURIComponent(multiItemPayload.idRetouche)}/items/${encodeURIComponent(multiItems[1].id_item)}`),
    session.token
  ).send({
    description: "Ourlet interdit apres paiement"
  });
  assert.equal(forbiddenPatch.status, 400, "un item retouche ne doit plus etre modifiable apres paiement");

  const globalPaymentPayload = {
    idRetouche: buildTestId("RET"),
    idClient: createPayload.nouveauClient.idClient,
    descriptionRetouche: "Retouche paiement global",
    items: [
      { typeRetouche: "OURLET", typeHabit: "ROBE", description: "Ourlet global 1", prix: 20, mesures: { longueur: 142 } },
      { typeRetouche: "OURLET", typeHabit: "ROBE", description: "Ourlet global 2", prix: 15, mesures: { longueur: 138 } }
    ]
  };
  const globalCreation = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(globalPaymentPayload);
  assert.equal(globalCreation.status, 201, "la retouche paiement global doit etre creee");
  const globalPayment = await withAuth(
    session.client.post(`/api/retouches/${encodeURIComponent(globalPaymentPayload.idRetouche)}/paiements/caisse`),
    session.token
  ).send({
    montant: 12,
    idCaisseJour,
    utilisateur: "integration-test"
  });
  assert.equal(globalPayment.status, 200, "le paiement global retouche doit reussir");
  const globalItems = await getRetoucheItems(atelierId, globalPaymentPayload.idRetouche);
  assert.equal(Number(globalItems[0]?.montant_paye || 0), 0, "la redistribution globale retouche ne doit pas ecrire un paiement cible sur item");
  assert.equal(Number(globalItems[1]?.montant_paye || 0), 0, "la redistribution globale retouche reste uniquement globale");

  assert.equal(multiItems[0]?.type_habit, "ROBE");
  assert.equal(Number(patchedItems[0]?.mesures_snapshot_json?.valeurs?.longueur || 0), 146);
  assert.equal(Number(multiItems[1]?.mesures_snapshot_json?.valeurs?.longueur || 0), 132);

  const retoucheRepo = new RetoucheRepoPg(atelierId);
  const rehydratedRetouche = await retoucheRepo.getById(multiItemPayload.idRetouche);
  assert.equal(Array.isArray(rehydratedRetouche?.items), true);
  assert.equal(rehydratedRetouche?.items?.length, 2);
  assert.equal(rehydratedRetouche?.items?.[0]?.typeRetouche, "OURLET");
  assert.equal(rehydratedRetouche?.items?.[0]?.typeHabit, "ROBE");
  assert.equal(Number(rehydratedRetouche?.items?.[1]?.mesures?.valeurs?.longueur || 0), 132);
  assert.equal(Number(rehydratedRetouche?.montantTotal || 0), 45);

  const itemDrivenPayload = {
    idRetouche: buildTestId("RET"),
    idClient: createPayload.nouveauClient.idClient,
    descriptionRetouche: "Retouche pilotee par items",
    items: [
      { typeRetouche: "OURLET", typeHabit: "ROBE", description: "Ourlet principal", prix: 22, mesures: { longueur: 140 } },
      { typeRetouche: "OURLET", typeHabit: "ROBE", description: "Ourlet secondaire", prix: 14, mesures: { longueur: 136 } }
    ]
  };
  const itemDrivenCreation = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(itemDrivenPayload);
  assert.equal(itemDrivenCreation.status, 201, "une retouche doit pouvoir etre creee depuis les items sans champs globaux");
  assert.equal(Number(itemDrivenCreation.body?.retouche?.montantTotal || 0), 36);
  assert.equal(String(itemDrivenCreation.body?.retouche?.typeRetouche || ""), "OURLET");
  assert.equal(String(itemDrivenCreation.body?.retouche?.typeHabit || ""), "ROBE");

  const replay = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(createPayload);
  assert.equal(replay.status, 200, "rejouer la meme creation doit renvoyer la retouche existante");
  assert.equal(await countClientsByTelephone(atelierId, createPayload.nouveauClient.telephone), 1, "aucun doublon client ne doit etre cree");
  assert.equal(await countRetouchesById(atelierId, createPayload.idRetouche), 1, "aucun doublon retouche ne doit etre cree");

  const invalidPayload = {
    idRetouche: buildTestId("RET"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Client",
      prenom: "Orphelin",
      telephone: "+243810101002"
    },
    descriptionRetouche: "Retouche invalide",
    typeRetouche: "OURLET",
    montantTotal: 55,
    typeHabit: "ROBE",
    mesuresHabit: {}
  };

  const invalidCreation = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(invalidPayload);
  assert.equal(invalidCreation.status, 400, "la retouche invalide doit etre refusee");
  assert.equal(await countClientsByTelephone(atelierId, invalidPayload.nouveauClient.telephone), 0, "aucun client orphelin ne doit etre cree");
  assert.equal(await countRetouchesById(atelierId, invalidPayload.idRetouche), 0, "aucune retouche invalide ne doit etre creee");

  const duplicatePhoneClient = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Jean",
    prenom: "Diallo",
    telephone: "+243810101003"
  });
  assert.equal(duplicatePhoneClient.status, 201, "client prealable attendu pour le test doublon telephone");
  const existingPhoneClientId = String(duplicatePhoneClient.body?.client?.idClient || "");

  const duplicatePhonePayload = {
    idRetouche: buildTestId("RET"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Jean",
      prenom: "Diallo",
      telephone: "+243810101003"
    },
    descriptionRetouche: "Retouche doublon telephone",
    typeRetouche: "OURLET",
    montantTotal: 45,
    typeHabit: "ROBE",
    mesuresHabit: robeMesuresCompletes
  };

  const duplicatePhone = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(duplicatePhonePayload);
  assert.equal(duplicatePhone.status, 409, "le doublon telephone doit etre bloque");
  assert.equal(duplicatePhone.body?.code, "CLIENT_DUPLICATE_PHONE");
  assert.equal(duplicatePhone.body?.existingClient?.idClient, existingPhoneClientId);
  assert.equal(await countClientsByTelephone(atelierId, duplicatePhonePayload.nouveauClient.telephone), 1, "aucun nouveau client ne doit etre cree");
  assert.equal(await countRetouchesById(atelierId, duplicatePhonePayload.idRetouche), 0, "aucune retouche ne doit etre creee sur conflit telephone");

  const probableDuplicateClient = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Marie",
    prenom: "Samba",
    telephone: "+243810101004"
  });
  assert.equal(probableDuplicateClient.status, 201, "client prealable attendu pour le test doublon probable");
  const probableDuplicateClientId = String(probableDuplicateClient.body?.client?.idClient || "");

  const probableDuplicatePayload = {
    idRetouche: buildTestId("RET"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Marie",
      prenom: "Samba",
      telephone: "+243810109999"
    },
    descriptionRetouche: "Retouche doublon probable",
    typeRetouche: "OURLET",
    montantTotal: 60,
    typeHabit: "ROBE",
    mesuresHabit: robeMesuresCompletes
  };

  const probableDuplicate = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(probableDuplicatePayload);
  assert.equal(probableDuplicate.status, 409, "le doublon probable doit etre signale");
  assert.equal(probableDuplicate.body?.code, "CLIENT_DUPLICATE_POSSIBLE");
  assert.equal(Array.isArray(probableDuplicate.body?.probableDuplicates), true);
  assert.equal(probableDuplicate.body?.probableDuplicates.some((row) => row.idClient === probableDuplicateClientId), true);
  assert.equal((await findClientsByIdentity(atelierId, "Marie", "Samba")).length, 1, "aucun doublon nom/prenom ne doit etre cree avant resolution");

  const resolvedDuplicate = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send({
    ...probableDuplicatePayload,
    doublonDecision: {
      action: "UPDATE_EXISTING_PHONE",
      idClient: probableDuplicateClientId
    }
  });
  assert.equal(resolvedDuplicate.status, 201, "la resolution du doublon probable doit permettre la creation");
  assert.equal(resolvedDuplicate.body?.retouche?.idRetouche, probableDuplicatePayload.idRetouche);
  assert.equal(resolvedDuplicate.body?.client?.idClient, probableDuplicateClientId, "le client existant doit etre reutilise");
  assert.equal(resolvedDuplicate.body?.client?.telephone, probableDuplicatePayload.nouveauClient.telephone, "le numero doit etre mis a jour");

  const marieClients = await findClientsByIdentity(atelierId, "Marie", "Samba");
  assert.equal(marieClients.length, 1, "la mise a jour numero ne doit pas creer de doublon client");
  assert.equal(String(marieClients[0]?.telephone || "").trim(), probableDuplicatePayload.nouveauClient.telephone);

  const sansTelephonePayload = {
    idRetouche: buildTestId("RET"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Junior",
      prenom: "SansNumero",
      telephone: ""
    },
    descriptionRetouche: "Retouche sans telephone",
    typeRetouche: "OURLET",
    montantTotal: 35,
    typeHabit: "ROBE",
    mesuresHabit: {
      longueur: 141
    }
  };

  const sansTelephoneCreation = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(sansTelephonePayload);
  assert.equal(sansTelephoneCreation.status, 201, "une retouche avec client sans telephone doit etre autorisee");
  assert.equal(String(sansTelephoneCreation.body?.client?.telephone || ""), "");

  const prefillRetouche = await getClientLatestMeasures(session, sansTelephonePayload.nouveauClient.idClient, "ROBE");
  assert.equal(prefillRetouche.status, 200, "la retouche doit aussi mettre a jour la derniere mesure connue");
  assert.equal(Number(prefillRetouche.body?.prefill?.mesuresHabit?.valeurs?.longueur || 0), 141);

  const probableSansNumeroPayload = {
    idRetouche: buildTestId("RET"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Junior",
      prenom: "SansNumero",
      telephone: ""
    },
    descriptionRetouche: "Retouche doublon probable sans numero",
    typeRetouche: "OURLET",
    montantTotal: 38,
    typeHabit: "ROBE",
    mesuresHabit: {
      longueur: 143
    }
  };

  const probableSansNumero = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send(probableSansNumeroPayload);
  assert.equal(probableSansNumero.status, 409, "un doublon probable sans telephone doit etre signale");
  assert.equal(probableSansNumero.body?.code, "CLIENT_DUPLICATE_POSSIBLE");

  const confirmSansNumero = await withAuth(session.client.post("/api/retouches/wizard"), session.token).send({
    ...probableSansNumeroPayload,
    doublonDecision: {
      action: "CONFIRM_NEW",
      idClient: sansTelephonePayload.nouveauClient.idClient
    }
  });
  assert.equal(confirmSansNumero.status, 201, "la creation reste possible apres confirmation explicite");
  assert.equal((await findClientsByIdentity(atelierId, "Junior", "SansNumero")).length >= 2, true);

  const atelierCustomHabitsId = `ATELIER_RET_CUSTOM_${Date.now()}`;
  const customSession = await createAuthenticatedSession({
    atelierId: atelierCustomHabitsId,
    emailPrefix: "ret-wizard-custom",
    nom: "Retouche Wizard Custom"
  });
  await saveAtelierParametres({
    atelierId: atelierCustomHabitsId,
    payload: createDefaultParametresPayload({
      retouches: {
        mesuresOptionnelles: true,
        saisiePartielle: true,
        descriptionObligatoire: false,
        typesRetouche: []
      },
      habits: {
        VESTE: {
          label: "Veste",
          actif: true,
          ordre: 1,
          mesures: [
            { code: "poitrine", label: "Poitrine", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
            { code: "longueurManches", label: "Longueur manches", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" }
          ]
        }
      }
    })
  });
  const customClient = await createClientViaApi({
    client: customSession.client,
    token: customSession.token,
    nom: "Custom",
    prenom: "Retouche",
    telephone: "+243810101778"
  });
  assert.equal(customClient.status, 201);
  const customHabitCreation = await withAuth(customSession.client.post("/api/retouches/wizard"), customSession.token).send({
    idRetouche: buildTestId("RET"),
    idClient: customClient.body?.client?.idClient,
    descriptionRetouche: "Retouche veste custom",
    items: [
      {
        typeRetouche: "REPARATION",
        typeHabit: "VESTE",
        description: "Ajustement veste",
        prix: 25
      }
    ]
  });
  assert.equal(customHabitCreation.status, 201, "une retouche doit accepter un type d'habit configure par atelier");
}

run()
  .then(() => {
    console.log("OK: integration retouches wizard atomic");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
