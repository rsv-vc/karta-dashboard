// Imports the Karta sales MIS workbook (Accounts + Funnel Health tabs) into the
// live project. The workbook is read from your disk and never copied into the
// repository; nothing from it is committed.
//
//   npx tsx --env-file=.env.local scripts/import-mis.mts <workbook.xlsx> \
//     --pipeloom=<email> --voicebot=<email> --growth=<email> --default=<email> [--write]
//
// Owners are matched by the email of an existing team member: Pipeloom accounts,
// Voice Bot team accounts, Head of Growth accounts, and --default for rows with
// no owner (the Won customers). Without --write it is a dry run: it prints every
// decision and writes nothing. Writing needs SUPABASE_SECRET_KEY and an empty
// accounts table (run it once, after the demo data is gone).
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { INDUSTRIES } from "@/lib/constants";
import { toIstIso } from "@/lib/dates";
import { leadBand, leadScore } from "@/lib/scoring";
import type { Database } from "@/types/supabase";
import type { LeadSource, LeadStage } from "@/types/lead";

type ActionStatus = Database["public"]["Enums"]["action_status"];

// Arguments ------------------------------------------------------------------------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1]?.trim().toLowerCase();
const WRITE = args.includes("--write");
if (!file) {
  console.error("Usage: import-mis.mts <workbook.xlsx> --pipeloom=… --voicebot=… --growth=… --default=… [--write]");
  process.exit(1);
}
const ownerEmails = { pipeloom: flag("pipeloom"), voicebot: flag("voicebot"), growth: flag("growth"), fallback: flag("default") };

// Helpers ----------------------------------------------------------------------------
type Cell = ExcelJS.CellValue;

/** Formula cells carry their cached result; rich text is flattened. */
function plain(v: Cell): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if ("result" in v) return plain(v.result as Cell);
  if ("richText" in v) return v.richText.map((r) => r.text).join("");
  if ("text" in v) return String(v.text);
  return null;
}
const text = (v: Cell) => {
  const p = plain(v);
  return p === null ? "" : p instanceof Date ? p.toISOString().slice(0, 10) : String(p).trim();
};
/** Excel dates are midnight UTC of the calendar day. */
const dateKey = (v: Cell): string | null => {
  const p = plain(v);
  return p instanceof Date ? p.toISOString().slice(0, 10) : null;
};
const int = (v: Cell): number | null => {
  const p = plain(v);
  if (typeof p === "number") return Math.round(p);
  if (typeof p === "string") {
    const digits = p.replace(/[^\d]/g, "");
    return digits ? Number(digits) : null;
  }
  return null;
};
const clamp = (n: number | null, max: number) => Math.max(0, Math.min(max, n ?? 0));
const normal = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const SOURCE: Record<string, LeadSource> = {
  pipeloom: "pipeloom",
  "voice bot campaign": "voice_bot",
  "head of growth": "head_of_growth",
};

/** The short Stage column, refined by the source tracker's raw status where it says more. */
function stageFor(stage: string, status: string, held: string): LeadStage {
  const s = stage.toLowerCase();
  const st = status.toLowerCase();
  if (s === "won") return "won";
  if (s === "lost") return "lost";
  if (s === "deferred") return "deferred";
  if (s === "no-show" || st.startsWith("no show") || held.toLowerCase() === "no-show") return "no_show";
  if (s === "poc") {
    if (st.startsWith("bot_test")) return "technical_round";
    if (st.startsWith("poc ongoing")) return "poc_ongoing";
    if (st.startsWith("poc approved")) return "poc_approved";
    return "poc_pitched";
  }
  if (s === "demo done" || s === "discovery done") return "discovery_done";
  if (s === "discovery") return held.toLowerCase() === "done" ? "discovery_done" : "not_met";
  return held.toLowerCase() === "done" ? "discovery_done" : "not_met";
}

const STATUS: Record<string, ActionStatus> = {
  open: "open",
  started: "started",
  scheduled: "scheduled",
  "pending approval": "pending_approval",
  "under review": "under_review",
  done: "done",
};

// Read the workbook ------------------------------------------------------------------
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sheet = wb.getWorksheet("Accounts");
const health = wb.getWorksheet("Funnel Health");
if (!sheet) throw new Error('No "Accounts" sheet');

