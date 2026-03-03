import { calculerBilanCaisse } from "../../domain/bilan-caisse.js";
import { TypeBilan } from "../../domain/value-objects.js";
import { generateBilanCaisseId } from "../../../shared/domain/id-generator.js";
import {
  buildDateJour,
  getKinshasaParts,
  isEndOfMonth
} from "../../domain/horloge-kinshasa.js";

function formatDate(year, month, day) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function startOfWeek(parts, endWeekday) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const startWeekday = (endWeekday + 1) % 7;
  const diff = (parts.weekday - startWeekday + 7) % 7;
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

function startOfYear(parts) {
  return formatDate(parts.year, 1, 1);
}

function endOfYear(parts) {
  return formatDate(parts.year, 12, 31);
}

function isEndOfYear(parts) {
  return parts.month === 12 && parts.day === 31;
}

function parseDateJour(dateJour) {
  if (dateJour instanceof Date && !Number.isNaN(dateJour.getTime())) {
    return {
      year: dateJour.getFullYear(),
      month: dateJour.getMonth() + 1,
      day: dateJour.getDate(),
      weekday: dateJour.getDay()
    };
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateJour || ""));
  if (!m) throw new Error("dateJour invalide");
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return {
    year,
    month,
    day,
    weekday: d.getUTCDay()
  };
}

function toIsoWeekYear(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { semaine: week, annee: isoYear };
}

function resolveEndWeekday(payload = null) {
  const raw = String(payload?.caisse?.finSemaineComptable || payload?.caisse?.finSemaine || "DIMANCHE").trim().toUpperCase();
  return raw === "SAMEDI" ? 6 : 0;
}

async function resolveSoldeDebut(caisseRepo, dateDebut) {
  if (!caisseRepo || typeof caisseRepo.listBeforeDate !== "function") return null;
  const before = await caisseRepo.listBeforeDate(dateDebut, 120);
  const lastClosed = (before || []).find((caisse) => caisse?.statutCaisse === "CLOTUREE" && caisse?.soldeCloture !== null);
  return lastClosed ? Number(lastClosed.soldeCloture) : null;
}

function sortByDate(caisses = []) {
  return [...caisses].sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));
}

