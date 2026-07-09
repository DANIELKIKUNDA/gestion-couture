import { computed, readonly, ref } from "vue";

const TAB_ID_STORAGE_KEY = "atelier.offline.tab_id.v1";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const CONNECTIVITY_CHECK_INTERVAL_MS = 15000;
const CONNECTIVITY_TIMEOUT_MS = 4500;
const OFFLINE_ACTIVATION_DELAY_MS = 6000;
const OFFLINE_CONFIRMATION_ATTEMPTS = 2;
const API_FAILURES_BEFORE_OFFLINE = 2;
const NETWORK_DEBUG = import.meta.env.DEV === true;

function createRandomId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveTabId() {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return createRandomId();
  }

  try {
    const current = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (current) return current;
    const next = createRandomId();
    window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createRandomId();
  }
}

function resolveOnlineState() {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }
  return navigator.onLine;
}

const listeners = new Set();
const tabId = resolveTabId();

let started = false;
let currentState = {
  online: true,
  offline: false,
  browserOnline: resolveOnlineState(),
  apiReachable: true,
  tabId
};
const onlineRef = ref(currentState.online);
const networkStateRef = ref({ ...currentState });
let connectivityTimer = null;
let connectivityCheckPromise = null;
let offlineActivationTimer = null;
let offlineConfirmationAttempts = 0;
let pendingOfflineApiReachable = true;
let consecutiveApiFailures = 0;
let pendingOfflineReason = "";

function debugNetwork(message, details = {}) {
  if (!NETWORK_DEBUG) return;
  console.info(`[NETWORK] ${message}`, details);
}

function clearOfflineActivationTimer() {
  if (offlineActivationTimer && typeof window !== "undefined") {
    window.clearTimeout(offlineActivationTimer);
  }
  offlineActivationTimer = null;
  offlineConfirmationAttempts = 0;
  pendingOfflineReason = "";
}

export function resolveConnectivityUrl() {
  if (!API_BASE_URL) return "";
  return `${API_BASE_URL}/system/bootstrap-manager/status`;
}

function commitState({ apiReachable = currentState.apiReachable, browserOnline = resolveOnlineState(), reason = "" } = {}) {
  const online = apiReachable || (browserOnline && apiReachable);
  const changed = currentState.online !== online || currentState.browserOnline !== browserOnline || currentState.apiReachable !== apiReachable;
  currentState = {
    online,
    offline: !online,
    browserOnline,
    apiReachable,
    tabId
  };
  onlineRef.value = currentState.online;
  networkStateRef.value = { ...currentState };
  if (changed) {
    debugNetwork("state changed", { ...currentState, reason });
  }

  for (const listener of listeners) {
    try {
      listener(getNetworkState());
    } catch {
      // Ignore listener failures to avoid breaking the app shell.
    }
  }
}

function confirmOfflineState() {
  const browserOnline = resolveOnlineState();
  const nextOnline = pendingOfflineApiReachable || (browserOnline && pendingOfflineApiReachable);

  if (nextOnline) {
    clearOfflineActivationTimer();
    commitState({ apiReachable: true });
    return;
  }

  offlineConfirmationAttempts += 1;
  if (offlineConfirmationAttempts < OFFLINE_CONFIRMATION_ATTEMPTS && typeof window !== "undefined") {
    offlineActivationTimer = window.setTimeout(confirmOfflineState, Math.ceil(OFFLINE_ACTIVATION_DELAY_MS / OFFLINE_CONFIRMATION_ATTEMPTS));
    return;
  }

  offlineActivationTimer = null;
  offlineConfirmationAttempts = 0;
  commitState({ apiReachable: pendingOfflineApiReachable, browserOnline, reason: pendingOfflineReason || "offline_confirmed" });
  pendingOfflineReason = "";
}

function emitState({ apiReachable = currentState.apiReachable, immediate = false, reason = "" } = {}) {
  const browserOnline = resolveOnlineState();
  const nextOnline = apiReachable || (browserOnline && apiReachable);

  if (nextOnline) {
    clearOfflineActivationTimer();
    pendingOfflineApiReachable = true;
    commitState({ apiReachable: true, browserOnline, reason: reason || "online_confirmed" });
    return;
  }

  if (!currentState.online || immediate || typeof window === "undefined") {
    clearOfflineActivationTimer();
    pendingOfflineApiReachable = apiReachable;
    commitState({ apiReachable, browserOnline, reason: reason || "offline_immediate" });
    return;
  }

  pendingOfflineApiReachable = apiReachable;
  pendingOfflineReason = reason || "offline_pending";
  if (offlineActivationTimer) return;
  debugNetwork("offline confirmation scheduled", { browserOnline, apiReachable, reason: pendingOfflineReason });
  offlineActivationTimer = window.setTimeout(confirmOfflineState, Math.ceil(OFFLINE_ACTIVATION_DELAY_MS / OFFLINE_CONFIRMATION_ATTEMPTS));
}

function handleOnline() {
  consecutiveApiFailures = 0;
  emitState({ reason: "browser_online" });
  void verifyApiConnectivity();
}

function handleOffline() {
  emitState({ apiReachable: false, reason: "browser_offline_event" });
}

export function initializeNetworkService() {
  if (started || typeof window === "undefined") {
    return getNetworkState();
  }

  started = true;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  emitState();
  void verifyApiConnectivity();
  connectivityTimer = window.setInterval(() => {
    void verifyApiConnectivity();
  }, CONNECTIVITY_CHECK_INTERVAL_MS);
  return getNetworkState();
}

export function stopNetworkService() {
  if (!started || typeof window === "undefined") return;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  if (connectivityTimer) {
    window.clearInterval(connectivityTimer);
    connectivityTimer = null;
  }
  clearOfflineActivationTimer();
  started = false;
}

export async function verifyApiConnectivity() {
  if (connectivityCheckPromise) return connectivityCheckPromise;

  const connectivityUrl = resolveConnectivityUrl();
  if (!connectivityUrl) {
    const browserOnline = resolveOnlineState();
    emitState({ apiReachable: browserOnline, reason: "no_connectivity_url" });
    return browserOnline;
  }

  connectivityCheckPromise = (async () => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId =
      controller && typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS)
        : null;

    try {
      const response = await fetch(connectivityUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal
      });
      const reachable = response.ok;
      if (reachable) {
        consecutiveApiFailures = 0;
        emitState({ apiReachable: true, reason: "api_ping_ok" });
      } else {
        consecutiveApiFailures += 1;
        emitState({
          apiReachable: consecutiveApiFailures < API_FAILURES_BEFORE_OFFLINE,
          reason: `api_ping_http_${response.status}`
        });
      }
      return reachable;
    } catch {
      consecutiveApiFailures += 1;
      emitState({
        apiReachable: consecutiveApiFailures < API_FAILURES_BEFORE_OFFLINE,
        reason: "api_ping_failed"
      });
      return false;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      connectivityCheckPromise = null;
    }
  })();

  return connectivityCheckPromise;
}

export function getNetworkState() {
  return { ...currentState };
}

export function isOnline() {
  return getNetworkState().online;
}

export function subscribeToNetworkState(listener) {
  if (typeof listener !== "function") {
    throw new Error("Un listener reseau doit etre une fonction.");
  }

  listeners.add(listener);
  listener(getNetworkState());
  return () => {
    listeners.delete(listener);
  };
}

export function getTabId() {
  return tabId;
}

export function useNetwork() {
  return {
    isOnline: readonly(onlineRef),
    isOffline: computed(() => !onlineRef.value),
    state: readonly(networkStateRef),
    tabId
  };
}
