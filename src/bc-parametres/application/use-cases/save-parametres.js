import { validateParametresPayload } from "../../domain/validation.js";

export async function saveParametresAtelier({ repo, payload, updatedBy = null }) {
  validateParametresPayload(payload);
  return repo.save({ payload, updatedBy, version: payload?.meta?.version || 1 });
}
