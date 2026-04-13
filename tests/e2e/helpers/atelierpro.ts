import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdirSync, openSync, closeSync, rmSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Locator, type Page } from "@playwright/test";

import { createApp } from "../../../src/interfaces/http/app.js";
import { pool } from "../../../src/shared/infrastructure/db.js";
import { PERMISSIONS } from "../../../src/bc-auth/domain/permissions.js";
import {
  createAuthenticatedSession,
  createDefaultParametresPayload,
  ensureDossierSchema,
  openCaisseViaApi as openCaisseViaApiFixture,
  saveAtelierParametres,
  withAuth
} from "../../helpers/integration-fixtures.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(CURRENT_DIR, "..", "..", "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const RUNTIME_DIR = path.join(ROOT_DIR, "tests", "e2e", ".runtime");
const START_LOCK_PATH = path.join(RUNTIME_DIR, "servers.lock");
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || "http://127.0.0.1:5173";
const API_URL = process.env.E2E_API_URL || "http://127.0.0.1:3000";

type TestActor = {
  atelierId: string;
  atelierSlug: string;
  token: string;
  email: string;
  password: string;
  client: any;
};

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "atelier";
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url: string, timeoutMs = 120_000) {
  const startedAt = Date.now();
  let lastError = "unknown";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error: any) {
      lastError = String(error?.message || error || "network_error");
    }
    await wait(500);
  }
  throw new Error(`Service indisponible sur ${url}: ${lastError}`);
}

function spawnBackgroundProcess(command: string, args: string[], cwd: string, logName: string) {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  let child: ChildProcess;
  try {
    child = spawn(command, args, {
      cwd,
      detached: process.platform !== "win32",
      stdio: "ignore",
      windowsHide: true
    });
  } catch (error: any) {
    if (String(error?.code || "").toUpperCase() !== "EINVAL") throw error;
    child = spawn(command, args, {
      cwd,
      detached: false,
      stdio: "ignore",
      shell: process.platform === "win32" && /\.cmd$/i.test(command),
      windowsHide: true
    });
  }
  child.unref();
  return child;
}

async function startServersIfNeeded() {
  const backendReady = fetch(`${API_URL}/health`).then((res) => res.ok).catch(() => false);
  const frontendReady = fetch(FRONTEND_URL).then((res) => res.ok).catch(() => false);
  if (await backendReady) {
    if (await frontendReady) return;
  }

  mkdirSync(RUNTIME_DIR, { recursive: true });

  let lockAcquired = false;
  try {
    const fd = openSync(START_LOCK_PATH, "wx");
    closeSync(fd);
    lockAcquired = true;
  } catch {
    lockAcquired = false;
  }

  if (!lockAcquired) {
    await waitForHttp(`${API_URL}/health`);
    await waitForHttp(FRONTEND_URL);
    return;
  }

  try {
    const backendOk = await fetch(`${API_URL}/health`).then((res) => res.ok).catch(() => false);
    if (!backendOk) {
      const envFilePath = path.join(ROOT_DIR, ".env");
      const backendArgs = existsSync(envFilePath)
        ? ["--env-file", envFilePath, "src/interfaces/http/server.js"]
        : ["src/interfaces/http/server.js"];
      spawnBackgroundProcess(process.execPath, backendArgs, ROOT_DIR, "backend");
    }

    const frontendOk = await fetch(FRONTEND_URL).then((res) => res.ok).catch(() => false);
    if (!frontendOk) {
      const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
      spawnBackgroundProcess(npmCommand, ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], FRONTEND_DIR, "frontend");
    }

    await waitForHttp(`${API_URL}/health`);
    await waitForHttp(FRONTEND_URL);
  } finally {
    if (existsSync(START_LOCK_PATH)) rmSync(START_LOCK_PATH, { force: true });
  }
}

export async function ensureAppReady() {
  await ensureDossierSchema();
  await startServersIfNeeded();
}

export async function createActor(label = "e2e"): Promise<TestActor> {
  const atelierId = `ATELIER_E2E_${label.toUpperCase()}_${Date.now()}_${randomUUID().slice(0, 6)}`;
  const atelierSlug = slugify(atelierId);
  const session = await createAuthenticatedSession({
    app: createApp(),
    atelierId,
    emailPrefix: `e2e-${label}`,
    permissions: Object.values(PERMISSIONS)
  });

  await saveAtelierParametres({
    atelierId,
    payload: createDefaultParametresPayload({
      identite: {
        nomAtelier: `Atelier E2E ${label}`
      }
    })
  });

  return {
    atelierId,
    atelierSlug,
    token: session.token,
    email: session.email,
    password: session.password,
    client: session.client
  };
}

