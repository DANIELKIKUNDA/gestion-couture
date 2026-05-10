import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { createAuthenticatedSession } from "../tests/helpers/integration-fixtures.js";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "marketing-screenshots");
const FRONTEND_URL = process.env.MARKETING_FRONTEND_URL || "http://127.0.0.1:5173";

const DESKTOP = { width: 1440, height: 960 };
const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true };

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".workspace", { timeout: 45_000 });
  await page.waitForTimeout(1400);
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
      [class*="update"] {
        display: none !important;
      }
      body {
        background: #edf2f7 !important;
      }
    `
  }).catch(() => {});
}

async function authenticatePage(page, token) {
  await page.addInitScript((authToken) => {
    window.localStorage.setItem("access_token", authToken);
    window.localStorage.setItem("token", authToken);
    window.localStorage.setItem("atelier.auth.portal.v1", "atelier");
    window.localStorage.setItem("atelier.auth.slug.v1", "atelier-historique");
  }, token);
}

async function openMobileDrawer(page) {
  const menuButton = page.locator(".mobile-header button").first();
  if (!(await menuButton.count())) return false;
  await menuButton.click({ timeout: 5000, force: true });
  await page.waitForTimeout(400);
  return true;
}

async function openRoute(page, labelCandidates, deviceName = "desktop") {
  for (const label of labelCandidates) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const labelPattern = new RegExp(`^${escapedLabel}$`, "i");
    const item =
      deviceName === "mobile"
        ? page.locator(".bottom-nav-item").filter({ hasText: labelPattern }).first()
        : page.locator(".menu-item").filter({ hasText: labelPattern }).first();
    if (await item.count()) {
      try {
        await item.click({ timeout: 5000 });
        await page.waitForTimeout(1600);
        return true;
      } catch {
        // Try the next label.
      }
    }
  }

  if (deviceName === "mobile" && (await openMobileDrawer(page))) {
    for (const label of labelCandidates) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const labelPattern = new RegExp(`^${escapedLabel}$`, "i");
      const item = page.locator(".menu-item").filter({ hasText: labelPattern }).first();
      if (await item.count()) {
        try {
          await item.click({ timeout: 5000, force: true });
          await page.waitForTimeout(1600);
          return true;
        } catch {
          // Try the next label.
        }
      }
    }
  }

  return false;
}

async function capture(page, deviceName, name, options = {}) {
  if (options.selector) {
    const locator = page.locator(options.selector).first();
    if (await locator.count()) {
      await locator.screenshot({
        path: path.join(OUTPUT_DIR, `${deviceName}-${normalizeName(name)}.png`)
      });
      return;
    }
  }

  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${deviceName}-${normalizeName(name)}.png`),
    fullPage: options.fullPage !== false
  });
}

async function captureSet(browser, viewport, deviceName, token) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: deviceName === "mobile" ? 2 : 1,
    isMobile: viewport.isMobile === true,
    hasTouch: viewport.hasTouch === true
  });
  const page = await context.newPage();
  await authenticatePage(page, token);
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await softenMarketingChrome(page);

  await capture(page, deviceName, "01-tableau-de-bord", { fullPage: false });

  const pages = [
    { name: "02-commandes", labels: ["Commandes"] },
    { name: "03-dossiers", labels: ["Dossiers"] },
    { name: "04-caisse", labels: ["Caisse"] },
    { name: "05-facturation", labels: ["Facturation", "Factures"] },
    { name: "06-stock-vente", labels: ["Stock & Ventes", "Stock", "Ventes", "Articles"] },
    { name: "07-retouches", labels: ["Retouches"] }
  ];

  for (const item of pages) {
    const opened = await openRoute(page, item.labels, deviceName);
    if (opened) {
      await softenMarketingChrome(page);
      await capture(page, deviceName, item.name, { fullPage: false });
    }
  }

  await context.close();
}

async function captureLogin(browser) {
  const context = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-card", { timeout: 45_000 });
  await page.waitForTimeout(1600);
  await capture(page, "mobile", "00-connexion", { fullPage: false });
  await context.close();
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const session = await createAuthenticatedSession({
    atelierId: "ATELIER",
    emailPrefix: "marketing-capture",
    nom: "Volcano Tech Capture",
    permissions: Object.values(PERMISSIONS)
  });

  const browser = await chromium.launch();
  try {
    await captureLogin(browser);
    await captureSet(browser, DESKTOP, "desktop", session.token);
    await captureSet(browser, MOBILE, "mobile", session.token);
  } finally {
    await browser.close();
  }

  console.log(`Captures marketing enregistrees dans ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
