import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { chromium } from "@playwright/test";

const ROOT_DIR = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT_DIR, "docs", "marketing-screenshots");
const ASSET_DIR = path.join(ROOT_DIR, "docs", "marketing-assets");
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "marketing-studio-videos");
const RAW_DIR = path.join(OUTPUT_DIR, ".raw");
const FFMPEG = process.env.FFMPEG_PATH || "C:\\Users\\MON PC\\Desktop\\autresDaniel\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe";
const FONT = "C\\:/Windows/Fonts/arial.ttf";

const DESKTOP = { width: 1920, height: 1080, suffix: "desktop" };
const MOBILE = { width: 1080, height: 1920, suffix: "mobile", isMobile: true, hasTouch: true };

const CONTACT = "WhatsApp: +243 983 630 390";
const LOGO_FILE = "volcanotech-logo.png";

const videos = [
  {
    id: "01-presentation-globale",
    title: "Presentation globale",
    duration: 36,
    scenes: [
      ["01-tableau-de-bord", "Gestion moderne d'atelier de couture", "Tableau de bord, commandes, caisse et suivi mobile dans une seule solution."],
      ["02-commandes", "Un atelier enfin organise", "Chaque travail avance avec ses informations, ses delais et son solde."],
      ["04-caisse", "Caisse claire et lisible", "Les entrees, sorties et operations restent comprehensibles."],
      ["06-stock-vente", "Stock et ventes maitrises", "Articles, achats et ventes sont suivis proprement."],
      ["00-connexion", "AtelierPro par VolcanoTech", "Mobile-first, offline-first, synchronisation intelligente."]
    ]
  },
  {
    id: "02-gestion-commandes",
    title: "Gestion commandes",
    duration: 52,
    scenes: [
      ["02-commandes", "Ne perdez plus les commandes", "Retrouvez rapidement un client, un statut ou un solde."],
      ["08-detail-commande", "Detail commande complet", "Client, habits, montants, paiements, historique et informations utiles sont centralises."],
      ["08-detail-commande", "Mesures et photos de reference", "Les photos et informations du modele restent rattachees a la commande."],
      ["02-commandes", "Suivi intelligent des statuts", "L'atelier sait ce qui est cree, en cours, pret ou a solder."],
      ["03-dossiers", "Le dossier client garde l'historique", "Utile lorsqu'un client revient souvent ou quand plusieurs travaux lui appartiennent."]
    ]
  },
  {
    id: "03-gestion-retouches",
    title: "Gestion retouches",
    duration: 38,
    scenes: [
      ["07-retouches", "Retouches rapides, suivi propre", "Un espace dedie aux corrections et petits travaux."],
      ["09-detail-retouche", "Detail retouche lisible", "Client, type de retouche, paiement et historique restent au meme endroit."],
      ["07-retouches", "Moins d'oublis au quotidien", "Les retouches ne se perdent plus dans les conversations ou les carnets."],
      ["03-dossiers", "Relier au dossier quand c'est utile", "Le dossier aide a garder une vue longue sur le client et ses travaux."]
    ]
  },
  {
    id: "04-caisse-intelligente",
    title: "Caisse intelligente",
    duration: 50,
    scenes: [
      ["04-caisse", "Suivi financier intelligent", "Argent entre, argent sorti et resultat du jour sont visibles sans calcul manuel."],
      ["04-caisse", "Operations recentes", "Chaque mouvement garde sa source et son sens."],
      ["01-tableau-de-bord", "Le proprietaire voit l'essentiel", "Argent disponible, alertes et activite recente en un regard."],
      ["05-facturation", "Factures et encaissements alignes", "La finance de l'atelier reste plus claire et plus credible."],
      ["04-caisse", "Une caisse faite pour rassurer", "Moins de confusion, plus de controle."]
    ]
  },
  {
    id: "05-offline-sync",
    title: "Offline-first et synchronisation",
    duration: 42,
    scenes: [
      ["00-connexion", "Fonctionne meme avec internet instable", "AtelierPro est pense pour les realites locales."],
      ["02-commandes", "Le travail continue", "Commandes, dossiers et informations utiles restent disponibles."],
      ["01-tableau-de-bord", "Synchronisation intelligente", "Les donnees se mettent a jour automatiquement des que la connexion revient."],
      ["08-detail-commande", "Photos et informations gardees", "Les elements importants restent rattaches au travail."],
      ["04-caisse", "Robuste pour le quotidien", "Une experience fiable pour les ateliers actifs."]
    ]
  },
  {
    id: "06-experience-mobile",
    title: "Experience mobile",
    duration: 36,
    scenes: [
      ["01-tableau-de-bord", "Pense pour le mobile", "Le proprietaire, le couturier et le caissier peuvent travailler depuis un telephone."],
      ["02-commandes", "Navigation simple", "Recherche, filtres et cartes sont adaptes aux petits ecrans."],
      ["04-caisse", "Caisse lisible sur terrain", "Les operations restent faciles a lire, meme en boutique."],
      ["06-stock-vente", "Vente et stock accessibles", "Un usage rapide pour les actions du quotidien."]
    ],
    preferMobile: true
  },
  {
    id: "07-tableaux-de-bord",
    title: "Tableaux de bord",
    duration: 40,
    scenes: [
      ["01-tableau-de-bord", "Pilotez votre atelier intelligemment", "Les informations importantes remontent au bon moment."],
      ["01-tableau-de-bord", "Vision globale instantanee", "Travaux en cours, argent en caisse, clients actifs et alertes."],
      ["04-caisse", "Lecture financiere plus claire", "Le proprietaire comprend la situation sans chercher partout."],
      ["02-commandes", "Priorites visibles", "Les travaux et soldes a suivre ne disparaissent plus."]
    ]
  },
  {
    id: "08-donnees-clients",
    title: "Donnees clients et dossiers",
    duration: 44,
    scenes: [
      ["03-dossiers", "Ne perdez plus les informations clients", "Les dossiers regroupent les personnes, les mesures et l'historique."],
      ["10-detail-dossier", "Dossier numerique centralise", "Ideal pour les clients fideles, familles et travaux repetes."],
      ["08-detail-commande", "Photos et mesures securisees", "Les references importantes restent attachees au bon travail."],
      ["07-retouches", "Commandes et retouches reliees", "L'atelier garde une memoire claire de son activite."]
    ]
  }
];

