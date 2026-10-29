// Proves the database enforces permissions, using the public (publishable) key
// exactly like the browser would: `npm run check:rls`.
// Needs the seeded demo data. Mutations happen only on a temporary lead that is
// deleted at the end, so the seed stays intact.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_USER_IDS as U, mockUsers } from "@/data/mock-users";
import type { Database } from "@/types/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !password) {
  console.error("Run with --env-file=.env.local (needs Supabase URL, publishable key, DEMO_PASSWORD)");
  process.exit(1);
}

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log("   ", detail);
  }
}

type Client = SupabaseClient<Database>;
const client = (): Client => createClient<Database>(url, key, { auth: { persistSession: false } });

async function signIn(appId: string): Promise<Client> {
  const c = client();
  const user = mockUsers.find((u) => u.id === appId)!;
  const { error } = await c.auth.signInWithPassword({ email: user.email, password: password! });
  if (error) throw new Error(`sign-in ${appId}: ${error.message}`);
  return c;
}

const priya = await signIn(U.priya);
const admin = await signIn(U.admin);
const anon = client();
const PRIYA = U.priya;
const ROHAN = U.rohan;

// Reads ----------------------------------------------------------------------------
const own = await priya.from("leads").select("id, owner_id");
check(`Priya reads only her own leads (${own.data?.length})`, !own.error && own.data!.length === 26 && own.data!.every((l) => l.owner_id === PRIYA));

const rohanLead = await admin.from("leads").select("id").eq("owner_id", ROHAN).limit(1).single();
const rohanId = rohanLead.data!.id;
const peek = await priya.from("leads").select("*").eq("id", rohanId);
check(`Priya selecting Rohan's lead ${rohanId} gets nothing`, !peek.error && peek.data!.length === 0);
const peekHistory = await priya.from("lead_activities").select("id").eq("lead_id", rohanId);
check("…nor its activities", !peekHistory.error && peekHistory.data!.length === 0);

const dir = await priya.rpc("lead_directory");
const dirKeys = dir.data?.[0] ? Object.keys(dir.data[0]).sort().join(",") : "";
check(`lead_directory() returns all 75 leads with exactly 5 columns`, !dir.error && dir.data!.length === 75 && dirKeys === "company_name,id,owner_id,poc_name,stage", dirKeys);
check(
  "…with the stage only on Priya's own accounts",
  !dir.error && dir.data!.every((r) => (r.owner_id === PRIYA) === (r.stage !== null)),
);

const dupes = await priya.rpc("find_possible_duplicates", { p_name: "Zenith Retail Solutions" });
check("find_possible_duplicates finds both Zenith leads, masked", !dupes.error && dupes.data!.length === 2 && !("poc_email" in (dupes.data![0] ?? {})));

const all = await admin.from("leads").select("id");
check(`Admin reads every lead (${all.data?.length})`, !all.error && all.data!.length === 75);

const anonLeads = await anon.from("leads").select("id");
check("Signed-out (anon) reads no leads", !anonLeads.error && anonLeads.data!.length === 0);
const anonDir = await anon.rpc("lead_directory");
check("Signed-out (anon) cannot call lead_directory()", Boolean(anonDir.error));

// Writes Priya must not be able to do -----------------------------------------------
const otherUpdate = await priya.from("leads").update({ notes: "hacked" }).eq("id", rohanId).select("id");
check("Priya cannot update Rohan's lead", !otherUpdate.error && otherUpdate.data!.length === 0);

const myLead = own.data![0].id;
const steal = await priya.from("leads").update({ owner_id: ROHAN }).eq("id", myLead).select("id");
check("Priya cannot change the owner of her own lead", Boolean(steal.error) || steal.data!.length === 0, steal.error?.message);

const jump = await priya.from("leads").update({ stage: "won" }).eq("id", myLead).select("id");
check("Priya cannot set a stage directly (must use change_lead_stage)", Boolean(jump.error), jump.error?.message);

