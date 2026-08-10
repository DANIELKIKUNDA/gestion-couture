import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  fingerprintDirectory,
  parseEnvFile,
  parseProperties,
  removeEmptyCapacitorPlaceholders,
  validateAndroidApiUrl,
  verifyCopiedAssets
} from "../frontend/scripts/android-release-lib.mjs";

async function run() {
  assert.deepEqual(parseProperties("VERSION_CODE=2\nVERSION_NAME:1.1.0\n"), { VERSION_CODE: "2", VERSION_NAME: "1.1.0" });
  assert.deepEqual(parseEnvFile("# comment\nVITE_API_BASE_URL=https://atelier.example/api\n"), {
    VITE_API_BASE_URL: "https://atelier.example/api"
  });
  assert.equal(validateAndroidApiUrl("/api").ok, false);
  assert.equal(validateAndroidApiUrl("http://atelier.example/api").ok, false);
  assert.equal(validateAndroidApiUrl("https://localhost/api").ok, false);
  assert.equal(validateAndroidApiUrl("https://atelier.example").ok, false);
  assert.equal(validateAndroidApiUrl("https://atelier.example/api").ok, true);

  const base = await mkdtemp(path.join(os.tmpdir(), "atelierpro-android-assets-"));
  const dist = path.join(base, "dist");
  const copied = path.join(base, "android-public");
  try {
    await mkdir(path.join(dist, "assets"), { recursive: true });
    await mkdir(path.join(copied, "assets"), { recursive: true });
    await writeFile(path.join(dist, "index.html"), "<html>new</html>");
    await writeFile(path.join(dist, "assets", "app.js"), "console.log('new')");
    await writeFile(path.join(copied, "index.html"), "<html>new</html>");
    await writeFile(path.join(copied, "assets", "app.js"), "console.log('new')");

    const fingerprint = await fingerprintDirectory(dist);
    assert.equal(fingerprint.files.length, 2);
    assert.equal((await verifyCopiedAssets(dist, copied)).ok, true);

    await writeFile(path.join(copied, "cordova.js"), "");
    await writeFile(path.join(copied, "cordova_plugins.js"), "");
    assert.deepEqual(await removeEmptyCapacitorPlaceholders(copied), ["cordova.js", "cordova_plugins.js"]);
    assert.equal((await verifyCopiedAssets(dist, copied)).ok, true);

    await writeFile(path.join(copied, "cordova.js"), "plugin-content");
    assert.deepEqual(await removeEmptyCapacitorPlaceholders(copied), []);
    const nonEmptyPlaceholder = await verifyCopiedAssets(dist, copied);
    assert.equal(nonEmptyPlaceholder.ok, false);
    assert.ok(nonEmptyPlaceholder.mismatches.some((entry) => entry.reason === "unexpected" && entry.file === "cordova.js"));
    await rm(path.join(copied, "cordova.js"), { force: true });

    await writeFile(path.join(copied, "assets", "app.js"), "console.log('old')");
    const stale = await verifyCopiedAssets(dist, copied);
    assert.equal(stale.ok, false);
    assert.equal(stale.mismatches[0].reason, "sha256");

    await writeFile(path.join(copied, "assets", "app.js"), "console.log('new')");
    await writeFile(path.join(copied, "assets", "stale-old-chunk.js"), "stale");
    const extraAsset = await verifyCopiedAssets(dist, copied);
    assert.equal(extraAsset.ok, false);
    assert.ok(extraAsset.mismatches.some((entry) => entry.reason === "unexpected" && entry.file === "assets/stale-old-chunk.js"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

run()
  .then(() => console.log("OK: android release asset verification"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
