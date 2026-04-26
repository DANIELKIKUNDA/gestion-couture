import { test, expect } from "@playwright/test";

import {
  createActor,
  createDossierViaApi,
  createRetoucheViaApi,
  createRetoucheInCurrentDossierThroughUi,
  ensureAppReady,
  gotoDossiers,
  loginInBrowser,
  openCaisseForActor,
  openDossierFromList
} from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("ajoute une retouche dans un dossier avec affichage correct du beneficiaire", async ({ page }) => {
  const actor = await createActor("retouche-ui");
  const responsableNomComplet = "Nsapu Retouche";
  const dossier = await createDossierViaApi(actor, {
    nom: "Nsapu",
    prenom: "Retouche",
    typeDossier: "INDIVIDUEL"
  });

  await loginInBrowser(page, actor);
  await gotoDossiers(page);
  await openDossierFromList(page, "Nsapu Retouche");
  await createRetoucheInCurrentDossierThroughUi(page);
  await expect(page.getByRole("heading", { name: /^Detail Retouche$/i }).first()).toBeVisible();
  const summaryCard = page.locator(".detail-summary-shell").first();
  await expect(summaryCard).toBeVisible();
  await expect(summaryCard.getByText(/Client\s*:/i).first()).toBeVisible();
  await expect(summaryCard.getByText(new RegExp(responsableNomComplet, "i")).first()).toBeVisible();
  await expect(summaryCard.getByText(/Total\s*:/i).first()).toBeVisible();
});

test("paye une intervention ciblee et masque la modification apres paiement", async ({ page }) => {
  const actor = await createActor("retouche-item-pay");
  const dossier = await createDossierViaApi(actor, {
    nom: "Banza",
    prenom: "Retouche",
    typeDossier: "INDIVIDUEL"
  });

  const retouche = await createRetoucheViaApi(actor, {
    idRetouche: `RET-E2E-${Date.now()}`,
    idDossier: dossier.idDossier,
    idClient: dossier.idResponsableClient,
    descriptionRetouche: "Retouche edition item",
    typeRetouche: "OURLET_PANTALON",
    typeHabit: "PANTALON",
    montantTotal: 40,
    mesuresHabit: { longueur: 140 },
    items: [
      {
        idItem: `RET-ITEM-1-${Date.now()}`,
        typeRetouche: "OURLET_PANTALON",
        typeHabit: "PANTALON",
        description: "Ourlet principal",
        prix: 25,
        mesures: { longueur: 140 }
      },
      {
        idItem: `RET-ITEM-2-${Date.now()}`,
        typeRetouche: "OURLET_PANTALON",
        typeHabit: "PANTALON",
        description: "Ourlet secondaire",
        prix: 15,
        mesures: { longueur: 136 }
      }
    ]
  });

  const caisse = await openCaisseForActor(actor, { utilisateur: "retouche e2e" });
  expect(caisse.status).toBe(201);

  await loginInBrowser(page, actor);
  await page.getByRole("link", { name: /^Retouches$/i }).click();
  const retoucheRow = page.locator("tr").filter({ hasText: retouche.idRetouche }).first();
  await expect(retoucheRow).toBeVisible();
  await retoucheRow.getByRole("button", { name: /^Voir$/i }).click();

  await expect(page.locator(".detail-header .row-actions").getByRole("button", { name: /^Modifier$/i })).toBeHidden();

  const itemCard = page.locator(".detail-item-card").filter({ hasText: /Ourlet secondaire/i }).first();
  await expect(itemCard).toBeVisible();
  await itemCard.getByRole("button", { name: /^Payer$/i }).click();
  const paymentModal = page.locator(".modal-card").filter({ hasText: /Confirmer le paiement/i }).first();
  await expect(paymentModal).toBeVisible();
  await paymentModal.locator('input[type="number"]').first().fill("15");
  await paymentModal.getByRole("button", { name: /Confirmer le paiement/i }).click();
  await expect(paymentModal).toBeHidden({ timeout: 15_000 });

  await expect(page.locator(".detail-item-card").filter({ hasText: /Ourlet principal/i }).first()).toContainText(/Reste\s*:\s*25/i);
  await expect(page.locator(".detail-item-card").filter({ hasText: /Ourlet secondaire/i }).first()).toContainText(/Reste\s*:\s*0/i);
  await expect(page.locator(".detail-item-card").getByRole("button", { name: /^Modifier$/i })).toHaveCount(0);
});

test("protege la creation retouche sur retour navigateur", async ({ page }) => {
  const actor = await createActor("retouche-back-guard");
  await createDossierViaApi(actor, {
    nom: "Retour",
    prenom: "Retouche",
    typeDossier: "INDIVIDUEL"
  });

  await loginInBrowser(page, actor);
  await gotoDossiers(page);
  await openDossierFromList(page, "Retour Retouche");

  await page.getByRole("button", { name: /\+ Retouche|Ajouter une retouche/i }).click();
  const wizardModal = page.locator(".modal-card-wizard").filter({ hasText: /Nouvelle retouche/i }).first();
  await expect(wizardModal).toBeVisible();

  await wizardModal.getByPlaceholder(/^Ex: raccourcir manche, changer fermeture, ajuster robe$/i).fill("Retouche non enregistree");
  await page.goBack();

  const confirmModal = page.locator(".modal-card").filter({ hasText: /Quitter sans enregistrer/i }).first();
  await expect(confirmModal).toBeVisible();
  await confirmModal.getByRole("button", { name: /Continuer la saisie/i }).click();
  await expect(confirmModal).toBeHidden({ timeout: 10_000 });
  await expect(wizardModal).toBeVisible();

  await page.goBack();
  await expect(confirmModal).toBeVisible();
  await confirmModal.getByRole("button", { name: /^Quitter$/i }).click();
  await expect(wizardModal).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /^Detail Dossier$/i }).first()).toBeVisible();
});
