"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Phones: the list filters in a bottom sheet behind one "Filters · N" button.
 * Filters apply as they change (they live in the URL), so Done only closes.
 */
export function FilterSheet({
  activeCount,
  onReset,
  children,
}: {
  activeCount: number;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 pointer-coarse:h-11 md:hidden">
          <SlidersHorizontalIcon />
          Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>The list updates as you choose.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 [&_button]:w-full [&_button]:justify-start">{children}</div>
        <SheetFooter className="flex-row pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="flex-1 pointer-coarse:h-11" onClick={onReset} disabled={activeCount === 0}>
            Reset
          </Button>
          <SheetTrigger asChild>
            <Button className="flex-1 pointer-coarse:h-11">Done</Button>
          </SheetTrigger>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
