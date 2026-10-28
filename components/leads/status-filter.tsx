"use client";

import { Button } from "@/components/ui/button";
import type { StatusFilter as Status } from "@/lib/leads/filters";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

/** Segmented All / Active / Closed control. */
export function StatusFilter({ value, onChange }: { value: Status; onChange: (value: Status) => void }) {
  return (
    <div role="group" aria-label="Lead status" className="inline-flex rounded-lg border p-0.5">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          variant="ghost"
          size="sm"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 px-2.5", value === o.value && "bg-muted text-foreground")}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
