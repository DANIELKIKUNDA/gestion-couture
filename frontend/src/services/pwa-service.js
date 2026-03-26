import { ref } from "vue";
import { registerSW } from "virtual:pwa-register";

export const isPwaInstallAvailable = ref(false);
export const isPwaUpdateAvailable = ref(false);
export const isPwaOfflineReady = ref(false);
export const isRunningStandalone = ref(false);

const appVersion = typeof APP_VERSION === "string" ? APP_VERSION : "dev";
const pwaCachePrefix = "atelierpro-";
const currentPwaCachePrefix = `${pwaCachePrefix}${appVersion}`;

let deferredInstallPrompt = null;
let initialized = false;
let serviceWorkerRegistration = null;
let updateServiceWorker = null;

function resolveStandaloneState() {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = typeof window.navigator?.standalone === "boolean" && window.navigator.standalone === true;
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || navigatorStandalone;
}

function syncInstallAvailability() {
  isRunningStandalone.value = resolveStandaloneState();
  isPwaInstallAvailable.value = Boolean(deferredInstallPrompt) && !isRunningStandalone.value;
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  syncInstallAvailability();
}

function handleAppInstalled() {
  deferredInstallPrompt = null;
  syncInstallAvailability();
}

function requestServiceWorkerUpdateCheck() {
  serviceWorkerRegistration?.update?.().catch(() => {});
}

async function cleanupLegacyPwaCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cacheKeys = await window.caches.keys();
    const staleCacheKeys = cacheKeys.filter((cacheKey) => {
      if (!cacheKey.startsWith(pwaCachePrefix)) return false;
      return !cacheKey.startsWith(currentPwaCachePrefix);
    });
    await Promise.all(staleCacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
  } catch {
    // Cache cleanup must stay best-effort and never break the app.
  }
}

export function initializePwaService() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  syncInstallAvailability();
  cleanupLegacyPwaCaches();

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", syncInstallAvailability);

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("focus", requestServiceWorkerUpdateCheck);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestServiceWorkerUpdateCheck();
  });

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      isPwaUpdateAvailable.value = true;
    },
    onOfflineReady() {
      isPwaOfflineReady.value = true;
    },
    onRegisteredSW(_swUrl, registration) {
      serviceWorkerRegistration = registration || null;
      cleanupLegacyPwaCaches();
      requestServiceWorkerUpdateCheck();
    },
    onRegisterError() {
      // PWA registration stays optional and must never break the app.
    }
  });

  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[PWA] AtelierPro ${appVersion}`);
  }
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  const accepted = String(choiceResult?.outcome || "").toLowerCase() === "accepted";
  if (accepted) deferredInstallPrompt = null;
  syncInstallAvailability();
  return accepted;
}

export function dismissPwaOfflineReady() {
  isPwaOfflineReady.value = false;
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) return false;
  isPwaUpdateAvailable.value = false;
  await updateServiceWorker(true);
  return true;
}
