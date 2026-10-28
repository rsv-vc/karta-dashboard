"use client";

import type { Column, RowData } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppTableFeatures } from "@/lib/table/features";

/** Header label that toggles sorting; plain text for unsortable columns. */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<AppTableFeatures, TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) return <span className={className}>{title}</span>;

  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ChevronsUpDownIcon;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2.5 h-7 data-[sorted=true]:text-foreground", className)}
      data-sorted={Boolean(sorted)}
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      <Icon className={cn("size-3.5", !sorted && "text-muted-foreground/60")} />
    </Button>
  );
}
