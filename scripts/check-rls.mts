// Proves the database enforces permissions, using the public (publishable) key
// exactly like the browser would: `npm run check:rls`.
// Needs the seeded demo data. Mutations happen only on a temporary lead that is
// deleted at the end, so the seed stays intact.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mockUsers, toAuthId } from "@/data/mock-users";
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

const priya = await signIn("u_priya");
const admin = await signIn("u_admin");
const anon = client();
const PRIYA = toAuthId("u_priya");
const ROHAN = toAuthId("u_rohan");

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
    industry: "SaaS",
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
check(`Admin creates a lead for Priya (${tempId})`, !created.error && /^L-\d+$/.test(tempId), created.error?.message);

const skip = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "proposal" });
check("change_lead_stage rejects a skip (new → proposal)", Boolean(skip.error), skip.error?.message);
const step = await priya.rpc("change_lead_stage", { p_lead_id: tempId, p_to: "contacted", p_note: "First call done" });
check("Priya moves her lead new → contacted", !step.error, step.error?.message);
const hist = await priya.from("lead_stage_history").select("stage, end_at").eq("lead_id", tempId).order("start_at");
check("…and history has new (closed) + contacted (current)", hist.data?.map((h) => `${h.stage}:${h.end_at ? "ended" : "current"}`).join() === "new:ended,contacted:current");

const moved = await admin.rpc("reassign_leads", { p_lead_ids: [tempId], p_to: ROHAN });
check("Admin reassigns it to Rohan", !moved.error && moved.data === 1, moved.error?.message);
const gone = await priya.from("leads").select("id").eq("id", tempId);
check("…and Priya can no longer read it", !gone.error && gone.data!.length === 0);

const removed = await admin.from("leads").delete().eq("id", tempId).select("id");
check("Admin deletes the temporary lead", !removed.error && removed.data!.length === 1);

await Promise.all([priya.auth.signOut(), admin.auth.signOut()]);
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll RLS checks passed");
