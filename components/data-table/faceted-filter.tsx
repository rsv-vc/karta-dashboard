"use client";

import { CheckIcon, PlusCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface FacetOption<T extends string> {
  value: T;
  label: string;
  /** Full Tailwind class for a colored dot, e.g. "bg-blue-500". */
  dotClass?: string;
}

/** Multi-select filter with per-option counts (shadcn "tasks" pattern). */
export function FacetedFilter<T extends string>({
  title,
  options,
  selected,
  counts,
  onChange,
}: {
  title: string;
  options: readonly FacetOption<T>[];
  selected: readonly T[];
  counts: Record<string, number>;
  onChange: (next: T[]) => void;
}) {
  const selectedSet = new Set<string>(selected);

  function toggle(value: T) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // Keep the options' canonical order so URLs are stable.
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed pointer-coarse:h-11">
          <PlusCircleIcon />
          {title}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 data-vertical:h-4 data-vertical:self-center" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selected.length}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selected.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((o) => selectedSet.has(o.value))
                    .map((o) => (
                      <Badge key={o.value} variant="secondary" className="rounded-sm px-1 font-normal">
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3 text-current" />}
                    </div>
                    {option.dotClass && <span className={cn("size-2 rounded-full", option.dotClass)} />}
                    <span>{option.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                      {counts[option.value] ?? 0}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center text-center">
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
