// Asserts the permission model and session token rules: `npm run check:permissions`
import { DEMO_PASSWORD, verifyCredentials } from "@/data/mock-credentials";
import { mockLeads } from "@/data/mock-leads";
import { getAgents, mockUsers } from "@/data/mock-users";
import { canViewReports, partitionLeadsForUser, toVisibleLead } from "@/lib/auth/permissions";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";
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

// Credentials.
check("valid credentials", verifyCredentials("priya@company.com", DEMO_PASSWORD)?.id === priya.id);
check("uppercase email still matches", verifyCredentials("PRIYA@COMPANY.COM", DEMO_PASSWORD)?.id === priya.id);
check("wrong password rejected", verifyCredentials("priya@company.com", "wrong") === null);
check("unknown email rejected", verifyCredentials("nobody@company.com", DEMO_PASSWORD) === null);

// Session tokens.
const secret = "test-secret-that-is-at-least-32-characters";
const now = Date.UTC(2026, 9, 28, 10);
const token = createSessionToken(priya.id, secret, now);
check("token round-trips", verifySessionToken(token, secret, now)?.userId === priya.id);
const [payload, signature] = token.split(".");
const forged = Buffer.from(JSON.stringify({ userId: "u_admin", issuedAt: now, expiresAt: now + 1e9 })).toString("base64url");
check("tampered payload rejected", verifySessionToken(`${forged}.${signature}`, secret, now) === null);
check("wrong secret rejected", verifySessionToken(token, `${secret}-other`, now) === null);
check("garbage rejected", verifySessionToken(`${payload}`, secret, now) === null);
check("expired token rejected", verifySessionToken(token, secret, now + 8 * 24 * 3600 * 1000) === null);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll permission checks passed");
