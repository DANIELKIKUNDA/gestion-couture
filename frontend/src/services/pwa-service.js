import { ref } from "vue";

export const isPwaInstallAvailable = ref(false);
export const isPwaUpdateAvailable = ref(false);
export const isPwaOfflineReady = ref(false);
export const isRunningStandalone = ref(false);

let deferredInstallPrompt = null;
let initialized = false;
let serviceWorkerRegistration = null;
let waitingServiceWorker = null;
let shouldReloadAfterUpdate = false;

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

function attachWorkerState(worker) {
  if (!worker) return;
  worker.addEventListener("statechange", () => {
    if (worker.state !== "installed") return;
    if (navigator.serviceWorker.controller) {
      waitingServiceWorker = serviceWorkerRegistration?.waiting || worker;
      isPwaUpdateAvailable.value = true;
      return;
    }
    isPwaOfflineReady.value = true;
  });
}

function monitorRegistration(registration) {
  if (!registration) return;
  serviceWorkerRegistration = registration;
  if (registration.waiting) {
    waitingServiceWorker = registration.waiting;
    isPwaUpdateAvailable.value = true;
  }
  if (registration.installing) attachWorkerState(registration.installing);
  registration.addEventListener("updatefound", () => {
    attachWorkerState(registration.installing);
  });
}

function requestServiceWorkerUpdateCheck() {
  serviceWorkerRegistration?.update?.().catch(() => {});
}

export function initializePwaService() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  syncInstallAvailability();

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", syncInstallAvailability);

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("focus", requestServiceWorkerUpdateCheck);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestServiceWorkerUpdateCheck();
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadAfterUpdate) return;
    shouldReloadAfterUpdate = false;
    isPwaUpdateAvailable.value = false;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      monitorRegistration(registration);
    } catch {
      // PWA registration stays optional and must never break the app.
    }
  });
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
  if (!waitingServiceWorker) return false;
  shouldReloadAfterUpdate = true;
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
  return true;
}
