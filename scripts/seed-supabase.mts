// Loads the 75 deterministic demo leads (with history and activities) and the
// monthly targets into Supabase: `npm run db:seed`.
//
// Signs in as the demo admin with the publishable key, so it works through Row
// Level Security like the app does (no secret key needed). Users must already
// exist (scripts/seed-users-sql.ts). Wipes existing leads only when DEMO_SEED=true.
import { createClient } from "@supabase/supabase-js";
import { mockLeads } from "@/data/mock-leads";
import { MONTHLY_TARGETS } from "@/data/mock-targets";
import { demoAgents, mockUsers } from "@/data/mock-users";
import { toDbInsert, toLead, type LeadDbRowWithRelations } from "@/lib/data/mappers";
import { FIRST_REPORT_MONTH, reportMonths } from "@/lib/reports/monthly";
import { TODAY } from "@/lib/constants";
import { validateLeads } from "@/lib/validation";
import type { Database } from "@/types/supabase";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} (run with --env-file=.env.local)`);
    process.exit(1);
  }
  return value;
}

if (process.env.DEMO_SEED !== "true") {
  console.error("Refusing to wipe data: set DEMO_SEED=true to reload the demo leads.");
  process.exit(1);
}

const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
  auth: { persistSession: false },
});

function check<T>(label: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    console.error(`✗ ${label}: ${result.error.message}`);
    process.exit(1);
  }
  return result.data;
}

const admin = mockUsers.find((u) => u.role === "admin")!;
const signIn = await supabase.auth.signInWithPassword({ email: admin.email, password: env("DEMO_PASSWORD") });
if (signIn.error) {
  console.error(`✗ sign in as admin: ${signIn.error.message}`);
  process.exit(1);
}

// Wipe (cascades to history and activities), then insert in dependency order.
check("delete leads", await supabase.from("leads").delete().neq("id", ""));
check("delete targets", await supabase.from("monthly_targets").delete().neq("new_leads", -1));

const rows = mockLeads.map(toDbInsert);
check("insert leads", await supabase.from("leads").insert(rows.map((r) => r.lead)));
check("insert history", await supabase.from("lead_stage_history").insert(rows.flatMap((r) => r.history)));
check("insert activities", await supabase.from("lead_activities").insert(rows.flatMap((r) => r.activities)));

const months = reportMonths(TODAY).filter((m) => m >= FIRST_REPORT_MONTH);
const targets = demoAgents().flatMap((agent) =>
  months.map((month) => ({
    user_id: agent.id,
    month: `${month}-01`,
    won_value: MONTHLY_TARGETS[agent.id]?.wonValue ?? 0,
    new_leads: MONTHLY_TARGETS[agent.id]?.newLeads ?? 0,
  })),
);
check("insert targets", await supabase.from("monthly_targets").insert(targets));
const seq = check("sync lead id sequence", await supabase.rpc("sync_lead_sequence"));

// Read everything back through the same mapping the app uses and validate it.
const back = check(
  "read back",
  await supabase.from("leads").select("*, lead_stage_history(*), lead_activities(*)").order("id"),
) as LeadDbRowWithRelations[];
const leads = back.map(toLead);
const result = validateLeads(leads, { seedRules: true, team: mockUsers });

console.log(`✓ ${leads.length} leads, ${rows.reduce((n, r) => n + r.history.length, 0)} history rows, ${rows.reduce((n, r) => n + r.activities.length, 0)} activities, ${targets.length} targets`);
console.log(`✓ next lead id will be L-${Number(seq) + 1}`);
console.log(result.valid ? "✓ data read back from Supabase passes validation" : result.errors.slice(0, 10));
await supabase.auth.signOut();
if (!result.valid) process.exit(1);