let headerRow = 0;
sheet.eachRow((row, n) => {
  if (!headerRow && text(row.getCell(1).value) === "#") headerRow = n;
});
// row.values is sparse (index 0 is empty), so fill the holes before mapping.
const header = Array.from(sheet.getRow(headerRow).values as Cell[], (v) => text(v));
const col = (name: string) => {
  const i = header.findIndex((h) => h.toLowerCase().startsWith(name.toLowerCase()));
  if (i < 1) throw new Error(`Column "${name}" not found`);
  return i;
};
const C = {
  company: col("Company"),
  segment: col("Segment"),
  source: col("Lead source"),
  contact: col("Contact"),
  title: col("Title"),
  month: col("Discovery month"),
  date: col("Discovery date"),
  held: col("Discovery held"),
  stage: col("Stage"),
  status: col("Status in source"),
  volume: col("Volume"),
  resp: col("Responsiveness"),
  access: col("Decision access"),
  timing: col("Timing"),
  update: col("Latest update"),
  updatedOn: col("Updated on"),
  next: col("Next step"),
  nextDate: col("Next step date"),
  owner: col("Owner"),
};

interface Planned {
  row: number;
  company: string;
  segment: string;
  source: LeadSource;
  ownerKey: keyof typeof ownerEmails;
  contact: string;
  title: string;
  stage: LeadStage;
  sourceStatus: string | null;
  discoveryMonth: string | null;
  discoveryDate: string | null;
  volume: number | null;
  responsiveness: number;
  decisionAccess: number;
  timingBudget: number;
  latestUpdate: string;
  updatedOn: string | null;
  nextStep: string;
  nextDate: string | null;
  notes: string[];
}

const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const planned: Planned[] = [];
let monthOnly = 0;
const skipped: string[] = [];
const decisions: string[] = [];

sheet.eachRow((row, n) => {
  if (n <= headerRow) return;
  const company = text(row.getCell(C.company).value);
  if (!company) return;
  const segmentRaw = text(row.getCell(C.segment).value);
  const contact = text(row.getCell(C.contact).value);
  const stageRaw = text(row.getCell(C.stage).value);
  if (!stageRaw && !segmentRaw && !contact) {
    skipped.push(`row ${n} ${company}: only a company name`);
    return;
  }
  const sourceRaw = text(row.getCell(C.source).value).toLowerCase();
  const ownerRaw = text(row.getCell(C.owner).value).toLowerCase();
  const status = text(row.getCell(C.status).value);
  const held = text(row.getCell(C.held).value);
  const stage = stageFor(stageRaw, status, held);
  const notes: string[] = [];

  const segment = (INDUSTRIES as readonly string[]).includes(segmentRaw) ? segmentRaw : "Other";
  if (segmentRaw && segment !== segmentRaw) notes.push(`segment "${segmentRaw}" → Other`);

  const source: LeadSource =
    SOURCE[sourceRaw] ?? (ownerRaw.includes("voice") ? "voice_bot" : ownerRaw.includes("growth") ? "head_of_growth" : ownerRaw.includes("pipeloom") ? "pipeloom" : "unknown");
  const ownerKey: Planned["ownerKey"] = ownerRaw.includes("pipeloom")
    ? "pipeloom"
    : ownerRaw.includes("voice")
      ? "voicebot"
      : ownerRaw.includes("growth")
        ? "growth"
        : "fallback";
  if (!sourceRaw && source !== "unknown") notes.push(`no lead source → ${source} (from owner)`);

  const month = dateKey(row.getCell(C.month).value);
  const exact = dateKey(row.getCell(C.date).value);
  const heldDone = held.toLowerCase() === "done" || stage === "won";
  // The first discovery: its exact date, else the first of its month (approximate).
  const discoveryDate = heldDone ? (exact ?? (month ? month : null)) : null;
  if (heldDone && !exact && month) monthOnly++;

  const timingRaw = int(row.getCell(C.timing).value);
  if (timingRaw !== null && timingRaw > 5) notes.push(`timing/budget ${timingRaw} capped at 5`);
  const volume = int(row.getCell(C.volume).value);
  const volumeText = text(row.getCell(C.volume).value);
  if (volumeText && volume === null) notes.push(`volume "${volumeText.replace(/\s+/g, " ")}" not a number → blank`);

  const nextDate = dateKey(row.getCell(C.nextDate).value);
  const open = stage !== "won" && stage !== "lost";
  if (nextDate && !open) notes.push("next step date dropped (account is closed)");

  planned.push({
    row: n,
    company,
    segment,
    source,
    ownerKey,
    contact: contact || "Not recorded",
    title: text(row.getCell(C.title).value),
    stage,
    sourceStatus: status || null,
    discoveryMonth: month ? `${month.slice(0, 7)}-01` : discoveryDate ? `${discoveryDate.slice(0, 7)}-01` : null,
    discoveryDate,
    volume,
    responsiveness: clamp(int(row.getCell(C.resp).value), 10),
    decisionAccess: clamp(int(row.getCell(C.access).value), 10),
    timingBudget: clamp(timingRaw, 5),
    latestUpdate: text(row.getCell(C.update).value),
    updatedOn: dateKey(row.getCell(C.updatedOn).value),
    nextStep: text(row.getCell(C.next).value),
    nextDate: open ? nextDate : null,
    notes,
  });
});

