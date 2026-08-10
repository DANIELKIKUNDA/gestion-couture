import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export function parseProperties(text = "") {
  const result = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const separator = line.search(/[:=]/);
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export function parseEnvFile(text = "") {
  const result = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function validateAndroidApiUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, reason: "VITE_API_BASE_URL est absent." };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "VITE_API_BASE_URL doit etre une URL absolue." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "VITE_API_BASE_URL Android doit utiliser HTTPS." };
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) {
    return { ok: false, reason: "VITE_API_BASE_URL Android ne peut pas pointer vers localhost." };
  }
  const pathname = url.pathname.replace(/\/$/, "");
  if (!pathname.endsWith("/api")) {
    return { ok: false, reason: "VITE_API_BASE_URL Android doit se terminer par /api pour AtelierPro." };
  }
  return { ok: true, url: url.toString().replace(/\/$/, "") };
}

async function walkFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await walkFiles(root, childRelative)));
    else if (entry.isFile()) files.push(childRelative.split(path.sep).join("/"));
  }
  return files;
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

export async function fingerprintDirectory(root, { exclude = [] } = {}) {
  const excluded = new Set(exclude.map((item) => String(item).replace(/\\/g, "/")));
  const files = (await walkFiles(root)).filter((file) => !excluded.has(file));
  const hash = createHash("sha256");
  const entries = [];
  for (const file of files) {
    const digest = await sha256File(path.join(root, ...file.split("/")));
    entries.push({ file, sha256: digest });
    hash.update(file);
    hash.update("\0");
    hash.update(digest);
    hash.update("\n");
  }
  return { sha256: hash.digest("hex"), files: entries };
}

export async function verifyCopiedAssets(distRoot, androidPublicRoot) {
  const distStat = await stat(distRoot).catch(() => null);
  const androidStat = await stat(androidPublicRoot).catch(() => null);
  if (!distStat?.isDirectory()) throw new Error(`Build web Android introuvable: ${distRoot}`);
  if (!androidStat?.isDirectory()) throw new Error(`Assets Capacitor introuvables: ${androidPublicRoot}`);

  const [source, copied] = await Promise.all([
    fingerprintDirectory(distRoot),
    fingerprintDirectory(androidPublicRoot)
  ]);
  const mismatches = [];
  const copiedByPath = new Map(copied.files.map((entry) => [entry.file, entry.sha256]));
  const sourcePaths = new Set(source.files.map((entry) => entry.file));

  for (const entry of source.files) {
    const targetHash = copiedByPath.get(entry.file);
    if (!targetHash) {
      mismatches.push({ file: entry.file, reason: "missing" });
      continue;
    }
    if (targetHash !== entry.sha256) {
      mismatches.push({ file: entry.file, reason: "sha256", expected: entry.sha256, actual: targetHash });
    }
  }

  for (const entry of copied.files) {
    if (!sourcePaths.has(entry.file)) mismatches.push({ file: entry.file, reason: "unexpected" });
  }

  return {
    ok: mismatches.length === 0 && source.sha256 === copied.sha256,
    sourceFingerprint: source.sha256,
    copiedFingerprint: copied.sha256,
    fileCount: source.files.length,
    copiedFileCount: copied.files.length,
    mismatches
  };
}
