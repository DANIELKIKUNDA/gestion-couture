import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { createAuthenticatedSession } from "../tests/helpers/integration-fixtures.js";

const OUTPUT_DIR = path.join(process.cwd(), "docs", "marketing-screenshots");
const FRONTEND_URL = process.env.MARKETING_FRONTEND_URL || "http://127.0.0.1:5173";

const VIEWPORTS = {
  desktop: { width: 1440, height: 960 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true }
};

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function authenticatePage(page, token) {
  await page.addInitScript((authToken) => {
    window.localStorage.setItem("access_token", authToken);
    window.localStorage.setItem("token", authToken);
    window.localStorage.setItem("atelier.auth.portal.v1", "atelier");
    window.localStorage.setItem("atelier.auth.slug.v1", "atelier-historique");
  }, token);
}

async function softenMarketingChrome(page) {
  await page.addStyleTag({
    content: `
      .global-toast-host,
      .offline-banner,
      .scroll-top-button,
      .sidebar-user,
      [class*="toast"],
      [class*="install"],
      [class*="update"] { display: none !important; }
      body { background: #edf2f7 !important; }
    `
  }).catch(() => {});
}

async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".workspace", { timeout: 45_000 });
  await softenMarketingChrome(page);
  await page.waitForTimeout(1200);
}

async function openMobileDrawer(page) {
  const button = page.locator(".mobile-header button").first();
  if (!(await button.count())) return false;
  await button.click({ force: true });
  await page.waitForTimeout(500);
  return true;
}

async function openRoute(page, label, deviceName) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const labelPattern = new RegExp(`^${escapedLabel}$`, "i");
  const primary =
    deviceName === "mobile"
      ? page.locator(".bottom-nav-item").filter({ hasText: labelPattern }).first()
      : page.locator(".menu-item").filter({ hasText: labelPattern }).first();
  if (await primary.count()) {
    await primary.click().catch(() => primary.click({ force: true }));
    await page.waitForTimeout(1300);
    await softenMarketingChrome(page);
    return;
  }
  if (deviceName === "mobile" && (await openMobileDrawer(page))) {
    const menuItem = page.locator(".menu-item").filter({ hasText: labelPattern }).first();
    if (await menuItem.count()) {
      await menuItem.click({ force: true });
      await page.waitForTimeout(1300);
      await softenMarketingChrome(page);
    }
  }
}

async function clickFirstOpenAction(page) {
  const candidates = [
    page.getByRole("button", { name: /^Voir detail$/i }).first(),
    page.getByRole("button", { name: /^Voir détail$/i }).first(),
    page.getByRole("button", { name: /^Ouvrir$/i }).first(),
    page.getByRole("button", { name: /^Voir$/i }).first(),
    page.locator("tr button").first()
  ];
  for (const candidate of candidates) {
    if (!(await candidate.count())) continue;
    try {
      await candidate.click({ timeout: 6000 });
      await page.waitForTimeout(1800);
      await softenMarketingChrome(page);
      return true;
    } catch {
      // Try the next candidate.
    }
  }
  return false;
}

async function screenshot(page, deviceName, name) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${deviceName}-${normalizeName(name)}.png`),
    fullPage: false
  });
}

async function captureDevice(browser, session, deviceName) {
  const viewport = VIEWPORTS[deviceName];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: deviceName === "mobile" ? 2 : 1,
    isMobile: viewport.isMobile === true,
    hasTouch: viewport.hasTouch === true
  });
  const page = await context.newPage();
  await authenticatePage(page, session.token);
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await openRoute(page, "Commandes", deviceName);
  if (await clickFirstOpenAction(page)) {
    await screenshot(page, deviceName, "08-detail-commande");
  }

  await openRoute(page, "Retouches", deviceName);
  if (await clickFirstOpenAction(page)) {
    await screenshot(page, deviceName, "09-detail-retouche");
  }

  await openRoute(page, "Dossiers", deviceName);
  if (await clickFirstOpenAction(page)) {
    await screenshot(page, deviceName, "10-detail-dossier");
  }

  await context.close();
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const session = await createAuthenticatedSession({
    atelierId: "ATELIER",
    emailPrefix: "marketing-details",
    nom: "Volcano Tech Studio",
    permissions: Object.values(PERMISSIONS)
  });

  const browser = await chromium.launch();
  try {
    await captureDevice(browser, session, "desktop");
    await captureDevice(browser, session, "mobile");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
