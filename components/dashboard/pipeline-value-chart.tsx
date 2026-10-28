"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatINR, formatINRShort } from "@/lib/utils";

export interface PipelineValueDatum {
  label: string;
  pipelineValue: number;
}

const config = { pipelineValue: { label: "Open pipeline", color: "var(--series-1)" } } satisfies ChartConfig;

/** Single-series area: open pipeline value at each month end (2px line, light wash, crosshair tooltip). */
export function PipelineValueChart({ data }: { data: PipelineValueDatum[] }) {
  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatINRShort(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const d = active ? (payload?.[0]?.payload as PipelineValueDatum | undefined) : undefined;
              if (!d) return null;
              return (
                <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-md">
                  <div className="font-medium">End of {d.label}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-0.5 w-3 rounded-full bg-(--series-1)" />
                    {formatINR(d.pipelineValue)}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="pipelineValue"
            stroke="var(--color-pipelineValue)"
            strokeWidth={2}
            fill="var(--color-pipelineValue)"
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ChartContainer>
      {/* sr-only on a wrapper: tables ignore the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>Open pipeline value at month end</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Open pipeline</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{formatINRShort(d.pipelineValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
