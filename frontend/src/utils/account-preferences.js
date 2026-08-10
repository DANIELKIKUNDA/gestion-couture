export const STARTUP_MODES = Object.freeze({
  HOME_PAGE: "PAGE_ACCUEIL",
  LAST_PAGE: "DERNIERE_PAGE"
});

export const USER_THEMES = Object.freeze({
  SYSTEM: "SYSTEME",
  LIGHT: "CLAIR",
  DARK: "SOMBRE"
});

export const DEFAULT_ACCOUNT_PREFERENCES = Object.freeze({
  pageAccueil: "dashboard",
  modeDemarrage: STARTUP_MODES.HOME_PAGE,
  restaurerDernierePage: false,
  theme: USER_THEMES.SYSTEM
});

const STARTUP_MODE_VALUES = new Set(Object.values(STARTUP_MODES));
const USER_THEME_VALUES = new Set(Object.values(USER_THEMES));

export function normalizeStartupMode(value, legacyRestoreLastPage = undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (STARTUP_MODE_VALUES.has(normalized)) return normalized;
  if (legacyRestoreLastPage === true) return STARTUP_MODES.LAST_PAGE;
  return STARTUP_MODES.HOME_PAGE;
}

export function normalizeThemePreference(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return USER_THEME_VALUES.has(normalized) ? normalized : USER_THEMES.SYSTEM;
}

export function normalizeAccountPreferences(value = {}) {
  const modeDemarrage = normalizeStartupMode(value?.modeDemarrage, value?.restaurerDernierePage);
  return {
    pageAccueil: String(value?.pageAccueil || DEFAULT_ACCOUNT_PREFERENCES.pageAccueil).trim() || DEFAULT_ACCOUNT_PREFERENCES.pageAccueil,
    modeDemarrage,
    // Compatibility mirror for old local snapshots and older backends.
    restaurerDernierePage: modeDemarrage === STARTUP_MODES.LAST_PAGE,
    theme: normalizeThemePreference(value?.theme)
  };
}

export function toAccountPreferencesPayload(value = {}) {
  const normalized = normalizeAccountPreferences(value);
  return {
    pageAccueil: normalized.pageAccueil,
    modeDemarrage: normalized.modeDemarrage,
    restaurerDernierePage: normalized.restaurerDernierePage,
    theme: normalized.theme
  };
}

export function resolveAccountStartRoute({ preferences, lastRoute = "", canAccessRoute, fallbackRoute = "dashboard" } = {}) {
  const normalized = normalizeAccountPreferences(preferences);
  const canAccess = typeof canAccessRoute === "function" ? canAccessRoute : () => true;
  const preferredHome = String(normalized.pageAccueil || "").trim();
  const remembered = String(lastRoute || "").trim();

  if (normalized.modeDemarrage === STARTUP_MODES.LAST_PAGE && remembered && canAccess(remembered)) {
    return remembered;
  }
  if (preferredHome && canAccess(preferredHome)) return preferredHome;
  if (fallbackRoute && canAccess(fallbackRoute)) return fallbackRoute;
  return "";
}
