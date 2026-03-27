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
  atelierId = "",
  caisseRepo,
  parametresRepo = null,
  utilisateur = "system",
  now = new Date(),
  timeZone = TIMEZONE_KINSHASA,
  logAutomation = null
}) {
  const scopedAtelierId =
    String(atelierId || "").trim() ||
    String(caisseRepo?.atelierId || "").trim() ||
    String(parametresRepo?.atelierId || "").trim() ||
    "ATELIER";
  const log = (reason, details = {}) => {
    if (typeof logAutomation !== "function") return;
    logAutomation(reason, { atelierId: scopedAtelierId, ...details });
  };
  const parts = getKinshasaParts(now, timeZone);
  const dateJour = buildDateJour(parts);
  const existing = await caisseRepo.getByDate(dateJour);
  if (existing) {
    log("open-skip", {
      reason: "caisse-deja-existante",
      dateJour,
      idCaisseJour: existing.idCaisseJour,
      statut: existing.statutCaisse
    });
    return null;
  }

  const parametres = parametresRepo && typeof parametresRepo.getCurrent === "function"
    ? await parametresRepo.getCurrent()
    : null;

  const caisseCfg = parametres?.payload?.caisse || {};
  const isSunday = parts.weekday === 0;
  const opening = parseTime(isSunday ? caisseCfg.ouvertureDimanche : caisseCfg.ouvertureAuto);

  if (!isAfterOrAt(parts, opening.hour, opening.minute)) {
    log("open-skip", {
      reason: "heure-ouverture-non-atteinte",
      dateJour,
      heureOuverture: `${String(opening.hour).padStart(2, "0")}:${String(opening.minute).padStart(2, "0")}`,
      heureCourante: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
    });
    return null;
  }

  const precedente = await caisseRepo.getLatestBeforeDate(dateJour);
  if (!precedente) {
    log("open-skip", {
      reason: "premiere-caisse-manuelle-requise",
      dateJour
    });
    return null;
  }

  if (precedente && precedente.statutCaisse !== StatutCaisse.CLOTUREE) {
    log("open-skip", {
      reason: "caisse-precedente-non-cloturee",
      dateJour,
      previousDate: precedente.date,
      previousStatus: precedente.statutCaisse,
      previousId: precedente.idCaisseJour
    });
    return null;
  }

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