const del = await priya.from("leads").delete().eq("id", myLead).select("id");
check("Priya cannot delete leads", !del.error && del.data!.length === 0);

const fakeActivity = await priya
  .from("lead_activities")
  .insert({ lead_id: myLead, type: "call", description: "Fake call", at: new Date().toISOString(), by_user_id: PRIYA });
check("Priya cannot insert activities directly", Boolean(fakeActivity.error));

const reassign = await priya.rpc("reassign_leads", { p_lead_ids: [myLead], p_to: ROHAN });
check("Priya cannot call reassign_leads()", Boolean(reassign.error));

const closed = await priya.from("leads").select("id").in("stage", ["won", "lost"]).limit(1).single();
const moveClosed = await priya.rpc("change_lead_stage", { p_lead_id: closed.data!.id, p_to: "lost", p_lost_reason: "Testing" });
check("change_lead_stage rejects a closed lead", Boolean(moveClosed.error), moveClosed.error?.message);

// The full lifecycle on a temporary lead --------------------------------------------
const created = await admin.rpc("create_lead", {
  p: {
    company_name: "RLS Check Temporary Pvt Ltd",
    poc_name: "Test Person",
    poc_designation: "QA",
    poc_email: "qa@example.com",
    poc_phone: "+91 98765 43210",
    industry: "Other",
    company_size: "11-50",
    city: "Pune",
    source: "website",
    priority: "low",
    deal_value: 100000,
    notes: "",
    owner_id: PRIYA,
  },
});
const tempId = created.data as string;
const unknownIndustry = await admin.rpc("create_lead", { p: { company_name: "RLS Unknown Industry", poc_name: "X", industry: "Not a real industry", source: "website", priority: "low", owner_id: PRIYA } });
check("An industry outside the Industries master is refused", Boolean(unknownIndustry.error), unknownIndustry.error?.message);
check(`Admin creates a lead for Priya (${tempId})`, !created.error && /^L-\d+$/.test(tempId), created.error?.message);

const step = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "discovery_done", p_note: "First call done" });
check("Priya moves her account not met → discovery done", !step.error, step.error?.message);
const back = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "not_met" });
check("change_lead_stage refuses a backwards move", Boolean(back.error), back.error?.message);
const noShow = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "no_show" });
check("…and No-show after discovery", Boolean(noShow.error), noShow.error?.message);
const hist = await priya.from("lead_stage_history").select("stage, end_at").eq("lead_id", tempId).order("start_at");
check("…and history has not met (closed) + discovery done (current)", hist.data?.map((h) => `${h.stage}:${h.end_at ? "ended" : "current"}`).join() === "not_met:ended,discovery_done:current");
const dated = await priya.from("leads").select("discovery_date, discovery_month").eq("id", tempId).single();
check("…and the first discovery dates the account", Boolean(dated.data?.discovery_date) && Boolean(dated.data?.discovery_month), dated.data);

const noReason = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "deferred", p_note: "Later" });
check("Deferring needs a reason from the list", /Pick a reason/.test(noReason.error?.message ?? ""), noReason.error?.message);
const lostOnly = await priya.from("drop_reasons").select("id").eq("applies_to", "lost").limit(1).single();
const wrongReason = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "deferred", p_reason_id: lostOnly.data!.id });
check("…and a lost-only reason is refused for Deferred", Boolean(wrongReason.error), wrongReason.error?.message);
const anyReason = await priya.from("drop_reasons").select("id, label").eq("applies_to", "both").limit(1).single();
const deferred = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "deferred", p_reason_id: anyReason.data!.id, p_lost_reason: "Budget in April" });
check("Priya defers it with a reason", !deferred.error, deferred.error?.message);
const why = await priya.from("leads").select("drop_reason_id, drop_note").eq("id", tempId).single();
check("…and the reason and details are stored", why.data?.drop_reason_id === anyReason.data!.id && why.data?.drop_note === "Budget in April", why.data);
const agentMaster = await priya.from("drop_reasons").insert({ label: "Agents cannot add this" }).select("id");
check("An agent cannot add to the masters", Boolean(agentMaster.error) || agentMaster.data!.length === 0, agentMaster.error?.message);
const agentPrice = await priya.from("app_settings").update({ price_per_minute: 1 }).eq("id", true).select("id");
check("…nor change the pricing", Boolean(agentPrice.error) || agentPrice.data!.length === 0, agentPrice.error?.message);

