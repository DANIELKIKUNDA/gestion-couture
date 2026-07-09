import { reactive } from "vue";

const DEFAULT_TOAST_DURATION = 2600;
let clearToastTimer = null;

export const toastState = reactive({
  message: ""
});

function sanitizeVisibleMessage(message = "") {
  const value = String(message || "").trim();
  if (!value) return "";
  const lowered = value.toLowerCase();
  const technicalPatterns = [
    "connexion api impossible",
    "frontend",
    "backend",
    "stack trace",
    "syntax error",
    "does not exist",
    "undefined",
    "not implemented",
    "failed to fetch",
    "networkerror",
    "postgres",
    "pg_",
    "internal_error"
  ];
  if (technicalPatterns.some((pattern) => lowered.includes(pattern))) {
    return "Operation momentanement indisponible. Veuillez reessayer.";
  }
  return value;
}

export function clearToast(expectedMessage = "") {
  const normalizedExpected = String(expectedMessage || "").trim();
  if (normalizedExpected && toastState.message !== normalizedExpected) return;
  toastState.message = "";
}

export function showToast(message = "", options = {}) {
  const value = sanitizeVisibleMessage(message);
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
