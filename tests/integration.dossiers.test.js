import assert from "node:assert/strict";

import {
  createAuthenticatedSession,
  createClientViaApi,
  createDefaultParametresPayload,
  ensureDossierSchema,
  saveAtelierParametres,
  withAuth
} from "./helpers/integration-fixtures.js";

async function main() {
  await ensureDossierSchema();
  const { client, token, atelierId } = await createAuthenticatedSession({
    atelierId: `ATELIER_DOSSIER_${Date.now()}`
  });

  await saveAtelierParametres({
    atelierId,
    payload: createDefaultParametresPayload()
  });

  const responsableResponse = await createClientViaApi({
    client,
    token,
    nom: "Mama",
    prenom: "Kasongo",
    telephone: "+243810000001"
  });
  assert.equal(responsableResponse.status, 201, `Creation client KO: ${responsableResponse.status} ${JSON.stringify(responsableResponse.body)}`);
  const responsable = responsableResponse.body?.client;
  assert.ok(responsable?.idClient, `Client cree invalide: ${JSON.stringify(responsableResponse.body)}`);

  const dossierRes = await withAuth(client.post("/api/dossiers"), token).send({
    idResponsableClient: responsable.idClient,
    typeDossier: "FAMILLE",
    notes: "Dossier famille test"
  });

  assert.equal(dossierRes.status, 201, `Creation dossier KO: ${dossierRes.status} ${JSON.stringify(dossierRes.body)}`);
  const dossier = dossierRes.body?.dossier;
  assert.ok(dossier?.idDossier, "idDossier manquant");
  assert.equal(dossier.typeDossier, "FAMILLE");
  assert.equal(dossier.totalCommandes, 0);
  assert.equal(dossier.totalRetouches, 0);

  const commandeRes = await withAuth(client.post("/api/commandes"), token).send({
    idDossier: dossier.idDossier,
    clientPayeurId: responsable.idClient,
    descriptionCommande: "Commande famille",
    montantTotal: 120,
    lignesCommande: [
      {
        utiliseClientPayeur: true,
        role: "PAYEUR_BENEFICIAIRE",
        typeHabit: "PANTALON",
        mesuresHabit: {
          longueur: 110,
          tourTaille: 82,
          tourHanche: 96,
          largeurBas: 22,
          hauteurFourche: 31
        }
      }
    ]
  });

  assert.equal(commandeRes.status, 201, `Creation commande dossier KO: ${commandeRes.status} ${JSON.stringify(commandeRes.body)}`);
  assert.equal(commandeRes.body?.dossierId, dossier.idDossier);

  const retoucheRes = await withAuth(client.post("/api/retouches/wizard"), token).send({
    idDossier: dossier.idDossier,
    idClient: responsable.idClient,
    descriptionRetouche: "Ourlet pantalon",
    typeRetouche: "OURLET_PANTALON",
    montantTotal: 30,
    typeHabit: "PANTALON",
    mesuresHabit: {
      longueur: 100
    }
  });

  assert.equal(retoucheRes.status, 201, `Creation retouche dossier KO: ${retoucheRes.status} ${JSON.stringify(retoucheRes.body)}`);
  assert.equal(retoucheRes.body?.retouche?.dossierId, dossier.idDossier);

  const detailRes = await withAuth(client.get(`/api/dossiers/${encodeURIComponent(dossier.idDossier)}`), token);
  assert.equal(detailRes.status, 200, `Lecture detail dossier KO: ${detailRes.status} ${JSON.stringify(detailRes.body)}`);
  assert.equal(detailRes.body?.totalCommandes, 1);
  assert.equal(detailRes.body?.totalRetouches, 1);
  assert.equal(detailRes.body?.commandes?.[0]?.dossierId, dossier.idDossier);
  assert.equal(detailRes.body?.retouches?.[0]?.dossierId, dossier.idDossier);
  assert.equal(detailRes.body?.commandes?.[0]?.soldeRestant, 120);
  assert.equal(detailRes.body?.commandes?.[0]?.beneficiairesResume?.length, 1);
  assert.equal(detailRes.body?.commandes?.[0]?.beneficiairesResume?.[0]?.role, "PAYEUR_BENEFICIAIRE");
  assert.equal(detailRes.body?.commandes?.[0]?.flagsMetier?.soldeOuvert, true);
  assert.equal(detailRes.body?.commandes?.[0]?.flagsMetier?.termineeNonLivree, false);
  assert.equal(detailRes.body?.retouches?.[0]?.soldeRestant, 30);
  assert.equal(detailRes.body?.retouches?.[0]?.beneficiaire?.idClient, responsable.idClient);
  assert.equal(detailRes.body?.retouches?.[0]?.flagsMetier?.soldeOuvert, true);
  assert.equal(detailRes.body?.retouches?.[0]?.flagsMetier?.termineeNonLivree, false);
  assert.equal(detailRes.body?.synthese?.totalBeneficiaires, 1);
  assert.equal(detailRes.body?.synthese?.documentsAvecSolde, 2);
  assert.equal(detailRes.body?.synthese?.commandesEnCours, 1);
  assert.equal(detailRes.body?.synthese?.retouchesEnCours, 1);
  assert.equal(detailRes.body?.synthese?.totalMontant, 150);
  assert.equal(detailRes.body?.synthese?.totalPaye, 0);
  assert.equal(detailRes.body?.synthese?.soldeRestant, 150);
  assert.ok(detailRes.body?.synthese?.derniereActivite);

  console.log("integration.dossiers.test.js: OK");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
