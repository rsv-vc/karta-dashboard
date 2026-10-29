import type {
  ActivityEntry,
  ActivityType,
  CompanySize,
  Lead,
  LeadPriority,
  LeadSource,
  LeadStage,
  StageHistoryEntry,
} from "@/types/lead";
import {
  CITIES,
  INDUSTRIES,
  STAGE_LABELS,
  isActiveStage,
  type Industry,
} from "@/lib/constants";
import { fromDayNumber, toDateKey, toDayNumber, toIstIso } from "@/lib/dates";
import { calculateDeal } from "@/lib/deal-calculator";
import { createRng } from "@/lib/random";
import { DEMO_USER_IDS as U } from "@/data/mock-users";

// Deterministic mock lead generator. Every random choice comes from one seeded
// PRNG, so the 75 leads are identical on every reload and on server and client.

/** The generator's own frozen "today": the demo data never shifts with the real date. */
export const SEED_TODAY = "2026-10-28";

const rng = createRng(20261028);
const TODAY_DAY = toDayNumber(SEED_TODAY);
const LEAD_COUNT = 75;

// ---------------------------------------------------------------------------
// Distribution targets
// ---------------------------------------------------------------------------

/** Leads created per month: gentle growth from May to October. */
const MONTH_PLAN = [
  { month: "2026-05", count: 8, lastDay: 31 },
  { month: "2026-06", count: 10, lastDay: 30 },
  { month: "2026-07", count: 12, lastDay: 31 },
  { month: "2026-08", count: 13, lastDay: 31 },
  { month: "2026-09", count: 15, lastDay: 30 },
  // October stops two days before TODAY so every lead has had a little activity.
  { month: "2026-10", count: 17, lastDay: 26 },
];

/** Priya is the top performer, Karan the weaker agent. Sums to 75. */
const OWNER_COUNTS: Record<string, number> = {
  [U.priya]: 26,
  [U.rohan]: 19,
  [U.ananya]: 19,
  [U.karan]: 11,
};

/** Multiplies a lead's chance of progressing far down the pipeline. */
const OWNER_SKILL: Record<string, number> = {
  [U.priya]: 1.35,
  [U.rohan]: 1,
  [U.ananya]: 1,
  [U.karan]: 0.75,
};

/** Relative chance that one of the owner's leads is lost. */
const OWNER_LOSS_WEIGHT: Record<string, number> = {
  [U.priya]: 0.4,
  [U.rohan]: 1,
  [U.ananya]: 1,
  [U.karan]: 2.5,
};

/** Exact stage counts (~15/20/18/14/10/13/10 %). Sums to 75. */
const LOST_COUNT = 7;
const ACTIVE_AND_WON_PLAN: { stage: LeadStage; count: number }[] = [
  { stage: "won", count: 10 },
  { stage: "poc_ongoing", count: 8 },
  { stage: "poc_pitched", count: 10 },
  { stage: "follow_up", count: 14 },
  { stage: "discovery_done", count: 15 },
  { stage: "not_met", count: 11 },
];

/** The main-path stages the fictional data moves through (skipping steps is allowed). */
const DEMO_PATH: LeadStage[] = ["not_met", "discovery_done", "follow_up", "poc_pitched", "poc_ongoing", "won"];

const MIN_STAGE_GAP = 3;
const MAX_STAGE_GAP = 25;

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

// One prefix per company keeps every normalized company name unique, so the
// Zenith pair is the only intentional duplicate.
const COMPANY_PREFIXES = [
  "Nimbus", "Vistara", "Kaveri", "Sahyadri", "Indus", "Tejas", "Prakash", "Shakti",
  "Vayu", "Agni", "Orbit", "Lotus", "Saffron", "Monsoon", "Peacock", "Himalaya",
  "Deccan", "Coromandel", "Malabar", "Narmada", "Kalpa", "Akshar", "Navya", "Pragati",
  "Samarth", "Unnati", "Vriddhi", "Jivan", "Arogya", "Vidya", "Gyan", "Kriya",
  "Sutra", "Rangoli", "Tara", "Surya", "Chandra", "Mitra", "Neev", "Setu",
  "Dhruv", "Ekam", "Anant", "Ojas", "Prana", "Sparsh", "Quantix", "Bluepeak",
  "Crestline", "Silverline", "Brightpath", "Greenfield", "Ironclad", "Keystone", "Lighthouse", "Meridian",
  "Pinnacle", "Redwood", "Skybridge", "Trident", "Uptrend", "Vantage", "Wavelength", "Yugantar",
  "Aravali", "Bodhi", "Chakra", "Dakshin", "Ganges", "Hamsa", "Kesari", "Mayur",
  "Nilgiri", "Pavan", "Sagar", "Triveni",
];

