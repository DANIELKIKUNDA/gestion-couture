import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { chromium } from "@playwright/test";

import { PERMISSIONS } from "../src/bc-auth/domain/permissions.js";
import { ROLES } from "../src/bc-auth/domain/roles.js";
import { pool } from "../src/shared/infrastructure/db.js";
import {
  createAuthenticatedSession,
  createClientViaApi,
  createCommandeViaApi,
  createDefaultParametresPayload,
  createRetoucheViaApi,
  openCaisseViaApi,
  saveAtelierParametres,
  withAuth
} from "../tests/helpers/integration-fixtures.js";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "marketing-screenshots", "ksg-final");
const FRONTEND_URL = process.env.MARKETING_FRONTEND_URL || "http://127.0.0.1:5173";
const ATELIER_ID = "ATELIER_KSG_COUTURE_MARKETING";
const ATELIER_SLUG = "atelier-ksg-couture-marketing";
const ALL_TENANT_PERMISSIONS = Object.values(PERMISSIONS).filter((permission) => permission !== PERMISSIONS.GERER_ATELIERS);

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

async function waitForHttp(url, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError = "unknown";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String(error?.message || error || "network_error");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Service indisponible sur ${url}: ${lastError}`);
}

async function prepareAtelier() {
  const owner = await createAuthenticatedSession({
    atelierId: ATELIER_ID,
    role: ROLES.PROPRIETAIRE,
    permissions: ALL_TENANT_PERMISSIONS,
    emailPrefix: "marketing-owner",
    nom: "Daniel Ksg"
  });
  const cashier = await createAuthenticatedSession({
    atelierId: ATELIER_ID,
    role: ROLES.CAISSIER,
    permissions: ALL_TENANT_PERMISSIONS,
    emailPrefix: "marketing-cashier",
    nom: "Caissier KSG"
  });
  const tailor = await createAuthenticatedSession({
    atelierId: ATELIER_ID,
    role: ROLES.COUTURIER,
    permissions: ALL_TENANT_PERMISSIONS,
    emailPrefix: "marketing-tailor",
    nom: "Couturier KSG"
  });

  await saveAtelierParametres({
    atelierId: ATELIER_ID,
    payload: createDefaultParametresPayload({
      identite: {
        nomAtelier: "KSG COUTURE",
        adresse: "Lubumbashi",
        telephone: "+243 000 000 000",
        email: "contact@ksg-couture.local",
        devise: "FC"
      },
      caisse: {
        ouvertureAuto: "07:30",
        ouvertureDimanche: "08:00",
        clotureAutoMinuit: false,
        clotureAutoActive: false,
        heureClotureAuto: "23:59"
      },
      securite: {
        rolesAutorises: ["PROPRIETAIRE", "CAISSIER"],
        confirmationAvantSauvegarde: false,
        verrouillageActif: false,
        auditLog: []
      }
    })
  });
  await pool.query(
    `UPDATE ateliers
     SET nom = 'KSG COUTURE',
         updated_at = NOW()
     WHERE id_atelier = $1`,
    [ATELIER_ID]
  ).catch(() => {});

  await seedMarketingData(owner);
  return { owner, cashier, tailor };
}

async function seedMarketingData(actor) {
  const caisseResponse = await openCaisseViaApi({
    client: actor.client,
    token: actor.token,
    utilisateur: "Daniel KSG",
    soldeOuverture: 275000
  });
  const caisse = caisseResponse.body?.caisse || caisseResponse.body;
  const idCaisseJour = caisse?.idCaisseJour || caisse?.id;

  if (idCaisseJour) {
    await withAuth(actor.client.post(`/api/caisse/${encodeURIComponent(idCaisseJour)}/entrees/manuelles`), actor.token).send({
      montant: 185000,
      justification: "Avances clients du matin",
      modePaiement: "CASH",
      utilisateur: "Daniel KSG",
      activite: "ATELIER",
      idempotencyKey: randomUUID()
    }).catch(() => {});
    await withAuth(actor.client.post(`/api/caisse/${encodeURIComponent(idCaisseJour)}/sorties`), actor.token).send({
      montant: 45000,
      motif: "Achat fournitures atelier",
      typeDepense: "QUOTIDIENNE",
      justification: "Fils, boutons et emballages",
      utilisateur: "Daniel KSG",
      role: "PROPRIETAIRE",
      activite: "ATELIER",
      idempotencyKey: randomUUID()
    }).catch(() => {});
  }

  const clients = [];
  for (const payload of [
    { nom: "Mulumba", prenom: "Jean", telephone: "+243810001001" },
    { nom: "Kalolo", prenom: "Judith", telephone: "+243810001002" },
    { nom: "Kabulo", prenom: "Francine", telephone: "+243810001003" }
  ]) {
    const response = await createClientViaApi({ client: actor.client, token: actor.token, ...payload });
    clients.push(response.body?.client || response.body);
  }

  const dossierResponse = await withAuth(actor.client.post("/api/dossiers"), actor.token).send({
    typeDossier: "FAMILLE",
    nouveauResponsable: {
      idClient: `CL-${randomUUID().slice(0, 8)}`,
      nom: "Famille",
      prenom: "Mukendi",
      telephone: "+243810001010"
    }
  });
  const dossier = dossierResponse.body?.dossier || dossierResponse.body;
  const dossierId = dossier?.idDossier;

  const commandeA = await createCommandeViaApi({
    client: actor.client,
    token: actor.token,
    idClient: clients[0]?.idClient,
    idDossier: dossierId,
    descriptionCommande: "Costume homme bleu nuit pour ceremonie",
    montantTotal: 220000,
    montantPaye: 80000,
    typeHabit: "PANTALON",
    datePrevue: new Date().toISOString(),
    mesuresHabit: {
      longueur: 105,
      tourTaille: 82,
      tourHanche: 96,
      largeurBas: 20,
      hauteurFourche: 28
    }
  });
  const commandeB = await createCommandeViaApi({
    client: actor.client,
    token: actor.token,
    idClient: clients[1]?.idClient,
    descriptionCommande: "Robe elegante avec finitions pagne",
    montantTotal: 165000,
    typeHabit: "ROBE",
    datePrevue: new Date().toISOString(),
    mesuresHabit: {
      poitrine: 96,
      taille: 84,
      hanche: 104,
      longueur: 145,
      largeurBas: 72
    }
  });

  const idCommandeA = (commandeA.body?.commande || commandeA.body)?.idCommande;
  const idCommandeB = (commandeB.body?.commande || commandeB.body)?.idCommande;
  await withAuth(actor.client.post(`/api/commandes/${encodeURIComponent(idCommandeA)}/paiements`), actor.token).send({ montant: 80000 }).catch(() => {});
  await withAuth(actor.client.post(`/api/commandes/${encodeURIComponent(idCommandeB)}/paiements`), actor.token).send({ montant: 165000 }).catch(() => {});
  await withAuth(actor.client.post(`/api/commandes/${encodeURIComponent(idCommandeB)}/terminer`), actor.token).send({}).catch(() => {});
  await pool.query(
    `UPDATE commandes
     SET date_prevue = NOW(),
         statut = CASE WHEN id_commande = $2 THEN 'EN_COURS' ELSE statut END
     WHERE atelier_id = $1
       AND id_commande IN ($2, $3)`,
    [ATELIER_ID, idCommandeA, idCommandeB]
  ).catch(() => {});

  const retouche = await createRetoucheViaApi({
    client: actor.client,
    token: actor.token,
    idClient: clients[2]?.idClient,
    idDossier: dossierId,
    descriptionRetouche: "Ajustement pantalon et ourlet express",
    typeRetouche: "OURLET_PANTALON",
    montantTotal: 35000,
    typeHabit: "PANTALON",
    datePrevue: new Date().toISOString(),
    mesuresHabit: { longueur: 98, tourTaille: 78 }
  });
  const idRetouche = (retouche.body?.retouche || retouche.body)?.idRetouche;
  await withAuth(actor.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/paiements`), actor.token).send({ montant: 35000 }).catch(() => {});
  await withAuth(actor.client.post(`/api/retouches/${encodeURIComponent(idRetouche)}/terminer`), actor.token).send({}).catch(() => {});
  await pool.query(
    `UPDATE retouches
     SET date_prevue = NOW()
     WHERE atelier_id = $1
       AND id_retouche = $2`,
    [ATELIER_ID, idRetouche]
  ).catch(() => {});

  const article = await withAuth(actor.client.post("/api/stock/articles"), actor.token).send({
    nomArticle: "Pagne wax premium",
    categorieArticle: "TISSU",
    uniteStock: "PIECE",
    quantiteDisponible: 0,
    seuilAlerte: 5,
    prixAchatInitial: 25000,
    prixVenteUnitaire: 38000
  });
  const idArticle = article.body?.idArticle || article.body?.article?.idArticle;
  if (idArticle) {
    await withAuth(actor.client.post(`/api/stock/articles/${encodeURIComponent(idArticle)}/entrees`), actor.token).send({
      quantite: 12,
      motif: "ACHAT",
      prixAchatUnitaire: 25000,
      fournisseur: "Fournisseur Lubumbashi",
      sourceFinancement: "ATELIER",
      idempotencyKey: randomUUID()
    }).catch(() => {});
  }
}

