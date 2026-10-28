"use client";

import { useTable, type ColumnVisibilityState, type SortingState, type Updater } from "@tanstack/react-table";
import { DownloadIcon, PlusIcon, SearchXIcon, UsersIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { FacetedFilter, type FacetOption } from "@/components/data-table/faceted-filter";
import { SearchInput } from "@/components/data-table/search-input";
import { useListUrlState } from "@/components/data-table/use-list-url-state";
import { StatusFilter } from "@/components/leads/status-filter";
import { LEAD_SORTABLE_IDS, getLeadColumns } from "@/components/leads/lead-columns";
import { Button } from "@/components/ui/button";
import { PRIORITIES, PRIORITY_LABELS, PRIORITY_STYLES, SOURCES, SOURCE_LABELS, STAGES, isActiveStage } from "@/lib/constants";
import {
  DEFAULT_FILTERS,
  FOLLOW_UP_BUCKETS,
  FOLLOW_UP_LABELS,
  facetCounts,
  filterLeadRows,
  hasActiveFilters,
  serializeLeadFilters,
  type FollowUpBucket,
} from "@/lib/leads/filters";
import type { LeadRow } from "@/lib/leads/rows";
import { appTableFeatures } from "@/lib/table/features";
import { formatINRShort } from "@/lib/utils";
import type { LeadPriority, LeadSource, LeadStage } from "@/types/lead";

// Most urgent first: overdue follow-ups at the top, leads without one at the bottom.
const DEFAULT_SORT: SortingState = [{ id: "nextFollowUp", desc: false }];

const STAGE_OPTIONS: FacetOption<LeadStage>[] = STAGES.map((s) => ({ value: s.value, label: s.label, dotClass: s.dotClass }));
const PRIORITY_OPTIONS: FacetOption<LeadPriority>[] = PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABELS[p],
  dotClass: PRIORITY_STYLES[p].dotClass,
}));
const SOURCE_OPTIONS: FacetOption<LeadSource>[] = SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }));
const FOLLOW_UP_OPTIONS: FacetOption<FollowUpBucket>[] = FOLLOW_UP_BUCKETS.map((b) => ({
  value: b,
  label: FOLLOW_UP_LABELS[b],
}));

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

/** Filterable, sortable, paginated lead list. Filters, sort and page live in the URL. */
export function LeadsTable({
  rows,
  ownerOptions,
  showOwner,
}: {
  rows: LeadRow[];
  ownerOptions: { id: string; name: string }[];
  showOwner: boolean;
}) {
  const { filters, sorting, pagination, setFilters, setSorting, setPagination } = useListUrlState({
    defaultSort: DEFAULT_SORT,
    sortableIds: LEAD_SORTABLE_IDS,
  });
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({ source: false });

  const columns = useMemo(() => getLeadColumns(showOwner), [showOwner]);
  const filtered = useMemo(() => filterLeadRows(rows, filters), [rows, filters]);

  // A page that no longer exists after filtering falls back to the last real page.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pagination.pageSize));
  const safePagination = { ...pagination, pageIndex: Math.min(pagination.pageIndex, pageCount - 1) };

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: filtered,
    state: { sorting, pagination: safePagination, columnVisibility },
    onSortingChange: (u) => setSorting(resolve(u, sorting)),
    onPaginationChange: (u) => setPagination(resolve(u, safePagination)),
    onColumnVisibilityChange: setColumnVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
    autoResetPageIndex: false,
  });

  const openPipeline = filtered.filter((r) => isActiveStage(r.stage)).reduce((sum, r) => sum + r.dealValue, 0);
  const filtering = hasActiveFilters(filters);
  const ownerFacet = ownerOptions.map((o) => ({ value: o.id, label: o.name }));

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
        <UsersIcon className="size-8 text-muted-foreground" />
        <p className="font-medium">No leads yet</p>
        <Button asChild size="sm">
          <Link href="/leads/new">
            <PlusIcon />
            Add lead
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.q}
          onChange={(q) => setFilters({ ...filters, q })}
          placeholder="Search company, POC or city…"
        />
        <FacetedFilter
          title="Stage"
          options={STAGE_OPTIONS}
          selected={filters.stages}
          counts={facetCounts(rows, filters, "stages")}
          onChange={(stages) => setFilters({ ...filters, stages })}
        />
        <FacetedFilter
          title="Priority"
          options={PRIORITY_OPTIONS}
          selected={filters.priorities}
          counts={facetCounts(rows, filters, "priorities")}
          onChange={(priorities) => setFilters({ ...filters, priorities })}
        />
        <FacetedFilter
          title="Follow-up"
          options={FOLLOW_UP_OPTIONS}
          selected={filters.followUp}
          counts={facetCounts(rows, filters, "followUp")}
          onChange={(followUp) => setFilters({ ...filters, followUp })}
        />
        <FacetedFilter
          title="Source"
          options={SOURCE_OPTIONS}
          selected={filters.sources}
          counts={facetCounts(rows, filters, "sources")}
          onChange={(sources) => setFilters({ ...filters, sources })}
        />
        {showOwner && (
          <FacetedFilter
            title="Owner"
            options={ownerFacet}
            selected={filters.owners}
            counts={facetCounts(rows, filters, "owners")}
            onChange={(owners) => setFilters({ ...filters, owners })}
          />
        )}
        {filtering && (
          <Button variant="ghost" size="sm" className="h-8" onClick={reset}>
            Reset
            <XIcon />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <StatusFilter value={filters.status} onChange={(status) => setFilters({ ...filters, status })} />
          <DataTableViewOptions table={table} />
          {/* Same filters as the table; the server exports only leads you can see in full. */}
          <Button asChild variant="outline" size="sm" className="h-8">
            <a href={`/leads/export?${serializeLeadFilters(filters).toString()}`} download>
              <DownloadIcon />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> of{" "}
        <span className="tabular-nums">{rows.length}</span> leads ·{" "}
        <span className="font-medium text-foreground tabular-nums">{formatINRShort(openPipeline)}</span> open pipeline
      </p>

      <DataTable
        table={table}
        getRowHref={(row) => `/leads/${row.id}`}
        emptyState={
          <div className="flex flex-col items-center gap-2 text-center">
            <SearchXIcon className="size-6 text-muted-foreground" />
            <p className="font-medium">No leads match these filters</p>
            <Button variant="outline" size="sm" onClick={reset}>
              Reset filters
            </Button>
          </div>
        }
      />

      <DataTablePagination table={table} />
    </div>
  );
}
