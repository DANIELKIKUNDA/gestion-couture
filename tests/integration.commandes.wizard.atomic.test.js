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

async function getClientLatestMeasures(session, idClient, typeHabit) {
  const response = await withAuth(
    session.client.get(`/api/clients/${encodeURIComponent(idClient)}/mesures/derniere`).query({ typeHabit }),
    session.token
  );
  return response;
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

  const famillePayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Clarisse",
      prenom: "Maman",
      telephone: ""
    },
    descriptionCommande: "Commande famille",
    montantTotal: 320,
    datePrevue: "2026-04-15",
    lignesCommande: [
      {
        source: "PAYEUR",
        role: "PAYEUR_BENEFICIAIRE",
        typeHabit: "ROBE",
        mesuresHabit: {
          poitrine: 92,
          taille: 74,
          hanche: 102,
          longueur: 144
        }
      },
      {
        nouveauClient: {
          idClient: buildTestId("CLI"),
          nom: "Junior",
          prenom: "Moke",
          telephone: ""
        },
        role: "BENEFICIAIRE",
        typeHabit: "PANTALON",
        mesuresHabit: pantalonMesuresCompletes
      },
      {
        nouveauClient: {
          idClient: buildTestId("CLI"),
          nom: "Sarah",
          prenom: "Moke",
          telephone: ""
        },
        role: "BENEFICIAIRE",
        typeHabit: "ROBE",
        mesuresHabit: {
          poitrine: 80,
          taille: 64,
          hanche: 88,
          longueur: 122
        }
      }
    ]
  };

  const familleCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(famillePayload);
  assert.equal(familleCreation.status, 201, "la commande famille doit etre creee");
  assert.equal(familleCreation.body?.commande?.nombreLignes, 3);
  assert.equal(familleCreation.body?.commande?.nombreBeneficiaires, 3);
  assert.equal(Array.isArray(familleCreation.body?.commande?.lignesCommande), true);
  assert.equal(familleCreation.body.commande.lignesCommande.length, 3);
  assert.equal(String(familleCreation.body?.client?.telephone || ""), "", "le client payeur sans telephone doit etre autorise");
  assert.equal(Array.isArray(familleCreation.body?.clientsAssocies), true);
  assert.equal(familleCreation.body.clientsAssocies.length, 3, "les trois clients associes doivent etre renvoyes");

  const familleLignes = await getCommandeLignes(atelierId, famillePayload.idCommande);
  assert.equal(familleLignes.length, 3, "les lignes de commande doivent etre persistées");
  assert.equal(familleLignes[0]?.role, "PAYEUR_BENEFICIAIRE");
  assert.equal(familleLignes[0]?.id_client, famillePayload.nouveauClient.idClient, "le payeur inclus ne doit pas etre duplique");
  assert.equal(
    String(familleLignes[1]?.mesures_habit_snapshot?.valeurs?.tourTaille || ""),
    String(pantalonMesuresCompletes.tourTaille),
    "les mesures de ligne doivent etre conservees"
  );

  const mesurePrefillPantalon = await getClientLatestMeasures(session, famillePayload.lignesCommande[1].nouveauClient.idClient, "PANTALON");
  assert.equal(mesurePrefillPantalon.status, 200, "les dernieres mesures par type doivent etre consultables");
  assert.equal(mesurePrefillPantalon.body?.prefill?.typeHabit, "PANTALON");
  assert.equal(Number(mesurePrefillPantalon.body?.prefill?.mesuresHabit?.valeurs?.tourTaille || 0), pantalonMesuresCompletes.tourTaille);

  const updatedPantalonMeasures = {
    longueur: 107,
    tourTaille: 86,
    tourHanche: 98,
    largeurBas: 19,
    hauteurFourche: 29
  };
  const mesureMajPayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: famillePayload.lignesCommande[1].nouveauClient.idClient,
    descriptionCommande: "Nouvelle prise de mesures pantalon",
    montantTotal: 95,
    typeHabit: "PANTALON",
    mesuresHabit: updatedPantalonMeasures
  };
  const mesureMajCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(mesureMajPayload);
  assert.equal(mesureMajCreation.status, 201, "la commande simple existante doit rester compatible");

  const mesurePrefillMaj = await getClientLatestMeasures(session, famillePayload.lignesCommande[1].nouveauClient.idClient, "PANTALON");
  assert.equal(Number(mesurePrefillMaj.body?.prefill?.mesuresHabit?.valeurs?.tourTaille || 0), updatedPantalonMeasures.tourTaille);
  const mesurePrefillAutreType = await getClientLatestMeasures(session, famillePayload.lignesCommande[1].nouveauClient.idClient, "ROBE");
  assert.equal(mesurePrefillAutreType.status, 200);
  assert.equal(mesurePrefillAutreType.body?.prefill, null, "le pre-remplissage doit rester contextualise par type d'habit");

  const papaPayeurPayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Patrick",
      prenom: "Papa",
      telephone: ""
    },
    descriptionCommande: "Commande enfants seulement",
    montantTotal: 220,
    lignesCommande: [
      {
        nouveauClient: {
          idClient: buildTestId("CLI"),
          nom: "Enfant",
          prenom: "Un",
          telephone: ""
        },
        role: "BENEFICIAIRE",
        typeHabit: "PANTALON",
        mesuresHabit: pantalonMesuresCompletes
      },
      {
        nouveauClient: {
          idClient: buildTestId("CLI"),
          nom: "Enfant",
          prenom: "Deux",
          telephone: ""
        },
        role: "BENEFICIAIRE",
        typeHabit: "ROBE",
        mesuresHabit: {
          poitrine: 70,
          taille: 60,
          hanche: 76,
          longueur: 118
        }
      }
    ]
  };

  const papaPayeurCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(papaPayeurPayload);
  assert.equal(papaPayeurCreation.status, 201, "le payeur sans ligne doit etre autorise");
  assert.equal(papaPayeurCreation.body?.commande?.nombreLignes, 2);
  assert.equal(papaPayeurCreation.body?.commande?.nombreBeneficiaires, 2);
  const papaPayeurLignes = await getCommandeLignes(atelierId, papaPayeurPayload.idCommande);
  assert.equal(papaPayeurLignes.length, 2);
  assert.equal(
    papaPayeurLignes.some((ligne) => ligne.id_client === papaPayeurPayload.nouveauClient.idClient),
    false,
    "le payeur seul ne doit pas etre cree comme ligne inutile"
  );

  const existingPayer = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Chef",
    prenom: "Chorale",
    telephone: "+243810001777"
  });
  assert.equal(existingPayer.status, 201);

  const choralePayload = {
    idCommande: buildTestId("CMD"),
    clientPayeurId: existingPayer.body?.client?.idClient,
    descriptionCommande: "Commande chorale",
    montantTotal: 480,
    lignesCommande: [
      {
        utiliseClientPayeur: true,
        role: "PAYEUR_BENEFICIAIRE",
        typeHabit: "CHEMISE",
        mesuresHabit: {
          poitrine: 108,
          longueurChemise: 76,
          typeManches: "longues",
          longueurManches: 61,
          poignet: 18,
          carrure: 46
        }
      },
      {
        nomAffiche: "Membre",
        prenomAffiche: "Un",
        role: "BENEFICIAIRE",
        typeHabit: "CHEMISE",
        mesuresHabit: {
          poitrine: 100,
          longueurChemise: 72,
          typeManches: "courtes",
          poignet: 17,
          carrure: 43
        }
      }
    ]
  };

  const choraleCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(choralePayload);
  assert.equal(choraleCreation.status, 201, "la commande groupe doit etre creee");
  assert.equal(choraleCreation.body?.nombreBeneficiaires, 2);
  const choraleLignes = await getCommandeLignes(atelierId, choralePayload.idCommande);
  assert.equal(choraleLignes[0]?.id_client, existingPayer.body?.client?.idClient, "le payeur existant inclus doit etre reutilise");
  assert.equal(choraleLignes[1]?.id_client, null, "un beneficiaire libre sans fiche client doit rester possible");

  const confirmDuplicatePayload = {
    idCommande: buildTestId("CMD"),
    nouveauClient: {
      idClient: buildTestId("CLI"),
      nom: "Jean",
      prenom: "Diallo",
      telephone: "+243810001003"
    },
    doublonDecision: {
      action: "CONFIRM_NEW",
      idClient: existingPhoneClientId
    },
    descriptionCommande: "Commande doublon confirme",
    montantTotal: 170,
    typeHabit: "PANTALON",
    mesuresHabit: pantalonMesuresCompletes
  };

  const confirmDuplicateCreation = await withAuth(session.client.post("/api/commandes"), session.token).send(confirmDuplicatePayload);
  assert.equal(confirmDuplicateCreation.status, 201, "la creation doit rester possible apres confirmation explicite");
  assert.equal(await countClientsByTelephone(atelierId, confirmDuplicatePayload.nouveauClient.telephone), 2, "la confirmation doit autoriser un nouveau client");
}

run()
  .then(() => {
    console.log("OK: integration commandes wizard atomic");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
