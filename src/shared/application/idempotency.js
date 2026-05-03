export class IdempotencyConflict extends Error {
  constructor(message = "Cette operation a deja ete traitee avec des donnees differentes.") {
    super(message);
    this.name = "IdempotencyConflict";
    this.code = "IDEMPOTENCY_CONFLICT";
    this.statusCode = 409;
  }
}

export function normalizeIdempotencyKey(value) {
  const normalized = typeof value === "string" ? value.trim() : String(value || "").trim();
  return normalized || null;
}

export function assertSameString(left, right, message) {
  const leftValue = String(left || "").trim();
  const rightValue = String(right || "").trim();
  if (leftValue !== rightValue) {
    throw new IdempotencyConflict(message);
  }
}

export function assertSameNumber(left, right, message) {
  const leftValue = Number(left || 0);
  const rightValue = Number(right || 0);
  if (Math.abs(leftValue - rightValue) > 0.000001) {
    throw new IdempotencyConflict(message);
  }
}

export async function lockIdempotencyKey(db, scope, atelierId, idempotencyKey) {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  if (!normalizedKey) return;
  const lockKey = `${String(scope || "idempotency").trim()}:${String(atelierId || "").trim()}:${normalizedKey}`;
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
}

export function idempotencyConflictResponse(error) {
  return {
    code: error?.code || "IDEMPOTENCY_CONFLICT",
    message: error?.message || "Cette operation a deja ete traitee avec des donnees differentes."
  };
}
