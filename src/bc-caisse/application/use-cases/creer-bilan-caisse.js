import { calculerBilanCaisse } from "../../domain/bilan-caisse.js";
import { TypeBilan } from "../../domain/value-objects.js";
import { generateBilanCaisseId } from "../../../shared/domain/id-generator.js";
import {
  buildDateJour,
  getKinshasaParts,
  isEndOfMonth,
  isSunday,
  isAfterOrAt
} from "../../domain/horloge-kinshasa.js";

function formatDate(year, month, day) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function startOfWeek(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const diff = parts.weekday === 0 ? 6 : parts.weekday - 1;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - diff);
  return formatDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate());
}

function startOfMonth(parts) {
  return formatDate(parts.year, parts.month, 1);
}

function endOfMonth(parts) {
  return formatDate(parts.year, parts.month, parts.day);
}

export async function creerBilanHebdoSiFinSemaine({
  caisseRepo,
  bilanRepo,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parts = getKinshasaParts(now, timeZone);
  if (!isSunday(parts)) return null;
  if (!isAfterOrAt(parts, 23, 0)) return null;

  const dateFin = buildDateJour(parts);
  const dateDebut = startOfWeek(parts);
  const exists = await bilanRepo.getByPeriod(TypeBilan.HEBDO, dateDebut, dateFin);
  if (exists) return exists;

  const caisses = await caisseRepo.listByDateRange(dateDebut, dateFin);
  const bilan = calculerBilanCaisse({
    caisses,
    dateDebut,
    dateFin,
    typeBilan: TypeBilan.HEBDO
  });

  const payload = {
    ...bilan,
    idBilan: generateBilanCaisseId(),
    creePar: utilisateur,
    dateCreation: now.toISOString()
  };
  await bilanRepo.save(payload);
  return payload;
}

export async function creerBilanMensuelSiFinMois({
  caisseRepo,
  bilanRepo,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parts = getKinshasaParts(now, timeZone);
  if (!isEndOfMonth(parts)) return null;
  if (!isAfterOrAt(parts, 23, 0)) return null;

  const dateFin = endOfMonth(parts);
  const dateDebut = startOfMonth(parts);
  const exists = await bilanRepo.getByPeriod(TypeBilan.MENSUEL, dateDebut, dateFin);
  if (exists) return exists;

  const caisses = await caisseRepo.listByDateRange(dateDebut, dateFin);
  const bilan = calculerBilanCaisse({
    caisses,
    dateDebut,
    dateFin,
    typeBilan: TypeBilan.MENSUEL
  });

  const payload = {
    ...bilan,
    idBilan: generateBilanCaisseId(),
    creePar: utilisateur,
    dateCreation: now.toISOString()
  };
  await bilanRepo.save(payload);
  return payload;
}
