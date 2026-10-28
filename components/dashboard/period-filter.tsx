"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_PERIOD, TEAM_PERIODS, type TeamPeriod } from "@/lib/dashboard/team-metrics";
import { cn } from "@/lib/utils";

/** Segmented period control kept in the URL as ?period= (default omitted). */
export function PeriodFilter({ value }: { value: TeamPeriod }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div role="group" aria-label="Period" className="inline-flex rounded-lg border p-0.5">
      {TEAM_PERIODS.map((p) => (
        <Button
          key={p.value}
          variant="ghost"
          size="sm"
          aria-pressed={value === p.value}
          onClick={() =>
            router.replace(p.value === DEFAULT_PERIOD ? pathname : `${pathname}?period=${p.value}`, { scroll: false })
          }
          className={cn("h-7 px-2.5", value === p.value && "bg-muted text-foreground")}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
