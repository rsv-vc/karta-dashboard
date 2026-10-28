import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StageBadge } from "@/components/shared/stage-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockLeads } from "@/data/mock-leads";
import { demoAgents, mockUsers } from "@/data/mock-users";
import { STAGES } from "@/lib/constants";
import {
  findPossibleDuplicates,
  getDirectory,
  getFollowUpsDue,
  getLeadsByOwner,
  getMonthlySummary,
  getStageCounts,
} from "@/lib/selectors";
import { formatDate, formatINR, formatINRShort, formatMonth } from "@/lib/utils";
import { validateLeads } from "@/lib/validation";

// Dev-only page for eyeballing the mock data and selector output.

export const metadata: Metadata = { title: "Data check (dev)" };

function ownerName(id: string): string {
  return mockUsers.find((u) => u.id === id)?.name ?? id;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ValidationSection() {
  const { valid, errors } = validateLeads(mockLeads, { seedRules: true, team: mockUsers });
  if (valid) {
    return (
      <p className="rounded-lg border border-green-300 bg-green-50 p-3 font-medium text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
        ✓ All {mockLeads.length} leads valid
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      <p className="font-medium">✗ {errors.length} problems found</p>
      <ul className="mt-2 list-disc pl-5">
        {errors.map((e, i) => (
          <li key={i}>
            {e.leadId} {e.companyName}: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageCounts() {
  const counts = getStageCounts(mockLeads);
  return (
    <div className="flex flex-wrap gap-4">
      {STAGES.map((s) => (
        <div key={s.value} className="flex items-center gap-2">
          <StageBadge stage={s.value} />
          <span className="font-medium tabular-nums">{counts[s.value]}</span>
          <span className="text-muted-foreground tabular-nums">
            ({Math.round((counts[s.value] / mockLeads.length) * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function AgentTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agent</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">Won</TableHead>
          <TableHead className="text-right">Lost</TableHead>
          <TableHead className="text-right">Won value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {demoAgents().map((agent) => {
          const leads = getLeadsByOwner(agent.id);
          const won = leads.filter((l) => l.stage === "won");
          return (
            <TableRow key={agent.id}>
              <TableCell>{agent.name}</TableCell>
              <TableCell className="text-right tabular-nums">{leads.length}</TableCell>
              <TableCell className="text-right tabular-nums">{won.length}</TableCell>
              <TableCell className="text-right tabular-nums">{leads.filter((l) => l.stage === "lost").length}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatINR(won.reduce((sum, l) => sum + l.dealValue, 0))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MonthlyTable() {
  const rows = getMonthlySummary({ year: 2026, month: 5 }, { year: 2026, month: 10 });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">New</TableHead>
          <TableHead className="text-right">Discoveries</TableHead>
          <TableHead className="text-right">POCs</TableHead>
          <TableHead className="text-right">Won</TableHead>
          <TableHead className="text-right">Lost</TableHead>
          <TableHead className="text-right">Win rate</TableHead>
          <TableHead className="text-right">Won value</TableHead>
          <TableHead className="text-right">Pipeline (month end)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell>{formatMonth(r.key)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.newLeads}</TableCell>
            <TableCell className="text-right tabular-nums">{r.discoveries}</TableCell>
            <TableCell className="text-right tabular-nums">{r.pocs}</TableCell>
            <TableCell className="text-right tabular-nums">{r.won}</TableCell>
            <TableCell className="text-right tabular-nums">{r.lost}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.winRate === null ? "—" : `${Math.round(r.winRate * 100)}%`}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(r.wonValue)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatINRShort(r.pipelineValue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecentLeadsTable() {
  const leads = [...mockLeads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>POC</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead className="text-right">Deal value</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="font-medium">{l.companyName}</TableCell>
            <TableCell>{l.pocName}</TableCell>
            <TableCell>{ownerName(l.ownerId)}</TableCell>
            <TableCell>
              <StageBadge stage={l.stage} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(l.dealValue)}</TableCell>
            <TableCell>{formatDate(l.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FollowUpSummary() {
  const { overdue, today, upcoming } = getFollowUpsDue();
  const items = [
    { label: "Overdue", count: overdue.length, className: "text-red-700 dark:text-red-400" },
    { label: "Due today", count: today.length, className: "text-amber-700 dark:text-amber-400" },
    { label: "Upcoming", count: upcoming.length, className: "text-foreground" },
  ];
  return (
    <div className="flex flex-wrap gap-8">
      {items.map((item) => (
        <div key={item.label}>
          <div className={`text-2xl font-semibold tabular-nums ${item.className}`}>{item.count}</div>
          <div className="text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function DuplicatesTable() {
  const matches = findPossibleDuplicates("Zenith Retail");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="font-mono text-xs">{l.id}</TableCell>
            <TableCell>{l.companyName}</TableCell>
            <TableCell>{ownerName(l.ownerId)}</TableCell>
            <TableCell>
              <StageBadge stage={l.stage} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DirectorySample() {
  const sample = getDirectory().slice(0, 5);
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(sample, null, 2)}</pre>
  );
}

export default function DevDataPage() {
  // Developer tool only: it lists every lead in full, so production builds hide it.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Dev only — remove before production
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Mock data check</h1>
        <p className="text-muted-foreground">
          {mockLeads.length} leads, {demoAgents().length} agents. TODAY is fixed at 28 Oct 2026.
        </p>
      </div>

      <Section title="Validation">
        <ValidationSection />
      </Section>

      <Section title="Leads per stage" description={`${mockLeads.length} leads in total`}>
        <StageCounts />
      </Section>

      <Section title="Leads per agent">
        <AgentTable />
      </Section>

      <Section
        title="Month on month (May–Oct 2026)"
        description="Event-based: discoveries/POCs count accounts first reaching that stage or beyond in the month; won/lost by close date."
      >
        <MonthlyTable />
      </Section>

      <Section title="10 most recent leads">
        <RecentLeadsTable />
      </Section>

      <Section title="Follow-ups (all agents)">
        <FollowUpSummary />
      </Section>

      <Section title='findPossibleDuplicates("Zenith Retail")'>
        <DuplicatesTable />
      </Section>

      <Section title="getDirectory() sample" description="Masked view: only these 5 fields leave the server for other agents' leads.">
        <DirectorySample />
      </Section>
    </main>
  );
}
