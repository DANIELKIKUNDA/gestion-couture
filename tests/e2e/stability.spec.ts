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

function authRequest(actor: any, method: "get" | "post", path: string) {
  return actor.client[method](path).set("Authorization", `Bearer ${actor.token}`);
}

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

async function seedFlaggedDossier() {
  const actor = await createActor("stability");
  const responsableName = `Workspace Stable ${Date.now()}`;
  const [nom, prenom, extra] = responsableName.split(" ");
  const dossier = await createDossierViaApi(actor, {
    nom: `${nom} ${prenom}`.trim(),
    prenom: extra || "Stable",
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
    mesuresHabit: { longueur: 100, tourTaille: 80, tourHanche: 90, largeurBas: 18, hauteurFourche: 26 }
  });
  await authRequest(actor, "post", `/api/commandes/${encodeURIComponent(overdueCommande.idCommande)}/paiements`).send({ montant: 10 });
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
    mesuresHabit: { longueur: 101, tourTaille: 81, tourHanche: 91, largeurBas: 19, hauteurFourche: 27 }
  });
  await authRequest(actor, "post", `/api/commandes/${encodeURIComponent(readyCommande.idCommande)}/paiements`).send({ montant: 40 });
  await authRequest(actor, "post", `/api/commandes/${encodeURIComponent(readyCommande.idCommande)}/terminer`).send({});
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
    typeRetouche: "OURLET_PANTALON",
    montantTotal: 60,
    datePrevue: new Date(Date.now() + 1 * 86400000).toISOString(),
    typeHabit: "PANTALON",
    mesuresHabit: { longueur: 98 }
  });
  await authRequest(actor, "post", `/api/retouches/${encodeURIComponent(cashRetouche.idRetouche)}/paiements`).send({ montant: 10 });
  await authRequest(actor, "post", `/api/retouches/${encodeURIComponent(cashRetouche.idRetouche)}/terminer`).send({});
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
    typeRetouche: "OURLET_PANTALON",
    montantTotal: 50,
    datePrevue: new Date(Date.now()).toISOString(),
    typeHabit: "PANTALON",
    mesuresHabit: { longueur: 95 }
  });
  await authRequest(actor, "post", `/api/retouches/${encodeURIComponent(doneRetouche.idRetouche)}/paiements`).send({ montant: 50 });
  await authRequest(actor, "post", `/api/retouches/${encodeURIComponent(doneRetouche.idRetouche)}/terminer`).send({});
  await authRequest(actor, "post", `/api/retouches/${encodeURIComponent(doneRetouche.idRetouche)}/livrer`).send({});
  await setRetoucheState(actor.atelierId, doneRetouche.idRetouche, {
    statut: "LIVREE",
    montantPaye: 50,
    datePrevueDaysOffset: -1
  });

  return {
    actor,
    dossier,
    responsableName,
    expectedLabels: ["Commande en retard", "Commande terminee", "Retouche a encaisser", "Retouche soldee"]
  };
}

async function openSeededDossier(page: any, { responsableName, expectedLabels = [] }: { responsableName: string; expectedLabels?: string[] }) {
  await gotoDossiers(page);
  const card = page.locator(".dossier-card").filter({ hasText: responsableName }).first();
  if (await card.count()) {
    await expect(card).toBeVisible();
    const openButton = card.getByRole("button", { name: /^Ouvrir$/i }).first();
    if (await openButton.count()) {
      await openButton.click();
    } else {
      await card.click();
    }
  } else {
    const row = page.locator("tr").filter({ hasText: responsableName }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^Ouvrir$/i }).click();
  }
  await expect(page.getByRole("heading", { name: /^Detail Dossier$/i }).first()).toBeVisible();
  await expect(page.locator(".dossier-workspace-hero").first()).toContainText(new RegExp(responsableName, "i"));
  await page.getByRole("button", { name: /^Actualiser$/i }).click();
  await expect
    .poll(async () => {
      const columnsCount = await page.locator(".dossier-document-column").count();
      const cardCount = await page.locator(".dossier-workspace-card").count();
      const headingHits = await Promise.all([
        page.getByRole("heading", { name: /^Retouches$/i }).count(),
        page.getByRole("heading", { name: /^Commandes$/i }).count()
      ]);
      return columnsCount + cardCount + headingHits.reduce((sum, count) => sum + count, 0);
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
}

test("garde un scroll stable et un DOM principal non recree sur le detail dossier", async ({ page }) => {
  const { actor, responsableName, expectedLabels } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, { responsableName, expectedLabels });

  await page.locator(".content-scroll").evaluate((node) => {
    (node as HTMLElement).scrollTop = 360;
  });

  await expectScrollStable(page, 2000);
});

test("detecte le clignotement d un bouton critique pendant un refresh", async ({ page }) => {
  const { actor, responsableName, expectedLabels } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, { responsableName, expectedLabels });

  const criticalButton = page.getByRole("button", { name: /^Encaisser$/i }).first();
  await expectNoBlink(criticalButton, 2000, async () => {
    await page.getByRole("button", { name: /^Actualiser$/i }).click();
  });
});

test("resiste a plusieurs refresh rapides sans reset brutal", async ({ page }) => {
  const { actor, responsableName, expectedLabels } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, { responsableName, expectedLabels });

  const dossierHeading = page.locator(".dossier-workspace-hero").first();
  const cashButton = page.getByRole("button", { name: /^Encaisser$/i }).first();
  await expect(dossierHeading).toBeVisible();
  await expect(cashButton).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: /^Actualiser$/i }).click();
  }

  await expect(dossierHeading).toBeVisible();
  await expect(cashButton).toBeVisible();
  await expectSidebarVisible(page);
});

test("affiche correctement les colonnes dossier et les statuts backend", async ({ page }) => {
  const { actor, responsableName, expectedLabels } = await seedFlaggedDossier();
  await loginInBrowser(page, actor);
  await openSeededDossier(page, { responsableName, expectedLabels });

  await expect(page.getByRole("heading", { name: /^Retouches$/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Commandes$/i }).first()).toBeVisible();
  await expect(page.locator(".dossier-document-column")).toHaveCount(2);

  await expect(page.getByText(/RET-/i).first()).toBeVisible();
  await expect(page.getByText(/CMD-/i).first()).toBeVisible();

  await expect(page.getByText(/^EN_COURS$/i).first()).toBeVisible();
  await expect(page.getByText(/^TERMINEE$/i).first()).toBeVisible();
  await expect(page.getByText(/^LIVREE$/i).first()).toBeVisible();

  await expect(page.getByRole("button", { name: /^Voir$/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Payer$/i }).first()).toBeVisible();
});