export async function openCaisseForActor(actor: TestActor, { utilisateur = "E2E User", soldeOuverture = 100 } = {}) {
  return openCaisseViaApiFixture({
    client: actor.client,
    token: actor.token,
    utilisateur,
    soldeOuverture
  });
}

export async function loginInBrowser(page: Page, actor: TestActor) {
  await page.addInitScript(
    ({ token, atelierSlug }) => {
      window.localStorage.setItem("access_token", token);
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("atelier.auth.portal.v1", "atelier");
      window.localStorage.setItem("atelier.auth.slug.v1", atelierSlug);
    },
    { token: actor.token, atelierSlug: actor.atelierSlug }
  );
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Chargement de la session/i)).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator(".workspace")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".topbar")).toBeVisible({ timeout: 45_000 });
}

export async function gotoDossiers(page: Page) {
  await page.getByRole("link", { name: /^Dossiers$/i }).click();
  await expect(page.getByText(/Centre des operations atelier/i)).toBeVisible();
}

export async function openDossierFromList(page: Page, responsableName: string) {
  const card = page.locator(".dossier-card").filter({ hasText: responsableName }).first();
  const row = page.locator("tr").filter({ hasText: responsableName }).first();
  await expect(card.or(row).first()).toBeVisible({ timeout: 15_000 });

  if ((await card.count()) && (await card.isVisible())) {
    await expect(card).toBeVisible();
    const openButton = card.getByRole("button", { name: /^Ouvrir$/i }).first();
    if (await openButton.count()) {
      await openButton.click();
    } else {
      await card.click();
    }
  } else {
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^Ouvrir$/i }).click();
  }
  await expect(page.getByRole("heading", { name: /^Detail Dossier$/i }).first()).toBeVisible();
  await expect(page.locator(".dossier-workspace-hero").first()).toContainText(new RegExp(responsableName, "i"));
}

export async function createDossierThroughUi(
  page: Page,
  {
    nom = "Responsable",
    prenom = "Dossier",
    telephone = `+24381${Date.now().toString().slice(-7)}`,
    typeDossier = "FAMILLE"
  } = {}
) {
  await gotoDossiers(page);
  const newDossierButton = page.getByRole("button", { name: /Nouveau dossier/i });
  await expect(newDossierButton).toBeVisible();
  await newDossierButton.click({ force: true });
  const modal = page.locator(".modal-card").filter({ hasText: "Ouvrir un dossier" }).first();
  await expect(modal).toBeVisible();
  await modal.locator(".segmented").getByRole("button", { name: /^Nouveau responsable$/i }).click();
  const inputs = modal.locator("input");
  await inputs.nth(0).fill(nom);
  await inputs.nth(1).fill(prenom);
  await inputs.nth(2).fill(telephone);
  await modal.locator("select").first().selectOption(typeDossier);
  await modal.getByRole("button", { name: /Creer le dossier/i }).click();
  await expect(page.getByRole("heading", { name: /^Detail Dossier$/i }).first()).toBeVisible();
  await expect(page.locator(".dossier-workspace-hero").first()).toContainText(new RegExp(`${nom}\\s+${prenom}`, "i"));
  return {
    responsableNomComplet: `${nom} ${prenom}`.trim(),
    telephone
  };
}

export async function chooseFirstNonPlaceholder(select: Locator) {
  const firstValue = await select.locator("option").evaluateAll((options) => {
    const match = options
      .map((option) => ({ value: (option as HTMLOptionElement).value, disabled: (option as HTMLOptionElement).disabled }))
      .find((option) => option.value && !option.disabled);
    return match?.value || "";
  });
  if (!firstValue) throw new Error("Aucune option selectable trouvee.");
  await select.selectOption(firstValue);
}

export async function chooseOptionByLabel(select: Locator, patterns: RegExp[]) {
  const options = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      label: String((node as HTMLOptionElement).label || (node as HTMLOptionElement).textContent || "").trim(),
      disabled: (node as HTMLOptionElement).disabled
    }))
  );

  const match = options.find(
    (option) => option.value && !option.disabled && patterns.some((pattern) => pattern.test(option.label))
  );
  if (!match) return false;
  await select.selectOption(match.value);
  return true;
}

export async function fillVisibleMeasureFields(container: Locator) {
  const numberInputs = container.locator('.form-grid input[type="number"]:visible');
  const numberCount = await numberInputs.count();
  for (let index = 0; index < numberCount; index += 1) {
    await numberInputs.nth(index).fill(String(10 + index));
  }

  const textInputs = container.locator('.form-grid input[type="text"]:visible');
  const textCount = await textInputs.count();
  for (let index = 0; index < textCount; index += 1) {
    await textInputs.nth(index).fill(`mesure-${index + 1}`);
  }

  const selects = container.locator(".form-grid select:visible");
  const selectCount = await selects.count();
  for (let index = 0; index < selectCount; index += 1) {
    await chooseFirstNonPlaceholder(selects.nth(index));
  }
}

