"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatINR, formatINRShort } from "@/lib/utils";

export interface PipelineDatum {
  label: string;
  count: number;
  value: number;
}

// One series, so one color for every bar (dataviz: no value ramp on categories).
const config = {
  count: { label: "Leads", color: "var(--series-1)" },
} satisfies ChartConfig;

/** Horizontal bars: active leads per stage, count at the bar tip, ₹ value on hover. */
export function PipelineChart({ data }: { data: PipelineDatum[] }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 32, top: 4, bottom: 4 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} />
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
              const d = active ? (payload?.[0]?.payload as PipelineDatum | undefined) : undefined;
              if (!d) return null;
              return (
                <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-md">
                  <div className="font-medium">{d.label}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-[2px] bg-(--series-1)" />
                    {d.count} {d.count === 1 ? "lead" : "leads"} · {formatINR(d.value)}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" isAnimationActive={!reducedMotion} fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs" />
          </Bar>
        </BarChart>
      </ChartContainer>
      {/* sr-only on a wrapper: tables ignore the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Active leads by stage</caption>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Leads</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{d.count}</td>
                <td>{formatINRShort(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
