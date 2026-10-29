"use client";

import { useTable, type ColumnVisibilityState, type SortingState, type Updater } from "@tanstack/react-table";
import { DownloadIcon, PlusIcon, SearchXIcon, UsersIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { FacetedFilter, type FacetOption } from "@/components/data-table/faceted-filter";
import { FilterSheet } from "@/components/data-table/filter-sheet";
import { SearchInput } from "@/components/data-table/search-input";
import { useListUrlState } from "@/components/data-table/use-list-url-state";
import { StatusFilter } from "@/components/leads/status-filter";
import { LeadCardList } from "@/components/leads/lead-cards";
import { LEAD_SORTABLE_IDS, getLeadColumns } from "@/components/leads/lead-columns";
import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/components/config/config-provider";
import { SOURCES, SOURCE_LABELS, STAGES, isActiveStage } from "@/lib/constants";
import { BANDS, type Band } from "@/lib/scoring";
import {
  DEFAULT_FILTERS,
  FOLLOW_UP_BUCKETS,
  FOLLOW_UP_LABELS,
  facetCounts,
  facetSelectionCount,
  filterLeadRows,
  hasActiveFilters,
  serializeLeadFilters,
  type FollowUpBucket,
} from "@/lib/leads/filters";
import type { LeadRow } from "@/lib/leads/rows";
import { appTableFeatures } from "@/lib/table/features";
import { formatNumber } from "@/lib/utils";
import type { LeadSource, LeadStage } from "@/types/lead";

// Most urgent first: overdue follow-ups at the top, leads without one at the bottom.
const DEFAULT_SORT: SortingState = [{ id: "nextFollowUp", desc: false }];

const BAND_OPTIONS: FacetOption<Band>[] = BANDS.map((b) => ({ value: b.value, label: `${b.label} (${b.min}+)` }));
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

  const config = useAppConfig();
  const stageOptions: FacetOption<LeadStage>[] = STAGES.map((s) => ({ value: s.value, label: config.stages[s.value].label, dotClass: s.dotClass }));
  const segmentOptions: FacetOption<string>[] = config.industries.map((i) => ({ value: i.name, label: i.name }));
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

  const open = filtered.filter((r) => isActiveStage(r.stage));
  const openVolume = open.reduce((sum, r) => sum + (r.volume ?? 0), 0);
  const filtering = hasActiveFilters(filters);
  const ownerFacet = ownerOptions.map((o) => ({ value: o.id, label: o.name }));

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  const noMatches = (
    <div className="flex flex-col items-center gap-2 text-center">
      <SearchXIcon className="size-6 text-muted-foreground" />
      <p className="font-medium">No leads match these filters</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Reset filters
      </Button>
    </div>
  );

  // Inline on wider screens, in the bottom sheet on phones.
  const facets = (
    <>
      <FacetedFilter
        title="Stage"
        options={stageOptions}
        selected={filters.stages}
        counts={facetCounts(rows, filters, "stages")}
        onChange={(stages) => setFilters({ ...filters, stages })}
      />
      <FacetedFilter
        title="Band"
        options={BAND_OPTIONS}
        selected={filters.bands}
        counts={facetCounts(rows, filters, "bands")}
        onChange={(bands) => setFilters({ ...filters, bands })}
      />
      <FacetedFilter
        title="Segment"
        options={segmentOptions}
        selected={filters.segments}
        counts={facetCounts(rows, filters, "segments")}
        onChange={(segments) => setFilters({ ...filters, segments })}
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
    </>
  );

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
        <div className="hidden md:contents">{facets}</div>
        <FilterSheet activeCount={facetSelectionCount(filters)} onReset={reset}>
          {facets}
        </FilterSheet>
        {filtering && (
          <Button variant="ghost" size="sm" className="hidden h-8 md:inline-flex" onClick={reset}>
            Reset
            <XIcon />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <StatusFilter value={filters.status} onChange={(status) => setFilters({ ...filters, status })} />
          <div className="hidden md:block">
            <DataTableViewOptions table={table} />
          </div>
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
        <span className="tabular-nums">{rows.length}</span> accounts · <span className="font-medium text-foreground tabular-nums">{open.length}</span> open
        {openVolume > 0 && (
          <>
            {" "}· <span className="font-medium text-foreground tabular-nums">{formatNumber(openVolume)}</span> open minutes / month
          </>
        )}
      </p>

      <DataTable className="hidden md:block" label="Accounts" table={table} getRowHref={(row) => `/leads/${row.id}`} emptyState={noMatches} />
      <LeadCardList
        className="md:hidden"
        rows={table.getRowModel().rows.map((r) => r.original)}
        showOwner={showOwner}
        empty={noMatches}
      />

      <DataTablePagination table={table} />
    </div>
  );
}
