import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "../src/shared/infrastructure/db.js";
import { CommandeRepoPg } from "../src/bc-commandes/infrastructure/repositories/commande-repo-pg.js";
import {
  createAuthenticatedSession,
  createClientViaApi,
  createDefaultParametresPayload,
  openCaisseViaApi,
  saveAtelierParametres,
  withAuth
} from "./helpers/integration-fixtures.js";

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

async function getCommandeLignes(atelierId, idCommande) {
  const result = await pool.query(
    `SELECT id_ligne, id_client, role, nom_affiche, prenom_affiche, type_habit, mesures_habit_snapshot, ordre_affichage
     FROM commande_lignes
     WHERE atelier_id = $1 AND id_commande = $2
     ORDER BY ordre_affichage ASC, date_creation ASC`,
    [atelierId, idCommande]
  );
  return result.rows;
}

async function getCommandeItems(atelierId, idCommande) {
  const columnsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'commande_items'
       AND column_name IN ('mesures_snapshot_json', 'montant_paye')`
  );
  const availableColumns = new Set((columnsResult.rows || []).map((row) => String(row.column_name || "").trim()));
  const hasMeasuresColumn = availableColumns.has("mesures_snapshot_json");
  const hasMontantPayeColumn = availableColumns.has("montant_paye");
  const result = await pool.query(
    hasMeasuresColumn
      ? `SELECT id_item, type_habit, description, prix, ${hasMontantPayeColumn ? "montant_paye," : ""} mesures_snapshot_json
         FROM commande_items
         WHERE atelier_id = $1 AND id_commande = $2
         ORDER BY ordre_affichage ASC, date_creation ASC`
      : `SELECT id_item, type_habit, description, prix, ${hasMontantPayeColumn ? "montant_paye" : "0 AS montant_paye"}
         FROM commande_items
         WHERE atelier_id = $1 AND id_commande = $2
         ORDER BY ordre_affichage ASC, date_creation ASC`,
    [atelierId, idCommande]
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
  await pool.query("ALTER TABLE commande_items ADD COLUMN IF NOT EXISTS mesures_snapshot_json JSONB NULL").catch(() => {});
  await pool.query("ALTER TABLE commande_items ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(12,2) NOT NULL DEFAULT 0").catch(() => {});
  await pool.query("ALTER TABLE series_mesures DROP CONSTRAINT IF EXISTS series_mesures_type_vetement_check").catch(() => {});
  await pool.query(
    `ALTER TABLE series_mesures
       ADD CONSTRAINT series_mesures_type_vetement_check
       CHECK (type_vetement ~ '^[A-Z0-9_]+$')`
  ).catch(() => {});
  const atelierId = `ATELIER_CMD_SRP_${Date.now()}`;
  const session = await createAuthenticatedSession({
    atelierId,
    emailPrefix: "cmd-srp",
    nom: "Commande SRP Owner"
  });

  const createPayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Alice",
      prenom: "Moke",
      telephone: ""
    },
    descriptionCommande: "Commande simple client nouveau",
    montantTotal: 140,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes
  };

  const created = await withAuth(session.client.post("/api/commandes"), session.token).send(createPayload);
  assert.equal(created.status, 201, "creation commande + client attendue");
  assert.equal(created.body?.commande?.idCommande, createPayload.idCommande);
  assert.equal(created.body?.client?.idClient, createPayload.nouveauClient.idClient);
  assert.equal(String(created.body?.client?.telephone || ""), "", "le client sans telephone doit etre autorise");
  assert.equal(await countCommandesById(atelierId, createPayload.idCommande), 1);

  const createdLines = await getCommandeLignes(atelierId, createPayload.idCommande);
  assert.equal(createdLines.length, 1, "une commande simple ne doit creer qu'une seule ligne");
  assert.equal(createdLines[0]?.role, "PAYEUR_BENEFICIAIRE");
  assert.equal(createdLines[0]?.id_client, createPayload.nouveauClient.idClient);
  const createdItems = await getCommandeItems(atelierId, createPayload.idCommande);
  assert.equal(createdItems.length, 1, "une commande legacy doit creer un item par defaut");
  assert.equal(createdItems[0]?.type_habit, "PANTALON");

  const multiItemPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: createPayload.nouveauClient.idClient,
    descriptionCommande: "Commande plusieurs habits meme client",
    montantTotal: 0,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes,
    items: [
      { typeHabit: "PANTALON", description: "Pantalon uniforme", prix: 95, mesures: pantalonMesuresCompletes },
      {
        typeHabit: "CHEMISE",
        description: "Chemise blanche",
        prix: 55,
        mesures: {
          poitrine: 98,
          longueurChemise: 74,
          typeManches: "longues",
          poignet: 18,
          carrure: 44,
          longueurManches: 63
        }
      }
    ]
  };
  const multiItemCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(multiItemPayload);
  assert.equal(multiItemCreation.status, 201, "une commande simple doit supporter plusieurs habits pour une seule personne");
  assert.equal(Number(multiItemCreation.body?.montantTotal ?? multiItemCreation.body?.commande?.montantTotal ?? 0), 150);
  const multiItems = await getCommandeItems(atelierId, multiItemPayload.idCommande);
  assert.equal(multiItems.length, 2, "les items commande doivent etre persistés atomiquement");

  const itemPatched = await withAuth(
    session.client.patch(`/api/commandes/${encodeURIComponent(multiItemPayload.idCommande)}/items/${encodeURIComponent(multiItems[0].id_item)}`),
    session.token
  ).send({
    description: "Pantalon uniforme corrige",
    prix: 110,
    mesures: {
      ...pantalonMesuresCompletes,
      tourTaille: 84
    }
  });
  assert.equal(itemPatched.status, 200, "un item commande doit etre modifiable avant paiement");
  const patchedItems = await getCommandeItems(atelierId, multiItemPayload.idCommande);
  assert.equal(String(patchedItems[0]?.description || ""), "Pantalon uniforme corrige");
  assert.equal(Number(patchedItems[0]?.prix || 0), 110);
  assert.equal(Number(patchedItems[0]?.mesures_snapshot_json?.valeurs?.tourTaille || 0), 84);

  const caisseResponse = await openCaisseViaApi({
    client: session.client,
    token: session.token,
    utilisateur: "integration-test"
  });
  assert.equal(caisseResponse.status, 201, "ouverture caisse attendue");
  const idCaisseJour = String(caisseResponse.body?.idCaisseJour || "");

  const paiementItemCommande = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(multiItemPayload.idCommande)}/paiements/caisse`),
    session.token
  ).send({
    montant: 20,
    idItem: multiItems[1].id_item,
    idCaisseJour,
    utilisateur: "integration-test"
  });
  assert.equal(paiementItemCommande.status, 200, "le paiement commande cible doit reussir");
  const paidItems = await getCommandeItems(atelierId, multiItemPayload.idCommande);
  assert.equal(Number(paidItems[0]?.montant_paye || 0), 0, "le paiement cible ne doit pas toucher le premier item");
  assert.equal(Number(paidItems[1]?.montant_paye || 0), 20, "le paiement cible doit etre stocke sur l'item vise");

  const forbiddenPatch = await withAuth(
    session.client.patch(`/api/commandes/${encodeURIComponent(multiItemPayload.idCommande)}/items/${encodeURIComponent(multiItems[1].id_item)}`),
    session.token
  ).send({
    description: "Chemise interdite apres paiement"
  });
  assert.equal(forbiddenPatch.status, 400, "un item commande ne doit plus etre modifiable apres paiement");

  const globalPaymentPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: createPayload.nouveauClient.idClient,
    descriptionCommande: "Commande paiement global",
    montantTotal: 0,
    items: [
      { typeHabit: "PANTALON", description: "Pantalon global", prix: 60, mesures: pantalonMesuresCompletes },
      { typeHabit: "CHEMISE", description: "Chemise globale", prix: 40, mesures: {
        poitrine: 98,
        longueurChemise: 74,
        typeManches: "longues",
        poignet: 18,
        carrure: 44,
        longueurManches: 63
      } }
    ]
  };
  const globalCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(globalPaymentPayload);
  assert.equal(globalCreation.status, 201, "la commande paiement global doit etre creee");
  const globalPayment = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(globalPaymentPayload.idCommande)}/paiements/caisse`),
    session.token
  ).send({
    montant: 30,
    idCaisseJour,
    utilisateur: "integration-test"
  });
  assert.equal(globalPayment.status, 200, "le paiement global commande doit reussir");
  const globalItems = await getCommandeItems(atelierId, globalPaymentPayload.idCommande);
  assert.equal(Number(globalItems[0]?.montant_paye || 0), 0, "la redistribution globale ne doit pas ecrire un paiement cible sur item");
  assert.equal(Number(globalItems[1]?.montant_paye || 0), 0, "la redistribution globale reste uniquement globale");

  assert.equal(Number(patchedItems[0]?.mesures_snapshot_json?.valeurs?.tourTaille || 0), 84);
  assert.equal(String(multiItems[1]?.mesures_snapshot_json?.typeHabit || ""), "CHEMISE");
  const commandeRepo = new CommandeRepoPg(atelierId);
  const rehydratedCommande = await commandeRepo.getById(multiItemPayload.idCommande);
  assert.ok(rehydratedCommande, "la commande multi-items doit etre rehydratable");
  assert.equal(rehydratedCommande.items.length, 2, "la rehydratation doit recharger les items");
  assert.equal(rehydratedCommande.items[0]?.typeHabit, "PANTALON");
  assert.equal(rehydratedCommande.items[1]?.typeHabit, "CHEMISE");
  assert.equal(Number(rehydratedCommande.items[1]?.mesures?.valeurs?.longueurChemise || 0), 74);
  assert.equal(Number(rehydratedCommande.montantTotal || 0), 165, "le total rehydrate doit suivre les items");

  const itemDrivenPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: createPayload.nouveauClient.idClient,
    descriptionCommande: "Commande pilotee par les items",
    montantTotal: 0,
    items: [
      {
        typeHabit: "CHEMISE",
        description: "Chemise principale",
        prix: 60,
        mesures: {
          poitrine: 100,
          longueurChemise: 75,
          typeManches: "courtes",
          poignet: 19,
          carrure: 45
        }
      },
      {
        typeHabit: "PANTALON",
        description: "Pantalon secondaire",
        prix: 80,
        mesures: pantalonMesuresCompletes
      }
    ]
  };
  const itemDrivenCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(itemDrivenPayload);
  assert.equal(itemDrivenCreation.status, 201, "une commande doit pouvoir etre creee a partir des mesures portees par les items");
  assert.equal(String(itemDrivenCreation.body?.typeHabit || itemDrivenCreation.body?.commande?.typeHabit || ""), "CHEMISE");
  assert.equal(Number(itemDrivenCreation.body?.montantTotal ?? itemDrivenCreation.body?.commande?.montantTotal ?? 0), 140);

  const replay = await withAuth(session.client.post("/api/commandes"), session.token).send(createPayload);
  assert.equal(replay.status, 200, "rejouer la meme creation doit renvoyer la commande existante");
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
  assert.equal(duplicatePhoneClient.status, 201);
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

  const probableDuplicateClient = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Marie",
    prenom: "Samba",
    telephone: "+243810001004"
  });
  assert.equal(probableDuplicateClient.status, 201);
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

  const resolvedDuplicate = await withAuth(session.client.post("/api/commandes"), session.token).send({
    ...probableDuplicatePayload,
    doublonDecision: {
      action: "UPDATE_EXISTING_PHONE",
      idClient: probableDuplicateClientId
    }
  });
  assert.equal(resolvedDuplicate.status, 201, "la resolution du doublon probable doit permettre la creation");
  assert.equal(resolvedDuplicate.body?.commande?.idCommande, probableDuplicatePayload.idCommande);
  assert.equal(resolvedDuplicate.body?.client?.idClient, probableDuplicateClientId);

  const marieClients = await findClientsByIdentity(atelierId, "Marie", "Samba");
  assert.equal(marieClients.length, 1, "la mise a jour numero ne doit pas creer de doublon client");
  assert.equal(String(marieClients[0]?.telephone || "").trim(), probableDuplicatePayload.nouveauClient.telephone);

  const mesureMajPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: createPayload.nouveauClient.idClient,
    descriptionCommande: "Nouvelle prise de mesures pantalon",
    montantTotal: 95,
    typeHabit: "PANTALON",
    mesuresHabit: {
      longueur: 107,
      tourTaille: 86,
      tourHanche: 98,
      largeurBas: 19,
      hauteurFourche: 29
    }
  };
  const mesureMajCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(mesureMajPayload);
  assert.equal(mesureMajCreation.status, 201, "la commande simple existante doit rester compatible");

  const mesurePrefillMaj = await getClientLatestMeasures(session, createPayload.nouveauClient.idClient, "PANTALON");
  assert.equal(Number(mesurePrefillMaj.body?.prefill?.mesuresHabit?.valeurs?.tourTaille || 0), 86);
  const mesurePrefillAutreType = await getClientLatestMeasures(session, createPayload.nouveauClient.idClient, "ROBE");
  assert.equal(mesurePrefillAutreType.status, 200);
  assert.equal(mesurePrefillAutreType.body?.prefill, null, "le pre-remplissage doit rester contextualise par type d'habit");

  const vestePayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: createPayload.nouveauClient.idClient,
    descriptionCommande: "Commande veste",
    montantTotal: 150,
    typeHabit: "VESTE",
    mesuresHabit: {
      poitrine: 96,
      taille: 82,
      longueurVeste: 72,
      longueurManches: 64,
      carrure: 44,
      poignet: 19
    }
  };
  const vesteCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(vestePayload);
  assert.equal(vesteCreation.status, 201, `la commande VESTE doit etre acceptee: ${JSON.stringify(vesteCreation.body || {})}`);
  assert.equal(String(vesteCreation.body?.typeHabit || vesteCreation.body?.commande?.typeHabit || ""), "VESTE");
  const mesurePrefillVeste = await getClientLatestMeasures(session, createPayload.nouveauClient.idClient, "VESTE");
  assert.equal(mesurePrefillVeste.status, 200);
  assert.equal(Number(mesurePrefillVeste.body?.prefill?.mesuresHabit?.valeurs?.poitrine || 0), 96);

  const atelierCustomFreeHabitId = `ATELIER_CMD_FREE_${Date.now()}`;
  const freeHabitSession = await createAuthenticatedSession({
    atelierId: atelierCustomFreeHabitId,
    emailPrefix: "cmd-free-habit",
    nom: "Commande Free Habit"
  });
  await saveAtelierParametres({
    atelierId: atelierCustomFreeHabitId,
    payload: createDefaultParametresPayload({
      habits: {
        SAHARIENNE: {
          label: "Saharienne",
          actif: true,
          ordre: 1,
          mesures: [
            { code: "poitrine", label: "Poitrine", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
            { code: "taille", label: "Taille", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" },
            { code: "longueur", label: "Longueur", obligatoire: false, actif: true, ordre: 3, typeChamp: "number" }
          ]
        }
      }
    })
  });
  const freeHabitPayer = await createClientViaApi({
    client: freeHabitSession.client,
    token: freeHabitSession.token,
    nom: "Papa",
    prenom: "Libre",
    telephone: "+243810001779"
  });
  assert.equal(freeHabitPayer.status, 201);
  const freeHabitPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: freeHabitPayer.body?.client?.idClient,
    descriptionCommande: "Commande saharienne parametree",
    montantTotal: 175,
    typeHabit: "SAHARIENNE",
    mesuresHabit: {
      poitrine: 102,
      taille: 88,
      longueur: 78
    }
  };
  const freeHabitCreation = await withAuth(freeHabitSession.client.post("/api/commandes"), freeHabitSession.token).send(freeHabitPayload);
  assert.equal(freeHabitCreation.status, 201, `le type d'habit parametre doit etre accepte: ${JSON.stringify(freeHabitCreation.body || {})}`);
  const freeHabitPrefill = await getClientLatestMeasures(freeHabitSession, freeHabitPayer.body?.client?.idClient, "SAHARIENNE");
  assert.equal(freeHabitPrefill.status, 200);
  assert.equal(Number(freeHabitPrefill.body?.prefill?.mesuresHabit?.valeurs?.poitrine || 0), 102);

  const multiPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: createPayload.nouveauClient.idClient,
    descriptionCommande: "Commande groupe interdite",
    montantTotal: 200,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes,
    lignesCommande: [
      {
        utiliseClientPayeur: true,
        role: "PAYEUR_BENEFICIAIRE",
        typeHabit: "PANTALON",
        mesuresHabit: pantalonMesuresCompletes
      },
      {
        idClient: probableDuplicateClientId,
        typeHabit: "PANTALON",
        mesuresHabit: pantalonMesuresCompletes
      }
    ]
  };
  const multiCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(multiPayload);
  assert.equal(multiCreation.status, 400, "une commande multi-personnes doit etre refusee");
  assert.match(String(multiCreation.body?.message || multiCreation.body?.error || ""), /un seul client|dossier/i);

  const atelierCustomHabitsId = `ATELIER_CMD_CUSTOM_${Date.now()}`;
  const customSession = await createAuthenticatedSession({
    atelierId: atelierCustomHabitsId,
    emailPrefix: "cmd-srp-custom",
    nom: "Commande SRP Custom"
  });
  await saveAtelierParametres({
    atelierId: atelierCustomHabitsId,
    payload: createDefaultParametresPayload({
      habits: {
        PANTALON: {
          label: "Pantalon",
          actif: true,
          ordre: 1,
          mesures: [
            { code: "taille", label: "Taille", obligatoire: true, actif: true, ordre: 1, typeChamp: "number" },
            { code: "hanche", label: "Hanche", obligatoire: true, actif: true, ordre: 2, typeChamp: "number" }
          ]
        }
      }
    })
  });
  const customPayer = await createClientViaApi({
    client: customSession.client,
    token: customSession.token,
    nom: "Maman",
    prenom: "Custom",
    telephone: "+243810001778"
  });
  assert.equal(customPayer.status, 201);

  const customHabitPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: customPayer.body?.client?.idClient,
    descriptionCommande: "Commande pantalon mesures custom",
    montantTotal: 135,
    typeHabit: "PANTALON",
    mesuresHabit: {
      taille: 44,
      hanche: 58
    }
  };
  const customHabitCreation = await withAuth(customSession.client.post("/api/commandes"), customSession.token).send(customHabitPayload);
  assert.equal(customHabitCreation.status, 201, "les mesures commande configurees par atelier doivent etre acceptees");
}

run()
  .then(() => {
    console.log("OK: integration commandes wizard atomic");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
