import { test, expect } from "@playwright/test";

import {
  createActor,
  createCommandeInCurrentDossierThroughUi,
  createDossierThroughUi,
  createDossierViaApi,
  createCommandeViaApi,
  ensureAppReady,
  gotoDossiers,
  loginInBrowser,
  tinyPngBuffer
} from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("ajoute une commande dans un dossier et affiche les beneficiaires", async ({ page }) => {
  const actor = await createActor("commande-ui");
  await loginInBrowser(page, actor);

  await createDossierThroughUi(page, {
    nom: "Tshibangu",
    prenom: "Commande",
    typeDossier: "FAMILLE"
  });

  await createCommandeInCurrentDossierThroughUi(page);
  await expect(page.getByRole("heading", { name: /^Detail Commande$/i }).first()).toBeVisible();
  await expect(page.getByText(/Payeur et beneficiaires/i).first()).toBeVisible();
  await expect(page.getByText(/Payeur \+ beneficiaire/i).first()).toBeVisible();
  await expect(page.getByText(/Montant total\s*:/i).first()).toBeVisible();
});

test("upload une photo et la conserve apres refresh UI", async ({ page }) => {
  const actor = await createActor("commande-photo");
  const dossier = await createDossierViaApi(actor, {
    nom: "Photo",
    prenom: "Commande",
    typeDossier: "INDIVIDUEL"
  });

  const commande = await createCommandeViaApi(actor, {
    idCommande: `CMD-E2E-${Date.now()}`,
    idDossier: dossier.idDossier,
    clientPayeurId: dossier.idResponsableClient,
    descriptionCommande: "Commande photo E2E",
    montantTotal: 220,
    datePrevue: new Date(Date.now() + 3 * 86400000).toISOString(),
    typeHabit: "PANTALON",
    mesuresHabit: {
      longueur: 105,
      tourTaille: 82,
      tourHanche: 96,
      largeurBas: 20,
      hauteurFourche: 28
    },
    lignesCommande: [
      {
        role: "PAYEUR_BENEFICIAIRE",
        utiliseClientPayeur: true,
        typeHabit: "PANTALON",
        mesuresHabit: {
          longueur: 105,
          tourTaille: 82,
          tourHanche: 96,
          largeurBas: 20,
          hauteurFourche: 28
        },
        ordreAffichage: 1
      }
    ]
  });

  await loginInBrowser(page, actor);
  await page.getByRole("link", { name: /^Commandes$/i }).click();
  const commandeRow = page.locator("tr").filter({ hasText: commande.idCommande }).first();
  await expect(commandeRow).toBeVisible();
  await commandeRow.getByRole("button", { name: /^Voir$/i }).click();

  const mediaPanel = page.locator(".commande-media-panel");
  await expect(mediaPanel).toBeVisible();
  await mediaPanel.locator('input[type="file"]').first().setInputFiles({
    name: "reference-modele.png",
    mimeType: "image/png",
    buffer: tinyPngBuffer()
  });

  await expect(mediaPanel.locator(".commande-media-card img")).toHaveCount(1);
  await page.getByRole("button", { name: /^Actualiser$/i }).click();
  await expect(mediaPanel.locator(".commande-media-card img")).toHaveCount(1);
});
