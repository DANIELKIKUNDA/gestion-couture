import { mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { createAuthenticatedSession } from "../tests/helpers/integration-fixtures.js";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "marketing-videos");
const RAW_DIR = path.join(OUTPUT_DIR, ".raw");
const FRONTEND_URL = process.env.MARKETING_FRONTEND_URL || "http://127.0.0.1:5173";

const DESKTOP = { width: 1440, height: 810 };
const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true };

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
      body { background: #edf2f7 !important; }
      .atelierpro-demo-caption {
        position: fixed;
        left: 28px;
        bottom: 30px;
        z-index: 3000;
        width: min(520px, calc(100vw - 56px));
        padding: 18px 20px;
        border: 1px solid rgba(255,255,255,.42);
        border-radius: 22px;
        color: #fff;
        background: linear-gradient(135deg, rgba(12,23,55,.94), rgba(31,90,162,.9));
        box-shadow: 0 22px 60px rgba(8,21,47,.34);
        backdrop-filter: blur(14px);
        font-family: "Space Grotesk", "Segoe UI", sans-serif;
        animation: atelierproDemoIn .38s ease both;
      }
      .atelierpro-demo-caption strong {
        display: block;
        font-size: clamp(22px, 2vw, 32px);
        line-height: 1.06;
        letter-spacing: 0;
      }
      .atelierpro-demo-caption span {
        display: block;
        margin-top: 8px;
        font-size: clamp(13px, 1.1vw, 16px);
        line-height: 1.45;
        color: rgba(244,248,255,.84);
      }
      .atelierpro-demo-caption[data-tone="green"] {
        background: linear-gradient(135deg, rgba(12,74,50,.94), rgba(35,140,85,.9));
      }
      .atelierpro-demo-caption[data-tone="gold"] {
        background: linear-gradient(135deg, rgba(91,61,12,.95), rgba(181,126,45,.9));
      }
      @media (max-width: 640px) {
        .atelierpro-demo-caption {
          left: 18px;
          right: 18px;
          bottom: calc(88px + env(safe-area-inset-bottom));
          width: auto;
          padding: 15px 16px;
          border-radius: 18px;
        }
        .atelierpro-demo-caption strong { font-size: 21px; }
        .atelierpro-demo-caption span { font-size: 13px; }
      }
      @keyframes atelierproDemoIn {
        from { opacity: 0; transform: translateY(16px) scale(.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `
  }).catch(() => {});
}

async function showCaption(page, title, subtitle = "", tone = "blue", duration = 2500) {
  await page.evaluate(
    ({ title, subtitle, tone }) => {
      document.querySelectorAll(".atelierpro-demo-caption").forEach((node) => node.remove());
      const caption = document.createElement("div");
      caption.className = "atelierpro-demo-caption";
      caption.dataset.tone = tone;
      caption.innerHTML = `<strong></strong><span></span>`;
      caption.querySelector("strong").textContent = title;
      caption.querySelector("span").textContent = subtitle;
      document.body.appendChild(caption);
    },
    { title, subtitle, tone }
  );
  await wait(duration);
}

async function clearCaption(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".atelierpro-demo-caption").forEach((node) => node.remove());
  }).catch(() => {});
}

async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".workspace", { timeout: 45_000 });
  await softenMarketingChrome(page);
  await wait(1200);
}

async function loginViaUi(page, session, deviceName) {
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-card", { timeout: 45_000 });
  await softenMarketingChrome(page);
  await showCaption(
    page,
    "AtelierPro",
    "Une application moderne pour piloter un atelier de couture.",
    "gold",
    deviceName === "mobile" ? 2100 : 2400
  );
  await page.locator("#login-email").fill(session.email);
  await wait(350);
  await page.locator("#login-password").fill(session.password);
  await wait(350);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await waitForApp(page);
}

async function openMobileDrawer(page) {
  const menuButton = page.locator(".mobile-header button").first();
  if (!(await menuButton.count())) return false;
  await menuButton.click({ timeout: 5000, force: true });
  await wait(500);
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
        await wait(1100);
        await softenMarketingChrome(page);
        return true;
      } catch {
        // Try drawer or next label.
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
          await wait(1200);
          await softenMarketingChrome(page);
          return true;
        } catch {
          // Try the next label.
        }
      }
    }
  }

  return false;
}

async function gentleScroll(page, distance = 420) {
  await page.mouse.wheel(0, distance);
  await wait(900);
}

async function runStory(page, deviceName) {
  await showCaption(page, "Tableau de bord clair", "Voyez l'etat de l'atelier, l'argent disponible et les priorites du jour.", "blue");
  await gentleScroll(page, deviceName === "mobile" ? 360 : 280);

  if (await openRoute(page, ["Commandes"], deviceName)) {
    await showCaption(page, "Commandes suivies", "Recherche, statuts, soldes et delais restent visibles en quelques secondes.", "blue");
    await gentleScroll(page, deviceName === "mobile" ? 420 : 300);
  }

  if (await openRoute(page, ["Dossiers"], deviceName)) {
    await showCaption(page, "Dossiers clients organises", "Chaque client, famille et historique reste facile a retrouver.", "green");
    await gentleScroll(page, deviceName === "mobile" ? 380 : 280);
  }

  if (await openRoute(page, ["Caisse"], deviceName)) {
    await showCaption(page, "Caisse lisible", "Les entrees, sorties et operations du jour sont presentees proprement.", "gold");
    await gentleScroll(page, deviceName === "mobile" ? 360 : 260);
  }

  if (await openRoute(page, ["Stock & Ventes", "Stock"], deviceName)) {
    await showCaption(page, "Stock et ventes", "Suivez les articles, les ventes et les approvisionnements depuis le meme espace.", "green");
    await gentleScroll(page, deviceName === "mobile" ? 430 : 300);
  }

  if (await openRoute(page, ["Facturation", "Factures"], deviceName)) {
    await showCaption(page, "Factures pretes", "Retrouvez rapidement les factures et les paiements associes.", "blue");
    await gentleScroll(page, deviceName === "mobile" ? 360 : 260);
  }

  if (await openRoute(page, ["Retouches"], deviceName)) {
    await showCaption(page, "Retouches maitrisees", "L'atelier suit les corrections et les travaux rapides sans confusion.", "gold");
  }

  await showCaption(page, "AtelierPro par Volcano Tech", "Une solution SaaS moderne pour les ateliers qui veulent travailler plus vite et plus proprement.", "green", 3200);
  await clearCaption(page);
}

async function recordVideo(browser, viewport, deviceName, session) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: deviceName === "mobile" ? 2 : 1,
    isMobile: viewport.isMobile === true,
    hasTouch: viewport.hasTouch === true,
    recordVideo: {
      dir: RAW_DIR,
      size: {
        width: viewport.width,
        height: viewport.height
      }
    }
  });
  const page = await context.newPage();
  await loginViaUi(page, session, deviceName);
  await runStory(page, deviceName);
  const video = page.video();
  await context.close();

  const rawPath = await video.path();
  const outputPath = path.join(OUTPUT_DIR, `atelierpro-demo-${deviceName}.webm`);
  await copyFile(rawPath, outputPath);
  return outputPath;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });

  const session = await createAuthenticatedSession({
    atelierId: "ATELIER",
    emailPrefix: "marketing-video",
    nom: "Volcano Tech Demo",
    permissions: Object.values(PERMISSIONS)
  });

  const browser = await chromium.launch();
  try {
    const desktopPath = await recordVideo(browser, DESKTOP, "desktop", session);
    const mobilePath = await recordVideo(browser, MOBILE, "mobile", session);
    await rm(RAW_DIR, { recursive: true, force: true });
    console.log(`Video desktop: ${desktopPath}`);
    console.log(`Video mobile: ${mobilePath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
