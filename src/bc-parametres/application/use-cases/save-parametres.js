import { validateParametresPayload } from "../../domain/validation.js";

function normalizeHabitKey(value) {
  return String(value || "").trim().toUpperCase();
}

async function validateCommandeHabitArchiving({ repo, commandeRepo, payload }) {
  if (!repo || typeof repo.getCurrent !== "function" || !commandeRepo || typeof commandeRepo.existsByTypeHabit !== "function") return;
  const current = await repo.getCurrent();
  const previousHabits = current?.payload?.habits && typeof current.payload.habits === "object" ? current.payload.habits : {};
  const nextHabits = payload?.habits && typeof payload.habits === "object" ? payload.habits : {};

  for (const [key, habit] of Object.entries(nextHabits)) {
    const normalizedKey = normalizeHabitKey(key);
    const previous = previousHabits[normalizedKey];
    const wasActive = previous?.actif !== false;
    const willBeActive = habit?.actif !== false;
    if (!wasActive || willBeActive) continue;
    const usedByCommande = await commandeRepo.existsByTypeHabit(normalizedKey);
    if (usedByCommande) {
      const label = String(habit?.label || normalizedKey).trim() || normalizedKey;
      throw new Error(`Impossible d'archiver le type d'habit ${label} : il est deja utilise par des commandes.`);
    }
  }
}

export async function saveParametresAtelier({ repo, payload, updatedBy = null, expectedVersion = null, commandeRepo = null }) {
  validateParametresPayload(payload);
  await validateCommandeHabitArchiving({ repo, commandeRepo, payload });
  const resolvedExpectedVersion = expectedVersion ?? payload?.meta?.version ?? null;
  return repo.save({ payload, updatedBy, expectedVersion: resolvedExpectedVersion });
}
