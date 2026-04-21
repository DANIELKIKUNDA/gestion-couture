import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { pool } from "../src/shared/infrastructure/db.js";
import {
  createAuthenticatedSession,
  createClientViaApi,
  createCommandeViaApi,
  withAuth
} from "./helpers/integration-fixtures.js";

const PNG_1X1_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0x8AAAAASUVORK5CYII=";

async function ensureCommandeMediaSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS commande_media (
      id_media TEXT PRIMARY KEY,
      atelier_id TEXT NOT NULL DEFAULT 'ATELIER',
      id_commande TEXT NOT NULL,
      id_item TEXT NULL,
      type_media TEXT NOT NULL DEFAULT 'IMAGE',
      source_type TEXT NOT NULL DEFAULT 'UPLOAD',
      chemin_original TEXT NOT NULL,
      chemin_thumbnail TEXT NOT NULL,
      nom_fichier_original TEXT NULL,
      mime_type TEXT NOT NULL,
      extension_stockage TEXT NOT NULL,
      taille_originale_bytes INTEGER NOT NULL CHECK (taille_originale_bytes > 0),
      largeur INTEGER NULL,
      hauteur INTEGER NULL,
      note TEXT NULL,
      position INTEGER NOT NULL DEFAULT 1 CHECK (position BETWEEN 0 AND 3),
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      cree_par TEXT NULL,
      date_creation TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_commande_media_atelier_commande ON commande_media (atelier_id, id_commande, position)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_commande_media_atelier_commande_item ON commande_media (atelier_id, id_commande, id_item, position)");
  await pool.query("DROP INDEX IF EXISTS idx_commande_media_atelier_commande_position");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_media_atelier_commande_item_position ON commande_media (atelier_id, id_commande, COALESCE(id_item, ''), position)");
  await pool.query("DROP INDEX IF EXISTS idx_commande_media_primary_unique");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_media_primary_item_unique ON commande_media (atelier_id, id_commande, COALESCE(id_item, '')) WHERE is_primary = true");
  await pool.query("ALTER TABLE commande_media DROP CONSTRAINT IF EXISTS commande_media_position_check");
  await pool.query("ALTER TABLE commande_media ADD CONSTRAINT commande_media_position_check CHECK (position BETWEEN 0 AND 3)");
}

async function createFixtureImage(targetDir, name = "fixture.png") {
  await fs.mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, name);
  await fs.writeFile(filePath, Buffer.from(PNG_1X1_BASE64, "base64"));
  return filePath;
}

