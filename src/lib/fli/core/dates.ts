// v1.0
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function parseIsoDate(dateStr: string): Date {
  if (!ISO_DATE_RE.test(dateStr)) throw new TypeError(`Invalid ISO date: ${dateStr}`);
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  if (isNaN(date.getTime())) throw new TypeError(`Invalid calendar date: ${dateStr}`);
  const rt = formatIsoDate(date);
  if (rt !== dateStr) throw new TypeError(`Date ${dateStr} round-tripped to ${rt}`);
  return date;
}
export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
