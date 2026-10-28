"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface TrendDatum {
  label: string;
  newLeads: number;
  won: number;
}

// Two series on one axis (both are counts): categorical slots 1 and 2.
const config = {
  newLeads: { label: "New leads", color: "var(--series-1)" },
  won: { label: "Won", color: "var(--series-2)" },
} satisfies ChartConfig;

/** Grouped columns: new leads vs deals won per month, with legend and tooltip. */
export function TrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <BarChart data={data} margin={{ left: -16, right: 4, top: 8, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="newLeads" fill="var(--color-newLeads)" radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="won" fill="var(--color-won)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ChartContainer>
      {/* sr-only on a wrapper: tables ignore the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>New leads and deals won per month</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>New leads</th>
              <th>Won</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{d.newLeads}</td>
                <td>{d.won}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