const INDUSTRY_WORDS: Record<Industry, string[]> = {
  NBFC: ["Finance", "Capital", "Credit", "Finvest"],
  Fintech: ["Payments", "Fintech", "Pay", "Money"],
  "Housing finance": ["Home Finance", "Housing Finance", "Homes Credit", "Home Loans"],
  Bank: ["Bank", "Small Finance Bank", "Co-operative Bank", "Payments Bank"],
  Insurance: ["Insurance", "General Insurance", "Life", "Assurance"],
  "Wealth & AMC": ["Wealth", "Asset Management", "Securities", "Investments"],
  Healthcare: ["Healthcare", "Hospitals", "Diagnostics", "Health"],
  Other: ["Motors", "Retail", "Logistics", "Technologies"],
};

const LEGAL_SUFFIXES = [" Pvt Ltd", " Ltd", " LLP", ""];
const LEGAL_SUFFIX_WEIGHTS = [6, 1, 1, 2];

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan",
  "Rahul", "Vikram", "Siddharth", "Nikhil", "Amit", "Suresh", "Rajesh", "Manish",
  "Ananya", "Diya", "Kavya", "Meera", "Neha", "Pooja", "Riya", "Sneha",
  "Divya", "Lakshmi", "Shreya", "Tanvi", "Nandini", "Aishwarya", "Deepa", "Harini",
];

const LAST_NAMES = [
  "Agarwal", "Bhat", "Chopra", "Desai", "Gupta", "Joshi", "Kapoor", "Kulkarni",
  "Malhotra", "Menon", "Nair", "Patel", "Rao", "Reddy", "Saxena", "Shetty",
  "Sinha", "Srinivasan", "Verma", "Banerjee", "Chatterjee", "Pillai", "Mishra", "Jain",
];

const SMALL_COMPANY_TITLES = ["Founder", "Co-founder", "CTO", "CEO", "Operations Manager"];
const LARGE_COMPANY_TITLES = [
  "Head of Procurement", "VP Sales", "CFO", "CTO", "Operations Manager",
  "Head of IT", "Director of Operations", "VP Engineering",
];

const COMPANY_SIZES: CompanySize[] = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const COMPANY_SIZE_WEIGHTS = [1.5, 3, 3, 2, 1.2];

/** Deal value range in rupees per company size. Bigger companies, bigger deals. */
const DEAL_RANGE: Record<CompanySize, [number, number]> = {
  "1-10": [200_000, 600_000],
  "11-50": [400_000, 1_200_000],
  "51-200": [800_000, 2_500_000],
  "201-1000": [1_500_000, 4_500_000],
  "1000+": [3_000_000, 7_500_000],
};

const SOURCES: LeadSource[] = ["linkedin", "referral", "cold_email", "cold_call", "website", "event", "partner"];
const SOURCE_WEIGHTS = [3, 2, 2, 1.5, 2, 1, 1];

const NOTE_SENTENCES = [
  "Evaluating two other vendors in parallel.",
  "Budget approval expected next quarter.",
  "Strong interest after seeing the case study.",
  "Needs integration with their existing ERP.",
  "Prefers WhatsApp for quick updates.",
  "Decision will be made by the leadership team.",
  "Looking to roll out across multiple cities.",
  "Price sensitive; emphasise ROI in follow-ups.",
  "Current contract with incumbent ends in December.",
  "Asked for a pilot before committing.",
];

