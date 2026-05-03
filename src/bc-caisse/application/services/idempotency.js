export function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  return key || null;
}

export function findOperationByIdempotencyKey(caisse, idempotencyKey) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return null;
  return (caisse?.operations || []).find((op) => normalizeIdempotencyKey(op.idempotencyKey) === key) || null;
}

export class IdempotencyConflict extends Error {
  constructor(message = "Cle d'idempotence deja utilisee avec une operation differente") {
    super(message);
    this.name = "IdempotencyConflict";
    this.code = "IDEMPOTENCY_CONFLICT";
    this.statusCode = 409;
  }
}

function normalizeComparableText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeComparableAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : NaN;
}

export function assertSameIdempotentOperation(existingOperation, expected = {}) {
  if (!existingOperation) return;
  const checks = [
    ["typeOperation", normalizeComparableText(existingOperation.typeOperation), normalizeComparableText(expected.typeOperation)],
    ["motif", normalizeComparableText(existingOperation.motif), normalizeComparableText(expected.motif)],
    ["referenceMetier", normalizeComparableText(existingOperation.referenceMetier), normalizeComparableText(expected.referenceMetier)],
    ["activite", normalizeComparableText(existingOperation.activite || "ATELIER"), normalizeComparableText(expected.activite || "ATELIER")]
  ];

  for (const [field, current, next] of checks) {
    if (next !== null && current !== next) {
      throw new IdempotencyConflict(`Cle d'idempotence deja utilisee avec un ${field} different`);
    }
  }

  const currentAmount = normalizeComparableAmount(existingOperation.montant);
  const nextAmount = normalizeComparableAmount(expected.montant);
  if (!Number.isNaN(nextAmount) && currentAmount !== nextAmount) {
    throw new IdempotencyConflict("Cle d'idempotence deja utilisee avec un montant different");
  }
}

export function findAndAssertIdempotentOperation(caisse, idempotencyKey, expected = {}) {
  const existing = findOperationByIdempotencyKey(caisse, idempotencyKey);
  if (existing) assertSameIdempotentOperation(existing, expected);
  return existing;
}

export async function getCaisseByIdempotencyKey(caisseRepo, idempotencyKey) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key || !caisseRepo) return null;
  if (typeof caisseRepo.getByOperationIdempotencyKey === "function") {
    return caisseRepo.getByOperationIdempotencyKey(key);
  }
  return null;
}

export async function saveCaisseIdempotently(caisseRepo, caisse, idempotencyKey) {
  try {
    await caisseRepo.save(caisse);
    return caisse;
  } catch (err) {
    const key = normalizeIdempotencyKey(idempotencyKey);
    if (key && String(err?.code || "") === "23505") {
      const existing = await getCaisseByIdempotencyKey(caisseRepo, key);
      if (existing) return existing;
    }
    throw err;
  }
}
