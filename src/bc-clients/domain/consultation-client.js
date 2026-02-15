function toIsoDate(input) {
  if (!input) return "";
  return String(input).slice(0, 10);
}

function daysAgoIso(days, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function statutFidelite(totalInteractions) {
  if (totalInteractions >= 7) return "Client fidele";
  if (totalInteractions >= 3) return "Client regulier";
  return "Client occasionnel";
}

export function normalizeMesuresSnapshot(snapshot, fallbackTypeHabit = "") {
  if (!snapshot || typeof snapshot !== "object") return null;

  const rawValues =
    snapshot.valeurs && typeof snapshot.valeurs === "object" ? snapshot.valeurs : snapshot;

  const ignore = new Set(["mode", "unite", "valeurs", "typeHabit", "provenance", "dateRattrapage"]);
  const valeurs = {};

  for (const [key, value] of Object.entries(rawValues)) {
    if (ignore.has(key)) continue;

    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      valeurs[key] = value;
      continue;
    }

    if (typeof value === "string") {
      const clean = value.trim();
      if (!clean) continue;
      if (key === "typeManches") {
        valeurs[key] = clean.toLowerCase();
      } else {
        const num = Number(clean);
        if (Number.isFinite(num) && num > 0) valeurs[key] = num;
      }
    }
  }

  if (Object.keys(valeurs).length === 0) return null;

  return {
    unite: "cm",
    typeHabit: snapshot.typeHabit || fallbackTypeHabit || "",
    valeurs
  };
}

function matchesPeriode(isoDate, periode, now = new Date()) {
  if (!isoDate || !periode || periode === "ALL") return true;
  const value = toIsoDate(isoDate);
  if (periode === "30J") return value >= daysAgoIso(30, now);
  if (periode === "90J") return value >= daysAgoIso(90, now);
  if (periode === "365J") return value >= daysAgoIso(365, now);
  return true;
}

export function filterHistoriques({ commandes, retouches, mesures, source = "ALL", typeHabit = "ALL", periode = "ALL", now = new Date() }) {
  const commandesFiltered = (commandes || []).filter((row) => {
    if (source !== "ALL" && source !== "COMMANDE") return false;
    if (typeHabit !== "ALL" && row.typeHabit !== typeHabit) return false;
    return matchesPeriode(row.date, periode, now);
  });

  const retouchesFiltered = (retouches || []).filter((row) => {
    if (source !== "ALL" && source !== "RETOUCHE") return false;
    if (typeHabit !== "ALL" && row.typeHabit !== typeHabit) return false;
    return matchesPeriode(row.date, periode, now);
  });

  const mesuresFiltered = (mesures || []).filter((row) => {
    if (source !== "ALL" && row.source !== source) return false;
    if (typeHabit !== "ALL" && row.typeHabit !== typeHabit) return false;
    return matchesPeriode(row.datePrise, periode, now);
  });

  return {
    commandes: commandesFiltered,
    retouches: retouchesFiltered,
    mesures: mesuresFiltered
  };
}