function screenshotPath(format, key) {
  const preferred = path.join(SCREENSHOT_DIR, `${format.suffix}-${key}.png`);
  if (existsSync(preferred)) return preferred;
  const fallback = path.join(SCREENSHOT_DIR, `desktop-${key}.png`);
  if (existsSync(fallback)) return fallback;
  return path.join(SCREENSHOT_DIR, "desktop-01-tableau-de-bord.png");
}

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/").replace(/ /g, "%20")}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(video, format) {
  const sceneDuration = Math.max(3.8, video.duration / video.scenes.length);
  const scenes = video.scenes
    .map(([key, title, subtitle], index) => ({
      src: fileUrl(screenshotPath(video.preferMobile ? MOBILE : format, key)),
      title,
      subtitle,
      start: index * sceneDuration,
      duration: sceneDuration
    }));
  const logoSrc = fileUrl(path.join(ASSET_DIR, LOGO_FILE));
  const isMobile = format.suffix === "mobile";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #07101f; font-family: Arial, sans-serif; }
  .stage { position: relative; width: ${format.width}px; height: ${format.height}px; overflow: hidden; background:
    radial-gradient(circle at 18% 18%, rgba(255,102,0,.24), transparent 30%),
    radial-gradient(circle at 82% 78%, rgba(31,90,162,.32), transparent 35%),
    linear-gradient(135deg, #07101f, #10294a 54%, #080d17); }
  .scene { position: absolute; inset: 0; opacity: 0; transition: opacity 760ms ease; }
  .scene.active { opacity: 1; }
  .shot-wrap { position: absolute; ${isMobile ? "inset: 170px 105px 250px;" : "inset: 118px 120px 160px;"} display: grid; place-items: center; }
  .shot {
    width: 100%; height: 100%; object-fit: cover; border-radius: ${isMobile ? "42px" : "32px"};
    box-shadow: 0 42px 110px rgba(0,0,0,.46); border: 1px solid rgba(255,255,255,.24);
    transform: scale(1.02); animation: zoomSoft ${sceneDuration}s ease-in-out both;
  }
  .logo-card { position: absolute; ${isMobile ? "top: 44px; left: 56px; right: 56px; height: 104px;" : "top: 36px; left: 54px; width: 430px; height: 92px;"} border-radius: 30px; display: flex; align-items: center; gap: 18px; padding: 16px 22px; background: rgba(255,255,255,.94); box-shadow: 0 20px 70px rgba(0,0,0,.22); }
  .logo-card img { height: ${isMobile ? "72px" : "58px"}; width: auto; object-fit: contain; }
  .logo-card div { display: grid; gap: 3px; color: #111827; }
  .logo-card strong { font-size: ${isMobile ? "30px" : "24px"}; line-height: 1; }
  .logo-card span { font-size: ${isMobile ? "15px" : "12px"}; letter-spacing: .16em; color: #ff4f12; font-weight: 800; text-transform: uppercase; }
  .caption { position: absolute; ${isMobile ? "left: 56px; right: 56px; bottom: 84px;" : "left: 92px; right: 92px; bottom: 54px;"} padding: ${isMobile ? "30px 34px" : "24px 30px"}; border-radius: 30px; color: #fff; background: linear-gradient(135deg, rgba(9,18,34,.94), rgba(21,65,111,.9)); border: 1px solid rgba(255,255,255,.2); box-shadow: 0 28px 90px rgba(0,0,0,.34); }
  .caption small { display: block; color: #ff7a1a; text-transform: uppercase; font-weight: 900; letter-spacing: .2em; font-size: ${isMobile ? "18px" : "13px"}; margin-bottom: 10px; }
  .caption h1 { margin: 0; font-size: ${isMobile ? "56px" : "42px"}; line-height: 1.02; letter-spacing: 0; }
  .caption p { margin: 13px 0 0; color: rgba(238,245,255,.86); font-size: ${isMobile ? "29px" : "20px"}; line-height: 1.38; max-width: ${isMobile ? "900px" : "1200px"}; }
  .pill-row { position: absolute; ${isMobile ? "right: 60px; top: 170px;" : "right: 58px; top: 50px;"} display: flex; gap: 12px; }
  .pill { padding: ${isMobile ? "14px 18px" : "10px 14px"}; border-radius: 999px; color: #fff; background: rgba(255,102,0,.92); font-weight: 900; font-size: ${isMobile ? "20px" : "13px"}; box-shadow: 0 14px 40px rgba(255,94,0,.25); }
  .outro { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; color: #111827; background: radial-gradient(circle at 50% 16%, rgba(255,102,0,.18), transparent 34%), #fff; }
  .outro img { width: ${isMobile ? "660px" : "620px"}; max-width: 78%; margin-bottom: ${isMobile ? "50px" : "34px"}; }
  .outro h2 { margin: 0; font-size: ${isMobile ? "58px" : "50px"}; }
  .outro p { margin: 18px 0 0; font-size: ${isMobile ? "30px" : "24px"}; color: #3b4658; }
  .outro strong { display: inline-flex; margin-top: 34px; padding: ${isMobile ? "24px 34px" : "18px 28px"}; border-radius: 999px; color: #fff; background: linear-gradient(135deg, #ff4f12, #111827); font-size: ${isMobile ? "28px" : "22px"}; }
  @keyframes zoomSoft { from { transform: scale(1.02) translateY(0); } to { transform: scale(1.08) translateY(-1.8%); } }
</style>
</head>
<body>
<main class="stage">
  <div class="logo-card"><img src="${logoSrc}" /><div><strong>Atelier Pro</strong><span>by VolcanoTech</span></div></div>
  <div class="pill-row"><span class="pill">Mobile-first</span><span class="pill">Offline-first</span></div>
  ${scenes
    .map(
      (scene, index) => `<section class="scene ${index === 0 ? "active" : ""}" data-index="${index}">
    <div class="shot-wrap"><img class="shot" src="${scene.src}" /></div>
    <div class="caption"><small>${escapeHtml(video.title)}</small><h1>${escapeHtml(scene.title)}</h1><p>${escapeHtml(scene.subtitle)}</p></div>
  </section>`
    )
    .join("\n")}
  <section class="scene outro" data-index="${scenes.length}">
    <div><img src="${logoSrc}" /><h2>Atelier Pro</h2><p>Gestion moderne d'atelier de couture</p><strong>Demandez votre demonstration - ${CONTACT}</strong></div>
  </section>
</main>
<script>
  const durations = ${JSON.stringify([...scenes.map(() => sceneDuration * 1000), 3600])};
  const scenes = Array.from(document.querySelectorAll('.scene'));
  let index = 0;
  function next() {
    scenes.forEach((scene, sceneIndex) => scene.classList.toggle('active', sceneIndex === index));
    const delay = durations[index] || 3000;
    index = Math.min(index + 1, scenes.length - 1);
    if (index < scenes.length) setTimeout(next, delay);
  }
  setTimeout(next, durations[0]);
</script>
</body>
</html>`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe", windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with ${code}`));
    });
  });
}

async function renderRawVideo(browser, video, format) {
  const htmlPath = path.join(RAW_DIR, `${video.id}-${format.suffix}.html`);
  await writeFile(htmlPath, buildHtml(video, format), "utf8");
  const context = await browser.newContext({
    viewport: { width: format.width, height: format.height },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: RAW_DIR,
      size: { width: format.width, height: format.height }
    }
  });
  const page = await context.newPage();
  await page.goto(fileUrl(htmlPath), { waitUntil: "load" });
  await page.waitForTimeout((video.duration + 5) * 1000);
  const rawVideo = page.video();
  await context.close();
  const rawPath = await rawVideo.path();
  const stableRaw = path.join(RAW_DIR, `${video.id}-${format.suffix}.webm`);
  await copyFile(rawPath, stableRaw);
  return stableRaw;
}

async function transcode(rawPath, outputPath, duration) {
  await run(FFMPEG, [
    "-y",
    "-i",
    rawPath,
    "-f",
    "lavfi",
    "-t",
    String(duration + 5),
    "-i",
    "sine=frequency=196:sample_rate=44100",
    "-filter_complex",
    "[1:a]volume=0.025,afade=t=in:ss=0:d=1.2,afade=t=out:st=" + Math.max(1, duration + 2) + ":d=2[a]",
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath
  ]);
}

async function writeVoiceScripts() {
  const lines = videos
    .map((video) => {
      const body = video.scenes.map(([, title, subtitle]) => `- ${title}. ${subtitle}`).join("\n");
      return `## ${video.id} - ${video.title}\n${body}\n- Demandez votre demonstration avec VolcanoTech. ${CONTACT}`;
    })
    .join("\n\n");
  await writeFile(path.join(OUTPUT_DIR, "scripts-voix-off.md"), lines, "utf8");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });
  await writeVoiceScripts();

  const browser = await chromium.launch();
  try {
    for (const video of videos) {
      for (const format of [MOBILE, DESKTOP]) {
        const outputPath = path.join(OUTPUT_DIR, `${video.id}-${format.suffix}.mp4`);
        if (existsSync(outputPath)) {
          const info = await stat(outputPath).catch(() => null);
          if (info && info.size > 100_000) {
            console.log(`skip ${outputPath}`);
            continue;
          }
          await rm(outputPath, { force: true });
        }
        const rawPath = await renderRawVideo(browser, video, format);
        await transcode(rawPath, outputPath, video.duration);
        console.log(outputPath);
      }
    }
  } finally {
    await browser.close();
    await rm(RAW_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
