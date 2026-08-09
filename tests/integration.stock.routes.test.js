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
  assert.equal(Number(createdArticle.prixAchatMoyen), 8);

  const createLotArticle = await withAuth(session.client.post("/api/stock/articles"), session.token).send({
    nomArticle: "Boutons lot total",
    categorieArticle: "BOUTON",
    uniteStock: "PIECE",
    quantiteDisponible: 4,
    montantAchatInitialTotal: 10000,
    prixVenteUnitaire: 4000,
    seuilAlerte: 1
  });
  assert.equal(createLotArticle.status, 201, "creation article par montant total du lot doit repondre 201");
  assert.equal(Number(createLotArticle.body?.prixAchatMoyen), 2500, "le total initial du lot doit etre converti en cout unitaire");

  const missingCorrectionReason = await withAuth(
    session.client.put(`/api/stock/articles/${encodeURIComponent(articleId)}`),
    session.token
  ).send({
    prixAchatMoyen: 9
  });
  assert.equal(missingCorrectionReason.status, 400, "une correction du cout d'achat sans motif doit etre refusee");

  const updateArticle = await withAuth(session.client.put(`/api/stock/articles/${encodeURIComponent(articleId)}`), session.token).send({
    prixAchatMoyen: 9,
    motifCorrectionPrixAchat: "Le montant total du lot avait ete saisi comme prix unitaire.",
    prixVenteUnitaire: 18,
    seuilAlerte: 3,
    updatedBy: "Stock Owner"
  });
  assert.equal(updateArticle.status, 200, "mise a jour article doit repondre 200");
  assert.equal(Number(updateArticle.body?.prixAchatMoyen), 9);
  assert.equal(Number(updateArticle.body?.prixVenteUnitaire), 18);
  assert.equal(Number(updateArticle.body?.seuilAlerte), 3);

  const priceHistory = await withAuth(session.client.get(`/api/stock/articles/${encodeURIComponent(articleId)}/prix-historique`), session.token);
  assert.equal(priceHistory.status, 200, "historique des prix doit repondre 200");
  assert.equal(priceHistory.body.length >= 2, true, "historiques achat et vente attendus");
  const saleHistory = priceHistory.body.find((row) => row.typePrix === "VENTE");
  const purchaseHistory = priceHistory.body.find((row) => row.typePrix === "ACHAT_MOYEN");
  assert.ok(saleHistory, "historique du prix de vente attendu");
  assert.equal(Number(saleHistory.ancienPrix), 12);
  assert.equal(Number(saleHistory.nouveauPrix), 18);
  assert.ok(purchaseHistory, "historique de correction du cout d'achat attendu");
  assert.equal(Number(purchaseHistory.ancienPrix), 8);
  assert.equal(Number(purchaseHistory.nouveauPrix), 9);
  assert.match(String(purchaseHistory.motifCorrection || ""), /montant total du lot/i);

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
