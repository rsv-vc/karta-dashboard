import { AlertCircleIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LeaderboardRow, SourceRow } from "@/lib/dashboard/team-metrics";
import { cn, formatINR, formatINRShort } from "@/lib/utils";

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
const NUM = "text-right tabular-nums";

/** Per-agent performance for the selected period, top performer first. */
export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const topId = rows[0] && rows[0].wonValue > 0 ? rows[0].agentId : null;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Active</TableHead>
            <TableHead className="text-right">Open pipeline</TableHead>
            <TableHead className="text-right">New</TableHead>
            <TableHead className="text-right">Won</TableHead>
            <TableHead className="text-right">Won value</TableHead>
            <TableHead className="text-right">Win rate</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
            <TableHead className="text-right">Stale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.agentId}>
              <TableCell>
                <Link href={`/leads?owner=${r.agentId}`} className="flex items-center gap-2 whitespace-nowrap hover:underline">
                  <UserAvatar name={r.name} className="size-6" />
                  {r.name}
                  {r.agentId === topId && <Badge variant="secondary">Top</Badge>}
                </Link>
              </TableCell>
              <TableCell className={NUM}>{r.active}</TableCell>
              <TableCell className={NUM} title={formatINR(r.openPipeline)}>
                {formatINRShort(r.openPipeline)}
              </TableCell>
              <TableCell className={NUM}>{r.newLeads}</TableCell>
              <TableCell className={NUM}>
                {r.won}
                <span className="text-muted-foreground"> / {r.won + r.lost}</span>
              </TableCell>
              <TableCell className={NUM}>{formatINRShort(r.wonValue)}</TableCell>
              <TableCell className={NUM}>{pct(r.winRate)}</TableCell>
              <TableCell className={cn(NUM, r.overdue > 0 && "font-medium")}>
                <span className="inline-flex items-center gap-1">
                  {r.overdue > 0 && <AlertCircleIcon className="size-3.5 text-red-700 dark:text-red-400" aria-label="Has overdue" />}
                  {r.overdue}
                </span>
              </TableCell>
              <TableCell className={NUM}>
                <span className="inline-flex items-center gap-1">
                  {r.stale > 0 && <ClockIcon className="size-3.5 text-amber-700 dark:text-amber-400" aria-label="Has stale leads" />}
                  {r.stale}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Lead sources ranked by volume, with outcomes for the period. */
export function SourceTable({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">New leads</TableHead>
            <TableHead className="text-right">Won</TableHead>
            <TableHead className="text-right">Win rate</TableHead>
            <TableHead className="text-right">Open pipeline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.source}>
              <TableCell className="whitespace-nowrap">{s.label}</TableCell>
              <TableCell className={NUM}>{s.leads}</TableCell>
              <TableCell className={NUM}>
                {s.won}
                <span className="text-muted-foreground"> / {s.won + s.lost}</span>
              </TableCell>
              <TableCell className={NUM}>{pct(s.winRate)}</TableCell>
              <TableCell className={NUM}>{formatINRShort(s.openPipeline)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
