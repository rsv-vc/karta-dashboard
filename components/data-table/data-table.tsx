"use client";

import type { ReactTable, RowData } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AppTableFeatures } from "@/lib/table/features";

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/** Ignore row clicks that land on a link, button or input inside the row. */
function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a, button, input, [role=checkbox]") !== null;
}

/**
 * Renders a TanStack Table v9 instance with shadcn table markup. Rows become
 * clickable when `getRowHref` returns a URL; the primary cell should also hold a
 * real <Link> for keyboard and screen-reader users.
 */
export function DataTable<TData extends RowData>({
  table,
  getRowHref,
  emptyState,
  className,
  label = "Results",
}: {
  table: ReactTable<AppTableFeatures, TData>;
  getRowHref?: (row: TData) => string | null;
  emptyState?: ReactNode;
  className?: string;
  /** Names the scroll area for keyboard and screen-reader users. */
  label?: string;
}) {
  const router = useRouter();
  const rows = table.getRowModel().rows;

  return (
    <div className={cn("overflow-x-auto rounded-xl border", className)}>
      <Table scrollLabel={label}>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted ? ARIA_SORT[sorted] : undefined}
                    className={cn("whitespace-nowrap", header.column.columnDef.meta?.className)}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-48">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const href = getRowHref?.(row.original) ?? null;
              const onClick = href
                ? (e: MouseEvent<HTMLTableRowElement>) => {
                    if (!isInteractive(e.target)) router.push(href);
                  }
                : undefined;
              return (
                <TableRow key={row.id} onClick={onClick} className={cn(href && "cursor-pointer")}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
