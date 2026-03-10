import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { createApp } from "../src/interfaces/http/app.js";
import { pool } from "../src/shared/infrastructure/db.js";
import { Utilisateur } from "../src/bc-auth/domain/utilisateur.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { ACCOUNT_STATES } from "../src/bc-auth/domain/account-state.js";
import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { hashPassword } from "../src/bc-auth/infrastructure/security/password-hasher.js";
import { UtilisateurRepoPg } from "../src/bc-auth/infrastructure/repositories/utilisateur-repo-pg.js";
import { RolePermissionAtelierRepoPg } from "../src/bc-auth/infrastructure/repositories/role-permission-atelier-repo-pg.js";

async function tenantSchemaReady() {
  const checks = [
    ["clients", "atelier_id"],
    ["commandes", "atelier_id"],
    ["retouches", "atelier_id"],
    ["caisse_jour", "atelier_id"],
    ["articles", "atelier_id"],
    ["ventes", "atelier_id"],
    ["factures", "atelier_id"]
  ];
  for (const [tableName, columnName] of checks) {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = $1
         AND column_name = $2
       LIMIT 1`,
      [tableName, columnName]
    );
    if (result.rowCount === 0) return false;
  }
  return true;
}

async function ensureAtelier(idAtelier, slug, nom) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ateliers (
      id_atelier TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      actif BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `INSERT INTO ateliers (id_atelier, slug, nom, actif)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (id_atelier) DO UPDATE
     SET slug = EXCLUDED.slug,
         nom = EXCLUDED.nom,
         actif = true,
         updated_at = NOW()`,
    [idAtelier, slug, nom]
  );
}

async function ensureExistingAteliersReferenced() {
  const existing = new Set();

  for (const tableName of ["utilisateurs", "role_permission_atelier"]) {
    const tableExists = await pool.query("SELECT to_regclass($1) AS regclass", [tableName]);
    if (!tableExists.rows[0]?.regclass) continue;
    const rows = await pool.query(`SELECT DISTINCT atelier_id FROM ${tableName} WHERE atelier_id IS NOT NULL AND atelier_id <> ''`);
    for (const row of rows.rows) {
      existing.add(String(row.atelier_id));
    }
  }

  for (const atelierId of existing) {
    const slug = String(atelierId).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "atelier";
    await ensureAtelier(atelierId, slug, `Atelier ${atelierId}`);
  }
}

async function seedBusinessDataset({ atelierId, suffix }) {
  const now = new Date();
  const clientId = `CLI-${suffix}`;
  const commandeId = `CMD-${suffix}`;
  const retoucheId = `RET-${suffix}`;
  const caisseId = `CAI-${suffix}`;
  const articleId = `ART-${suffix}`;
  const venteId = `VEN-${suffix}`;
  const factureId = `FACID-${suffix}`;

  await pool.query(
    `INSERT INTO clients (id_client, atelier_id, nom, prenom, telephone, actif, date_creation)
     VALUES ($1, $2, $3, $4, $5, true, $6)`,
    [clientId, atelierId, `Nom ${suffix}`, `Prenom ${suffix}`, `+243${suffix.slice(-6)}`, now]
  );

  await pool.query(
    `INSERT INTO commandes (id_commande, atelier_id, id_client, description, date_creation, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
     VALUES ($1, $2, $3, $4, $5, 150, 50, 'CREEE', 'ROBE', $6::jsonb)`,
    [
      commandeId,
      atelierId,
      clientId,
      `Commande ${suffix}`,
      now,
      JSON.stringify({ unite: "cm", typeHabit: "ROBE", valeurs: { poitrine: 90, taille: 70 } })
    ]
  );

  await pool.query(
    `INSERT INTO retouches (id_retouche, atelier_id, id_client, description, type_retouche, date_depot, montant_total, montant_paye, statut, type_habit, mesures_habit_snapshot)
     VALUES ($1, $2, $3, $4, 'OURLET', $5, 40, 10, 'DEPOSEE', 'PANTALON', $6::jsonb)`,
    [
      retoucheId,
      atelierId,
      clientId,
      `Retouche ${suffix}`,
      now,
      JSON.stringify({ unite: "cm", typeHabit: "PANTALON", valeurs: { longueur: 102 } })
    ]
  );

  await pool.query(
    `INSERT INTO caisse_jour (id_caisse_jour, atelier_id, date_jour, statut, solde_ouverture, ouverte_par, date_ouverture)
     VALUES ($1, $2, $3, 'OUVERTE', 100, $4, $5)`,
    [caisseId, atelierId, now.toISOString().slice(0, 10), `Owner ${suffix}`, now]
  );

  await pool.query(
    `INSERT INTO articles (id_article, atelier_id, nom_article, categorie_article, unite_stock, quantite_disponible, prix_achat_moyen, prix_vente_unitaire, seuil_alerte, actif)
     VALUES ($1, $2, $3, 'TISSU', 'METRE', 12, 5, 9, 2, true)`,
    [articleId, atelierId, `Article ${suffix}`]
  );

  await pool.query(
    `INSERT INTO ventes (id_vente, atelier_id, date_vente, total, total_prix_achat, benefice_total, statut, reference_caisse)
     VALUES ($1, $2, $3, 90, 45, 45, 'VALIDEE', $4)`,
    [venteId, atelierId, now, caisseId]
  );

  await pool.query(
    `INSERT INTO vente_lignes (id_ligne, atelier_id, id_vente, id_article, libelle_article, quantite, prix_unitaire, prix_achat_unitaire, benefice_unitaire, benefice_total)
     VALUES ($1, $2, $3, $4, $5, 2, 45, 22.5, 22.5, 45)`,
    [`LIG-${suffix}`, atelierId, venteId, articleId, `Article ${suffix}`]
  );

  await pool.query(
    `INSERT INTO factures (id_facture, atelier_id, numero_facture, type_origine, id_origine, client_snapshot, date_emission, montant_total, reference_caisse, lignes_json)
     VALUES ($1, $2, $3, 'VENTE', $4, $5::jsonb, $6, 90, $7, $8::jsonb)`,
    [
      factureId,
      atelierId,
      `FAC-${suffix}`,
      venteId,
      JSON.stringify({ nom: `Nom ${suffix} Prenom ${suffix}`, contact: `+243${suffix.slice(-6)}` }),
      now,
      caisseId,
      JSON.stringify([{ description: `Article ${suffix}`, quantite: 2, prix: 45, montant: 90 }])
    ]
  );

  return {
    clientId,
    commandeId,
    retoucheId,
    caisseId,
    articleId,
    venteId,
    factureId
  };
}

async function login(client, email, motDePasse) {
  const response = await client.post("/api/auth/login").send({ email, motDePasse });
  assert.equal(response.status, 200, `login attendu pour ${email}`);
  return String(response.body?.token || "");
}

async function run() {
  if (!(await tenantSchemaReady())) {
    console.log("SKIPPED: integration multi-tenant business isolation (schema multi-tenant absent)");
    return false;
  }

  const app = createApp();
  const client = request(app);
  const utilisateurRepo = new UtilisateurRepoPg();
  const rolePermissionRepo = new RolePermissionAtelierRepoPg();

  const seed = Date.now();
  const atelierA = `ATELIER_ISO_A_${seed}`;
  const atelierB = `ATELIER_ISO_B_${seed}`;
  await ensureExistingAteliersReferenced();
  await ensureAtelier("ATELIER", "atelier-historique", "Atelier historique");
  await ensureAtelier("ATELIER-001", "atelier-001", "Atelier legacy 001");
  await ensureAtelier(atelierA, `atelier-iso-a-${seed}`, `Atelier Isolation A ${seed}`);
  await ensureAtelier(atelierB, `atelier-iso-b-${seed}`, `Atelier Isolation B ${seed}`);

  const permissions = [
    PERMISSIONS.VOIR_CLIENTS,
    PERMISSIONS.VOIR_COMMANDES,
    PERMISSIONS.VOIR_RETOUCHES,
    PERMISSIONS.GERER_STOCK,
    PERMISSIONS.GERER_VENTES
  ];
  await rolePermissionRepo.save({ atelierId: atelierA, role: ROLES.PROPRIETAIRE, permissions, updatedBy: "integration-test" });
  await rolePermissionRepo.save({ atelierId: atelierB, role: ROLES.PROPRIETAIRE, permissions, updatedBy: "integration-test" });

  const password = "Passw0rd!Isolation";
  const ownerAEmail = `owner.iso.a.${seed}@atelier.local`;
  const ownerBEmail = `owner.iso.b.${seed}@atelier.local`;
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Owner Isolation A",
      email: ownerAEmail,
      roleId: ROLES.PROPRIETAIRE,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: atelierA,
      motDePasseHash: hashPassword(password)
    })
  );
  await utilisateurRepo.save(
    new Utilisateur({
      id: randomUUID(),
      nom: "Owner Isolation B",
      email: ownerBEmail,
      roleId: ROLES.PROPRIETAIRE,
      actif: true,
      etatCompte: ACCOUNT_STATES.ACTIVE,
      atelierId: atelierB,
      motDePasseHash: hashPassword(password)
    })
  );

  const datasetA = await seedBusinessDataset({ atelierId: atelierA, suffix: `${seed}A` });
  const datasetB = await seedBusinessDataset({ atelierId: atelierB, suffix: `${seed}B` });

  const tokenA = await login(client, ownerAEmail, password);

  const clients = await client.get("/api/clients").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(clients.status, 200, "liste clients atelier A doit repondre 200");
  assert.equal(clients.body.some((row) => row.idClient === datasetA.clientId), true, "client atelier A manquant");
  assert.equal(clients.body.some((row) => row.idClient === datasetB.clientId), false, "fuite client atelier B");

  const consultationA = await client
    .get(`/api/clients/${encodeURIComponent(datasetA.clientId)}/consultation`)
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(consultationA.status, 200, "consultation client atelier A doit repondre 200");
  assert.equal(consultationA.body?.synthese?.totalCommandes, 1, "consultation A doit compter 1 commande");
  assert.equal(consultationA.body?.synthese?.totalRetouches, 1, "consultation A doit compter 1 retouche");

  const consultationB = await client
    .get(`/api/clients/${encodeURIComponent(datasetB.clientId)}/consultation`)
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(consultationB.status, 404, "consultation client atelier B doit etre invisible");

  const commandes = await client.get("/api/commandes").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(commandes.status, 200, "liste commandes atelier A doit repondre 200");
  assert.equal(commandes.body.some((row) => row.idCommande === datasetA.commandeId), true, "commande atelier A manquante");
  assert.equal(commandes.body.some((row) => row.idCommande === datasetB.commandeId), false, "fuite commande atelier B");

  const commandeB = await client.get(`/api/commandes/${encodeURIComponent(datasetB.commandeId)}`).set("Authorization", `Bearer ${tokenA}`);
  assert.equal(commandeB.status, 404, "detail commande atelier B doit etre invisible");

  const retouches = await client.get("/api/retouches").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(retouches.status, 200, "liste retouches atelier A doit repondre 200");
  assert.equal(retouches.body.some((row) => row.idRetouche === datasetA.retoucheId), true, "retouche atelier A manquante");
  assert.equal(retouches.body.some((row) => row.idRetouche === datasetB.retoucheId), false, "fuite retouche atelier B");

  const retoucheB = await client.get(`/api/retouches/${encodeURIComponent(datasetB.retoucheId)}`).set("Authorization", `Bearer ${tokenA}`);
  assert.equal(retoucheB.status, 404, "detail retouche atelier B doit etre invisible");

  const caisse = await client.get("/api/caisse").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(caisse.status, 200, "liste caisse atelier A doit repondre 200");
  assert.equal(caisse.body.some((row) => row.idCaisseJour === datasetA.caisseId), true, "caisse atelier A manquante");
  assert.equal(caisse.body.some((row) => row.idCaisseJour === datasetB.caisseId), false, "fuite caisse atelier B");

  const articles = await client.get("/api/stock/articles").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(articles.status, 200, "liste articles atelier A doit repondre 200");
  assert.equal(articles.body.some((row) => row.idArticle === datasetA.articleId), true, "article atelier A manquant");
  assert.equal(articles.body.some((row) => row.idArticle === datasetB.articleId), false, "fuite article atelier B");

  const ventes = await client.get("/api/ventes").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(ventes.status, 200, "liste ventes atelier A doit repondre 200");
  assert.equal(ventes.body.some((row) => row.idVente === datasetA.venteId), true, "vente atelier A manquante");
  assert.equal(ventes.body.some((row) => row.idVente === datasetB.venteId), false, "fuite vente atelier B");

  const factures = await client.get("/api/factures").set("Authorization", `Bearer ${tokenA}`);
  assert.equal(factures.status, 200, "liste factures atelier A doit repondre 200");
  assert.equal(factures.body.some((row) => row.idFacture === datasetA.factureId), true, "facture atelier A manquante");
  assert.equal(factures.body.some((row) => row.idFacture === datasetB.factureId), false, "fuite facture atelier B");

  const factureB = await client.get(`/api/factures/${encodeURIComponent(datasetB.factureId)}`).set("Authorization", `Bearer ${tokenA}`);
  assert.equal(factureB.status, 404, "detail facture atelier B doit etre invisible");
  return true;
}

run()
  .then((executed) => {
    if (executed) {
      console.log("OK: integration multi-tenant business isolation");
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
