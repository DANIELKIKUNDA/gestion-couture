function generateCompactIdFragment() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  }

  const now = Date.now().toString(16).toUpperCase();
  const random = Math.random().toString(16).slice(2, 14).toUpperCase();
  return `${now}${random}`.slice(0, 12);
}

function createServerEntityId(prefix) {
  const normalizedPrefix = String(prefix || "").trim().toUpperCase();
  if (!normalizedPrefix) {
    throw new Error("Prefixe d'identifiant requis.");
  }
  return `${normalizedPrefix}-${generateCompactIdFragment()}`;
}

export function createServerClientId() {
  return createServerEntityId("CLI");
}

export function createServerCommandeId() {
  return createServerEntityId("CMD");
}

export function createServerRetoucheId() {
  return createServerEntityId("RET");
}
