"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthLabel } from "@/lib/reports/monthly";

const NONE = "none";

/** Month + comparison pickers (kept in the URL), CSV download and print. Hidden when printing. */
export function ReportToolbar({ months, month, compare }: { months: string[]; month: string; compare: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const query = `month=${month}${compare ? `&compare=${compare}` : `&compare=${NONE}`}`;

  function go(nextMonth: string, nextCompare: string | null) {
    router.replace(`${pathname}?month=${nextMonth}&compare=${nextCompare ?? NONE}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Month</span>
        {/* Picking the compared month as the main one shifts the comparison one month back. */}
        <Select value={month} onValueChange={(m) => go(m, compare === m ? (months[months.indexOf(m) + 1] ?? null) : compare)}>
          <SelectTrigger className="w-44" aria-label="Report month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Compare with</span>
        <Select value={compare ?? NONE} onValueChange={(c) => go(month, c === NONE ? null : c)}>
          <SelectTrigger className="w-44" aria-label="Compare with month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No comparison</SelectItem>
            {months
              .filter((m) => m !== month)
              .map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </label>
      <div className="flex gap-2 sm:ml-auto">
        <Button asChild variant="outline">
          {/* A plain link: the route handler answers with an attachment. */}
          <a href={`/reports/export?${query}`} download>
            <DownloadIcon />
            Download CSV
          </a>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <PrinterIcon />
          Print
        </Button>
      </div>
    </div>
  );
}
