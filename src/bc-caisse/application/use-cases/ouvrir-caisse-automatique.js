import { getKinshasaParts, buildDateJour, isAfterOrAt, TIMEZONE_KINSHASA } from "../../domain/horloge-kinshasa.js";
import { StatutCaisse } from "../../domain/value-objects.js";
import { ouvrirCaisseDuJour } from "./ouvrir-caisse-du-jour.js";

function parseTime(value, fallback = "07:30") {
  const raw = String(value || fallback);
  const m = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return { hour: 7, minute: 30 };
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export async function ouvrirCaisseAutomatique({
  caisseRepo,
  parametresRepo = null,
  utilisateur = "system",
  now = new Date(),
  timeZone = TIMEZONE_KINSHASA
}) {
  const parts = getKinshasaParts(now, timeZone);
  const dateJour = buildDateJour(parts);
  const existing = await caisseRepo.getByDate(dateJour);
  if (existing) return null;

  const parametres = parametresRepo && typeof parametresRepo.getCurrent === "function"
    ? await parametresRepo.getCurrent()
    : null;

  const caisseCfg = parametres?.payload?.caisse || {};
  const isSunday = parts.weekday === 0;
  const opening = parseTime(isSunday ? caisseCfg.ouvertureDimanche : caisseCfg.ouvertureAuto);

  if (!isAfterOrAt(parts, opening.hour, opening.minute)) return null;

  const precedente = await caisseRepo.getLatestBeforeDate(dateJour);
  if (precedente && precedente.statutCaisse !== StatutCaisse.CLOTUREE) return null;

  return ouvrirCaisseDuJour({
    utilisateur,
    soldeInitial: 0,
    overrideHeureOuverture: true,
    role: "SYSTEME",
    motifOverride: "AUTO_OPEN",
    caisseRepo,
    now,
    timeZone
  });
}
