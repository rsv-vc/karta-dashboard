"use client";

import { createColumnHelper, useTable, type SortingState, type Updater } from "@tanstack/react-table";
import { InfoIcon, SearchXIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { UserAvatar } from "@/components/auth/user-avatar";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { FacetedFilter } from "@/components/data-table/faceted-filter";
import { FilterSheet } from "@/components/data-table/filter-sheet";
import { SearchInput } from "@/components/data-table/search-input";
import { useListUrlState } from "@/components/data-table/use-list-url-state";
import { DirectoryCardList } from "@/components/leads/lead-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_FILTERS, facetCounts, facetSelectionCount, filterLeadRows, hasActiveFilters } from "@/lib/leads/filters";
import type { DirectoryRow } from "@/lib/leads/rows";
import { appTableFeatures, type AppTableFeatures } from "@/lib/table/features";

const helper = createColumnHelper<AppTableFeatures, DirectoryRow>();
const DEFAULT_SORT: SortingState = [{ id: "company", desc: false }];
const SORTABLE_IDS = ["company", "owner"] as const;

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
]);

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

/** All leads for a sales agent: who is working which company (company, POC and owner only). */
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
        You see the company, contact and owner of every account. Your own accounts, in full, are under My leads. Search
        here before adding a lead to avoid chasing a company a teammate is already working.
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
        label="All leads"
        table={table}
        getRowHref={(row) => (row.isMine ? `/leads/${row.id}` : null)}
        emptyState={noMatches}
      />
      <DirectoryCardList className="md:hidden" rows={table.getRowModel().rows.map((r) => r.original)} empty={noMatches} />
      <DataTablePagination table={table} />
    </div>
  );
}
