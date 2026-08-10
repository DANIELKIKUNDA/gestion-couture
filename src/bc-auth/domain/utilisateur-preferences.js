export const STARTUP_MODES = Object.freeze({
  HOME_PAGE: "PAGE_ACCUEIL",
  LAST_PAGE: "DERNIERE_PAGE"
});

export const USER_THEMES = Object.freeze({
  SYSTEM: "SYSTEME",
  LIGHT: "CLAIR",
  DARK: "SOMBRE"
});

export const DEFAULT_USER_PREFERENCES = Object.freeze({
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

export function normalizeUserTheme(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return USER_THEME_VALUES.has(normalized) ? normalized : USER_THEMES.SYSTEM;
}

export function normalizeUserPreferences(value = {}) {
  const modeDemarrage = normalizeStartupMode(value?.modeDemarrage, value?.restaurerDernierePage);
  return {
    pageAccueil: String(value?.pageAccueil || DEFAULT_USER_PREFERENCES.pageAccueil).trim() || DEFAULT_USER_PREFERENCES.pageAccueil,
    modeDemarrage,
    // Kept as a compatibility mirror for old clients. New clients use modeDemarrage.
    restaurerDernierePage: modeDemarrage === STARTUP_MODES.LAST_PAGE,
    theme: normalizeUserTheme(value?.theme)
  };
}
