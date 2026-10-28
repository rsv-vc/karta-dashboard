"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { FunnelStep } from "@/lib/dashboard/team-metrics";

// One series (leads reaching each stage), so one color for every bar.
const config = { reached: { label: "Leads", color: "var(--series-1)" } } satisfies ChartConfig;

type Datum = FunnelStep & { tip: string; prevLabel: string | null };

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Conversion funnel: how many leads ever reached each stage, with step conversion at the tip. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const data: Datum[] = steps.map((s, i) => ({
    ...s,
    prevLabel: i > 0 ? steps[i - 1].label : null,
    tip: s.conversion === null ? String(s.reached) : `${s.reached} · ${pct(s.conversion)}`,
  }));

  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-60 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 64, top: 4, bottom: 4 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={88}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined;
              if (!d) return null;
              return (
                <div className="max-w-56 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-md">
                  <div className="font-medium">{d.label}</div>
                  <div className="text-muted-foreground">
                    {d.reached} leads reached this stage
                    {d.conversion !== null && d.prevLabel && ` · ${pct(d.conversion)} of ${d.prevLabel}`}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="reached" fill="var(--color-reached)" radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList dataKey="tip" position="right" offset={8} className="fill-foreground text-xs" />
          </Bar>
        </BarChart>
      </ChartContainer>
      {/* sr-only on a wrapper: tables ignore the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Leads reaching each stage</caption>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Reached</th>
              <th>Conversion from previous stage</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.stage}>
                <td>{d.label}</td>
                <td>{d.reached}</td>
                <td>{d.conversion === null ? "—" : pct(d.conversion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
