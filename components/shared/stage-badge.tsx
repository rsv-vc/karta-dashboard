import { Badge } from "@/components/ui/badge";
import { STAGE_BY_VALUE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LeadStage } from "@/types/lead";

/** Badge colored by lead stage, using the shared stage palette. */
export function StageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  const config = STAGE_BY_VALUE[stage];
  return <Badge className={cn(config.badgeClass, className)}>{config.label}</Badge>;
}