// Duplicates: a Won row whose name matches another account merges into it as a note;
// "Avaas" is Aavas Financiers.
const RENAME: Record<string, string> = { avaas: "Aavas Financiers" };
for (const p of planned) {
  const fixed = RENAME[normal(p.company)];
  if (fixed) {
    decisions.push(`row ${p.row} "${p.company}" imported as "${fixed}"`);
    p.company = fixed;
  }
}
const byName = new Map<string, Planned[]>();
for (const p of planned) byName.set(normal(p.company), [...(byName.get(normal(p.company)) ?? []), p]);
const merged = new Set<Planned>();
for (const group of byName.values()) {
  if (group.length < 2) continue;
  const keep = group.find((p) => p.stage !== "won") ?? group[0];
  for (const p of group) {
    if (p === keep) continue;
    merged.add(p);
    keep.notes.push(`also listed as ${p.stage === "won" ? "a Won customer" : p.stage} (row ${p.row})`);
    decisions.push(`row ${p.row} "${p.company}" (${p.stage}) merged into row ${keep.row} "${keep.company}" (${keep.stage})`);
  }
}
const accounts = planned.filter((p) => !merged.has(p));

// Funnel Health rows: funnel number in column A carries down; problem in C.
interface ActionRow {
  funnel: 1 | 2 | 3;
  problem: string;
  fix: string;
  owner: string;
  due: string;
  status: ActionStatus;
}
const actions: ActionRow[] = [];
if (health) {
  let funnel: 1 | 2 | 3 = 1;
  health.eachRow((row, n) => {
    if (n <= 4) return;
    const a = text(row.getCell(1).value);
    const m = /^([123])\./.exec(a);
    if (m) funnel = Number(m[1]) as 1 | 2 | 3;
    const b = text(row.getCell(2).value);
    const c = text(row.getCell(3).value);
    // Column B is either the funnel's metric (has numbers) or, in the notes at the
    // bottom, an account name with its reason in C ("Airtel bank" / "Pricing").
    const accountNote = !a && b && !/\d/.test(b) && b.length < 40;
    const problem = accountNote ? (c ? `${b}: ${c}` : b) : c;
    if (problem.length < 3) return;
    actions.push({
      funnel,
      problem: problem.slice(0, 500),
      fix: text(row.getCell(4).value).slice(0, 500),
      owner: text(row.getCell(5).value).slice(0, 120),
      due: text(row.getCell(6).value).slice(0, 60),
      status: STATUS[text(row.getCell(7).value).toLowerCase()] ?? "open",
    });
  });
}

