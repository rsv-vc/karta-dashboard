import { PRIORITIES, SOURCES, STAGES, TODAY, isActiveStage } from "@/lib/constants";
import { toDateKey } from "@/lib/dates";
import { normalizeCompanyName } from "@/lib/selectors";
import type { Lead, LeadPriority, LeadSource, LeadStage } from "@/types/lead";

// Pure filter logic for the lead list and directory. Filters live in the URL,
// so they parse from and serialize to search params. No React, no server APIs.

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "none";
export type StatusFilter = "all" | "active" | "closed";

export const FOLLOW_UP_BUCKETS: readonly FollowUpBucket[] = ["overdue", "today", "upcoming", "none"];
export const FOLLOW_UP_LABELS: Record<FollowUpBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
  none: "No follow-up",
};
const STATUSES: readonly StatusFilter[] = ["all", "active", "closed"];

export interface LeadFilters {
  q: string;
  stages: LeadStage[];
  priorities: LeadPriority[];
  sources: LeadSource[];
  owners: string[];
  followUp: FollowUpBucket[];
  status: StatusFilter;
}

export const DEFAULT_FILTERS: LeadFilters = {
  q: "",
  stages: [],
  priorities: [],
  sources: [],
  owners: [],
  followUp: [],
  status: "all",
};

/** The subset of row fields filtering needs; LeadRow and DirectoryRow both satisfy the core of it. */
export type FilterableRow = Pick<Lead, "companyName" | "pocName" | "stage" | "ownerId"> &
  Partial<Pick<Lead, "city" | "priority" | "source" | "nextFollowUpAt">>;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

const STAGE_VALUES = STAGES.map((s) => s.value);

function readParam(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** "a,b,zzz" -> the known values only, in the allowed order. */
function readList<T extends string>(params: ParamSource, key: string, allowed: readonly T[]): T[] {
  const raw = readParam(params, key);
  if (!raw) return [];
  const picked = new Set(raw.split(","));
  return allowed.filter((v) => picked.has(v));
}

/** Owner ids are not a fixed enum, so keep any non-empty, deduplicated id. */
function readIds(params: ParamSource, key: string): string[] {
  const raw = readParam(params, key);
  return raw ? [...new Set(raw.split(",").filter(Boolean))] : [];
}

export function parseLeadFilters(params: ParamSource): LeadFilters {
  const status = readParam(params, "status");
  return {
    q: (readParam(params, "q") ?? "").trim(),
    stages: readList(params, "stage", STAGE_VALUES),
    priorities: readList(params, "priority", PRIORITIES),
    sources: readList(params, "source", SOURCES),
    owners: readIds(params, "owner"),
    followUp: readList(params, "followUp", FOLLOW_UP_BUCKETS),
    status: STATUSES.includes(status as StatusFilter) ? (status as StatusFilter) : "all",
  };
}

/** Defaults are omitted, so an unfiltered list has a clean URL. */
export function serializeLeadFilters(filters: LeadFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.stages.length) params.set("stage", filters.stages.join(","));
  if (filters.priorities.length) params.set("priority", filters.priorities.join(","));
  if (filters.sources.length) params.set("source", filters.sources.join(","));
  if (filters.owners.length) params.set("owner", filters.owners.join(","));
  if (filters.followUp.length) params.set("followUp", filters.followUp.join(","));
  if (filters.status !== "all") params.set("status", filters.status);
  return params;
}

export function hasActiveFilters(filters: LeadFilters): boolean {
  return serializeLeadFilters(filters).size > 0;
}

export function followUpBucket(row: { nextFollowUpAt?: string | null }, today: string = TODAY): FollowUpBucket {
  if (!row.nextFollowUpAt) return "none";
  const day = toDateKey(row.nextFollowUpAt);
  if (day < today) return "overdue";
  return day === today ? "today" : "upcoming";
}

/** Case-insensitive match on company, POC and city; company also matches ignoring "Pvt Ltd" etc. */
export function matchesSearch(row: FilterableRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [row.companyName, row.pocName, row.city ?? ""].join(" ").toLowerCase();
  if (haystack.includes(needle)) return true;
  const normalizedNeedle = normalizeCompanyName(q);
  return normalizedNeedle.length > 0 && normalizeCompanyName(row.companyName).includes(normalizedNeedle);
}

type Facet = "stages" | "priorities" | "sources" | "owners" | "followUp" | "status" | "q";

/** True if the row passes every filter except `skip` (used for faceted counts). */
function passes(row: FilterableRow, f: LeadFilters, skip?: Facet): boolean {
  if (skip !== "q" && !matchesSearch(row, f.q)) return false;
  if (skip !== "stages" && f.stages.length && !f.stages.includes(row.stage)) return false;
  if (skip !== "priorities" && f.priorities.length && (!row.priority || !f.priorities.includes(row.priority))) {
    return false;
  }
  if (skip !== "sources" && f.sources.length && (!row.source || !f.sources.includes(row.source))) return false;
  if (skip !== "owners" && f.owners.length && !f.owners.includes(row.ownerId)) return false;
  if (skip !== "followUp" && f.followUp.length && !f.followUp.includes(followUpBucket(row))) return false;
  if (skip !== "status" && f.status !== "all") {
    const active = isActiveStage(row.stage);
    if ((f.status === "active") !== active) return false;
  }
  return true;
}

export function filterLeadRows<T extends FilterableRow>(rows: T[], filters: LeadFilters): T[] {
  return rows.filter((row) => passes(row, filters));
}

type FacetKey = "stages" | "priorities" | "sources" | "owners" | "followUp";

function facetValue(row: FilterableRow, facet: FacetKey): string | undefined {
  switch (facet) {
    case "stages":
      return row.stage;
    case "priorities":
      return row.priority;
    case "sources":
      return row.source;
    case "owners":
      return row.ownerId;
    case "followUp":
      return followUpBucket(row);
  }
}

/** Count per option of `facet`, with every OTHER filter applied. */
export function facetCounts(rows: FilterableRow[], filters: LeadFilters, facet: FacetKey): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!passes(row, filters, facet)) continue;
    const value = facetValue(row, facet);
    if (value !== undefined) counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
