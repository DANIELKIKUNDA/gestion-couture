import { isAfterOrAt } from "./horloge-kinshasa.js";
import { StatutCaisse } from "./value-objects.js";

export const HEURE_CLOTURE_AUTOMATIQUE = 17;
export const MINUTE_CLOTURE_AUTOMATIQUE = 0;

function parseHoraire(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function resolveClotureAutoConfig(payload = null) {
  const caisse = payload?.caisse || {};
  const legacyMidnight = typeof caisse.clotureAutoMinuit === "boolean" ? caisse.clotureAutoMinuit : null;
  const active = typeof caisse.clotureAutoActive === "boolean" ? caisse.clotureAutoActive : legacyMidnight !== null ? legacyMidnight : true;
  const configured = parseHoraire(caisse.heureClotureAuto);
  return {
    active,
    hour: configured?.hour ?? (legacyMidnight === true ? 0 : HEURE_CLOTURE_AUTOMATIQUE),
    minute: configured?.minute ?? (legacyMidnight === true ? 0 : MINUTE_CLOTURE_AUTOMATIQUE)
  };
}

function caisseOuverteLaPlusRecente(caisses = []) {
  for (const caisse of caisses) {
    if (caisse?.statutCaisse === StatutCaisse.OUVERTE) return caisse;
  }
  return null;
}

export function selectionnerCaisseACloturer({ parts, caisseDuJour = null, caissesAnterieures = [], clotureAuto = null }) {
  const active = clotureAuto?.active !== false;
  const hour = Number.isInteger(clotureAuto?.hour) ? clotureAuto.hour : HEURE_CLOTURE_AUTOMATIQUE;
  const minute = Number.isInteger(clotureAuto?.minute) ? clotureAuto.minute : MINUTE_CLOTURE_AUTOMATIQUE;
  if (!active) return null;

  // Priorite 1: rattraper une caisse anterieure restee ouverte.
  const caisseRetard = caisseOuverteLaPlusRecente(caissesAnterieures);
  if (caisseRetard) return caisseRetard;

  // Cas particulier: une cloture configuree a minuit signifie "a la bascule du jour suivant".
  // On ne doit donc jamais cloturer la caisse du jour pendant ce meme jour.
  if (hour === 0 && minute === 0) return null;

  // Priorite 2: a partir de l'heure de cloture, fermer la caisse du jour si elle est ouverte.
  if (!isAfterOrAt(parts, hour, minute)) return null;
  if (!caisseDuJour || caisseDuJour.statutCaisse !== StatutCaisse.OUVERTE) return null;
  return caisseDuJour;
}
