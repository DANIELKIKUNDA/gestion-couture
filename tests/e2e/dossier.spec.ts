import { test, expect } from "@playwright/test";

import {
  createActor,
  createDossierThroughUi,
  ensureAppReady,
  expectSidebarVisible,
  gotoDossiers,
  loginInBrowser
} from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("demarre l application sans erreur visible", async ({ page }) => {
  const actor = await createActor("boot");
  await loginInBrowser(page, actor);

  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".error-panel")).toHaveCount(0);
  await expectSidebarVisible(page);
});

test("cree un dossier et le retrouve dans la liste", async ({ page }) => {
  const actor = await createActor("dossier-create");
  await loginInBrowser(page, actor);

  const dossier = await createDossierThroughUi(page, {
    nom: "Mukeba",
    prenom: "Famille",
    typeDossier: "FAMILLE"
  });

  await expect(page.getByRole("button", { name: /\+ Commande|Ajouter une commande/i })).toBeVisible();
  await expect(page.getByText(/Workspace dossier/i)).toBeVisible();

  await page.getByRole("button", { name: /^Retour$/i }).click();
  await expect(page.getByText(new RegExp(dossier.responsableNomComplet, "i"))).toBeVisible();
});

test("navigue dossiers -> detail -> retour sans perdre la navigation", async ({ page }) => {
  const actor = await createActor("dossier-nav");
  await loginInBrowser(page, actor);

  const dossier = await createDossierThroughUi(page, {
    nom: "Kalonji",
    prenom: "Navigation",
    typeDossier: "INDIVIDUEL"
  });

  await expectSidebarVisible(page);
  await expect(page.getByRole("button", { name: /^Retour$/i })).toBeVisible();

  await page.getByRole("button", { name: /^Retour$/i }).click();
  await expectSidebarVisible(page);
  await expect(page.getByText(new RegExp(dossier.responsableNomComplet, "i"))).toBeVisible();
});
