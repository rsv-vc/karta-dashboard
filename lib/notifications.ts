import type { MonthlyTarget } from "@/data/mock-targets";
import { isActiveStage } from "@/lib/constants";
import { daysBetween, toDateKey, toIstIso } from "@/lib/dates";
import { getFollowUpsDue } from "@/lib/selectors";
import { formatINRShort } from "@/lib/utils";
import type { Lead } from "@/types/lead";

// The notification feed, computed (never stored) from the accounts the viewer
// can see: alerts that keep them active (overdue and due-today follow-ups) and
// small victories (wins, new accounts, accounts handed to them, monthly targets
// met). Unread = newer than the person's "seen up to" marker.

export type NotificationTone = "alert" | "celebrate" | "info";

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  detail: string;
  href: string;
  /** ISO timestamp the event happened (alerts: the start of today, so they come back daily). */
  at: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

/** How far back wins, new accounts and hand-overs are shown. */
export const NOTIFICATION_WINDOW_DAYS = 14;

const names = (leads: Lead[]) =>
  leads.length <= 3 ? leads.map((l) => l.companyName).join(", ") : `${leads.slice(0, 3).map((l) => l.companyName).join(", ")} and ${leads.length - 3} more`;

export function buildNotifications(
  leads: Lead[],
  o: {
    viewerId: string;
    viewerName: string;
    isAdmin: boolean;
    today: string;
    nameOf: (id: string) => string;
    target: MonthlyTarget;
    /** Last time the viewer opened the feed (ISO), or null. */
    seenAt: string | null;
  },
): NotificationFeed {
  const items: AppNotification[] = [];
  const own = leads.filter((l) => l.ownerId === o.viewerId);
  const startOfToday = toIstIso(o.today, 0, 0);
  const recent = (iso: string | null): iso is string => iso !== null && daysBetween(toDateKey(iso), o.today) <= NOTIFICATION_WINDOW_DAYS && toDateKey(iso) <= o.today;
  const month = o.today.slice(0, 7);

  // Alerts: the viewer's own follow-ups.
  const { overdue, today } = getFollowUpsDue(o.viewerId, o.today, own);
  if (overdue.length > 0) {
    items.push({
      id: `overdue-${o.today}`,
      tone: "alert",
      title: `${overdue.length} follow-up${overdue.length === 1 ? "" : "s"} overdue`,
      detail: names(overdue),
      href: "/follow-ups",
      at: startOfToday,
    });
  }
  if (today.length > 0) {
    items.push({
      id: `today-${o.today}`,
      tone: "alert",
      title: `${today.length} follow-up${today.length === 1 ? "" : "s"} due today`,
      detail: names(today),
      href: "/follow-ups",
      at: startOfToday,
    });
  }

  // Employees also keep an eye on the team's overdue follow-ups.
  if (o.isAdmin) {
    const team = getFollowUpsDue(undefined, o.today, leads).overdue.filter((l) => l.ownerId !== o.viewerId);
    if (team.length > 0) {
      items.push({
        id: `team-overdue-${o.today}`,
        tone: "alert",
        title: `Team: ${team.length} follow-up${team.length === 1 ? "" : "s"} overdue`,
        detail: [...new Set(team.map((l) => o.nameOf(l.ownerId)))].join(", "),
        href: "/follow-ups",
        at: startOfToday,
      });
    }
  }

  // Wins: the team's for employees, their own for agents.
  for (const l of (o.isAdmin ? leads : own).filter((l) => l.stage === "won" && recent(l.closedAt))) {
    const mine = l.ownerId === o.viewerId;
    items.push({
      id: `won-${l.id}`,
      tone: "celebrate",
      title: mine ? `You closed ${l.companyName}` : `${o.nameOf(l.ownerId)} closed ${l.companyName}`,
      detail: l.dealValue > 0 ? `Won at ${formatINRShort(l.dealValue)}` : "Won",
      href: `/leads/${l.id}`,
      at: l.closedAt!,
    });
  }

  // New accounts.
  for (const l of (o.isAdmin ? leads : own).filter((l) => recent(l.createdAt))) {
    const mine = l.ownerId === o.viewerId;
    items.push({
      id: `new-${l.id}`,
      tone: "info",
      title: `New account: ${l.companyName}`,
      detail: mine ? "Owned by you" : `Owned by ${o.nameOf(l.ownerId)}`,
      href: `/leads/${l.id}`,
      at: l.createdAt,
    });
  }

  // Accounts handed to the viewer (the reassign activity names the new owner last).
  for (const l of own) {
    const handover = l.activities.find(
      (a) => a.description.startsWith("Reassigned from") && a.description.endsWith(` to ${o.viewerName}`) && recent(a.date),
    );
    if (handover && isActiveStage(l.stage)) {
      items.push({ id: `handover-${handover.id}`, tone: "info", title: `${l.companyName} is now yours`, detail: handover.description, href: `/leads/${l.id}`, at: handover.date });
    }
  }

  // Monthly targets met (the viewer's own).
  const wonThisMonth = own
    .filter((l) => l.stage === "won" && l.closedAt?.slice(0, 7) === month)
    .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  let running = 0;
  const crossing = o.target.wonValue > 0 ? wonThisMonth.find((l) => (running += l.dealValue) >= o.target.wonValue) : undefined;
  if (crossing) {
    items.push({
      id: `target-won-${month}`,
      tone: "celebrate",
      title: "Monthly won target met",
      detail: `${formatINRShort(wonThisMonth.reduce((s, l) => s + l.dealValue, 0))} won against ${formatINRShort(o.target.wonValue)}`,
      href: "/dashboard",
      at: crossing.closedAt!,
    });
  }
  const addedThisMonth = own.filter((l) => l.createdAt.slice(0, 7) === month).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (o.target.newLeads > 0 && addedThisMonth.length >= o.target.newLeads) {
    items.push({
      id: `target-new-${month}`,
      tone: "celebrate",
      title: "New-account target met",
      detail: `${addedThisMonth.length} accounts added this month (target ${o.target.newLeads})`,
      href: "/my-leads",
      at: addedThisMonth[o.target.newLeads - 1].createdAt,
    });
  }

  const seen = o.seenAt ? Date.parse(o.seenAt) : -Infinity;
  const sorted = items
    .sort((a, b) => (a.tone === "alert") !== (b.tone === "alert") ? (a.tone === "alert" ? -1 : 1) : Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);
  return { items: sorted, unread: sorted.filter((n) => Date.parse(n.at) > seen).length };
}
