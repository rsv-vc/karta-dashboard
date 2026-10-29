import { DealBreakdown } from "@/components/leads/deal-breakdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateDeal } from "@/lib/deal-calculator";
import { formatINR } from "@/lib/utils";
import type { Lead } from "@/types/lead";

/** How the account's volume and deal value were worked out (edit the inputs on the Edit page). */
export function DealCard({ lead }: { lead: Lead }) {
  const deal = calculateDeal({
    segment: lead.industry,
    callsPerMonth: lead.callsPerMonth,
    minutesPerCall: lead.minutesPerCall,
    pricePerMinute: lead.pricePerMinute,
    contractMonths: lead.contractMonths,
  });
  // A final value recorded when the deal was won takes precedence over the estimate.
  const final = lead.stage === "won" && lead.dealValue > 0 && lead.dealValue !== deal.dealValue;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume &amp; deal value</CardTitle>
        <CardDescription>
          {final ? `Won at ${formatINR(lead.dealValue)}; the calculator's estimate is below.` : "Calculated from the inputs on the Edit page."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DealBreakdown deal={deal} />
      </CardContent>
    </Card>
  );
}