async function run() {
  const storageRoot = path.join(os.tmpdir(), `atelier-media-storage-${Date.now()}`);
  const tempRoot = path.join(storageRoot, "tmp");
  process.env.MEDIA_STORAGE_ROOT = storageRoot;
  process.env.MEDIA_TEMP_ROOT = tempRoot;

  await ensureCommandeMediaSchema();

  const atelierId = `ATELIER_MEDIA_${Date.now()}`;
  const session = await createAuthenticatedSession({
    atelierId,
    emailPrefix: "media-commande",
    nom: "Commande Media Owner"
  });

  const clientResponse = await createClientViaApi({
    client: session.client,
    token: session.token,
    nom: "Client",
    prenom: "Media",
    telephone: "+243810000120"
  });
  assert.equal(clientResponse.status, 201);
  const idClient = String(clientResponse.body?.client?.idClient || "");

  const commandeResponse = await createCommandeViaApi({
    client: session.client,
    token: session.token,
    idClient,
    descriptionCommande: "Commande media",
    items: [
      {
        idItem: "ITEM-VESTE",
        typeHabit: "VESTE",
        description: "Veste bleu nuit",
        prix: 120,
        mesures: {
          longueur: 74,
          poitrine: 96,
          taille: 88
        }
      },
      {
        idItem: "ITEM-PANTALON",
        typeHabit: "PANTALON",
        description: "Pantalon assorti",
        prix: 80,
        mesures: {
          longueur: 105,
          tourTaille: 82,
          tourHanche: 96,
          largeurBas: 20,
          hauteurFourche: 28
        }
      }
    ]
  });
  assert.equal(commandeResponse.status, 201);
  const idCommande = String(commandeResponse.body?.idCommande || "");

  const fixturesDir = path.join(os.tmpdir(), `atelier-media-fixtures-${Date.now()}`);
  const fixtureOne = await createFixtureImage(fixturesDir, "ref-1.png");
  const fixtureTwo = await createFixtureImage(fixturesDir, "ref-2.png");

  const uploadOne = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  )
    .field("idItem", "ITEM-VESTE")
    .field("note", "Reference initiale")
    .field("sourceType", "UPLOAD")
    .attach("photo", fixtureOne);
  assert.equal(uploadOne.status, 201, "premier upload attendu");
  assert.equal(uploadOne.body?.idItem, "ITEM-VESTE");
  assert.equal(uploadOne.body?.position, 1);
  assert.equal(uploadOne.body?.isPrimary, true);
  const firstMediaId = String(uploadOne.body?.idMedia || "");

  const uploadTwo = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  )
    .field("idItem", "ITEM-VESTE")
    .field("note", "Deuxieme reference")
    .field("sourceType", "CAMERA")
    .attach("photo", fixtureTwo);
  assert.equal(uploadTwo.status, 201, "deuxieme upload attendu");
  assert.equal(uploadTwo.body?.idItem, "ITEM-VESTE");
  assert.equal(uploadTwo.body?.position, 2);
  assert.equal(uploadTwo.body?.isPrimary, false);
  const secondMediaId = String(uploadTwo.body?.idMedia || "");

  const fixtureThree = await createFixtureImage(fixturesDir, "ref-3.png");
  const fixtureFour = await createFixtureImage(fixturesDir, "ref-4.png");
  const fixtureFive = await createFixtureImage(fixturesDir, "ref-5.png");

  const uploadThree = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  )
    .field("idItem", "ITEM-VESTE")
    .field("note", "Troisieme reference")
    .attach("photo", fixtureThree);
  assert.equal(uploadThree.status, 201, "troisieme upload attendu");
  assert.equal(uploadThree.body?.position, 3);

  const uploadFourSameHabit = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  )
    .field("idItem", "ITEM-VESTE")
    .field("note", "Quatrieme reference")
    .attach("photo", fixtureFour);
  assert.equal(uploadFourSameHabit.status, 400, "quatrieme upload meme habit refuse");
  assert.match(String(uploadFourSameHabit.body?.error || ""), /par habit/i);

  const uploadOtherItem = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  )
    .field("idItem", "ITEM-PANTALON")
    .field("note", "Reference pantalon")
    .attach("photo", fixtureFive);
  assert.equal(uploadOtherItem.status, 201, "upload autre habit attendu");
  assert.equal(uploadOtherItem.body?.idItem, "ITEM-PANTALON");
  assert.equal(uploadOtherItem.body?.position, 1);
  assert.equal(uploadOtherItem.body?.isPrimary, true);

  const listAfterUpload = await withAuth(
    session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  );
  assert.equal(listAfterUpload.status, 200);
  assert.equal(listAfterUpload.body.length, 4);
  assert.equal(listAfterUpload.body.filter((item) => item?.idItem === "ITEM-VESTE").length, 3);
  assert.equal(listAfterUpload.body.filter((item) => item?.idItem === "ITEM-PANTALON").length, 1);

  const patchPrimary = await withAuth(
    session.client.patch(`/api/commandes/${encodeURIComponent(idCommande)}/media/${encodeURIComponent(secondMediaId)}`),
    session.token
  ).send({
    isPrimary: true,
    position: 1,
    note: "Nouvelle principale"
  });
  assert.equal(patchPrimary.status, 200, "maj principale attendue");
  assert.equal(patchPrimary.body?.isPrimary, true);
  assert.equal(patchPrimary.body?.note, "Nouvelle principale");

  const listAfterPatch = await withAuth(
    session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  );
  assert.equal(listAfterPatch.status, 200);
  const vesteMedia = listAfterPatch.body.filter((item) => item?.idItem === "ITEM-VESTE");
  const pantalonMedia = listAfterPatch.body.filter((item) => item?.idItem === "ITEM-PANTALON");
  assert.equal(vesteMedia[0]?.idMedia, secondMediaId);
  assert.equal(vesteMedia[0]?.isPrimary, true);
  assert.equal(vesteMedia[0]?.position, 1);
  assert.equal(vesteMedia[1]?.position, 2);
  assert.equal(vesteMedia[2]?.position, 3);
  assert.equal(pantalonMedia[0]?.position, 1);
  assert.equal(pantalonMedia[0]?.isPrimary, true);

  const thumb = await withAuth(
    session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media/${encodeURIComponent(secondMediaId)}/thumbnail`),
    session.token
  );
  assert.equal(thumb.status, 200, "thumbnail attendue");

  const full = await withAuth(
    session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media/${encodeURIComponent(secondMediaId)}/fichier`),
    session.token
  );
  assert.equal(full.status, 200, "fichier final attendu");

  const deleteSecond = await withAuth(
    session.client.delete(`/api/commandes/${encodeURIComponent(idCommande)}/media/${encodeURIComponent(secondMediaId)}`),
    session.token
  );
  assert.equal(deleteSecond.status, 200, "suppression media attendue");

  const listAfterDelete = await withAuth(
    session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  );
  assert.equal(listAfterDelete.status, 200);
  assert.equal(listAfterDelete.body.length, 3);
  const vesteAfterDelete = listAfterDelete.body.filter((item) => item?.idItem === "ITEM-VESTE");
  const pantalonAfterDelete = listAfterDelete.body.filter((item) => item?.idItem === "ITEM-PANTALON");
  assert.equal(vesteAfterDelete.length, 2);
  assert.equal(vesteAfterDelete[0]?.idMedia, firstMediaId);
  assert.equal(vesteAfterDelete[0]?.isPrimary, true);
  assert.equal(vesteAfterDelete[0]?.position, 1);
  assert.equal(vesteAfterDelete[1]?.position, 2);
  assert.equal(pantalonAfterDelete[0]?.position, 1);
  assert.equal(pantalonAfterDelete[0]?.isPrimary, true);

  const otherSession = await createAuthenticatedSession({
    atelierId: `${atelierId}_OTHER`,
    emailPrefix: "media-commande-other",
    nom: "Commande Media Owner Other"
  });

  const crossTenantThumb = await withAuth(
    otherSession.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media/${encodeURIComponent(firstMediaId)}/thumbnail`),
    otherSession.token
  );
  assert.equal(crossTenantThumb.status, 404, "acces cross-tenant refuse");

  await fs.rm(storageRoot, { recursive: true, force: true });
  await fs.rm(fixturesDir, { recursive: true, force: true });
}

run()
  .then(() => {
    console.log("OK: integration commandes media");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
