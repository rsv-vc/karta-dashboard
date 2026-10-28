// Timezone-safe date helpers. All business dates are Indian (IST) calendar days,
// so day-level logic works on the "YYYY-MM-DD" prefix of each ISO string rather
// than on Date objects, which would shift with the server's timezone.

const MS_PER_DAY = 86_400_000;

/** "2026-10-28T10:30:00+05:30" -> "2026-10-28" */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Calendar day -> integer day number (days since 1970-01-01). */
export function toDayNumber(dateKey: string): number {
  return Math.round(Date.parse(`${dateKey}T00:00:00Z`) / MS_PER_DAY);
}

/** Integer day number -> "YYYY-MM-DD". */
export function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole calendar days from `a` to `b` (positive when b is later). Accepts ISO strings or date keys. */
export function daysBetween(a: string, b: string): number {
  return toDayNumber(toDateKey(b)) - toDayNumber(toDateKey(a));
}

/** Build an IST ISO timestamp for a calendar day and time. */
export function toIstIso(dateKey: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dateKey}T${hh}:${mm}:00+05:30`;
}

/**
 * "Now" in the mock world: TODAY's date with the real current IST time of day.
 * The calendar is frozen at TODAY so seed data stays meaningful.
 */
export function nowIso(today: string, realNow: number = Date.now()): string {
  const ist = new Date(realNow + 330 * 60_000);
  return toIstIso(today, ist.getUTCHours(), ist.getUTCMinutes());
}

/** `iso` if it is after `minIso`, otherwise one minute after `minIso` (same IST format). */
export function laterThan(iso: string, minIso: string): string {
  if (iso > minIso) return iso;
  const next = new Date(Date.parse(minIso) + 60_000 + 330 * 60_000);
  return toIstIso(next.toISOString().slice(0, 10), next.getUTCHours(), next.getUTCMinutes());
}

/** "YYYY-MM" key for a year and 1-12 month. */
export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Last calendar day of a 1-12 month, as a date key. */
export function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
