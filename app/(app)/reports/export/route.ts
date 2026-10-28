import { mockUsers } from "@/data/mock-users";
import { getCurrentUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { TODAY } from "@/lib/constants";
import { fetchVisibleLeads } from "@/lib/data/repo";
import { monthlyReportCsv } from "@/lib/reports/csv";
import { buildMonthlyReport, isMonthKey, previousMonth, reportMonths } from "@/lib/reports/monthly";

// Monthly report CSV. Admin only; auth failures return status codes, never redirects.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (!isAdmin(user)) return new Response("Admins only", { status: 403 });

  const params = new URL(request.url).searchParams;
  const months = reportMonths(TODAY);
  const month = params.get("month") ?? months[0];
  // "none" turns the comparison off; absent means the previous month.
  const rawCompare = params.get("compare") ?? previousMonth(month);
  const compare = rawCompare === "none" ? null : rawCompare;
  if (!isMonthKey(month) || !months.includes(month) || (compare !== null && !isMonthKey(compare))) {
    return new Response("Invalid month", { status: 400 });
  }

  const report = buildMonthlyReport(await fetchVisibleLeads(), { month, compareTo: compare, agents: mockUsers });
  return new Response(monthlyReportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="karta-report-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