const ACTIVITY_TEMPLATES: Record<Exclude<ActivityType, "stage_change">, string[]> = {
  call: [
    "Intro call with {poc}",
    "Discovery call to understand requirements",
    "Follow-up call on pricing questions",
    "Call with {poc} to discuss timelines",
    "Left a voicemail; will try again",
  ],
  email: [
    "Sent intro email with company deck",
    "Shared case studies relevant to {industry}",
    "Followed up on the previous email",
    "Shared pricing sheet and FAQs",
    "Sent recap of last discussion",
  ],
  meeting: [
    "Product demo with {poc} and team",
    "On-site meeting at the {city} office",
    "Requirements workshop with stakeholders",
    "Commercial discussion with procurement",
  ],
  note: [
    "{poc} prefers calls after 4 pm",
    "Competing with an incumbent vendor",
    "Decision maker is the {designation}",
    "Asked for a reference customer in {industry}",
  ],
};

const OTHER_ACTIVITY_TYPES: Exclude<ActivityType, "stage_change">[] = ["call", "email", "meeting", "note"];
const OTHER_ACTIVITY_WEIGHTS = [3, 3, 2, 2];

// ---------------------------------------------------------------------------
// Step 1: skeletons (created date + owner)
// ---------------------------------------------------------------------------

interface Skeleton {
  index: number;
  createdDay: number;
  createdAt: string;
  ownerId: string;
  /** Set for the two intentional near-duplicates. */
  forcedCompanyName?: string;
}

/** Positions (by creation order) and owners of the Zenith near-duplicate pair. */
const ZENITH_SLOTS = [
  { index: 30, ownerId: U.rohan, name: "Zenith Retail" },
  { index: 66, ownerId: U.ananya, name: "Zenith Retail Pvt Ltd" },
];

function buildSkeletons(): Skeleton[] {
  const days: number[] = [];
  for (const { month, count, lastDay } of MONTH_PLAN) {
    for (let i = 0; i < count; i++) {
      days.push(toDayNumber(`${month}-${String(rng.int(1, lastDay)).padStart(2, "0")}`));
    }
  }
  days.sort((a, b) => a - b);

  // Owner pool with exact counts, minus the owners reserved for the Zenith slots.
  const pool: string[] = [];
  for (const [ownerId, count] of Object.entries(OWNER_COUNTS)) {
    const reserved = ZENITH_SLOTS.filter((z) => z.ownerId === ownerId).length;
    for (let i = 0; i < count - reserved; i++) pool.push(ownerId);
  }
  const owners = rng.shuffle(pool);

  return days.map((day, index) => {
    const zenith = ZENITH_SLOTS.find((z) => z.index === index);
    return {
      index,
      createdDay: day,
      // Created in the 9 o'clock hour; all later activity on that day is 10:00+.
      createdAt: toIstIso(fromDayNumber(day), 9, rng.int(0, 59)),
      ownerId: zenith ? zenith.ownerId : owners.pop()!,
      forcedCompanyName: zenith?.name,
    };
  });
}

// ---------------------------------------------------------------------------
// Step 2: stage assignment that is feasible for each lead's age
// ---------------------------------------------------------------------------

interface StagePlan {
  /** Stages visited in order, ending with the current stage. */
  path: LeadStage[];
}

function ageOf(s: Skeleton): number {
  return TODAY_DAY - s.createdDay;
}

/** Weighted sampling without replacement. */
function sampleWithoutReplacement<T>(items: T[], weightOf: (item: T) => number, count: number): T[] {
  const remaining = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && remaining.length > 0) {
    const picked = rng.weightedPick(remaining, remaining.map(weightOf));
    chosen.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return chosen;
}