// Report -------------------------------------------------------------------------------
const count = <T,>(items: T[], key: (t: T) => string) =>
  Object.entries(items.reduce<Record<string, number>>((m, t) => ((m[key(t)] = (m[key(t)] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");

console.log(`Workbook: ${accounts.length} accounts to import, ${merged.size} merged, ${skipped.length} skipped, ${actions.length} funnel health rows`);
console.log(`  by stage:  ${count(accounts, (a) => a.stage)}`);
console.log(`  by source: ${count(accounts, (a) => a.source)}`);
console.log(`  by owner:  ${count(accounts, (a) => a.ownerKey)}`);
console.log(`  by band:   ${count(accounts, (a) => leadBand(a))}`);
console.log(`  avg score: ${(accounts.reduce((s, a) => s + leadScore(a), 0) / accounts.length).toFixed(1)} /40`);
console.log(`  dates:     ${monthOnly} discoveries have only a month; dated to the 1st of it`);
console.log(`  unrecorded source: ${accounts.filter((a) => a.source === "unknown").map((a) => a.company).join(", ") || "none"}`);
for (const s of skipped) console.log(`  skipped   ${s}`);
for (const d of decisions) console.log(`  decision  ${d}`);
for (const a of accounts) if (a.notes.length) console.log(`  note      row ${a.row} ${a.company}: ${a.notes.join("; ")}`);

for (const a of actions) console.log(`  health    ${a.funnel}. [${a.status}] ${a.problem.replace(/\s+/g, " ").slice(0, 90)}`);

if (!WRITE) {
  console.log("\nDry run: nothing written. Add --write to import.");
  process.exit(0);
}

// Write ----------------------------------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local)");
const db = createClient<Database>(url, secret, { auth: { persistSession: false } });

const { data: team, error: teamError } = await db.from("profiles").select("id, email, name, status, is_demo");
if (teamError) throw teamError;
const owners: Record<string, string> = {};
for (const [key, email] of Object.entries(ownerEmails)) {
  const member = team.find((m) => m.email === email && m.status === "active" && !m.is_demo);
  if (!member) throw new Error(`--${key === "fallback" ? "default" : key}: no active (non-demo) member with email ${email ?? "(missing)"}`);
  owners[key] = member.id;
}
const { count: existing } = await db.from("leads").select("id", { count: "exact", head: true });
if ((existing ?? 0) > 0) throw new Error(`Refusing: the accounts table already has ${existing} rows (remove the demo data first)`);

let written = 0;
for (const a of accounts) {
  const ownerId = owners[a.ownerKey];
  // Created at the first thing we know about the account; closed accounts close then too.
  const createdDay = [a.discoveryDate, a.discoveryMonth, a.updatedOn].filter((d): d is string => Boolean(d)).sort()[0] ?? today;
  const createdAt = toIstIso(createdDay, 10, 0);
  const closed = a.stage === "won" || a.stage === "lost";
  const { data: lead, error } = await db
    .from("leads")
    .insert({
      company_name: a.company,
      poc_name: a.contact,
      poc_designation: a.title,
      industry: a.segment,
      source: a.source,
      stage: a.stage,
      priority: leadBand(a) === "hot" || leadBand(a) === "warm" ? "high" : leadBand(a) === "nurture" ? "medium" : "low",
      deal_value: 0,
      volume: a.volume,
      responsiveness: a.responsiveness,
      decision_access: a.decisionAccess,
      timing_budget: a.timingBudget,
      discovery_date: a.discoveryDate,
      discovery_month: a.discoveryMonth,
      next_step: a.nextStep.slice(0, 200),
      next_follow_up_at: a.nextDate ? toIstIso(a.nextDate, 10, 0) : null,
      source_status: a.sourceStatus?.slice(0, 200) ?? null,
      owner_id: ownerId,
      created_at: createdAt,
      closed_at: closed ? createdAt : null,
      notes: a.notes.filter((n) => n.startsWith("also listed")).map((n) => `MIS: ${n}`).join("\n"),
    })
    .select("id")
    .single();
  if (error) throw new Error(`row ${a.row} ${a.company}: ${error.message}`);

  const history = await db.from("lead_stage_history").insert({ lead_id: lead.id, stage: a.stage, start_at: createdAt });
  if (history.error) throw new Error(`row ${a.row} history: ${history.error.message}`);
  const activities = [{ lead_id: lead.id, type: "note" as const, description: "Imported from the sales MIS workbook", at: createdAt, by_user_id: ownerId }];
  if (a.latestUpdate) {
    const day = a.updatedOn && a.updatedOn >= createdDay ? a.updatedOn : createdDay;
    activities.push({ lead_id: lead.id, type: "note", description: a.latestUpdate.slice(0, 1000), at: toIstIso(day, 12, 0), by_user_id: ownerId });
  }
  const acts = await db.from("lead_activities").insert(activities);
  if (acts.error) throw new Error(`row ${a.row} activities: ${acts.error.message}`);
  written++;
}

if (actions.length) {
  const res = await db.from("funnel_actions").insert(actions.map((a, i) => ({
    funnel: a.funnel,
    problem: a.problem,
    fix: a.fix,
    owner_label: a.owner,
    due_label: a.due,
    status: a.status,
    position: i,
  })));
  if (res.error) throw new Error(`funnel health: ${res.error.message}`);
}
console.log(`\n✓ Imported ${written} accounts and ${actions.length} funnel health rows.`);