const moved = await admin.rpc("reassign_leads", { p_lead_ids: [tempId], p_to: ROHAN });
check("Admin reassigns it to Rohan", !moved.error && moved.data === 1, moved.error?.message);
const gone = await priya.from("leads").select("id").eq("id", tempId);
check("…and Priya can no longer read it", !gone.error && gone.data!.length === 0);

const removed = await admin.from("leads").delete().eq("id", tempId).select("id");
check("Admin deletes the temporary lead", !removed.error && removed.data!.length === 1);

// Team management ------------------------------------------------------------------
const KARAN = U.karan;
const agentCall = await priya.rpc("admin_update_member", { p_id: ROHAN, p_role: "sales_agent", p_status: "inactive" });
check("an agent cannot call admin_update_member", Boolean(agentCall.error), agentCall.error?.message);
const selfDemote = await admin.rpc("admin_update_member", { p_id: U.admin, p_role: "sales_agent", p_status: "active" });
check("an admin cannot demote themselves", /own admin access/.test(selfDemote.error?.message ?? ""), selfDemote.error?.message);
const selfOff = await admin.rpc("admin_update_member", { p_id: U.admin, p_role: "admin", p_status: "inactive" });
check("an admin cannot deactivate themselves", /own admin access/.test(selfOff.error?.message ?? ""), selfOff.error?.message);
const busy = await admin.rpc("admin_update_member", { p_id: KARAN, p_role: "sales_agent", p_status: "inactive" });
check("deactivating someone who owns open accounts is refused", /open accounts/.test(busy.error?.message ?? ""), busy.error?.message);
// Admins can own accounts, so promoting an agent who owns some is fine (and put back).
const promote = await admin.rpc("admin_update_member", { p_id: KARAN, p_role: "admin", p_status: "active" });
const demote = await admin.rpc("admin_update_member", { p_id: KARAN, p_role: "sales_agent", p_status: "active" });
check("an agent who owns accounts can become an employee (and back)", !promote.error && !demote.error, promote.error?.message ?? demote.error?.message);
const noop = await admin.rpc("admin_update_member", { p_id: KARAN, p_role: "sales_agent", p_status: "active" });
check("an unchanged role and status is accepted", !noop.error, noop.error?.message);

const agentAllow = await priya.from("allowed_emails").insert({ email: "rls-check@example.com" });
check("an agent cannot add allowed emails", Boolean(agentAllow.error));
const agentList = await priya.from("allowed_emails").select("email");
check("…nor read the list", !agentList.error && agentList.data!.length === 0);
const flag = await priya.from("profiles").update({ must_change_password: false }).eq("id", PRIYA);
check("people cannot clear their own must_change_password flag", Boolean(flag.error), flag.error?.message);
const promoteSelf = await priya.from("profiles").update({ role: "admin" }).eq("id", PRIYA);
check("…nor change their own role", Boolean(promoteSelf.error));
const target = await priya.from("monthly_targets").upsert({ user_id: PRIYA, month: "2026-12-01", won_value: 1, new_leads: 1 });
check("an agent cannot set targets", Boolean(target.error));

// Local sign-out: a global one would end these demo accounts' sessions everywhere.
await Promise.all([priya.auth.signOut({ scope: "local" }), admin.auth.signOut({ scope: "local" })]);
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll RLS checks passed");