function futureDate(daysAhead = 5) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function createCommandeInCurrentDossierThroughUi(page: Page) {
  await page.getByRole("button", { name: /\+ Commande|Ajouter une commande/i }).click();
  const modal = page.locator(".modal-card").filter({ hasText: "Nouvelle commande" }).first();
  await expect(modal).toBeVisible();

  await modal.getByRole("button", { name: /^Continuer$/i }).click();
  const step = modal.locator("section.modal-body:visible").first();

  const label = `Commande E2E ${Date.now()}`;
  await chooseFirstNonPlaceholder(step.locator("select:visible").first());
  await step.getByPlaceholder(/Pantalon bleu marine/i).fill(label);
  await step.locator('article input[type="number"]:visible').first().fill("150");
  await step.getByPlaceholder(/Commande mariage/i).fill(label);
  await step.locator('input[type="date"]:visible').first().fill(futureDate());

  await modal.getByRole("button", { name: /Continuer vers les mesures/i }).click();
  const mesuresStep = modal.locator("section.modal-body:visible").first();
  await fillVisibleMeasureFields(mesuresStep);

  await modal.getByRole("button", { name: /Continuer vers le resume/i }).click();
  await expect(modal.getByRole("heading", { name: /Verification finale/i })).toBeVisible();
  await modal.getByRole("button", { name: /Creer la commande/i }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Detail Commande$/i }).first()).toBeVisible();
}

