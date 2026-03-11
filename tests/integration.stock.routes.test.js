import assert from "node:assert/strict";

import { createAuthenticatedSession, withAuth } from "./helpers/integration-fixtures.js";

async function run() {
  const session = await createAuthenticatedSession({
    atelierId: `ATELIER_STOCK_${Date.now()}`,
    emailPrefix: "stock",
    nom: "Stock Owner"
  });

  const createArticle = await withAuth(session.client.post("/api/stock/articles"), session.token).send({
    nomArticle: "Wax premium",
    categorieArticle: "TISSU",
    uniteStock: "METRE",
    quantiteDisponible: 10,
    prixAchatInitial: 8,
    prixVenteUnitaire: 12,
    seuilAlerte: 2
  });
  assert.equal(createArticle.status, 201, "creation article doit repondre 201");
  const articleId = String(createArticle.body?.idArticle || "");
  assert.ok(articleId, "id article manquant");

  const listArticles = await withAuth(session.client.get("/api/stock/articles"), session.token);
  assert.equal(listArticles.status, 200, "liste articles doit repondre 200");
  const createdArticle = listArticles.body.find((row) => row.idArticle === articleId);
  assert.ok(createdArticle, "article cree introuvable dans la liste");
  assert.equal(createdArticle.quantiteDisponible, 10);

  const updateArticle = await withAuth(session.client.put(`/api/stock/articles/${encodeURIComponent(articleId)}`), session.token).send({
    prixVenteUnitaire: 18,
    seuilAlerte: 3,
    updatedBy: "Stock Owner"
  });
  assert.equal(updateArticle.status, 200, "mise a jour article doit repondre 200");
  assert.equal(Number(updateArticle.body?.prixVenteUnitaire), 18);
  assert.equal(Number(updateArticle.body?.seuilAlerte), 3);

  const priceHistory = await withAuth(session.client.get(`/api/stock/articles/${encodeURIComponent(articleId)}/prix-historique`), session.token);
  assert.equal(priceHistory.status, 200, "historique des prix doit repondre 200");
  assert.equal(priceHistory.body.length >= 1, true, "historique de prix attendu");
  assert.equal(Number(priceHistory.body[0]?.ancienPrix), 12);
  assert.equal(Number(priceHistory.body[0]?.nouveauPrix), 18);

  const createSupplier = await withAuth(session.client.post("/api/stock/fournisseurs"), session.token).send({
    nomFournisseur: "Fournisseur test",
    telephone: "+243810000002"
  });
  assert.equal(createSupplier.status, 201, "creation fournisseur doit repondre 201");
  const supplierId = String(createSupplier.body?.idFournisseur || "");
  assert.ok(supplierId, "id fournisseur manquant");

  const updateSupplier = await withAuth(session.client.put(`/api/stock/fournisseurs/${encodeURIComponent(supplierId)}`), session.token).send({
    nomFournisseur: "Fournisseur test update",
    telephone: "+243810000003",
    actif: true
  });
  assert.equal(updateSupplier.status, 200, "mise a jour fournisseur doit repondre 200");
  assert.equal(updateSupplier.body?.nomFournisseur, "Fournisseur test update");

  const listSuppliers = await withAuth(session.client.get("/api/stock/fournisseurs"), session.token);
  assert.equal(listSuppliers.status, 200, "liste fournisseurs doit repondre 200");
  assert.equal(listSuppliers.body.some((row) => row.idFournisseur === supplierId), true, "fournisseur cree introuvable");
}

run()
  .then(() => {
    console.log("OK: integration stock routes");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