function assignStages(skeletons: Skeleton[]): Map<number, StagePlan> {
  const plans = new Map<number, StagePlan>();

  // Lost leads: biased to weaker owners and older leads. They can drop out of any
  // active stage the lead is old enough to have reached.
  const lostCandidates = skeletons.filter((s) => ageOf(s) >= 10);
  const lost = sampleWithoutReplacement(
    lostCandidates,
    (s) => OWNER_LOSS_WEIGHT[s.ownerId] * Math.min(ageOf(s), 90),
    LOST_COUNT,
  );
  const dropOutWeights = [1, 3, 3, 2, 1]; // not_met..poc_ongoing
  for (const s of lost) {
    const feasible = [0, 1, 2, 3, 4].filter((k) => MIN_STAGE_GAP * (k + 1) <= ageOf(s));
    const k = rng.weightedPick(feasible, feasible.map((i) => dropOutWeights[i]));
    plans.set(s.index, { path: [...DEMO_PATH.slice(0, k + 1), "lost"] });
  }

  // Everyone else: rank by age, owner skill and some jitter, then hand out the
  // most advanced stages first. October leads end up mostly not met / discovery done.
  const ranked = skeletons
    .filter((s) => !plans.has(s.index))
    .map((s) => ({ s, score: ageOf(s) * (0.55 + 0.9 * rng.rand()) * OWNER_SKILL[s.ownerId] }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.s);

  let cursor = 0;
  for (const { stage, count } of ACTIVE_AND_WON_PLAN) {
    for (let i = 0; i < count && cursor < ranked.length; i++, cursor++) {
      const s = ranked[cursor];
      // Safety net: never place a lead further than its age allows.
      let k = DEMO_PATH.indexOf(stage);
      while (MIN_STAGE_GAP * k > ageOf(s)) k--;
      plans.set(s.index, { path: DEMO_PATH.slice(0, k + 1) });
    }
  }
  return plans;
}

// ---------------------------------------------------------------------------
// Step 3: stage history with realistic gaps that never pass TODAY
// ---------------------------------------------------------------------------

/** Day number on which each stage in the path starts. */
function planTransitionDays(createdDay: number, transitions: number): number[] {
  const available = TODAY_DAY - createdDay;
  let gaps = Array.from({ length: transitions }, () => rng.int(MIN_STAGE_GAP, MAX_STAGE_GAP));
  const total = gaps.reduce((a, b) => a + b, 0);

  // Too slow for the lead's age: shrink the slack above the minimum gap proportionally.
  if (total > available) {
    const slack = available - MIN_STAGE_GAP * transitions;
    const used = total - MIN_STAGE_GAP * transitions;
    gaps = gaps.map((g) => MIN_STAGE_GAP + Math.floor(((g - MIN_STAGE_GAP) * slack) / used));
  }

  const days = [createdDay];
  for (const gap of gaps) days.push(days[days.length - 1] + gap);
  return days;
}

function randomWorkTime(dateKey: string): string {
  return toIstIso(dateKey, rng.int(10, 18), rng.int(0, 59));
}

function buildStageHistory(createdAt: string, createdDay: number, path: LeadStage[]): StageHistoryEntry[] {
  const days = planTransitionDays(createdDay, path.length - 1);
  const starts = days.map((day, i) => (i === 0 ? createdAt : randomWorkTime(fromDayNumber(day))));
  return path.map((stage, i) => ({
    stage,
    startDate: starts[i],
    endDate: i < path.length - 1 ? starts[i + 1] : null,
  }));
}

// ---------------------------------------------------------------------------
// Step 4: identity (company, POC, deal)
// ---------------------------------------------------------------------------

interface Identity {
  companyName: string;
  pocName: string;
  pocDesignation: string;
  pocEmail: string;
  pocPhone: string;
  pocLinkedIn?: string;
  industry: Industry;
  companySize: CompanySize;
  city: string;
  source: LeadSource;
  priority: LeadPriority;
  dealValue: number;
  notes: string;
}

function phoneNumber(): string {
  const first = `${rng.pick(["9", "8", "7", "6"])}${rng.int(1000, 9999)}`;
  return `+91 ${first} ${rng.int(10000, 99999)}`;
}

function priorityFor(dealValue: number): LeadPriority {
  const weights = dealValue >= 3_000_000 ? [1, 3, 5] : dealValue >= 1_000_000 ? [2, 5, 2] : [5, 3, 1];
  return rng.weightedPick<LeadPriority>(["low", "medium", "high"], weights);
}

function buildIdentity(prefix: string, forcedName: string | undefined): Identity {
  const industry: Industry = forcedName ? "Other" : rng.pick(INDUSTRIES);
  const industryWord = forcedName ? "Retail" : rng.pick(INDUSTRY_WORDS[industry]);
  const brand = forcedName ? "Zenith" : prefix;
  const companyName =
    forcedName ?? `${brand} ${industryWord}${rng.weightedPick(LEGAL_SUFFIXES, LEGAL_SUFFIX_WEIGHTS)}`;
  const domain = `${brand}${industryWord}`.toLowerCase().replace(/[^a-z]/g, "") + rng.pick([".in", ".com", ".co.in"]);

  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_NAMES);
  const companySize = rng.weightedPick(COMPANY_SIZES, COMPANY_SIZE_WEIGHTS);
  const isSmall = companySize === "1-10" || companySize === "11-50";
  const [min, max] = DEAL_RANGE[companySize];
  const dealValue = Math.round(rng.int(min, max) / 10_000) * 10_000;
  const noteCount = rng.int(1, 2);

  return {
    companyName,
    pocName: `${first} ${last}`,
    pocDesignation: rng.pick(isSmall ? SMALL_COMPANY_TITLES : LARGE_COMPANY_TITLES),
    pocEmail: `${first.toLowerCase()}@${domain}`,
    pocPhone: phoneNumber(),
    pocLinkedIn: rng.chance(0.7)
      ? `https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${rng.int(100, 999)}`
      : undefined,
    industry,
    companySize,
    city: rng.pick(CITIES),
    source: rng.weightedPick(SOURCES, SOURCE_WEIGHTS),
    priority: priorityFor(dealValue),
    dealValue,
    notes: rng.shuffle(NOTE_SENTENCES).slice(0, noteCount).join(" "),
  };
}

