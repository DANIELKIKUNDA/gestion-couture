export const ACCOUNT_STATES = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED"
};

export function normalizeAccountState(value) {
  const v = String(value || "").trim().toUpperCase();
  if (Object.values(ACCOUNT_STATES).includes(v)) return v;
  return ACCOUNT_STATES.ACTIVE;
}

export function isWriteMethod(method) {
  const m = String(method || "").toUpperCase();
  return !["GET", "HEAD", "OPTIONS"].includes(m);
}
