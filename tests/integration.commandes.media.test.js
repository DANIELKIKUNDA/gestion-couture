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
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_media_atelier_commande_position ON commande_media (atelier_id, id_commande, position)");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_media_primary_unique ON commande_media (atelier_id, id_commande) WHERE is_primary = true");
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
    descriptionCommande: "Commande media"
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
    .field("note", "Reference initiale")
    .field("sourceType", "UPLOAD")
    .attach("photo", fixtureOne);
  assert.equal(uploadOne.status, 201, "premier upload attendu");
  assert.equal(uploadOne.body?.position, 1);
  assert.equal(uploadOne.body?.isPrimary, true);
  const firstMediaId = String(uploadOne.body?.idMedia || "");

  const uploadTwo = await withAuth(
    session.client.post(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  )
    .field("note", "Deuxieme reference")
    .field("sourceType", "CAMERA")
    .attach("photo", fixtureTwo);
  assert.equal(uploadTwo.status, 201, "deuxieme upload attendu");
  assert.equal(uploadTwo.body?.position, 2);
  assert.equal(uploadTwo.body?.isPrimary, false);
  const secondMediaId = String(uploadTwo.body?.idMedia || "");

  const listAfterUpload = await withAuth(
    session.client.get(`/api/commandes/${encodeURIComponent(idCommande)}/media`),
    session.token
  );
  assert.equal(listAfterUpload.status, 200);
  assert.equal(listAfterUpload.body.length, 2);
  assert.equal(listAfterUpload.body[0]?.isPrimary, true);

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
  assert.equal(listAfterPatch.body[0]?.idMedia, secondMediaId);
  assert.equal(listAfterPatch.body[0]?.isPrimary, true);
  assert.equal(listAfterPatch.body[0]?.position, 1);
  assert.equal(listAfterPatch.body[1]?.position, 2);

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
  assert.equal(listAfterDelete.body.length, 1);
  assert.equal(listAfterDelete.body[0]?.idMedia, firstMediaId);
  assert.equal(listAfterDelete.body[0]?.isPrimary, true);
  assert.equal(listAfterDelete.body[0]?.position, 1);

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
