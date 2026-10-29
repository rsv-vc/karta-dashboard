import { MIS_SOURCES, PIPELINE_ORDER, SOURCE_LABELS, STAGES, STAGE_LABELS, TODAY, isActiveStage } from "@/lib/constants";
import { toDateKey } from "@/lib/dates";
import { BANDS, STAGE_POINTS, leadBand, leadScore, type Band } from "@/lib/scoring";
import type { Lead, LeadSource, LeadStage } from "@/types/lead";

// The sales MIS home page (the workbook's Pipeline Overview and Monthly Funnel
// tabs), computed from accounts. Pure: takes accounts and "today", no I/O.
// Like the workbook, funnel counts use each account's CURRENT stage, so an
// account that later deferred or was lost counts only as "discovery held".

export interface FunnelStepRow {
  label: string;
  count: number;
  /** Share of discoveries held; null when there are none. */
  ofDiscoveries: number | null;
}

export interface BandRow {
  band: Band;
  label: string;
  range: string;
  total: number;
  share: number | null;
  bySource: Record<string, number>;
}

export interface StageRow {
  stage: LeadStage;
  label: string;
  count: number;
  avgScore: number | null;
}

export interface SegmentRow {
  segment: string;
  count: number;
  hotWarm: number;
}

export interface MonthRow {
  /** "YYYY-MM" */
  month: string;
  discoveriesBySource: Record<string, number>;
  discoveries: number;
  noShows: number;
  /** held / (held + no-shows); null when nothing was booked. */
  showRate: number | null;
  followUpPlus: number;
  technicalPlus: number;
  pocPlus: number;
  /** technicalPlus / discoveries */
  technicalShare: number | null;
  deferredOrLost: number;
}

export interface NextStepRow {
  id: string;
  companyName: string;
  nextStep: string;
  date: string;
  band: Band;
  overdue: boolean;
}

export interface MisOverview {
  tracked: number;
  discoveriesHeld: number;
  notMetYet: number;
  hotWarm: number;
  won: number;
  avgScore: number | null;
  /** Calculated deal value and volume (minutes a month) of open accounts. */
  openDealValue: number;
  openVolume: number;
  funnel: FunnelStepRow[];
  bands: BandRow[];
  bandTotalsBySource: Record<string, number>;
  sources: { value: LeadSource; label: string }[];
  stages: StageRow[];
  segments: SegmentRow[];
  months: MonthRow[];
  nextSteps: NextStepRow[];
}

const at = (stage: LeadStage) => PIPELINE_ORDER.indexOf(stage);
/** Current stage is `min` or later on the main path (exits are not "beyond"). */
const atLeast = (lead: Lead, min: LeadStage) => at(lead.stage) >= at(min);

