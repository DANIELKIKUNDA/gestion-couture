import { test, expect } from "@playwright/test";

import {
  createActor,
  createDossierThroughUi,
  createRetoucheInCurrentDossierThroughUi,
  ensureAppReady,
  loginInBrowser
} from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("ajoute une retouche dans un dossier avec affichage correct du beneficiaire", async ({ page }) => {
  const actor = await createActor("retouche-ui");
  await loginInBrowser(page, actor);

  const dossier = await createDossierThroughUi(page, {
    nom: "Nsapu",
    prenom: "Retouche",
    typeDossier: "INDIVIDUEL"
  });

  await createRetoucheInCurrentDossierThroughUi(page);
  await expect(page.getByRole("heading", { name: /^Detail Retouche$/i }).first()).toBeVisible();
  await expect(page.getByText(/Client\s*:/i).first()).toBeVisible();
  await expect(page.getByText(new RegExp(dossier.responsableNomComplet, "i")).first()).toBeVisible();
  await expect(page.getByText(/Montant total\s*:/i).first()).toBeVisible();
});
