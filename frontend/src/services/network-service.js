import { computed, readonly, ref } from "vue";

const TAB_ID_STORAGE_KEY = "atelier.offline.tab_id.v1";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const CONNECTIVITY_CHECK_INTERVAL_MS = 15000;
const CONNECTIVITY_TIMEOUT_MS = 4500;
const OFFLINE_ACTIVATION_DELAY_MS = 6000;

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
  online: resolveOnlineState(),
  offline: !resolveOnlineState(),
  browserOnline: resolveOnlineState(),
  apiReachable: true,
  tabId
};
const onlineRef = ref(currentState.online);
const networkStateRef = ref({ ...currentState });
let connectivityTimer = null;
let connectivityCheckPromise = null;
let offlineActivationTimer = null;

function clearOfflineActivationTimer() {
  if (offlineActivationTimer && typeof window !== "undefined") {
    window.clearTimeout(offlineActivationTimer);
  }
  offlineActivationTimer = null;
}

export function resolveConnectivityUrl() {
  if (!API_BASE_URL) return "";
  return `${API_BASE_URL}/system/bootstrap-manager/status`;
}

function commitState({ apiReachable = currentState.apiReachable } = {}) {
  const browserOnline = resolveOnlineState();
  currentState = {
    online: browserOnline && apiReachable,
    offline: !browserOnline || !apiReachable,
    browserOnline,
    apiReachable,
    tabId
  };
  onlineRef.value = currentState.online;
  networkStateRef.value = { ...currentState };

  for (const listener of listeners) {
    try {
      listener(getNetworkState());
    } catch {
      // Ignore listener failures to avoid breaking the app shell.
    }
  }
}

function emitState({ apiReachable = currentState.apiReachable, immediate = false } = {}) {
  const browserOnline = resolveOnlineState();
  const nextOnline = browserOnline && apiReachable;

  if (nextOnline) {
    clearOfflineActivationTimer();
    commitState({ apiReachable: true });
    return;
  }

  if (!currentState.online || immediate || typeof window === "undefined") {
    clearOfflineActivationTimer();
    commitState({ apiReachable });
    return;
  }

  if (offlineActivationTimer) return;
  offlineActivationTimer = window.setTimeout(() => {
    offlineActivationTimer = null;
    commitState({ apiReachable: resolveOnlineState() ? false : apiReachable });
  }, OFFLINE_ACTIVATION_DELAY_MS);
}

function handleOnline() {
  emitState();
  void verifyApiConnectivity();
}

function handleOffline() {
  emitState({ apiReachable: false });
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
  if (!resolveOnlineState()) {
    emitState({ apiReachable: false });
    return false;
  }

  const connectivityUrl = resolveConnectivityUrl();
  if (!connectivityUrl) {
    emitState({ apiReachable: true });
    return true;
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
      emitState({ apiReachable: reachable });
      return reachable;
    } catch {
      emitState({ apiReachable: false });
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
