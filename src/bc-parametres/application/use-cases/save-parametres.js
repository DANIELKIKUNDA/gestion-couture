import { validateParametresPayload } from "../../domain/validation.js";

export async function saveParametresAtelier({ repo, payload, updatedBy = null, expectedVersion = null }) {
  validateParametresPayload(payload);
  const resolvedExpectedVersion = expectedVersion ?? payload?.meta?.version ?? null;
  return repo.save({ payload, updatedBy, expectedVersion: resolvedExpectedVersion });
}
