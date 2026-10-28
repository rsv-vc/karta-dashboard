import { getCurrentUser } from "@/lib/auth/dal";
import { partitionLeadsForUser } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { fetchLeadSummaries, fetchTeam } from "@/lib/data/repo";
import { filterLeadRows, parseLeadFilters } from "@/lib/leads/filters";
import { toLeadRow } from "@/lib/leads/rows";
import { leadsCsv } from "@/lib/reports/csv";
import { nameLookup } from "@/lib/team";

// Leads CSV using the same filters as /leads. Only leads the requester may see
// in full are exported (agents: their own); masked leads never leave the server.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const filters = parseLeadFilters(new URL(request.url).searchParams);
  const [leads, team] = await Promise.all([fetchLeadSummaries(), fetchTeam()]);
  const { full } = partitionLeadsForUser(user, leads);
  const nameOf = nameLookup(team);
  const keep = new Set(filterLeadRows(full.map((l) => toLeadRow(l, nameOf)), filters).map((r) => r.id));

  return new Response(leadsCsv(full.filter((l) => keep.has(l.id)), nameOf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="karta-leads-${TODAY}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
