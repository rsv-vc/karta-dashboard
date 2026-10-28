import Link from "next/link";
import { UserAvatar } from "@/components/auth/user-avatar";
import { TargetMeter } from "@/components/dashboard/target-meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { TeamMember } from "@/lib/data/leads";
import { cn, formatDate, formatINRShort } from "@/lib/utils";

/** One agent's month at a glance: targets, workload and shortcuts to their lists. */
export function AgentCard({ member }: { member: TeamMember }) {
  const { kpis, target } = member.dashboard;
  const stats = [
    { label: "Active", value: kpis.openPipeline.count },
    { label: "Pipeline", value: formatINRShort(kpis.openPipeline.value) },
    { label: "Overdue", value: kpis.followUpsDue.overdue, alert: kpis.followUpsDue.overdue > 0 },
    { label: "Stale", value: member.stale },
  ];

  return (
    <Card id={member.id} className="scroll-mt-20">
      <CardHeader className="flex flex-row items-center gap-3">
        <UserAvatar name={member.name} className="size-10" />
        <div className="min-w-0">
          <div className="truncate font-medium">{member.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {member.email} · joined {formatDate(member.joinedAt)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-4 gap-2 text-center">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/50 px-1 py-2">
              <dd className={cn("text-base font-semibold", s.alert && "text-red-600 dark:text-red-400")}>{s.value}</dd>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
        <TargetMeter label={`Won in ${target.monthLabel}`} actual={target.wonValue.actual} target={target.wonValue.target} format={formatINRShort} />
        <TargetMeter label={`New leads in ${target.monthLabel}`} actual={target.newLeads.actual} target={target.newLeads.target} format={String} />
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/leads?owner=${member.id}`}>View leads</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/follow-ups?owner=${member.id}`}>Follow-ups</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
