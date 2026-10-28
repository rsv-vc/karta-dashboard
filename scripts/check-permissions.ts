// Asserts the app-level permission rules: `npm run check:permissions`
// (Sessions, passwords and database enforcement are covered by `npm run check:rls`.)
import "./_demo-today";
import { mockLeads } from "@/data/mock-leads";
import { getAgents, mockUsers } from "@/data/mock-users";
import { canViewReports, partitionLeadsForUser, toVisibleLead } from "@/lib/auth/permissions";
import { getLeadsByOwner } from "@/lib/selectors";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const DIRECTORY_KEYS = ["companyName", "id", "ownerId", "pocName", "stage"].join(",");

// Admin sees everything.
const admin = mockUsers.find((u) => u.role === "admin")!;
const adminView = partitionLeadsForUser(admin, mockLeads);
check("admin: 75 full, 0 masked", adminView.full.length === 75 && adminView.masked.length === 0);
check("admin: can view reports", canViewReports(admin));

// Each agent: own leads full, everyone else's masked down to the 5 directory fields.
for (const agent of getAgents()) {
  const { full, masked } = partitionLeadsForUser(agent, mockLeads);
  const own = getLeadsByOwner(agent.id).length;
  check(`${agent.name}: ${own} full + ${masked.length} masked = 75`, full.length === own && own + masked.length === 75);
  check(`${agent.name}: every full lead is their own`, full.every((l) => l.ownerId === agent.id));
  check(
    `${agent.name}: masked entries carry only the directory keys`,
    masked.every((e) => Object.keys(e).sort().join(",") === DIRECTORY_KEYS),
  );
  check(`${agent.name}: cannot view reports`, !canViewReports(agent));
}

const [priya, rohan] = getAgents();
const priyaLead = getLeadsByOwner(priya.id)[0];
check("agent sees another agent's lead masked", toVisibleLead(rohan, priyaLead).kind === "masked");
check("agent sees own lead in full", toVisibleLead(priya, priyaLead).kind === "full");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll permission checks passed");
