import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fingerprintDirectory,
  parseEnvFile,
  parseProperties,
  removeEmptyCapacitorPlaceholders,
  validateAndroidApiUrl,
  verifyCopiedAssets
} from "./android-release-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const androidRoot = path.join(frontendRoot, "android");
const distRoot = path.join(frontendRoot, "dist");
const androidPublicRoot = path.join(androidRoot, "app", "src", "main", "assets", "public");
const versionFile = path.join(androidRoot, "version.properties");
const androidEnvFile = path.join(frontendRoot, ".env.android");
const releaseInfoFile = path.join(distRoot, "atelierpro-release.json");

function fail(message) {
  console.error(`\n[AtelierPro Android] ${message}`);
  process.exit(1);
}

function run(command, args, cwd = frontendRoot) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false, env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} a echoue avec le code ${result.status}`);
}

function runNpm(args) {
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (npmExecPath && existsSync(npmExecPath)) {
    run(process.execPath, [npmExecPath, ...args]);
    return;
  }
  run(process.platform === "win32" ? "npm.cmd" : "npm", args);
}

function runGradle(task) {
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", "gradlew.bat", task], androidRoot);
    return;
  }
  run("sh", ["./gradlew", task], androidRoot);
}

function readVersion() {
  if (!existsSync(versionFile)) fail(`Fichier de version Android manquant: ${versionFile}`);
  const properties = parseProperties(readFileSync(versionFile, "utf8"));
  const versionCode = Number(properties.VERSION_CODE || 0);
  const versionName = String(properties.VERSION_NAME || "").trim();
  if (!Number.isInteger(versionCode) || versionCode < 1) fail("VERSION_CODE doit etre un entier positif.");
  if (!/^\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) fail("VERSION_NAME Android est invalide.");
  return { versionCode, versionName };
}

function readAndroidApiUrl() {
  const merged = {};
  for (const fileName of [".env", ".env.local", ".env.android", ".env.android.local"]) {
    const filePath = path.join(frontendRoot, fileName);
    if (existsSync(filePath)) Object.assign(merged, parseEnvFile(readFileSync(filePath, "utf8")));
  }
  const candidate = process.env.VITE_API_BASE_URL || merged.VITE_API_BASE_URL || "";
  const validated = validateAndroidApiUrl(candidate);
  if (!validated.ok) fail(`${validated.reason} Configure frontend/.env.android avant le build.`);
  return validated.url;
}

function gitState() {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const dirty = Boolean(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim()
    );
    return { commit, dirty };
  } catch {
    return { commit: "unknown", dirty: null };
  }
}

async function buildAndSync() {
  const version = readVersion();
  const apiBaseUrl = readAndroidApiUrl();
  const sourceGit = gitState();
  console.log(`[AtelierPro Android] Build ${version.versionName} (${version.versionCode})`);
  console.log(`[AtelierPro Android] API ${apiBaseUrl}`);

  runNpm(["run", "build:android:web"]);
  const webFingerprint = await fingerprintDirectory(distRoot, { exclude: ["atelierpro-release.json"] });
  const releaseInfo = {
    schemaVersion: 1,
    appId: "com.volcanotech.atelierpro",
    versionCode: version.versionCode,
    versionName: version.versionName,
    gitCommit: sourceGit.commit,
    gitDirty: sourceGit.dirty,
    apiBaseUrl,
    webAssetFingerprint: webFingerprint.sha256,
    webAssetCount: webFingerprint.files.length
  };
  writeFileSync(releaseInfoFile, `${JSON.stringify(releaseInfo, null, 2)}\n`, "utf8");

  runNpm(["exec", "--", "cap", "sync", "android"]);
  const removedPlaceholders = await removeEmptyCapacitorPlaceholders(androidPublicRoot);
  if (removedPlaceholders.length) {
    console.log(`[AtelierPro Android] Placeholders Capacitor vides retires: ${removedPlaceholders.join(", ")}`);
  }
  const verification = await verifyCopiedAssets(distRoot, androidPublicRoot);
  if (!verification.ok) {
    console.error(verification.mismatches.slice(0, 20));
    fail(`Les assets Android ne correspondent pas au build Vite (${verification.mismatches.length} difference(s)).`);
  }
  console.log(`[AtelierPro Android] Assets verifies: ${verification.fileCount} fichiers, ${verification.sourceFingerprint}`);
  return { version, releaseInfo, verification };
}

async function main() {
  const target = String(process.argv[2] || "prepare").trim().toLowerCase();
  if (!["prepare", "verify", "apk", "aab"].includes(target)) {
    fail("Cible inconnue. Utiliser prepare, verify, apk ou aab.");
  }

  if (target === "verify") {
    const verification = await verifyCopiedAssets(distRoot, androidPublicRoot);
    if (!verification.ok) {
      console.error(verification.mismatches.slice(0, 20));
      fail(`Assets Android obsoletes ou differents (${verification.mismatches.length} difference(s)).`);
    }
    console.log(`[AtelierPro Android] Assets synchronises: ${verification.fileCount} fichiers, ${verification.sourceFingerprint}`);
    return;
  }

  if (target === "aab") {
    const sourceGit = gitState();
    if (sourceGit.dirty === true) fail("Un AAB Play Store doit etre construit depuis un working tree Git propre.");
  }

  const { version } = await buildAndSync();
  if (target === "prepare") return;

  if (target === "aab" && !existsSync(path.join(androidRoot, "keystore.properties"))) {
    fail("keystore.properties est obligatoire pour generer l'AAB Play Store signe.");
  }

  const task = target === "apk" ? "assembleDebug" : "bundleRelease";
  runGradle(task);
  const artifact =
    target === "apk"
      ? path.join(androidRoot, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
      : path.join(androidRoot, "app", "build", "outputs", "bundle", "release", "app-release.aab");
  if (!existsSync(artifact)) fail(`Artefact Android introuvable apres ${task}: ${artifact}`);
  console.log(`[AtelierPro Android] ${target.toUpperCase()} ${version.versionName} (${version.versionCode}) pret: ${artifact}`);
}

main().catch((error) => fail(error?.message || String(error)));
