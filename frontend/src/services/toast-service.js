import { reactive } from "vue";

const DEFAULT_TOAST_DURATION = 2600;
let clearToastTimer = null;

export const toastState = reactive({
  message: ""
});

export function clearToast(expectedMessage = "") {
  const normalizedExpected = String(expectedMessage || "").trim();
  if (normalizedExpected && toastState.message !== normalizedExpected) return;
  toastState.message = "";
}

export function showToast(message = "", options = {}) {
  const value = String(message || "").trim();
  if (!value) return;

  const duration = Number(options?.duration);
  toastState.message = value;

  if (typeof window === "undefined") return;
  if (clearToastTimer) {
    window.clearTimeout(clearToastTimer);
    clearToastTimer = null;
  }

  const timeout = Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_TOAST_DURATION;
  clearToastTimer = window.setTimeout(() => {
    clearToast(value);
    clearToastTimer = null;
  }, timeout);
}
