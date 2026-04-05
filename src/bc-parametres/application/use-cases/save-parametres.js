import { validateParametresPayload } from "../../domain/validation.js";

function normalizeHabitKey(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRetoucheCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeMeasureCode(value) {
  return String(value || "").trim();
}

function listActiveMeasureCodes(definition = null) {
  const mesures = Array.isArray(definition?.mesures) ? definition.mesures : [];
  return mesures
    .filter((row) => normalizeMeasureCode(row?.code) && row?.actif !== false)
    .map((row) => normalizeMeasureCode(row?.code));
}

async function isHabitTypeUsed({ habitKey, commandeRepo, retoucheRepo, serieRepo }) {
  if (!habitKey) return false;
  const checks = [
    commandeRepo?.existsByTypeHabit?.(habitKey),
    retoucheRepo?.existsByTypeHabit?.(habitKey),
    serieRepo?.existsByTypeVetement?.(habitKey)
  ].filter(Boolean);
  if (checks.length === 0) return false;
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

async function isRetoucheTypeUsed({ typeCode, retoucheRepo }) {
  if (!typeCode || !retoucheRepo?.existsByTypeRetouche) return false;
  return Boolean(await retoucheRepo.existsByTypeRetouche(typeCode));
}

async function isMeasureUsed({ measureCode, habitKey = null, retoucheCode = null, commandeRepo, retoucheRepo, serieRepo }) {
  if (!measureCode) return false;
  const checks = [
    commandeRepo?.existsByMeasureCode?.(measureCode, { typeHabit: habitKey || null }),
    retoucheRepo?.existsByMeasureCode?.(measureCode, {
      typeRetouche: retoucheCode || null,
      typeHabit: habitKey || null
    }),
    habitKey ? serieRepo?.existsByMeasureCode?.(measureCode, { typeVetement: habitKey }) : null
  ].filter(Boolean);
  if (checks.length === 0) return false;
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

async function validateHabitRemovalProtection({ repo, commandeRepo, retoucheRepo, serieRepo, payload }) {
  if (!repo || typeof repo.getCurrent !== "function") return;
  const current = await repo.getCurrent();
  const previousHabits = current?.payload?.habits && typeof current.payload.habits === "object" ? current.payload.habits : {};
  const nextHabits = payload?.habits && typeof payload.habits === "object" ? payload.habits : {};

  for (const [rawKey, previousHabit] of Object.entries(previousHabits)) {
    const habitKey = normalizeHabitKey(rawKey);
    if (!habitKey || Object.prototype.hasOwnProperty.call(nextHabits, habitKey)) continue;
    const used = await isHabitTypeUsed({ habitKey, commandeRepo, retoucheRepo, serieRepo });
    if (!used) continue;
    const label = String(previousHabit?.label || habitKey).trim() || habitKey;
    throw new Error(`Impossible de supprimer le type d'habit ${label} : il est deja utilise. Archivez-le a la place.`);
  }
}

async function validateHabitMeasureRemovalProtection({ repo, commandeRepo, retoucheRepo, serieRepo, payload }) {
  if (!repo || typeof repo.getCurrent !== "function") return;
  const current = await repo.getCurrent();
  const previousHabits = current?.payload?.habits && typeof current.payload.habits === "object" ? current.payload.habits : {};
  const nextHabits = payload?.habits && typeof payload.habits === "object" ? payload.habits : {};

  for (const [rawKey, previousHabit] of Object.entries(previousHabits)) {
    const habitKey = normalizeHabitKey(rawKey);
    const nextHabit = nextHabits[habitKey];
    if (!nextHabit) continue;
    const nextMeasureCodes = new Set(listActiveMeasureCodes(nextHabit));
    for (const measureCode of listActiveMeasureCodes(previousHabit)) {
      if (nextMeasureCodes.has(measureCode)) continue;
      const used = await isMeasureUsed({ measureCode, habitKey, commandeRepo, retoucheRepo, serieRepo });
      if (!used) continue;
      const habitLabel = String(previousHabit?.label || habitKey).trim() || habitKey;
      throw new Error(`Impossible de supprimer la mesure ${measureCode} du type ${habitLabel} : elle est deja utilisee. Archivez-la a la place.`);
    }
  }
}

async function validateRetoucheTypeRemovalProtection({ repo, retoucheRepo, payload }) {
  if (!repo || typeof repo.getCurrent !== "function") return;
  const current = await repo.getCurrent();
  const previousTypes = Array.isArray(current?.payload?.retouches?.typesRetouche) ? current.payload.retouches.typesRetouche : [];
  const nextTypes = Array.isArray(payload?.retouches?.typesRetouche) ? payload.retouches.typesRetouche : [];
  const nextCodes = new Set(nextTypes.map((row) => normalizeRetoucheCode(row?.code)).filter(Boolean));

  for (const previousType of previousTypes) {
    const typeCode = normalizeRetoucheCode(previousType?.code);
    if (!typeCode || nextCodes.has(typeCode)) continue;
    const used = await isRetoucheTypeUsed({ typeCode, retoucheRepo });
    if (!used) continue;
    const label = String(previousType?.libelle || typeCode).trim() || typeCode;
    throw new Error(`Impossible de supprimer le type de retouche ${label} : il est deja utilise. Archivez-le a la place.`);
  }
}

async function validateRetoucheMeasureRemovalProtection({ repo, retoucheRepo, payload }) {
  if (!repo || typeof repo.getCurrent !== "function") return;
  const current = await repo.getCurrent();
  const previousTypes = Array.isArray(current?.payload?.retouches?.typesRetouche) ? current.payload.retouches.typesRetouche : [];
  const nextTypes = Array.isArray(payload?.retouches?.typesRetouche) ? payload.retouches.typesRetouche : [];
  const nextByCode = new Map(nextTypes.map((row) => [normalizeRetoucheCode(row?.code), row]));

  for (const previousType of previousTypes) {
    const typeCode = normalizeRetoucheCode(previousType?.code);
    const nextType = nextByCode.get(typeCode);
    if (!typeCode || !nextType) continue;
    const nextMeasureCodes = new Set(listActiveMeasureCodes(nextType));
    for (const measureCode of listActiveMeasureCodes(previousType)) {
      if (nextMeasureCodes.has(measureCode)) continue;
      const used = await isMeasureUsed({ measureCode, retoucheCode: typeCode, retoucheRepo });
      if (!used) continue;
      const label = String(previousType?.libelle || typeCode).trim() || typeCode;
      throw new Error(`Impossible de supprimer la mesure ${measureCode} du type de retouche ${label} : elle est deja utilisee. Archivez-la a la place.`);
    }
  }
}

export async function saveParametresAtelier({
  repo,
  payload,
  updatedBy = null,
  expectedVersion = null,
  commandeRepo = null,
  retoucheRepo = null,
  serieRepo = null
}) {
  validateParametresPayload(payload);
  await validateHabitRemovalProtection({ repo, commandeRepo, retoucheRepo, serieRepo, payload });
  await validateHabitMeasureRemovalProtection({ repo, commandeRepo, retoucheRepo, serieRepo, payload });
  await validateRetoucheTypeRemovalProtection({ repo, retoucheRepo, payload });
  await validateRetoucheMeasureRemovalProtection({ repo, retoucheRepo, payload });
  const resolvedExpectedVersion = expectedVersion ?? payload?.meta?.version ?? null;
  return repo.save({ payload, updatedBy, expectedVersion: resolvedExpectedVersion });
}
