import { test, expect } from "@playwright/test";

import {
  createActor,
  createCommandeInCurrentDossierThroughUi,
  createDossierViaApi,
  createCommandeViaApi,
  ensureAppReady,
  gotoDossiers,
  loginInBrowser,
  openCaisseForActor,
  openDossierFromList,
  tinyPngBuffer
} from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("ajoute une commande simple dans un dossier et affiche le client associe", async ({ page }) => {
  const actor = await createActor("commande-ui");
  const dossier = await createDossierViaApi(actor, {
    nom: "Tshibangu",
    prenom: "Commande",
    typeDossier: "FAMILLE"
  });

  await loginInBrowser(page, actor);
  await gotoDossiers(page);
  await openDossierFromList(page, "Tshibangu Commande");
  await createCommandeInCurrentDossierThroughUi(page);
  await expect(page.getByRole("heading", { name: /^Detail Commande$/i }).first()).toBeVisible();
  const summaryCard = page.locator(".detail-summary-shell").first();
  await expect(summaryCard).toBeVisible();
  await expect(summaryCard.getByText(/Client\s*:\s*Tshibangu Commande/i)).toBeVisible();
  await expect(summaryCard.getByText(/Nombre d'habits\s*:/i)).toBeVisible();
  await expect(summaryCard.getByText(/Total\s*:/i).first()).toBeVisible();
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
    }
  });

  await loginInBrowser(page, actor);
  await page.getByRole("link", { name: /^Commandes$/i }).click();
  const commandeRow = page.locator("tr").filter({ hasText: commande.idCommande }).first();
  await expect(commandeRow).toBeVisible();
  await commandeRow.getByRole("button", { name: /^Voir$/i }).click();

  await page.getByRole("button", { name: /^Voir photos$/i }).first().click();
  const mediaPanel = page.locator(".detail-photo-dialog .commande-media-panel");
  await expect(mediaPanel).toBeVisible();
  await mediaPanel.locator('input[type="file"]').first().setInputFiles({
    name: "reference-modele.png",
    mimeType: "image/png",
    buffer: tinyPngBuffer()
  });

  await expect(mediaPanel.locator(".commande-media-card img")).toHaveCount(1);
  await page.getByRole("button", { name: /^Fermer$/i }).click();
  await page.getByRole("button", { name: /^Actualiser$/i }).click();
  await page.getByRole("button", { name: /^Voir photos$/i }).first().click();
  await expect(mediaPanel.locator(".commande-media-card img")).toHaveCount(1);
});

test("modifie un item avant paiement puis bloque la modification apres paiement cible", async ({ page }) => {
  const actor = await createActor("commande-item-edit");
  const dossier = await createDossierViaApi(actor, {
    nom: "Mukendi",
    prenom: "Edition",
    typeDossier: "INDIVIDUEL"
  });

  const commande = await createCommandeViaApi(actor, {
    idCommande: `CMD-E2E-EDIT-${Date.now()}`,
    idDossier: dossier.idDossier,
    clientPayeurId: dossier.idResponsableClient,
    descriptionCommande: "Commande edition item",
    montantTotal: 140,
    items: [
      {
        idItem: `CMD-ITEM-1-${Date.now()}`,
        typeHabit: "PANTALON",
        description: "Pantalon test",
        prix: 100,
        mesures: {
          longueur: 105,
          tourTaille: 82,
          tourHanche: 96,
          largeurBas: 20,
          hauteurFourche: 28
        }
      },
      {
        idItem: `CMD-ITEM-2-${Date.now()}`,
        typeHabit: "CHEMISE",
        description: "Chemise test",
        prix: 40,
        mesures: {
          poitrine: 98,
          longueurChemise: 74,
          typeManches: "longues",
          poignet: 18,
          carrure: 44,
          longueurManches: 63
        }
      }
    ]
  });

  const caisse = await openCaisseForActor(actor, { utilisateur: "commande e2e" });
  expect(caisse.status).toBe(201);

  await loginInBrowser(page, actor);
  await page.getByRole("link", { name: /^Commandes$/i }).click();
  const commandeRow = page.locator("tr").filter({ hasText: commande.idCommande }).first();
  await expect(commandeRow).toBeVisible();
  await commandeRow.getByRole("button", { name: /^Voir$/i }).click();

  await expect(page.locator(".detail-header .row-actions").getByRole("button", { name: /^Modifier$/i })).toBeHidden();

  const pantalonCard = page.locator(".detail-item-card").filter({ hasText: /Pantalon test/i }).first();
  await expect(pantalonCard).toBeVisible();
  await pantalonCard.getByRole("button", { name: /^Modifier$/i }).click();
  const editModal = page.locator(".modal-card").filter({ hasText: /Modifier l'habit/i }).first();
  await expect(editModal).toBeVisible();
  await editModal.locator('input[type="text"]').first().fill("Pantalon corrige");
  await editModal.locator('input[type="number"]').first().fill("110");
  await editModal.getByRole("button", { name: /^Enregistrer$/i }).click();
  await expect(editModal).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".detail-item-card").filter({ hasText: /Pantalon corrige/i }).first()).toBeVisible();

  const chemiseCard = page.locator(".detail-item-card").filter({ hasText: /Chemise test/i }).first();
  await chemiseCard.getByRole("button", { name: /^Payer$/i }).click();
  const paymentModal = page.locator(".modal-card").filter({ hasText: /Confirmer le paiement/i }).first();
  await expect(paymentModal).toBeVisible();
  await paymentModal.locator('input[type="number"]').first().fill("40");
  await paymentModal.getByRole("button", { name: /Confirmer le paiement/i }).click();
  await expect(paymentModal).toBeHidden({ timeout: 15_000 });

  await expect(page.locator(".detail-item-card").filter({ hasText: /Pantalon corrige/i }).first()).toContainText(/Reste\s*:\s*110/i);
  await expect(page.locator(".detail-item-card").filter({ hasText: /Chemise test/i }).first()).toContainText(/Reste\s*:\s*0/i);
  await expect(page.locator(".detail-item-card").filter({ hasText: /Pantalon corrige|Chemise test/i }).getByRole("button", { name: /^Modifier$/i })).toHaveCount(0);
});
