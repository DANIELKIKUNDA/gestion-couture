function toIsoDate(input) {
  if (!input) return "";
  const raw = String(input).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function positiveInt(raw, fallback, max = 200) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.floor(n));
}

function paginateRows(rows, page, size) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    page: safePage,
    size,
    total,
    totalPages
  };
}

export {
  positiveInt,
  paginateRows,
  toIsoDate
};
