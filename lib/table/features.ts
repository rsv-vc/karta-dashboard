import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

// One shared TanStack Table v9 feature registry for every list in the app.
// Filtering is done by our own pure functions (lib/leads/filters.ts) before
// rows reach the table, so only sorting, pagination and visibility live here.

export interface AppColumnMeta {
  /** Extra classes for the header and body cells (alignment, width). */
  className?: string;
  /** Human label for the "Columns" visibility menu. */
  label?: string;
}

export const appTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnVisibilityFeature,
  columnMeta: {} as AppColumnMeta,
});

export type AppTableFeatures = typeof appTableFeatures;

export const PAGE_SIZES = [10, 20, 50] as const;