export async function creerBilanHebdoSiFinSemaine({
  caisseRepo,
  bilanRepo,
  parametresRepo = null,
  caisseCloturee = null,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parametres = parametresRepo && typeof parametresRepo.getCurrent === "function"
    ? await parametresRepo.getCurrent()
    : null;
  const endWeekday = resolveEndWeekday(parametres?.payload || null);

  const parts = caisseCloturee?.date
    ? parseDateJour(caisseCloturee.date)
    : getKinshasaParts(now, timeZone);

  if (parts.weekday !== endWeekday) return null;

  const dateFin = buildDateJour(parts);
  const dateDebut = startOfWeek(parts, endWeekday);
  const exists = await bilanRepo.getByPeriod(TypeBilan.HEBDO, dateDebut, dateFin);
  if (exists) return exists;

  const caissesRange = await caisseRepo.listByDateRange(dateDebut, dateFin);
  const caisses = (caissesRange || []).filter((caisse) => caisse?.statutCaisse === "CLOTUREE");
  const soldeDebut = await resolveSoldeDebut(caisseRepo, dateDebut);
  const periode = toIsoWeekYear(parts);

  const bilan = calculerBilanCaisse({
    caisses,
    dateDebut,
    dateFin,
    typeBilan: TypeBilan.HEBDO,
    soldeOuvertureOverride: soldeDebut
  });
  const soldeFinPeriode = Number(soldeDebut ?? 0) + Number(bilan.totalEntrees || 0) - Number(bilan.totalSorties || 0);

  const payload = {
    ...bilan,
    soldeCloture: soldeFinPeriode,
    semaine: periode.semaine,
    annee: periode.annee,
    mois: null,
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
  parametresRepo = null,
  caisseCloturee = null,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parts = caisseCloturee?.date
    ? parseDateJour(caisseCloturee.date)
    : getKinshasaParts(now, timeZone);

  if (!isEndOfMonth(parts)) return null;

  const dateFin = endOfMonth(parts);
  const dateDebut = startOfMonth(parts);
  const exists = await bilanRepo.getByPeriod(TypeBilan.MENSUEL, dateDebut, dateFin);
  if (exists) return exists;

  const caissesRange = await caisseRepo.listByDateRange(dateDebut, dateFin);
  const caisses = (caissesRange || []).filter((caisse) => caisse?.statutCaisse === "CLOTUREE");
  const soldeDebut = await resolveSoldeDebut(caisseRepo, dateDebut);

  const bilan = calculerBilanCaisse({
    caisses,
    dateDebut,
    dateFin,
    typeBilan: TypeBilan.MENSUEL,
    soldeOuvertureOverride: soldeDebut
  });
  const soldeFinPeriode = Number(soldeDebut ?? 0) + Number(bilan.totalEntrees || 0) - Number(bilan.totalSorties || 0);

  const payload = {
    ...bilan,
    soldeCloture: soldeFinPeriode,
    mois: parts.month,
    annee: parts.year,
    semaine: null,
    idBilan: generateBilanCaisseId(),
    creePar: utilisateur,
    dateCreation: now.toISOString()
  };
  await bilanRepo.save(payload);
  return payload;
}

export async function creerBilanAnnuelSiFinAnnee({
  caisseRepo,
  bilanRepo,
  caisseCloturee = null,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  const parts = caisseCloturee?.date
    ? parseDateJour(caisseCloturee.date)
    : getKinshasaParts(now, timeZone);

  if (!isEndOfYear(parts)) return null;

  const dateDebut = startOfYear(parts);
  const dateFin = endOfYear(parts);
  const exists = await bilanRepo.getByPeriod(TypeBilan.ANNUEL, dateDebut, dateFin);
  if (exists) return exists;

  const previousYearStart = formatDate(parts.year - 1, 1, 1);
  const previousYearEnd = formatDate(parts.year - 1, 12, 31);
  const previousAnnual = await bilanRepo.getByPeriod(TypeBilan.ANNUEL, previousYearStart, previousYearEnd);
  const previousAnnualSolde = previousAnnual?.solde_cloture ?? previousAnnual?.soldeCloture ?? null;

  const allYearCaisses = sortByDate(await caisseRepo.listByDateRange(dateDebut, dateFin));
  const closedCaisses = allYearCaisses.filter((caisse) => caisse?.statutCaisse === "CLOTUREE");

  const fallbackSoldeDebut = allYearCaisses[0] ? Number(allYearCaisses[0].soldeOuverture || 0) : 0;
  const soldeDebutAnnee = previousAnnualSolde !== undefined && previousAnnualSolde !== null
    ? Number(previousAnnualSolde)
    : fallbackSoldeDebut;

  const bilan = calculerBilanCaisse({
    caisses: closedCaisses,
    dateDebut,
    dateFin,
    typeBilan: TypeBilan.ANNUEL,
    soldeOuvertureOverride: soldeDebutAnnee
  });
  const soldeFinAnnee = Number(soldeDebutAnnee) + Number(bilan.totalEntrees || 0) - Number(bilan.totalSorties || 0);

  const payload = {
    ...bilan,
    soldeCloture: soldeFinAnnee,
    mois: null,
    semaine: null,
    annee: parts.year,
    idBilan: generateBilanCaisseId(),
    creePar: utilisateur,
    dateCreation: now.toISOString()
  };
  await bilanRepo.save(payload);
  return payload;
}

export async function genererBilansApresCloture({
  caisseCloturee,
  caisseRepo,
  bilanRepo,
  parametresRepo = null,
  utilisateur = "system",
  now = new Date(),
  timeZone
}) {
  if (!caisseCloturee || caisseCloturee.statutCaisse !== "CLOTUREE") {
    return { hebdo: null, mensuel: null, annuel: null };
  }

  const hebdo = await creerBilanHebdoSiFinSemaine({
    caisseRepo,
    bilanRepo,
    parametresRepo,
    caisseCloturee,
    utilisateur,
    now,
    timeZone
  });

  const mensuel = await creerBilanMensuelSiFinMois({
    caisseRepo,
    bilanRepo,
    parametresRepo,
    caisseCloturee,
    utilisateur,
    now,
    timeZone
  });

  const annuel = await creerBilanAnnuelSiFinAnnee({
    caisseRepo,
    bilanRepo,
    caisseCloturee,
    utilisateur,
    now,
    timeZone
  });

  return { hebdo, mensuel, annuel };
}
