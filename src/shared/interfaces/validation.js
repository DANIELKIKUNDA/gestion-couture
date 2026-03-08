import { z } from "zod";

// Minimal request validation helper
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length > 0) {
    return { ok: false, error: `Champs obligatoires manquants: ${missing.join(", ")}` };
  }
  return { ok: true };
}

export function requireNumber(body, field) {
  const v = body[field];
  if (typeof v !== "number" || Number.isNaN(v)) {
    return { ok: false, error: `${field} doit etre un nombre` };
  }
  return { ok: true };
}

export function validateSchema(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((issue) => issue.message).join("; ")
    };
  }
  return { ok: true, data: result.data };
}

export const zod = z;
