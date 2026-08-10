import assert from "node:assert/strict";

async function run() {
  const storage = new Map();
  const listeners = new Set();
  let matchesDark = true;
  const media = {
    get matches() {
      return matchesDark;
    },
    addEventListener(type, listener) {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") listeners.delete(listener);
    }
  };
  const meta = {
    content: "",
    setAttribute(name, value) {
      if (name === "content") this.content = value;
    }
  };

  globalThis.window = {
    matchMedia: () => media,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    }
  };
  globalThis.document = {
    documentElement: { dataset: {}, style: {} },
    querySelector: (selector) => (selector === 'meta[name="theme-color"]' ? meta : null)
  };

  try {
    const moduleUrl = new URL(`../frontend/src/services/theme-service.js?test=${Date.now()}`, import.meta.url);
    const theme = await import(moduleUrl.href);

    theme.initializeThemeService();
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(document.documentElement.dataset.themePreference, "systeme");

    theme.applyThemePreference("CLAIR");
    assert.equal(document.documentElement.dataset.theme, "light");
    assert.equal(storage.get("atelier.ui.theme.last.v1"), "CLAIR");

    theme.applyThemePreference("SYSTEME");
    assert.equal(document.documentElement.dataset.theme, "dark");
    matchesDark = false;
    for (const listener of listeners) listener({ matches: false });
    assert.equal(document.documentElement.dataset.theme, "light", "le mode Systeme doit suivre un changement du theme OS");

    theme.applyThemePreference("SOMBRE");
    assert.equal(document.documentElement.dataset.theme, "dark");
    matchesDark = false;
    for (const listener of listeners) listener({ matches: false });
    assert.equal(document.documentElement.dataset.theme, "dark", "le mode Sombre ne doit pas suivre le theme OS");

    theme.resetThemePreference();
    assert.equal(storage.has("atelier.ui.theme.last.v1"), false);
    assert.equal(document.documentElement.dataset.theme, "light");
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

run()
  .then(() => console.log("OK: theme service system/light/dark"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
