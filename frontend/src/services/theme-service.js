import { USER_THEMES, normalizeThemePreference } from "../utils/account-preferences.js";

const DEVICE_THEME_STORAGE_KEY = "atelier.ui.theme.last.v1";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const LIGHT_THEME_COLOR = "#f6f8fb";
const DARK_THEME_COLOR = "#101827";

let currentPreference = USER_THEMES.SYSTEM;
let mediaQuery = null;
let mediaListenerAttached = false;

function preferredSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(preference = currentPreference) {
  const normalized = normalizeThemePreference(preference);
  if (normalized === USER_THEMES.DARK) return "dark";
  if (normalized === USER_THEMES.LIGHT) return "light";
  return preferredSystemTheme();
}

function updateThemeColor(resolvedTheme) {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

function commitTheme(preference, { persistDevice = true } = {}) {
  const normalized = normalizeThemePreference(preference);
  currentPreference = normalized;
  const resolved = resolveTheme(normalized);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.themePreference = normalized.toLowerCase();
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    updateThemeColor(resolved);
  }
  if (persistDevice && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DEVICE_THEME_STORAGE_KEY, normalized);
    } catch {
      // Device cache is best effort. Server-side account preferences remain authoritative.
    }
  }
  return resolved;
}

function onSystemThemeChanged() {
  if (currentPreference !== USER_THEMES.SYSTEM) return;
  commitTheme(USER_THEMES.SYSTEM, { persistDevice: false });
}

function attachMediaListener() {
  if (mediaListenerAttached || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  mediaQuery = window.matchMedia(DARK_QUERY);
  if (typeof mediaQuery.addEventListener === "function") mediaQuery.addEventListener("change", onSystemThemeChanged);
  else if (typeof mediaQuery.addListener === "function") mediaQuery.addListener(onSystemThemeChanged);
  mediaListenerAttached = true;
}

export function initializeThemeService() {
  let cached = USER_THEMES.SYSTEM;
  if (typeof window !== "undefined") {
    try {
      cached = normalizeThemePreference(window.localStorage.getItem(DEVICE_THEME_STORAGE_KEY));
    } catch {
      cached = USER_THEMES.SYSTEM;
    }
  }
  attachMediaListener();
  return commitTheme(cached, { persistDevice: false });
}

export function applyThemePreference(preference, options = {}) {
  attachMediaListener();
  return commitTheme(preference, options);
}

export function resetThemePreference() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(DEVICE_THEME_STORAGE_KEY);
    } catch {
      // Best effort.
    }
  }
  return commitTheme(USER_THEMES.SYSTEM, { persistDevice: false });
}

export function getThemeSnapshot() {
  return {
    preference: currentPreference,
    resolved: resolveTheme(currentPreference)
  };
}
