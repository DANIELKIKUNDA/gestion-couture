import { buildDateJour, getKinshasaParts, TIMEZONE_KINSHASA } from "../../domain/horloge-kinshasa.js";

export function isCaisseDateDuJour(caisse, { now = new Date(), timeZone = TIMEZONE_KINSHASA } = {}) {
  const dateCaisse = String(caisse?.date || caisse?.dateJour || "").slice(0, 10);
  const dateJour = buildDateJour(getKinshasaParts(now, timeZone));
  return Boolean(dateCaisse) && dateCaisse === dateJour;
}

export function assertCaisseDateDuJour(caisse, options = {}) {
  if (isCaisseDateDuJour(caisse, options)) return;
  throw new Error("Operation interdite: seule la caisse du jour peut recevoir une ecriture.");
}
