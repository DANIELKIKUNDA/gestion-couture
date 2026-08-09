import { test, expect } from "@playwright/test";

import { createActor, ensureAppReady, loginInBrowser, openCaisseForActor } from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("separe resultat du jour et soldes cumulatifs Atelier/Stock", async ({ page }) => {
  const actor = await createActor("caisse-finance");
  const opened = await openCaisseForActor(actor, { utilisateur: "owner e2e", soldeOuverture: 500000 });
  expect(opened.status).toBe(201);
  const caisseId = opened.body.idCaisseJour;

  const allocation = await actor.client
    .put("/api/caisse/soldes-activite/repartition-initiale")
    .set("Authorization", `Bearer ${actor.token}`)
    .send({ soldeAtelierInitial: 400000, soldeStockInitial: 100000 });
  expect(allocation.status).toBe(200);

  const entree = await actor.client
    .post(`/api/caisse/${encodeURIComponent(caisseId)}/entrees/manuelles`)
    .set("Authorization", `Bearer ${actor.token}`)
    .send({ montant: 50000, justification: "Encaissement atelier E2E", activite: "ATELIER" });
  expect(entree.status).toBe(200);

  const quotidienne = await actor.client
    .post(`/api/caisse/${encodeURIComponent(caisseId)}/sorties`)
    .set("Authorization", `Bearer ${actor.token}`)
    .send({
      montant: 10000,
      motif: "Depense quotidienne E2E",
      typeDepense: "QUOTIDIENNE",
      activite: "ATELIER",
      role: "PROPRIETAIRE"
    });
  expect(quotidienne.status).toBe(200);

  const exceptionnelle = await actor.client
    .post(`/api/caisse/${encodeURIComponent(caisseId)}/sorties`)
    .set("Authorization", `Bearer ${actor.token}`)
    .send({
      montant: 80000,
      motif: "Depense exceptionnelle E2E",
      typeDepense: "EXCEPTIONNELLE",
      justification: "Investissement paye depuis le solde global",
      activite: "ATELIER",
      role: "PROPRIETAIRE"
    });
  expect(exceptionnelle.status).toBe(200);

  await loginInBrowser(page, actor);
  await page.locator("nav a").filter({ hasText: /^Caisse$/i }).first().click();
  await expect(page.getByText(/Caisse du jour/i).first()).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText(/Solde Atelier/i).first()).toBeVisible();
  await expect(page.getByText(/360[\s\u202f]?000\s*FC/i).first()).toBeVisible();
  await expect(page.getByText(/Solde Stock/i).first()).toBeVisible();
  await expect(page.getByText(/100[\s\u202f]?000\s*FC/i).first()).toBeVisible();
  await expect(page.getByText(/Resultat du jour/i).first()).toBeVisible();
  await expect(page.getByText(/40[\s\u202f]?000\s*FC/i).first()).toBeVisible();
  await expect(page.getByText(/460[\s\u202f]?000\s*FC/i).first()).toBeVisible();
});
