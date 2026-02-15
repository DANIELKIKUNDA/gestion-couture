import { MontantInvalide, OuvertureInterdite } from "./errors.js";
import { getKinshasaParts, isSunday } from "./horloge-kinshasa.js";

export function assertHeureOuvertureAutorisee({ now = new Date(), timeZone, override = false, role = "", motif = "" }) {
  const parts = getKinshasaParts(now, timeZone);
  const isSun = isSunday(parts);
  const minHour = isSun ? 7 : 6;
  const minMinute = isSun ? 0 : 30;

  const before =
    parts.hour < minHour || (parts.hour === minHour && parts.minute < minMinute);

  if (before) {
    if (override && String(role).toLowerCase() === "manager" && String(motif).trim()) {
      return { ...parts, ouvertureAnticipee: true, motifOuvertureAnticipee: motif.trim() };
    }
    const label = isSun ? "07:00" : "06:30";
    throw new OuvertureInterdite(`Ouverture autorisee a partir de ${label} (heure Kinshasa).`);
  }

  return { ...parts, ouvertureAnticipee: false, motifOuvertureAnticipee: null };
}

export function determinerSoldeOuverture({ soldeCloturePrecedent, soldeInitial }) {
  if (soldeCloturePrecedent !== null && soldeCloturePrecedent !== undefined) {
    return Number(soldeCloturePrecedent);
  }

  const base = soldeInitial ?? 0;
  const value = Number(base);
  if (Number.isNaN(value) || value < 0) {
    throw new MontantInvalide("soldeOuverture must be >= 0");
  }
  return value;
}
