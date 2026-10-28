import { Badge } from "@/components/ui/badge";
import { BAND_BY_VALUE, type Band } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/** Hot / Warm / Nurture / Inactive, optionally with the score (always as text, never colour alone). */
export function BandBadge({ band, score, className }: { band: Band; score?: number; className?: string }) {
  const config = BAND_BY_VALUE[band];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", config.badgeClass, className)}>
      {config.label}
      {score !== undefined && <span className="tabular-nums opacity-80">· {score}</span>}
    </Badge>
  );
}
