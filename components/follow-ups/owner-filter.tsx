"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/** Admin-only owner picker, kept in the URL as ?owner=. */
export function OwnerFilter({ value, options }: { value: string | null; options: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => router.replace(v === ALL ? pathname : `${pathname}?owner=${v}`, { scroll: false })}
    >
      <SelectTrigger className="w-44" aria-label="Filter by owner">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All agents</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
