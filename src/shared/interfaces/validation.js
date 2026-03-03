// Minimal request validation helper
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length > 0) {
    return { ok: false, error: `Missing fields: ${missing.join(", ")}` };
  }
  return { ok: true };
}

export function requireNumber(body, field) {
  const v = body[field];
  if (typeof v !== "number" || Number.isNaN(v)) {
    return { ok: false, error: `${field} must be a number` };
  }
  return { ok: true };
}