// ---------------------------------------------------------------------------
// Step 5: activities, last contact and follow-up
// ---------------------------------------------------------------------------

function fillTemplate(template: string, identity: Identity): string {
  return template
    .replace("{poc}", identity.pocName)
    .replace("{industry}", identity.industry)
    .replace("{city}", identity.city)
    .replace("{designation}", identity.pocDesignation);
}

function buildActivities(
  leadId: string,
  ownerId: string,
  history: StageHistoryEntry[],
  createdDay: number,
  endDay: number,
  identity: Identity,
): ActivityEntry[] {
  type Draft = Omit<ActivityEntry, "id">;
  const drafts: Draft[] = [];

  // One stage_change per transition, on the transition timestamp.
  for (let i = 1; i < history.length; i++) {
    drafts.push({
      type: "stage_change",
      description: `Moved from ${STAGE_LABELS[history[i - 1].stage]} to ${STAGE_LABELS[history[i].stage]}`,
      date: history[i].startDate,
      byUserId: ownerId,
    });
  }

  // Top up with calls, emails, meetings and notes: 2-8 activities in total.
  const transitions = history.length - 1;
  const extras = Math.max(2 - transitions, rng.int(1, 3));
  for (let i = 0; i < extras; i++) {
    const type = rng.weightedPick(OTHER_ACTIVITY_TYPES, OTHER_ACTIVITY_WEIGHTS);
    drafts.push({
      type,
      description: fillTemplate(rng.pick(ACTIVITY_TEMPLATES[type]), identity),
      date: randomWorkTime(fromDayNumber(rng.int(createdDay, endDay))),
      byUserId: ownerId,
    });
  }

  // All timestamps share the same IST format, so string order is time order.
  return drafts
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d, i) => ({ ...d, id: `${leadId}-a${i + 1}` }));
}

/** Latest real touchpoint (call, email or meeting). Notes and stage changes are not contact. */
function lastContactOf(activities: ActivityEntry[]): string | null {
  const contacts = activities.filter((a) => a.type === "call" || a.type === "email" || a.type === "meeting");
  return contacts.length ? contacts[contacts.length - 1].date : null;
}

/** ~25% overdue, ~10% due today, ~65% upcoming. */
function nextFollowUp(createdDay: number): string {
  const roll = rng.rand();
  let day: number;
  if (roll < 0.25) day = Math.max(createdDay, TODAY_DAY - rng.int(1, 10));
  else if (roll < 0.35) day = TODAY_DAY;
  else day = TODAY_DAY + rng.int(1, 14);
  return toIstIso(fromDayNumber(day), rng.int(10, 17), rng.pick([0, 30]));
}

// ---------------------------------------------------------------------------
// Sales MIS fields
// ---------------------------------------------------------------------------

/** Separate stream: adding these fields must not change any earlier draw. */
const misRng = createRng(20261029);

