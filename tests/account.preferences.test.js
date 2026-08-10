import assert from "node:assert/strict";

import {
  DEFAULT_USER_PREFERENCES,
  STARTUP_MODES as BACKEND_STARTUP_MODES,
  USER_THEMES as BACKEND_USER_THEMES,
  normalizeUserPreferences
} from "../src/bc-auth/domain/utilisateur-preferences.js";
import {
  STARTUP_MODES,
  USER_THEMES,
  normalizeAccountPreferences,
  resolveAccountStartRoute,
  toAccountPreferencesPayload
} from "../frontend/src/utils/account-preferences.js";

function run() {
  assert.deepEqual(normalizeUserPreferences({}), DEFAULT_USER_PREFERENCES);
  assert.equal(normalizeUserPreferences({ restaurerDernierePage: true }).modeDemarrage, BACKEND_STARTUP_MODES.LAST_PAGE);
  assert.equal(
    normalizeUserPreferences({ modeDemarrage: BACKEND_STARTUP_MODES.HOME_PAGE, restaurerDernierePage: true }).restaurerDernierePage,
    false,
    "le nouveau mode explicite doit etre la source de verite"
  );
  assert.equal(normalizeUserPreferences({ theme: "sombre" }).theme, BACKEND_USER_THEMES.DARK);

  const homePreferences = normalizeAccountPreferences({
    pageAccueil: "caisse",
    modeDemarrage: STARTUP_MODES.HOME_PAGE,
    theme: USER_THEMES.DARK
  });
  assert.equal(
    resolveAccountStartRoute({
      preferences: homePreferences,
      lastRoute: "dashboard",
      canAccessRoute: () => true,
      fallbackRoute: "dashboard"
    }),
    "caisse",
    "la page d'accueil doit gagner lorsque le mode PAGE_ACCUEIL est choisi"
  );

  const lastPreferences = normalizeAccountPreferences({
    pageAccueil: "caisse",
    modeDemarrage: STARTUP_MODES.LAST_PAGE,
    theme: USER_THEMES.SYSTEM
  });
  assert.equal(
    resolveAccountStartRoute({
      preferences: lastPreferences,
      lastRoute: "commandes",
      canAccessRoute: () => true,
      fallbackRoute: "dashboard"
    }),
    "commandes"
  );
  assert.equal(
    resolveAccountStartRoute({
      preferences: lastPreferences,
      lastRoute: "audit",
      canAccessRoute: (route) => route !== "audit",
      fallbackRoute: "dashboard"
    }),
    "caisse",
    "si la derniere page n'est plus autorisee, la page d'accueil devient le repli"
  );

  const payload = toAccountPreferencesPayload({ pageAccueil: "caisse", modeDemarrage: STARTUP_MODES.LAST_PAGE, theme: USER_THEMES.LIGHT });
  assert.deepEqual(payload, {
    pageAccueil: "caisse",
    modeDemarrage: STARTUP_MODES.LAST_PAGE,
    restaurerDernierePage: true,
    theme: USER_THEMES.LIGHT
  });
}

run();
console.log("OK: account preferences startup and theme rules");
