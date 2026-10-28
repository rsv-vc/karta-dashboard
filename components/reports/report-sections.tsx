import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_LABELS } from "@/lib/constants";
import type { MonthlyReport, SummaryRow } from "@/lib/reports/monthly";
import { cn, formatDate, formatINR, formatINRShort } from "@/lib/utils";

const NUM = "text-right tabular-nums";
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

function formatMetric(row: SummaryRow, value: number | null): string {
  if (value === null) return "—";
  if (row.kind === "currency") return formatINRShort(value);
  if (row.kind === "percent") return pct(value);
  return String(value);
}

/** Signed change with a direction icon; percent rows change in percentage points. Never color alone. */
function Change({ row }: { row: SummaryRow }) {
  if (row.value === null || row.compare === null) return <span className="text-muted-foreground">—</span>;
  const diff = row.value - row.compare;
  const Icon = diff > 0 ? ArrowUpRightIcon : diff < 0 ? ArrowDownRightIcon : MinusIcon;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const magnitude = Math.abs(diff);
  const text =
    row.kind === "percent"
      ? `${sign}${Math.round(magnitude * 100)} pts`
      : row.kind === "currency"
        ? `${sign}${formatINRShort(magnitude)}`
        : `${sign}${magnitude}`;
  const good = diff === 0 ? null : (diff > 0) === row.higherIsBetter;
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <Icon className="size-3.5" aria-hidden />
      {text}
      {good !== null && <span className="sr-only">{good ? "(improved)" : "(worse)"}</span>}
    </span>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="report-section">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** All sections of the monthly report; plain server-rendered tables that also print well. */
export function ReportSections({ report }: { report: MonthlyReport }) {
  const comparing = report.compareLabel !== null;

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Summary"
        description={comparing ? `${report.monthLabel} compared with ${report.compareLabel}.` : report.monthLabel}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">{report.monthLabel}</TableHead>
              {comparing && <TableHead className="text-right">{report.compareLabel}</TableHead>}
              {comparing && <TableHead className="text-right">Change</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.summary.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell className={cn(NUM, "font-medium")} title={row.kind === "currency" && row.value !== null ? formatINR(row.value) : undefined}>
                  {formatMetric(row, row.value)}
                </TableCell>
                {comparing && <TableCell className={cn(NUM, "text-muted-foreground")}>{formatMetric(row, row.compare)}</TableCell>}
                {comparing && (
                  <TableCell className={NUM}>
                    <Change row={row} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="By agent" description="Closed and created in the month. Activities = calls, emails and meetings logged.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Discoveries</TableHead>
              <TableHead className="text-right">POCs</TableHead>
              <TableHead className="text-right">Won</TableHead>
              <TableHead className="text-right">Won value</TableHead>
              <TableHead className="text-right">Lost</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
              <TableHead className="text-right">Activities</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.agents.map((a) => (
              <TableRow key={a.agentId}>
                <TableCell className="whitespace-nowrap">{a.name}</TableCell>
                <TableCell className={NUM}>{a.newLeads}</TableCell>
                <TableCell className={NUM}>{a.discoveries}</TableCell>
                <TableCell className={NUM}>{a.pocs}</TableCell>
                <TableCell className={NUM}>{a.won}</TableCell>
                <TableCell className={NUM}>{formatINRShort(a.wonValue)}</TableCell>
                <TableCell className={NUM}>{a.lost}</TableCell>
                <TableCell className={NUM}>{pct(a.winRate)}</TableCell>
                <TableCell className={NUM}>{a.activities}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="By source">
        {report.sources.length === 0 ? (
          <Empty>No new leads or wins in {report.monthLabel}.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">New leads</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Won value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.sources.map((s) => (
                <TableRow key={s.label}>
                  <TableCell>{s.label}</TableCell>
                  <TableCell className={NUM}>{s.newLeads}</TableCell>
                  <TableCell className={NUM}>{s.won}</TableCell>
                  <TableCell className={NUM}>{formatINRShort(s.wonValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Won deals · ${report.wonDeals.length}`}>
          {report.wonDeals.length === 0 ? (
            <Empty>No deals won in {report.monthLabel}.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.wonDeals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/leads/${d.id}`} className="font-medium hover:underline">
                        {d.companyName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{d.ownerName}</TableCell>
                    <TableCell className={NUM}>{formatINRShort(d.dealValue)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatDate(d.closedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section title={`Lost deals · ${report.lostDeals.length}`}>
          {report.lostDeals.length === 0 ? (
            <Empty>No deals lost in {report.monthLabel}.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Lost at</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.lostDeals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/leads/${d.id}`} className="font-medium hover:underline">
                        {d.companyName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{d.ownerName}</TableCell>
                    <TableCell>{d.stageLostAt ? STAGE_LABELS[d.stageLostAt] : "—"}</TableCell>
                    <TableCell className="min-w-40 text-muted-foreground">{d.reason ?? "Not recorded"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatDate(d.closedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}