export async function createRetoucheInCurrentDossierThroughUi(page: Page) {
  await page.getByRole("button", { name: /\+ Retouche|Ajouter une retouche/i }).click();
  const modal = page.locator(".modal-card").filter({ hasText: "Nouvelle retouche" }).first();
  await expect(modal).toBeVisible();

  await modal.getByRole("button", { name: /^Continuer$/i }).click();
  const step = modal.locator("section.modal-body:visible").first();
  const selects = step.locator("select:visible");
  const typeSelect = selects.nth(0);
  const matchedType =
    (await chooseOptionByLabel(typeSelect, [/ourlet pantalon/i])) ||
    (await chooseOptionByLabel(typeSelect, [/ourlet/i])) ||
    false;
  if (!matchedType) await chooseFirstNonPlaceholder(typeSelect);
  await step.locator('article input[type="number"]:visible').first().fill("40");
  const label = `Retouche E2E ${Date.now()}`;
  await step.getByPlaceholder(/Ajuster l'ourlet/i).fill(label);
  await modal.getByRole("button", { name: /Continuer vers la configuration/i }).click();

  const configStep = modal.locator("section.modal-body:visible").first();
  const habitSelect = configStep.locator("select:visible").first();
  const matchedHabit =
    (await chooseOptionByLabel(habitSelect, [/pantalon/i, /robe/i])) ||
    false;
  if (!matchedHabit) await chooseFirstNonPlaceholder(habitSelect);
  await fillVisibleMeasureFields(configStep);
  const textInputs = configStep.locator('input[type="text"]:visible');
  const textCount = await textInputs.count();
  if (textCount > 0) {
    await textInputs.first().fill(label);
  }
  await configStep.locator('input[type="date"]:visible').first().fill(futureDate());

  await modal.getByRole("button", { name: /Continuer vers le resume/i }).click();
  await expect(modal.getByRole("heading", { name: /Verification finale/i })).toBeVisible();
  const submitButton = modal.getByRole("button", { name: /Creer la retouche/i }).first();

  // Le wizard retouche synchronise encore quelques champs derives avant de soumettre.
  // En CI Windows, un clic trop rapide peut laisser la modal ouverte sans creation.
  await expect(submitButton).toBeEnabled({ timeout: 10_000 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await submitButton.click();
    try {
      await Promise.race([
        expect(modal).toBeHidden({ timeout: 10_000 }),
        expect(page.getByRole("heading", { name: /^Detail Retouche$/i }).first()).toBeVisible({ timeout: 10_000 })
      ]);
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      await expect(submitButton).toBeEnabled({ timeout: 10_000 });
    }
  }
  await expect(page.getByRole("heading", { name: /^Detail Retouche$/i }).first()).toBeVisible();
}

export async function createDossierViaApi(
  actor: TestActor,
  {
    nom = "Api",
    prenom = "Dossier",
    telephone = `+24399${Date.now().toString().slice(-7)}`,
    typeDossier = "FAMILLE"
  } = {}
) {
  const response = await withAuth(actor.client.post("/api/dossiers"), actor.token).send({
    typeDossier,
    nouveauResponsable: {
      idClient: `CL-${randomUUID().slice(0, 8)}`,
      nom,
      prenom,
      telephone
    }
  });
  expect(response.status).toBe(201);
  return response.body?.dossier || response.body;
}

export async function createCommandeViaApi(actor: TestActor, payload: Record<string, unknown>) {
  const response = await withAuth(actor.client.post("/api/commandes"), actor.token).send(payload);
  expect(response.status).toBe(201);
  return response.body?.commande || response.body;
}

export async function createRetoucheViaApi(actor: TestActor, payload: Record<string, unknown>) {
  const response = await withAuth(actor.client.post("/api/retouches"), actor.token).send(payload);
  expect(response.status, JSON.stringify(response.body || {})).toBe(201);
  return response.body?.retouche || response.body;
}

export async function setCommandeState(
  atelierId: string,
  idCommande: string,
  {
    statut = "EN_COURS",
    montantPaye = 0,
    datePrevueDaysOffset = 0
  }: { statut?: string; montantPaye?: number; datePrevueDaysOffset?: number } = {}
) {
  const datePrevue = new Date();
  datePrevue.setDate(datePrevue.getDate() + datePrevueDaysOffset);
  await pool.query(
    `UPDATE commandes
     SET statut = $1,
         montant_paye = $2,
         date_prevue = $3
     WHERE atelier_id = $4
       AND id_commande = $5`,
    [statut, montantPaye, datePrevue.toISOString(), atelierId, idCommande]
  );
}

export async function setRetoucheState(
  atelierId: string,
  idRetouche: string,
  {
    statut = "EN_COURS",
    montantPaye = 0,
    datePrevueDaysOffset = 0
  }: { statut?: string; montantPaye?: number; datePrevueDaysOffset?: number } = {}
) {
  const datePrevue = new Date();
  datePrevue.setDate(datePrevue.getDate() + datePrevueDaysOffset);
  await pool.query(
    `UPDATE retouches
     SET statut = $1,
         montant_paye = $2,
         date_prevue = $3
     WHERE atelier_id = $4
       AND id_retouche = $5`,
    [statut, montantPaye, datePrevue.toISOString(), atelierId, idRetouche]
  );
}

export async function getScrollState(page: Page) {
  return page.locator(".content-scroll").evaluate((node) => ({
    scrollTop: (node as HTMLElement).scrollTop,
    height: (node as HTMLElement).scrollHeight
  }));
}

export async function expectScrollStable(page: Page, durationMs = 2000) {
  const stateBefore = await getScrollState(page);
  const sameNode = await page.evaluate((duration) => {
    const scrollHost = document.querySelector(".content-scroll");
    const hero = document.querySelector(".dossier-workspace-hero");
    (window as any).__e2eDossierHero = hero;
    (window as any).__e2eScrollTop = scrollHost instanceof HTMLElement ? scrollHost.scrollTop : window.scrollY;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        const nextScrollHost = document.querySelector(".content-scroll");
        const nextHero = document.querySelector(".dossier-workspace-hero");
        const nextScrollTop = nextScrollHost instanceof HTMLElement ? nextScrollHost.scrollTop : window.scrollY;
        resolve({
          sameHero: (window as any).__e2eDossierHero === nextHero,
          scrollDelta: Math.abs(((window as any).__e2eScrollTop || 0) - nextScrollTop)
        });
      }, duration);
    });
  }, durationMs);
  expect((sameNode as any).sameHero).toBeTruthy();
  expect((sameNode as any).scrollDelta).toBeLessThanOrEqual(2);
  const stateAfter = await getScrollState(page);
  expect(Math.abs(stateBefore.scrollTop - stateAfter.scrollTop)).toBeLessThanOrEqual(2);
}

export async function expectNoBlink(locator: Locator, durationMs = 2000, action?: () => Promise<void>) {
  await expect(locator).toBeVisible();
  const handle = await locator.elementHandle();
  if (!handle) throw new Error("Element introuvable pour l'observation visuelle.");

  const observer = handle.evaluate(
    async (node, duration) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < duration) {
        const el = node as HTMLElement;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible =
          el.isConnected &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) {
          return {
            ok: false,
            reason: {
              isConnected: el.isConnected,
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              width: rect.width,
              height: rect.height
            }
          };
        }
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      return { ok: true };
    },
    durationMs
  );

  if (action) await action();
  const result = await observer;
  expect(result.ok, JSON.stringify(result)).toBeTruthy();
}

export async function expectSidebarVisible(page: Page) {
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.getByRole("button", { name: /Deconnexion/i })).toBeVisible();
}

export function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
    "base64"
  );
}
