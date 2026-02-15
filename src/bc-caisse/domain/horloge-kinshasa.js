export const TIMEZONE_KINSHASA = "Africa/Kinshasa";

const WEEKDAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export function getKinshasaParts(date = new Date(), timeZone = TIMEZONE_KINSHASA) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date);
  const out = { year: "", month: "", day: "", hour: "", minute: "", weekday: "" };
  for (const part of parts) {
    if (part.type in out) out[part.type] = part.value;
  }

  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    weekday: WEEKDAY_MAP[out.weekday] ?? 0
  };
}

export function buildDateJour(parts) {
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

export function isSunday(parts) {
  return parts.weekday === 0;
}

export function isEndOfMonth(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return date.getUTCMonth() !== next.getUTCMonth();
}

export function isAfterOrAt(parts, hour, minute) {
  if (parts.hour > hour) return true;
  if (parts.hour < hour) return false;
  return parts.minute >= minute;
}
