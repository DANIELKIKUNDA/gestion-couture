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
  const homeMode = page.getByRole("radio", { name: /Ouvrir ma page d'accueil/i });
  await expect(homeMode).toBeVisible();
  await homeMode.check();

  const homeSelect = page.getByLabel(/Page d'accueil/i);
  await expect(homeSelect).toBeEnabled();
  await homeSelect.selectOption("caisse");

  const darkTheme = page.getByRole("radio", { name: /Sombre/i });
  await darkTheme.check();
  await page.getByRole("button", { name: /Enregistrer mes preferences/i }).click();
  await expect(page.getByText(/Preferences enregistrees/i)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const account = await actor.client.get("/api/auth/account").set("Authorization", `Bearer ${actor.token}`);
  expect(account.status).toBe(200);
  expect(account.body.preferences.pageAccueil).toBe("caisse");
  expect(account.body.preferences.modeDemarrage).toBe("PAGE_ACCUEIL");
  expect(account.body.preferences.restaurerDernierePage).toBe(false);
  expect(account.body.preferences.theme).toBe("SOMBRE");

  await page.reload();
  await expect(page.getByRole("heading", { name: /Caisse du jour/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("le theme Systeme suit le theme du terminal", async ({ page }) => {
  const actor = await createActor("account-system-theme");
  await page.emulateMedia({ colorScheme: "dark" });
  await loginInBrowser(page, actor);
  await page.getByTitle("Ouvrir mon compte").click();
  await page.getByRole("tab", { name: /^Preferences$/i }).click();
  await page.getByRole("radio", { name: /Systeme/i }).check();
  await page.getByRole("button", { name: /Enregistrer mes preferences/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
