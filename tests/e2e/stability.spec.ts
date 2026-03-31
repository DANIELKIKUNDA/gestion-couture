import { test, expect } from "@playwright/test";

import {
  createActor,
  createCommandeViaApi,
  createDossierViaApi,
  createRetoucheViaApi,
  ensureAppReady,
  expectNoBlink,
  expectScrollStable,
  expectSidebarVisible,
  gotoDossiers,
  loginInBrowser,
  setCommandeState,
  setRetoucheState
} from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

async function seedFlaggedDossier() {
  const actor = await createActor("stability");
  const dossier = await createDossierViaApi(actor, {
    nom: "Workspace",
    prenom: "Stable",
    typeDossier: "FAMILLE"
  });

  const overdueCommande = await createCommandeViaApi(actor, {
    idCommande: `CMD-OVERDUE-${Date.now()}`,
    idDossier: dossier.idDossier,
    clientPayeurId: dossier.idResponsableClient,
    descriptionCommande: "Commande en retard",
    montantTotal: 180,
    datePrevue: new Date(Date.now() - 3 * 86400000).toISOString(),
    typeHabit: "PANTALON",
    mesuresHabit: { longueur: 100, tourTaille: 80, tourHanche: 90, largeurBas: 18, hauteurFourche: 26 },
    lignesCommande: [
      {
        role: "PAYEUR_BENEFICIAIRE",
        utiliseClientPayeur: true,
        typeHabit: "PANTALON",
        mesuresHabit: { longueur: 100, tourTaille: 80, tourHanche: 90, largeurBas: 18, hauteurFourche: 26 },
        ordreAffichage: 1
      }
    ]
  });
  await setCommandeState(actor.atelierId, overdueCommande.idCommande, {
    statut: "EN_COURS",
    montantPaye: 0,
    datePrevueDaysOffset: -3
  });

  const readyCommande = await createCommandeViaApi(actor, {
    idCommande: `CMD-READY-${Date.now()}`,
    idDossier: dossier.idDossier,
    clientPayeurId: dossier.idResponsableClient,
    descriptionCommande: "Commande terminee",
    montantTotal: 200,
    datePrevue: new Date(Date.now() + 2 * 86400000).toISOString(),
    typeHabit: "PANTALON",
    mesuresHabit: { longueur: 101, tourTaille: 81, tourHanche: 91, largeurBas: 19, hauteurFourche: 27 },
    lignesCommande: [
      {
        role: "PAYEUR_BENEFICIAIRE",
        utiliseClientPayeur: true,
        typeHabit: "PANTALON",
        mesuresHabit: { longueur: 101, tourTaille: 81, tourHanche: 91, largeurBas: 19, hauteurFourche: 27 },
        ordreAffichage: 1
      }
    ]
  });
  await setCommandeState(actor.atelierId, readyCommande.idCommande, {
    statut: "TERMINEE",
    montantPaye: 40,
    datePrevueDaysOffset: 1
  });

  const cashRetouche = await createRetoucheViaApi(actor, {
    idRetouche: `RET-CASH-${Date.now()}`,
    idDossier: dossier.idDossier,
    idClient: dossier.idResponsableClient,
    descriptionRetouche: "Retouche a encaisser",
    typeRetouche: "OURLET",
    montantTotal: 60,
    datePrevue: new Date(Date.now() + 1 * 86400000).toISOString(),
    typeHabit: "ROBE",
    mesuresHabit: { longueur: 98 }
  });
  await setRetoucheState(actor.atelierId, cashRetouche.idRetouche, {
    statut: "LIVREE",
    montantPaye: 0,
    datePrevueDaysOffset: -1
  });

  const doneRetouche = await createRetoucheViaApi(actor, {
    idRetouche: `RET-DONE-${Date.now()}`,
    idDossier: dossier.idDossier,
    idClient: dossier.idResponsableClient,
    descriptionRetouche: "Retouche soldee",
    typeRetouche: "OURLET",
    montantTotal: 50,
    datePrevue: new Date(Date.now()).toISOString(),
    typeHabit: "ROBE",
    mesuresHabit: { longueur: 95 }
  });
  await setRetoucheState(actor.atelierId, doneRetouche.idRetouche, {
    statut: "LIVREE",
    montantPaye: 50,
    datePrevueDaysOffset: -1
  });

  return { actor, dossier };
}

async function openSeededDossier(page: any, responsableName: string) {
  await gotoDossiers(page);
  await page.locator("tr").filter({ hasText: responsableName }).first().getByRole("button", { name: /^Ouvrir$/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(responsableName, "i") })).toBeVisible();
}

test("garde un scroll stable et un DOM principal non recree sur le detail dossier", async ({ page }) => {
  const { actor } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, "Workspace Stable");

  await page.locator(".content-scroll").evaluate((node) => {
    (node as HTMLElement).scrollTop = 360;
  });

  await expectScrollStable(page, 2000);
});

test("detecte le clignotement d un bouton critique pendant un refresh", async ({ page }) => {
  const { actor } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, "Workspace Stable");

  const criticalButton = page.getByRole("button", { name: /^Encaisser$/i }).first();
  await expectNoBlink(criticalButton, 2000, async () => {
    await page.getByRole("button", { name: /^Actualiser$/i }).click();
  });
});

test("resiste a plusieurs refresh rapides sans reset brutal", async ({ page }) => {
  const { actor } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, "Workspace Stable");

  const hero = page.locator(".dossier-workspace-hero");
  await expect(hero).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: /^Actualiser$/i }).click();
  }

  await expect(hero).toBeVisible();
  await expect(page.locator(".dossier-workspace-sections")).toBeVisible();
  await expectSidebarVisible(page);
});

test("affiche correctement les flags metier et les sections prioritaires", async ({ page }) => {
  const { actor } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, "Workspace Stable");

  await expect(page.getByRole("heading", { name: /^A faire$/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Pret$/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^A encaisser$/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Termine$/i })).toBeVisible();
  await expect(page.getByText(/En retard/i).first()).toBeVisible();
  await expect(page.getByText(/Terminee non livree/i).first()).toBeVisible();
  await expect(page.getByText(/Solde ouvert/i).first()).toBeVisible();
});
