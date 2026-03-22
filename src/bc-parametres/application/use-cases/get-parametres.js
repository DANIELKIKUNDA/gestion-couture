import { buildDefaultAtelierParametresPayload } from "../../domain/default-parametres.js";

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function buildRuntimePayload(current) {
  const merged = buildDefaultAtelierParametresPayload({ overrides: current?.payload || null });
  const version = Number(current?.version || merged?.meta?.version || 1);
  const lastSavedAt = current?.updatedAt || merged?.meta?.lastSavedAt || null;

  return {
    meta: {
      version,
      lastSavedAt
    },
    identite: {
      nomAtelier: String(merged?.identite?.nomAtelier || "Atelier").trim() || "Atelier",
      devise: String(merged?.identite?.devise || "FC").trim().toUpperCase() || "FC",
      logoUrl: String(merged?.identite?.logoUrl || "").trim()
    },
    commandes: cloneJson(merged?.commandes || {}),
    retouches: cloneJson(merged?.retouches || {}),
    habits: cloneJson(merged?.habits || {})
  };
}

export async function getParametresAtelier({ repo }) {
  return repo.getCurrent();
}

export async function getRuntimeParametresAtelier({ repo }) {
  const current = await repo.getCurrent();
  const payload = buildRuntimePayload(current);

  return {
    payload,
    version: Number(payload?.meta?.version || 1),
    updatedAt: payload?.meta?.lastSavedAt || null,
    updatedBy: null
  };
}
