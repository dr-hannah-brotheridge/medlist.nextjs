const NZ_DATE = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Format an ISO date (YYYY-MM-DD) as a readable NZ date, e.g. "15 May 2026". */
export function formatNZDate(iso: string | null | undefined): string {
  if (!iso) return "Not specified";
  // Parse as a local date to avoid timezone shifting the day.
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "Not specified";
  return NZ_DATE.format(new Date(y, m - 1, d));
}

/** Normalise any date-ish value to an ISO date string, or "" if empty. */
export function toISODate(value: string | null | undefined): string {
  if (!value) return "";
  return value.split("T")[0];
}
