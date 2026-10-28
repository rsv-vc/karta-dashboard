"use client";

import { createColumnHelper, useTable, type SortingState, type Updater } from "@tanstack/react-table";
import { InfoIcon, SearchXIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { FacetedFilter, type FacetOption } from "@/components/data-table/faceted-filter";
import { FilterSheet } from "@/components/data-table/filter-sheet";
import { SearchInput } from "@/components/data-table/search-input";
import { useListUrlState } from "@/components/data-table/use-list-url-state";
import { DirectoryCardList } from "@/components/leads/lead-cards";
import { StageBadge } from "@/components/shared/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAGES } from "@/lib/constants";
import { DEFAULT_FILTERS, facetCounts, facetSelectionCount, filterLeadRows, hasActiveFilters } from "@/lib/leads/filters";
import type { DirectoryRow } from "@/lib/leads/rows";
import { appTableFeatures, type AppTableFeatures } from "@/lib/table/features";
import type { LeadStage } from "@/types/lead";

const helper = createColumnHelper<AppTableFeatures, DirectoryRow>();
const STAGE_RANK = Object.fromEntries(STAGES.map((s, i) => [s.value, i]));
const DEFAULT_SORT: SortingState = [{ id: "company", desc: false }];
const SORTABLE_IDS = ["company", "owner", "stage"] as const;
const STAGE_OPTIONS: FacetOption<LeadStage>[] = STAGES.map((s) => ({ value: s.value, label: s.label, dotClass: s.dotClass }));

// Only the viewer's own rows link anywhere; everyone else's are read-only entries.
const columns = helper.columns([
  helper.accessor("companyName", {
    id: "company",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
    cell: ({ row }) =>
      row.original.isMine ? (
        <Link href={`/leads/${row.original.id}`} className="font-medium hover:underline">
          {row.original.companyName}
        </Link>
      ) : (
        <span className="font-medium">{row.original.companyName}</span>
      ),
    sortFn: "text",
  }),
  helper.accessor("pocName", { id: "poc", header: "POC", enableSorting: false }),
  helper.accessor("ownerName", {
    id: "owner",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <UserAvatar name={row.original.ownerName} className="size-6" />
        {row.original.ownerName}
        {row.original.isMine && <Badge variant="secondary">You</Badge>}
      </div>
    ),
    sortFn: "text",
  }),
  helper.accessor((r) => STAGE_RANK[r.stage], {
    id: "stage",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Stage" />,
    cell: ({ row }) => <StageBadge stage={row.original.stage} />,
    sortFn: "basic",
  }),
]);

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

/** Masked, team-wide list of who is working which company. */
export function DirectoryTable({ rows, ownerOptions }: { rows: DirectoryRow[]; ownerOptions: { id: string; name: string }[] }) {
  const { filters, sorting, pagination, setFilters, setSorting, setPagination } = useListUrlState({
    defaultSort: DEFAULT_SORT,
    sortableIds: SORTABLE_IDS,
  });
  const filtered = useMemo(() => filterLeadRows(rows, filters), [rows, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pagination.pageSize));
  const safePagination = { ...pagination, pageIndex: Math.min(pagination.pageIndex, pageCount - 1) };

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: filtered,
    state: { sorting, pagination: safePagination },
    onSortingChange: (u) => setSorting(resolve(u, sorting)),
    onPaginationChange: (u) => setPagination(resolve(u, safePagination)),
    enableSortingRemoval: false,
    enableMultiSort: false,
    autoResetPageIndex: false,
  });

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  const noMatches = (
    <div className="flex flex-col items-center gap-2 text-center">
      <SearchXIcon className="size-6 text-muted-foreground" />
      <p className="font-medium">No one is working this company yet</p>
      <p className="text-sm text-muted-foreground">You are clear to add it as a new lead.</p>
      <Button asChild size="sm">
        <Link href="/leads/new">Add lead</Link>
      </Button>
    </div>
  );

  // Inline on wider screens, in the bottom sheet on phones.
  const facets = (
    <>
      <FacetedFilter
        title="Stage"
        options={STAGE_OPTIONS}
        selected={filters.stages}
        counts={facetCounts(rows, filters, "stages")}
        onChange={(stages) => setFilters({ ...filters, stages })}
      />
      <FacetedFilter
        title="Owner"
        options={ownerOptions.map((o) => ({ value: o.id, label: o.name }))}
        selected={filters.owners}
        counts={facetCounts(rows, filters, "owners")}
        onChange={(owners) => setFilters({ ...filters, owners })}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        Contact details and deal values are only visible to the lead owner. Search here before adding a lead to avoid
        chasing a company a teammate is already working.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.q}
          onChange={(q) => setFilters({ ...filters, q })}
          placeholder="Search companies or POCs…"
        />
        <div className="hidden md:contents">{facets}</div>
        <FilterSheet activeCount={facetSelectionCount(filters)} onReset={reset}>
          {facets}
        </FilterSheet>
        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" className="hidden h-8 md:inline-flex" onClick={reset}>
            Reset
            <XIcon />
          </Button>
        )}
        <p className="ml-auto text-sm text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length} companies
        </p>
      </div>

      <DataTable
        className="hidden md:block"
        table={table}
        getRowHref={(row) => (row.isMine ? `/leads/${row.id}` : null)}
        emptyState={noMatches}
      />
      <DirectoryCardList className="md:hidden" rows={table.getRowModel().rows.map((r) => r.original)} empty={noMatches} />
      <DataTablePagination table={table} />
    </div>
  );
}