/** The first discovery meeting was held (the workbook's "Discovery held: Done"). */
export function discoveryHeld(lead: Lead): boolean {
  return lead.discoveryDate !== null || (at(lead.stage) >= at("discovery_done"));
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** `points` and `labels` come from the Stages master (defaults: the seeded values). */
export function computeMisOverview(
  leads: Lead[],
  {
    today = TODAY,
    points = STAGE_POINTS,
    labels = STAGE_LABELS,
  }: { today?: string; points?: Record<LeadStage, number>; labels?: Record<LeadStage, string> } = {},
): MisOverview {
  const held = leads.filter(discoveryHeld);
  const scored = leads.map((l) => ({ lead: l, score: leadScore(l, points), band: leadBand(l, points) }));

  const funnelSteps: [string, (l: Lead) => boolean][] = [
    ["Discovery held", discoveryHeld],
    ["Follow-up / deep dive or beyond", (l) => atLeast(l, "follow_up")],
    ["Bot / technical round or beyond", (l) => atLeast(l, "technical_round")],
    ["POC pitched or beyond", (l) => atLeast(l, "poc_pitched")],
    ["POC ongoing or won", (l) => atLeast(l, "poc_ongoing")],
    ["Won (paid)", (l) => l.stage === "won"],
  ];
  const funnel = funnelSteps.map(([label, test]) => {
    const count = leads.filter(test).length;
    return { label, count, ofDiscoveries: share(count, held.length) };
  });

  // Sources that actually appear, MIS channels first.
  const present = new Set(leads.map((l) => l.source));
  const sources = [...MIS_SOURCES, ...[...present].filter((s) => !MIS_SOURCES.includes(s))]
    .filter((s) => present.has(s))
    .map((value) => ({ value, label: SOURCE_LABELS[value] }));

  const bands = BANDS.map((b, i): BandRow => {
    const inBand = scored.filter((s) => s.band === b.value);
    const upper = i > 0 ? BANDS[i - 1].min - 1 : null;
    return {
      band: b.value,
      label: b.label,
      range: upper === null ? `${b.min}+` : b.min === 0 ? `below ${upper + 1}` : `${b.min}–${upper}`,
      total: inBand.length,
      share: share(inBand.length, leads.length),
      bySource: Object.fromEntries(sources.map((s) => [s.value, inBand.filter((x) => x.lead.source === s.value).length])),
    };
  });
  const bandTotalsBySource = Object.fromEntries(sources.map((s) => [s.value, leads.filter((l) => l.source === s.value).length]));

  const stages = STAGES.map((s): StageRow => {
    const inStage = scored.filter((x) => x.lead.stage === s.value);
    return { stage: s.value, label: labels[s.value], count: inStage.length, avgScore: average(inStage.map((x) => x.score)) };
  });

  const segmentNames = [...new Set(leads.map((l) => l.industry).filter(Boolean))];
  const segments = segmentNames
    .map((segment): SegmentRow => {
      const inSegment = scored.filter((x) => x.lead.industry === segment);
      return {
        segment,
        count: inSegment.length,
        hotWarm: inSegment.filter((x) => x.band === "hot" || x.band === "warm").length,
      };
    })
    .sort((a, b) => b.count - a.count || a.segment.localeCompare(b.segment));

  // Month on month, grouped by discovery month (accounts without one are not in a cohort).
  const monthKeys = [...new Set(leads.map((l) => l.discoveryMonth).filter((m): m is string => m !== null))].sort();
  const months = monthKeys.map((month): MonthRow => {
    const cohort = leads.filter((l) => l.discoveryMonth === month);
    const cohortHeld = cohort.filter(discoveryHeld);
    const noShows = cohort.filter((l) => l.stage === "no_show").length;
    const technicalPlus = cohort.filter((l) => atLeast(l, "technical_round")).length;
    return {
      month,
      discoveriesBySource: Object.fromEntries(sources.map((s) => [s.value, cohortHeld.filter((l) => l.source === s.value).length])),
      discoveries: cohortHeld.length,
      noShows,
      showRate: share(cohortHeld.length, cohortHeld.length + noShows),
      followUpPlus: cohort.filter((l) => atLeast(l, "follow_up")).length,
      technicalPlus,
      pocPlus: cohort.filter((l) => atLeast(l, "poc_pitched")).length,
      technicalShare: share(technicalPlus, cohortHeld.length),
      deferredOrLost: cohort.filter((l) => l.stage === "deferred" || l.stage === "lost").length,
    };
  });

  const nextSteps = scored
    .filter((x) => isActiveStage(x.lead.stage) && x.lead.nextFollowUpAt)
    .map(({ lead, band }) => {
      const date = toDateKey(lead.nextFollowUpAt!);
      return { id: lead.id, companyName: lead.companyName, nextStep: lead.nextStep, date, band, overdue: date < today };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.companyName.localeCompare(b.companyName));

  return {
    tracked: leads.length,
    discoveriesHeld: held.length,
    notMetYet: leads.filter((l) => l.stage === "not_met").length,
    hotWarm: scored.filter((x) => x.band === "hot" || x.band === "warm").length,
    won: leads.filter((l) => l.stage === "won").length,
    avgScore: average(scored.map((x) => x.score)),
    openDealValue: leads.filter((l) => isActiveStage(l.stage)).reduce((n, l) => n + l.dealValue, 0),
    openVolume: leads.filter((l) => isActiveStage(l.stage)).reduce((n, l) => n + (l.volume ?? 0), 0),
    funnel,
    bands,
    bandTotalsBySource,
    sources,
    stages,
    segments,
    months,
    nextSteps,
  };
}

/** Stage label lookup re-exported for the page. */
export { STAGE_LABELS };
