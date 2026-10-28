"use client";

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { UserAvatar } from "@/components/auth/user-avatar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { StageBadge } from "@/components/shared/stage-badge";
import { PRIORITIES, SOURCE_LABELS, STAGES } from "@/lib/constants";
import type { LeadRow } from "@/lib/leads/rows";
import type { AppTableFeatures } from "@/lib/table/features";
import { formatDate, formatINR, formatINRShort } from "@/lib/utils";

const helper = createColumnHelper<AppTableFeatures, LeadRow>();

const STAGE_RANK = Object.fromEntries(STAGES.map((s, i) => [s.value, i]));
const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, i]));

export const LEAD_SORTABLE_IDS = [
  "company",
  "stage",
  "priority",
  "dealValue",
  "owner",
  "nextFollowUp",
  "lastContact",
  "source",
  "createdAt",
] as const;

/** Column set for the lead list. The owner column exists only for admins. */
export function getLeadColumns(showOwner: boolean) {
  const columns = helper.columns([
    helper.accessor("companyName", {
      id: "company",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
      cell: ({ row }) => (
        <div className="min-w-44">
          <Link href={`/leads/${row.original.id}`} className="font-medium hover:underline">
            {row.original.companyName}
          </Link>
          <div className="text-xs text-muted-foreground">
            {row.original.industry} · {row.original.city}
          </div>
        </div>
      ),
      sortFn: "text",
      enableHiding: false,
      meta: { label: "Company" },
    }),
    helper.accessor("pocName", {
      id: "poc",
      header: "POC",
      cell: ({ row }) => (
        <div className="min-w-32">
          <div>{row.original.pocName}</div>
          <div className="text-xs text-muted-foreground">{row.original.pocDesignation}</div>
        </div>
      ),
      enableSorting: false,
      meta: { label: "POC" },
    }),
    // Sort by pipeline position (new → won, lost last), not alphabetically.
    helper.accessor((r) => STAGE_RANK[r.stage], {
      id: "stage",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stage" />,
      cell: ({ row }) => <StageBadge stage={row.original.stage} />,
      sortFn: "basic",
      meta: { label: "Stage" },
    }),
    helper.accessor((r) => PRIORITY_RANK[r.priority], {
      id: "priority",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      sortFn: "basic",
      meta: { label: "Priority" },
    }),
    helper.accessor("dealValue", {
      id: "dealValue",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Deal value" className="ml-auto" />,
      cell: ({ row }) => (
        <span className="tabular-nums" title={formatINR(row.original.dealValue)}>
          {formatINRShort(row.original.dealValue)}
        </span>
      ),
      sortFn: "basic",
      meta: { label: "Deal value", className: "text-right" },
    }),
    helper.accessor("ownerName", {
      id: "owner",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <UserAvatar name={row.original.ownerName} className="size-6" />
          {row.original.ownerName}
        </div>
      ),
      sortFn: "text",
      meta: { label: "Owner" },
    }),
    // ISO strings sort correctly as text; leads without a date go last either way.
    helper.accessor((r) => r.nextFollowUpAt ?? undefined, {
      id: "nextFollowUp",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Next follow-up" />,
      cell: ({ row }) => <FollowUpLabel date={row.original.nextFollowUpAt} />,
      sortFn: "text",
      sortUndefined: "last",
      meta: { label: "Next follow-up" },
    }),
    helper.accessor((r) => r.lastContactedAt ?? undefined, {
      id: "lastContact",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last contact" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {row.original.lastContactedAt ? formatDate(row.original.lastContactedAt) : "Never"}
        </span>
      ),
      sortFn: "text",
      sortUndefined: "last",
      meta: { label: "Last contact" },
    }),
    helper.accessor((r) => SOURCE_LABELS[r.source], {
      id: "source",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
      cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span>,
      sortFn: "text",
      meta: { label: "Source" },
    }),
    helper.accessor("createdAt", {
      id: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
      sortFn: "text",
      meta: { label: "Created" },
    }),
  ]);
  return showOwner ? columns : columns.filter((c) => c.id !== "owner");
}
