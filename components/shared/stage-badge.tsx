"use client";

import { useAppConfig } from "@/components/config/config-provider";
import { Badge } from "@/components/ui/badge";
import { STAGE_BY_VALUE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LeadStage } from "@/types/lead";

/** Badge colored by lead stage (name from the Stages master). Renders nothing for a hidden (null) stage. */
export function StageBadge({ stage, className }: { stage: LeadStage | null; className?: string }) {
  const { stages } = useAppConfig();
  if (stage === null) return null;
  return <Badge className={cn(STAGE_BY_VALUE[stage].badgeClass, className)}>{stages[stage].label}</Badge>;
}
