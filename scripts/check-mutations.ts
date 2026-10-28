// Asserts the pure lead mutation rules: `npm run check:mutations`
import { mockLeads } from "@/data/mock-leads";
import { getUserById } from "@/data/mock-users";
import { TODAY } from "@/lib/constants";
import { laterThan, nowIso } from "@/lib/dates";
import {
  MutationError,
  allowedNextStages,
  applyActivity,
  applyLeadEdits,
  applyStageChange,
  buildNewLead,
  normalizePhone,
} from "@/lib/leads/mutations";
import { createLeadSchema, leadFormSchema, type LeadFormValues } from "@/lib/leads/schemas";
import { validateLeads } from "@/lib/validation";
import type { Lead } from "@/types/lead";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}
function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof MutationError;
  }
}
const isValid = (lead: Lead) => {
  const r = validateLeads([lead]);
  if (!r.valid) console.log("   ", r.errors.map((e) => e.message).join("; "));
  return r.valid;
};

const input: LeadFormValues = {
  companyName: "Zenith Retail Solutions",
  industry: "Retail",
  companySize: "51-200",
  city: "Pune",
  pocName: "Asha Rao",
  pocDesignation: "Head of Procurement",
  pocEmail: "Asha@ZenithSolutions.in",
  pocPhone: "98765-43210",
  pocLinkedIn: "",
  source: "referral",
  priority: "high",
  dealValue: 1_500_000,
  nextFollowUpDate: "",
  notes: "",
  ownerId: "",
  duplicateAcknowledged: true,
};

// Schema.
check("valid form input parses", leadFormSchema.safeParse(input).success);
check("bad email rejected", !leadFormSchema.safeParse({ ...input, pocEmail: "nope" }).success);
check("bad phone rejected", !leadFormSchema.safeParse({ ...input, pocPhone: "12345" }).success);
check("past follow-up rejected on create", !createLeadSchema.safeParse({ ...input, nextFollowUpDate: "2026-10-01" }).success);
check("past follow-up allowed on edit (unchanged overdue)", leadFormSchema.safeParse({ ...input, nextFollowUpDate: "2026-10-01" }).success);
check("normalizePhone", normalizePhone("9876543210") === "+91 98765 43210" && normalizePhone("+91 98765-43210") === "+91 98765 43210");

// Time helpers.
check("nowIso uses TODAY", nowIso(TODAY).startsWith(`${TODAY}T`));
check("laterThan bumps by a minute", laterThan("2026-10-28T09:00:00+05:30", "2026-10-28T17:40:00+05:30") === "2026-10-28T17:41:00+05:30");

// Create.
const at = "2026-10-28T09:30:00+05:30";
let lead = buildNewLead(input, { id: "L-2001", ownerId: "u_priya", byUserId: "u_priya", at });
check("new lead is valid", isValid(lead));
check("new lead normalizes email and phone", lead.pocEmail === "asha@zenithsolutions.in" && lead.pocPhone === "+91 98765 43210");

// Walk the pipeline one step at a time.
check("skipping a stage throws", throws(() => applyStageChange(lead, { to: "proposal" }, { byUserId: "u_priya" })));
let ok = true;
for (const to of ["contacted", "qualified", "proposal", "negotiation", "won"] as const) {
  lead = applyStageChange(lead, { to, finalDealValue: to === "won" ? 1_800_000 : undefined }, { byUserId: "u_priya", at: "2026-10-28T09:00:00+05:30" });
  ok &&= isValid(lead);
}
check("new → won stays valid at every step (timestamps kept ordered)", ok);
check("won sets closedAt and final value", lead.closedAt !== null && lead.dealValue === 1_800_000 && lead.nextFollowUpAt === null);
check("one stage_change per transition", lead.activities.filter((a) => a.type === "stage_change").length === 5);
check("won is terminal", allowedNextStages("won").length === 0 && throws(() => applyStageChange(lead, { to: "lost", lostReason: "x" }, { byUserId: "u_priya" })));
check("activity on a closed lead throws", throws(() => applyActivity(lead, { type: "call", description: "Hi", date: TODAY, nextFollowUpDate: "" }, { byUserId: "u_priya" })));

// Lost needs a reason.
const proposal = mockLeads.find((l) => l.stage === "proposal")!;
check("lost without reason throws", throws(() => applyStageChange(proposal, { to: "lost" }, { byUserId: proposal.ownerId })));
const lost = applyStageChange(proposal, { to: "lost", lostReason: "Went with a competitor" }, { byUserId: proposal.ownerId });
check("lost with reason is valid", isValid(lost) && lost.activities.at(-1)!.description.endsWith("Went with a competitor"));

// Activities.
const active = mockLeads.find((l) => l.stage === "qualified" && l.lastContactedAt !== null)!;
check("activity before creation throws", throws(() => applyActivity(active, { type: "call", description: "Call", date: "2026-01-01", nextFollowUpDate: "" }, { byUserId: active.ownerId })));
const called = applyActivity(active, { type: "call", description: "Pricing call", date: TODAY, nextFollowUpDate: "2026-11-03" }, { byUserId: active.ownerId });
check("a call updates lastContactedAt and follow-up", called.lastContactedAt!.startsWith(TODAY) && called.nextFollowUpAt!.startsWith("2026-11-03") && isValid(called));
const noted = applyActivity(active, { type: "note", description: "Internal note", date: TODAY, nextFollowUpDate: "" }, { byUserId: active.ownerId });
check("a note does not touch lastContactedAt", noted.lastContactedAt === active.lastContactedAt);

// Edits.
const nameOf = (id: string) => getUserById(id)?.name ?? id;
const editInput = { ...input, ownerId: "u_karan" };
const agentEdit = applyLeadEdits(active, editInput, { byUserId: active.ownerId, canReassign: false, ownerName: nameOf });
check("an agent edit keeps the owner", agentEdit.ownerId === active.ownerId);
const adminEdit = applyLeadEdits(active, editInput, { byUserId: "u_admin", canReassign: true, ownerName: nameOf });
check("an admin edit reassigns with a note", adminEdit.ownerId === "u_karan" && adminEdit.activities.some((a) => a.description.startsWith("Reassigned")) && isValid(adminEdit));

// Seed rules still hold for the untouched seed.
check("seed still valid with seed rules", validateLeads(mockLeads, { seedRules: true }).valid);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll mutation checks passed");
