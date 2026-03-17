import { ref } from "vue";
import { registerSW } from "virtual:pwa-register";

export const isPwaInstallAvailable = ref(false);
export const isPwaUpdateAvailable = ref(false);
export const isPwaOfflineReady = ref(false);
export const isRunningStandalone = ref(false);

let deferredInstallPrompt = null;
let updateServiceWorker = null;
let initialized = false;

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
  isPwaUpdateAvailable.value = false;
  syncInstallAvailability();
}

export function initializePwaService() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  syncInstallAvailability();

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", syncInstallAvailability);

  updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady() {
      isPwaOfflineReady.value = true;
    },
    onNeedRefresh() {
      isPwaUpdateAvailable.value = true;
    }
  });
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  const accepted = String(choiceResult?.outcome || "").toLowerCase() === "accepted";
  if (accepted) {
    deferredInstallPrompt = null;
  }
  syncInstallAvailability();
  return accepted;
}

export function dismissPwaOfflineReady() {
  isPwaOfflineReady.value = false;
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) return false;
  await updateServiceWorker(true);
  isPwaUpdateAvailable.value = false;
  return true;
}
