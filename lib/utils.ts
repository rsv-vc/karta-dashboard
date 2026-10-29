import { format, parseISO } from "date-fns";
import { TODAY } from "@/lib/constants";
import { daysBetween, toDateKey } from "@/lib/dates";

export { cn } from "cn";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Full rupee amount with Indian digit grouping, e.g. 1250000 -> "₹12,50,000". */
export function formatINR(value: number): string {
  return inrFormatter.format(value);
}

const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Whole number with Indian digit grouping, e.g. 150000 -> "1,50,000". */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** One decimal place, without a trailing ".0". */
function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** Compact rupee amount: "₹85K", "₹12.5L", "₹1.2Cr". */
export function formatINRShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${oneDecimal(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${oneDecimal(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${oneDecimal(abs / 1e3)}K`;
  return formatINR(value);
}

/** "2026-10-28T10:30:00+05:30" -> "28 Oct 2026" (uses the IST calendar day). */
export function formatDate(iso: string): string {
  return format(parseISO(toDateKey(iso)), "d MMM yyyy");
}

/** "2026-10-28T14:05:00+05:30" -> "28 Oct 2026, 2:05 pm" (IST wall-clock time from the string). */
export function formatDateTime(iso: string): string {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${formatDate(iso)}, ${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "2026-10" -> "Oct 2026" */
export function formatMonth(monthKey: string): string {
  return format(parseISO(`${monthKey}-01`), "MMM yyyy");
}

/** A past event relative to TODAY: "Today", "Yesterday", "5 days ago". */
export function formatDaysAgo(iso: string): string {
  const n = daysBetween(iso, TODAY);
  return n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`;
}

/** Relative to TODAY: "Today", "In 3 days", "2 days overdue". */
export function formatRelativeDays(iso: string): string {
  const diff = daysBetween(TODAY, iso);
  if (diff === 0) return "Today";
  const n = Math.abs(diff);
  const unit = n === 1 ? "day" : "days";
  return diff > 0 ? `In ${n} ${unit}` : `${n} ${unit} overdue`;
}
