import { MontantInvalide, OuvertureInterdite } from "./errors.js";
import { getKinshasaParts, isSunday } from "./horloge-kinshasa.js";

function parseHoraire(value, fallbackHour, fallbackMinute) {
  const raw = String(value || "").trim();
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) {
    return {
      hour: fallbackHour,
      minute: fallbackMinute,
      label: `${String(fallbackHour).padStart(2, "0")}:${String(fallbackMinute).padStart(2, "0")}`
    };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return {
      hour: fallbackHour,
      minute: fallbackMinute,
      label: `${String(fallbackHour).padStart(2, "0")}:${String(fallbackMinute).padStart(2, "0")}`
    };
  }
  return {
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  };
}

export function resolveHeureOuvertureConfig({ parametres = null, isSun = false } = {}) {
  const caisse = parametres?.payload?.caisse || parametres?.caisse || {};
  if (isSun) return parseHoraire(caisse.ouvertureDimanche, 7, 0);
  return parseHoraire(caisse.ouvertureAuto, 6, 30);
}

export function assertHeureOuvertureAutorisee({ now = new Date(), timeZone, override = false, role = "", motif = "", parametres = null }) {
  const parts = getKinshasaParts(now, timeZone);
  const isSun = isSunday(parts);
  const opening = resolveHeureOuvertureConfig({ parametres, isSun });
  const minHour = opening.hour;
  const minMinute = opening.minute;

  const before =
    parts.hour < minHour || (parts.hour === minHour && parts.minute < minMinute);

  if (before) {
    if (override && String(role).toLowerCase() === "manager" && String(motif).trim()) {
      return { ...parts, ouvertureAnticipee: true, motifOuvertureAnticipee: motif.trim() };
    }
    throw new OuvertureInterdite(`Ouverture autorisee a partir de ${opening.label} (heure Kinshasa).`);
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
    throw new MontantInvalide("soldeOuverture doit etre >= 0");
  }
  return value;
}