/** The three MIS channels, mapped from the generator's legacy sources. */
const CHANNEL: Record<LeadSource, LeadSource> = {
  partner: "pipeloom",
  referral: "pipeloom",
  website: "pipeloom",
  cold_call: "voice_bot",
  event: "voice_bot",
  linkedin: "head_of_growth",
  cold_email: "head_of_growth",
  pipeloom: "pipeloom",
  voice_bot: "voice_bot",
  head_of_growth: "head_of_growth",
  unknown: "pipeloom",
};

const NEXT_STEPS = [
  "Follow-up meeting with IT",
  "Share pricing and ROI calculator",
  "Callback to confirm the trial",
  "Demo with the business sponsor",
  "Send the case study deck",
  "Set POC success criteria",
];

function misFields(stage: LeadStage, history: StageHistoryEntry[]) {
  const advanced = DEMO_PATH.indexOf(stage) >= DEMO_PATH.indexOf("follow_up");
  const first = history.find((e) => e.stage !== "not_met" && e.stage !== "lost");
  const discoveryDate = first ? toDateKey(first.startDate) : null;
  return {
    // Calls a month entered for most accounts; the rest use their segment's average.
    // (Deal values stay the generator's fictional ₹ figures so report numbers are stable.)
    callsPerMonth: misRng.rand() < 0.8 ? misRng.int(5, 80) * 1000 : null,
    minutesPerCall: null,
    pricePerMinute: null,
    contractMonths: null,
    responsiveness: stage === "lost" ? 0 : misRng.pick(advanced ? [5, 7, 10] : [0, 3, 5]),
    decisionAccess: misRng.pick(advanced ? [7, 10] : [1, 4, 7]),
    timingBudget: stage === "lost" ? 0 : misRng.pick(advanced ? [3, 5] : [0, 3]),
    discoveryDate,
    discoveryMonth: discoveryDate?.slice(0, 7) ?? null,
    nextStep: isActiveStage(stage) ? misRng.pick(NEXT_STEPS) : "",
    sourceStatus: null,
  };
}

/** Volume (minutes a month) from the calculator, like the app stores it. */
function withVolume<T extends { callsPerMonth: number | null }>(segment: string, fields: T) {
  const deal = calculateDeal({ segment, callsPerMonth: fields.callsPerMonth, minutesPerCall: null, pricePerMinute: null, contractMonths: null });
  return { ...fields, volume: deal.volume };
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

function generateLeads(): Lead[] {
  const skeletons = buildSkeletons();
  const plans = assignStages(skeletons);
  const prefixes = rng.shuffle(COMPANY_PREFIXES);

  return skeletons.map((s) => {
    const id = `L-${1001 + s.index}`;
    const { path } = plans.get(s.index)!;
    const stage = path[path.length - 1];
    const identity = buildIdentity(prefixes[s.index], s.forcedCompanyName);
    const stageHistory = buildStageHistory(s.createdAt, s.createdDay, path);
    const active = isActiveStage(stage);
    const closedAt = active ? null : stageHistory[stageHistory.length - 1].startDate;
    const endDay = closedAt ? toDayNumber(toDateKey(closedAt)) : TODAY_DAY;
    const activities = buildActivities(id, s.ownerId, stageHistory, s.createdDay, endDay, identity);

    return {
      id,
      companyName: identity.companyName,
      pocName: identity.pocName,
      pocDesignation: identity.pocDesignation,
      pocEmail: identity.pocEmail,
      pocPhone: identity.pocPhone,
      pocLinkedIn: identity.pocLinkedIn,
      industry: identity.industry,
      companySize: identity.companySize,
      city: identity.city,
      source: CHANNEL[identity.source],
      stage,
      priority: identity.priority,
      dealValue: identity.dealValue,
      currency: "INR",
      ownerId: s.ownerId,
      createdAt: s.createdAt,
      lastContactedAt: lastContactOf(activities),
      nextFollowUpAt: active ? nextFollowUp(s.createdDay) : null,
      closedAt,
      notes: identity.notes,
      ...withVolume(identity.industry, misFields(stage, stageHistory)),
      stageHistory,
      activities,
    };
  });
}

export const mockLeads: Lead[] = generateLeads();

if (mockLeads.length !== LEAD_COUNT) {
  throw new Error(`Expected ${LEAD_COUNT} mock leads, generated ${mockLeads.length}`);
}
