import { test, expect } from "@playwright/test";

import { createActor, ensureAppReady, loginInBrowser, openCaisseForActor } from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

async function createStockArticle(actor: any, overrides: Record<string, unknown> = {}) {
  const response = await actor.client
    .post("/api/stock/articles")
    .set("Authorization", `Bearer ${actor.token}`)
    .send({
      nomArticle: `Wax stock E2E ${Date.now()}`,
      categorieArticle: "TISSU",
      uniteStock: "METRE",
      quantiteDisponible: 10,
      prixAchatInitialUnitaire: 800,
      prixVenteUnitaire: 1200,
      seuilAlerte: 2,
      ...overrides
    });
  expect(response.status).toBe(201);
  return response.body;
}

async function gotoStock(page: any) {
  await page.getByRole("link", { name: /Stock\s*&\s*Ventes/i }).click();
  await expect(page.getByText(/^Stock & Ventes$/i).first()).toBeVisible({ timeout: 30_000 });
}

test("affiche la valorisation et audite une correction du cout d'achat", async ({ page }) => {
  const actor = await createActor("stock-correction");
  const article = await createStockArticle(actor);

  await loginInBrowser(page, actor);
  await gotoStock(page);

  await expect(page.getByText(/Valeur actuelle au cout d'achat/i)).toBeVisible();
  await expect(page.getByText("Valeur de vente potentielle", { exact: true })).toBeVisible();
  await expect(page.getByText(/Benefice brut potentiel/i)).toBeVisible();
  await expect(page.getByText(/8[\s\u202f]?000\s*FC/i)).toBeVisible();
  await expect(page.getByText(/12[\s\u202f]?000\s*FC/i)).toBeVisible();

  const row = page.locator("tr").filter({ hasText: article.nomArticle }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /^Modifier$/i }).click();

  const modal = page.locator(".modal-card").filter({ hasText: /Modifier l'article/i }).first();
  await expect(modal).toBeVisible();
  await modal.getByLabel(/Cout d'achat moyen unitaire/i).fill("900");
  await modal.getByLabel(/Motif de correction du cout d'achat/i).fill("Le total du lot avait ete saisi comme prix unitaire.");
  await modal.getByRole("button", { name: /^Enregistrer$/i }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });

  const history = await actor.client
    .get(`/api/stock/articles/${encodeURIComponent(article.idArticle)}/prix-historique`)
    .set("Authorization", `Bearer ${actor.token}`);
  expect(history.status).toBe(200);
  const purchaseCorrection = history.body.find((item: any) => item.typePrix === "ACHAT_MOYEN");
  expect(purchaseCorrection).toBeTruthy();
  expect(Number(purchaseCorrection.ancienPrix)).toBe(800);
  expect(Number(purchaseCorrection.nouveauPrix)).toBe(900);
  expect(String(purchaseCorrection.motifCorrection || "")).toMatch(/total du lot/i);

  const refreshedRow = page.locator("tr").filter({ hasText: article.nomArticle }).first();
  await refreshedRow.getByRole("button", { name: /^Historique$/i }).click();
  const historyModal = page.locator(".modal-card").filter({ hasText: /Historique des prix/i }).first();
  await expect(historyModal).toBeVisible();
  await expect(historyModal.getByText(/Cout d'achat moyen/i)).toBeVisible();
  await expect(historyModal.getByText(/total du lot avait ete saisi/i)).toBeVisible();
  await expect(historyModal.getByText(/800\s*FC/i)).toBeVisible();
  await expect(historyModal.getByText(/900\s*FC/i)).toBeVisible();
});

test("saisit un achat par montant total du lot et calcule le cout unitaire", async ({ page }) => {
  const actor = await createActor("stock-lot");
  const article = await createStockArticle(actor, {
    quantiteDisponible: 0,
    prixAchatInitialUnitaire: 0,
    prixVenteUnitaire: 4000
  });
  const caisse = await openCaisseForActor(actor, { utilisateur: "stock e2e", soldeOuverture: 100000 });
  expect(caisse.status).toBe(201);

  await loginInBrowser(page, actor);
  await gotoStock(page);

  const row = page.locator("tr").filter({ hasText: article.nomArticle }).first();
  await row.getByRole("button", { name: /^Acheter$/i }).click();

  const modal = page.locator(".modal-card").filter({ hasText: /Acheter du stock/i }).first();
  await expect(modal).toBeVisible();
  await modal.getByLabel(/Quantite achetee/i).fill("4");
  await modal.getByLabel(/Mode de saisie du cout/i).selectOption("LOT_TOTAL");
  await modal.getByLabel(/Montant d'achat/i).fill("10000");
  await expect(modal.getByText(/Cout d'achat unitaire/i)).toBeVisible();
  await expect(modal.getByText(/2[\s\u202f]?500\s*FC/i)).toBeVisible();
  await expect(modal.getByText(/10[\s\u202f]?000\s*FC/i)).toBeVisible();
  await modal.getByRole("button", { name: /Enregistrer l'achat/i }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });

  const list = await actor.client.get("/api/stock/articles").set("Authorization", `Bearer ${actor.token}`);
  expect(list.status).toBe(200);
  const updated = list.body.find((item: any) => item.idArticle === article.idArticle);
  expect(Number(updated.quantiteDisponible)).toBe(4);
  expect(Number(updated.prixAchatMoyen)).toBe(2500);
});
