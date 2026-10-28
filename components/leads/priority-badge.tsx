import { PRIORITY_LABELS, PRIORITY_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LeadPriority } from "@/types/lead";

/** Colored dot + label; quieter than a filled badge so it does not compete with stage. */
export function PriorityBadge({ priority, className }: { priority: LeadPriority; className?: string }) {
  const style = PRIORITY_STYLES[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", style.textClass, className)}>
      <span className={cn("size-2 rounded-full", style.dotClass)} aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
