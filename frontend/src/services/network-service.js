import { computed, readonly, ref } from "vue";

const TAB_ID_STORAGE_KEY = "atelier.offline.tab_id.v1";

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
  tabId
};
const onlineRef = ref(currentState.online);
const networkStateRef = ref({ ...currentState });

function emitState() {
  currentState = {
    online: resolveOnlineState(),
    offline: !resolveOnlineState(),
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

function handleOnline() {
  emitState();
}

function handleOffline() {
  emitState();
}

export function initializeNetworkService() {
  if (started || typeof window === "undefined") {
    return getNetworkState();
  }

  started = true;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  emitState();
  return getNetworkState();
}

export function stopNetworkService() {
  if (!started || typeof window === "undefined") return;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  started = false;
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
