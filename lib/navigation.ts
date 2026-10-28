import {
  BarChart3Icon,
  BellRingIcon,
  BookUserIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/user";

// Single source of truth for routes, labels, icons and who sees them. Hiding a
// link here is cosmetic only: every page enforces access through the DAL.

export type NavKey =
  | "dashboard"
  | "leads"
  | "directory"
  | "newLead"
  | "followUps"
  | "team"
  | "reports"
  | "settings";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** One label for everyone, or one per role. */
  label: string | Record<Role, string>;
  roles: readonly Role[];
  /** Build phase that fills in this page. */
  phase: number;
  description: string;
  badge?: "overdueFollowUps";
}

const ALL_ROLES: readonly Role[] = ["admin", "sales_agent"];

export const NAV_ITEMS: Record<NavKey, NavItem> = {
  dashboard: {
    key: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    label: { sales_agent: "My dashboard", admin: "Team overview" },
    roles: ALL_ROLES,
    phase: 6,
    description: "Your pipeline at a glance.",
  },
  leads: {
    key: "leads",
    href: "/leads",
    icon: UsersIcon,
    label: { sales_agent: "My leads", admin: "All leads" },
    roles: ALL_ROLES,
    phase: 4,
    description: "Every lead you can work on, with filters and search.",
  },
  directory: {
    key: "directory",
    href: "/leads/directory",
    icon: BookUserIcon,
    label: "Lead directory",
    roles: ["sales_agent"],
    phase: 4,
    description: "Who is already working which company, so nobody chases the same lead.",
  },
  newLead: {
    key: "newLead",
    href: "/leads/new",
    icon: PlusIcon,
    label: "Add lead",
    roles: ALL_ROLES,
    phase: 5,
    description: "Capture a new lead and check it is not already being worked.",
  },
  followUps: {
    key: "followUps",
    href: "/follow-ups",
    icon: BellRingIcon,
    label: "Follow-ups",
    roles: ALL_ROLES,
    phase: 6,
    description: "Overdue, today's and upcoming follow-ups.",
    badge: "overdueFollowUps",
  },
  team: {
    key: "team",
    href: "/team",
    icon: UsersRoundIcon,
    label: "Team",
    roles: ["admin"],
    phase: 7,
    description: "Agent performance, leaderboard and workload.",
  },
  reports: {
    key: "reports",
    href: "/reports",
    icon: BarChart3Icon,
    label: "Reports",
    roles: ["admin"],
    phase: 8,
    description: "Monthly performance reports and exports.",
  },
  settings: {
    key: "settings",
    href: "/settings",
    icon: SettingsIcon,
    label: "Settings",
    roles: ALL_ROLES,
    phase: 10,
    description: "Your profile and preferences.",
  },
};

export interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: { label: string; keys: NavKey[] }[] = [
  { label: "Workspace", keys: ["dashboard", "leads", "directory", "followUps"] },
  { label: "Admin", keys: ["team", "reports"] },
];

export function canSeeNavItem(item: NavItem, role: Role): boolean {
  return item.roles.includes(role);
}

/** Sidebar sections for a role, dropping empty sections. */
export function getNavSections(role: Role): NavSection[] {
  return SECTIONS.map((s) => ({
    label: s.label,
    items: s.keys.map((k) => NAV_ITEMS[k]).filter((item) => canSeeNavItem(item, role)),
  })).filter((s) => s.items.length > 0);
}

export function getNavLabel(item: NavItem, role: Role): string {
  return typeof item.label === "string" ? item.label : item.label[role];
}

/** Page title for a nav item; role only matters for items with per-role labels. */
export function getNavTitle(key: NavKey, role: Role = "sales_agent"): string {
  return getNavLabel(NAV_ITEMS[key], role);
}

/** The item whose href is the longest prefix of the path ("/leads/directory" beats "/leads"). */
export function findNavItem(pathname: string): NavItem | undefined {
  return Object.values(NAV_ITEMS)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export interface Breadcrumb {
  label: string;
  href: string;
}

/**
 * Crumbs for every nav item that prefixes the path, e.g. Leads › Lead directory.
 * A deeper path with no nav item of its own (a record page such as /leads/L-1001)
 * gets a generic final "Details" crumb.
 */
export function getBreadcrumbs(pathname: string, role: Role): Breadcrumb[] {
  const crumbs = Object.values(NAV_ITEMS)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => a.href.length - b.href.length)
    .map((item) => ({ label: getNavLabel(item, role), href: item.href }));
  const deepest = crumbs[crumbs.length - 1];
  if (deepest && deepest.href !== pathname) {
    const editing = pathname.endsWith("/edit");
    const recordPath = editing ? pathname.slice(0, -"/edit".length) : pathname;
    crumbs.push({ label: "Details", href: recordPath });
    if (editing) crumbs.push({ label: "Edit", href: pathname });
  }
  return crumbs;
}
