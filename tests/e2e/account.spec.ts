import { test, expect } from "@playwright/test";

import { createActor, ensureAppReady, loginInBrowser } from "./helpers/atelierpro";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 960 } });

test.beforeAll(async () => {
  await ensureAppReady();
});

test("ouvre Mon compte et enregistre des preferences personnelles", async ({ page }) => {
  const actor = await createActor("account");
  await loginInBrowser(page, actor);

  await page.getByTitle("Ouvrir mon compte").click();
  await expect(page.getByText(/ESPACE PERSONNEL/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: /^Profil$/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Securite$/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Preferences$/i })).toBeVisible();

  await page.getByRole("tab", { name: /^Preferences$/i }).click();
  const homeSelect = page.getByLabel(/Page d'accueil preferee/i);
  await expect(homeSelect).toBeVisible();
  await homeSelect.selectOption("caisse");
  const restoreLastPage = page.getByLabel(/Reprendre ma derniere page/i);
  if (await restoreLastPage.isChecked()) await restoreLastPage.uncheck();
  await page.getByRole("button", { name: /Enregistrer mes preferences/i }).click();
  await expect(page.getByText(/Preferences enregistrees/i)).toBeVisible();

  const account = await actor.client.get("/api/auth/account").set("Authorization", `Bearer ${actor.token}`);
  expect(account.status).toBe(200);
  expect(account.body.preferences.pageAccueil).toBe("caisse");
  expect(account.body.preferences.restaurerDernierePage).toBe(false);
});
