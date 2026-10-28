"use client";

import type { PaginationState, SortingState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseLeadFilters, serializeLeadFilters, type LeadFilters } from "@/lib/leads/filters";
import { PAGE_SIZES } from "@/lib/table/features";

// The URL is the source of truth for list state, so filtered views can be
// bookmarked, shared and survive reloads (e.g. /leads?followUp=overdue).

export interface ListState {
  filters: LeadFilters;
  sorting: SortingState;
  pagination: PaginationState;
}

interface Options {
  defaultSort: SortingState;
  defaultPageSize?: number;
  /** Column ids that may be sorted; anything else in ?sort= is ignored. */
  sortableIds: readonly string[];
}

function parseSort(raw: string | null, sortableIds: readonly string[], fallback: SortingState): SortingState {
  const [id, dir] = (raw ?? "").split(".");
  if (!id || !sortableIds.includes(id) || (dir !== "asc" && dir !== "desc")) return fallback;
  return [{ id, desc: dir === "desc" }];
}

function sameSort(a: SortingState, b: SortingState): boolean {
  return a.length === b.length && a.every((s, i) => s.id === b[i].id && s.desc === b[i].desc);
}

export function useListUrlState({ defaultSort, defaultPageSize = 20, sortableIds }: Options) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo<ListState>(() => {
    const size = Number(searchParams.get("size"));
    const page = Number(searchParams.get("page"));
    return {
      filters: parseLeadFilters(searchParams),
      sorting: parseSort(searchParams.get("sort"), sortableIds, defaultSort),
      pagination: {
        pageIndex: Number.isInteger(page) && page > 1 ? page - 1 : 0,
        pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : defaultPageSize,
      },
    };
  }, [searchParams, sortableIds, defaultSort, defaultPageSize]);

  /** Writes a complete state to the URL, omitting defaults to keep it clean. */
  const write = useCallback(
    (next: ListState) => {
      const params = serializeLeadFilters(next.filters);
      const sort = next.sorting[0];
      if (sort && !sameSort(next.sorting, defaultSort)) params.set("sort", `${sort.id}.${sort.desc ? "desc" : "asc"}`);
      if (next.pagination.pageIndex > 0) params.set("page", String(next.pagination.pageIndex + 1));
      if (next.pagination.pageSize !== defaultPageSize) params.set("size", String(next.pagination.pageSize));
      // Commas are safe in a query string; keep them readable (?stage=new,won).
      const query = params.toString().replace(/%2C/g, ",");
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, defaultSort, defaultPageSize],
  );

  /** Changing filters always returns to the first page. */
  const setFilters = useCallback(
    (filters: LeadFilters) => write({ ...state, filters, pagination: { ...state.pagination, pageIndex: 0 } }),
    [state, write],
  );
  const setSorting = useCallback((sorting: SortingState) => write({ ...state, sorting }), [state, write]);
  const setPagination = useCallback((pagination: PaginationState) => write({ ...state, pagination }), [state, write]);

  return { ...state, setFilters, setSorting, setPagination };
}