async function authenticatePage(page, session) {
  await page.addInitScript(({ token, slug }) => {
    window.localStorage.setItem("access_token", token);
    window.localStorage.setItem("token", token);
    window.localStorage.setItem("atelier.auth.portal.v1", "atelier");
    window.localStorage.setItem("atelier.auth.slug.v1", slug);
  }, { token: session.token, slug: ATELIER_SLUG });
}

async function polishForMarketing(page) {
  await page.addStyleTag({
    content: `
      .global-toast-host,
      .scroll-top-button,
      [class*="toast"],
      [class*="install"],
      [class*="update"] {
        display: none !important;
      }
      body {
        background: #eef2f7 !important;
      }
    `
  }).catch(() => {});
}

async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".workspace", { timeout: 60_000 });
  await page.waitForSelector(".topbar, .mobile-header", { timeout: 60_000 });
  await polishForMarketing(page);
  await page.waitForTimeout(1800);
}

async function openMobileDrawer(page) {
  const button = page.locator(".mobile-header button").first();
  if (!(await button.count())) return false;
  await button.click({ force: true });
  await page.waitForTimeout(500);
  return true;
}

async function openRoute(page, labels, deviceName) {
  const labelList = Array.isArray(labels) ? labels : [labels];
  for (const label of labelList) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const labelPattern = new RegExp(`^${escapedLabel}$`, "i");
    const primary =
      deviceName === "mobile"
        ? page.locator(".bottom-nav-item").filter({ hasText: labelPattern }).first()
        : page.locator(".menu-item").filter({ hasText: labelPattern }).first();
    if (await primary.count()) {
      await primary.click({ timeout: 7000 }).catch(() => primary.click({ force: true }));
      await page.waitForTimeout(1600);
      await polishForMarketing(page);
      return true;
    }
  }

  if (deviceName === "mobile" && (await openMobileDrawer(page))) {
    for (const label of labelList) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const labelPattern = new RegExp(`^${escapedLabel}$`, "i");
      const menuItem = page.locator(".menu-item").filter({ hasText: labelPattern }).first();
      if (await menuItem.count()) {
        await menuItem.click({ force: true });
        await page.waitForTimeout(1600);
        await polishForMarketing(page);
        return true;
      }
    }
  }
  return false;
}

async function clickFirstDetails(page) {
  const candidates = [
    page.getByRole("button", { name: /^Voir detail$/i }).first(),
    page.getByRole("button", { name: /^Voir le detail$/i }).first(),
    page.getByRole("button", { name: /^Voir détail$/i }).first(),
    page.getByRole("button", { name: /^Voir le détail$/i }).first(),
    page.getByRole("button", { name: /^Ouvrir$/i }).first(),
    page.getByRole("button", { name: /^Voir$/i }).first(),
    page.locator("article").filter({ hasText: /COMMANDE|RET-|CMD-|Dossier|FAMILLE/i }).first(),
    page.locator(".mobile-card, .dossier-card, .commande-card, .retouche-card").first(),
    page.locator("tr button").first()
  ];
  for (const candidate of candidates) {
    if (!(await candidate.count())) continue;
    try {
      await candidate.click({ timeout: 7000 });
      await page.waitForTimeout(1800);
      await polishForMarketing(page);
      return true;
    } catch {
      // next candidate
    }
  }
  return false;
}

async function screenshot(page, deviceName, name, fullPage = false) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${deviceName}-${normalizeName(name)}.png`),
    fullPage
  });
}

async function newMarketingPage(browser, deviceName, session) {
  const viewport = VIEWPORTS[deviceName];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: deviceName === "mobile" ? 2 : 1,
    isMobile: viewport.isMobile === true,
    hasTouch: viewport.hasTouch === true
  });
  const page = await context.newPage();
  await authenticatePage(page, session);
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

async function captureDashboard(browser, deviceName, name, session) {
  const { context, page } = await newMarketingPage(browser, deviceName, session);
  await screenshot(page, deviceName, name);
  await context.close();
}

async function captureFlow(browser, deviceName, session) {
  const { context, page } = await newMarketingPage(browser, deviceName, session);

  await openRoute(page, "Caisse", deviceName);
  await screenshot(page, deviceName, "04-caisse-intelligente");

  await openRoute(page, "Commandes", deviceName);
  await screenshot(page, deviceName, "05-commandes");
  if (await clickFirstDetails(page)) {
    await screenshot(page, deviceName, "06-detail-commande");
  }

  await openRoute(page, "Retouches", deviceName);
  await screenshot(page, deviceName, "07-retouches");

  await openRoute(page, "Dossiers", deviceName);
  await screenshot(page, deviceName, "08-dossiers-clients");

  await openRoute(page, ["Stock & Ventes", "Stock", "Ventes", "Articles"], deviceName);
  await screenshot(page, deviceName, "09-stock-et-vente");

  await context.close();
}

async function captureLogin(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORTS.mobile,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-card", { timeout: 60_000 });
  await page.waitForTimeout(1600);
  await polishForMarketing(page);
  await screenshot(page, "mobile", "00-connexion-premium");
  await context.close();
}

async function main() {
  await waitForHttp(`${process.env.MARKETING_API_URL || "http://127.0.0.1:3000"}/health`);
  await waitForHttp(FRONTEND_URL);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const sessions = await prepareAtelier();
  const browser = await chromium.launch();
  try {
    await captureLogin(browser);

    for (const deviceName of ["mobile", "desktop"]) {
      await captureDashboard(browser, deviceName, "01-dashboard-proprietaire", sessions.owner);
      await captureDashboard(browser, deviceName, "02-dashboard-caissier", sessions.cashier);
      await captureDashboard(browser, deviceName, "03-dashboard-couturier", sessions.tailor);
      await captureFlow(browser, deviceName, sessions.owner);
    }
  } finally {
    await browser.close();
  }

  console.log(`Captures KSG COUTURE enregistrees dans ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
