"use client";

import { CheckIcon, XCircleIcon } from "lucide-react";
import { useAppConfig } from "@/components/config/config-provider";
import { stageLabelsOf } from "@/lib/config";
import { PIPELINE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StageHistoryEntry } from "@/types/lead";

/**
 * Pipeline progress: completed steps get a check, the current step is ringed,
 * later steps are muted. Step labels appear when the card is wide enough
 * (container query); otherwise a one-line caption names the current step.
 * A lost lead shows where it dropped out instead.
 */
export function StageStepper({ history }: { history: StageHistoryEntry[] }) {
  const labels = stageLabelsOf(useAppConfig());
  const current = history[history.length - 1].stage;
  const lost = current === "lost";
  const won = current === "won";
  // For a lost lead, the furthest real stage it reached.
  const reached = lost ? (history[history.length - 2]?.stage ?? "new") : current;
  const reachedIndex = PIPELINE_ORDER.indexOf(reached);

  return (
    <div className="@container flex flex-col gap-3">
      <ol className="flex items-start" aria-label="Pipeline progress">
        {PIPELINE_ORDER.map((stage, i) => {
          const done = i < reachedIndex || (i === reachedIndex && (lost || won));
          const isCurrent = !lost && !won && i === reachedIndex;
          return (
            <li
              key={stage}
              className="flex flex-1 flex-col items-center gap-1.5"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                <span className={cn("h-px flex-1", i === 0 ? "bg-transparent" : i <= reachedIndex ? "bg-primary" : "bg-border")} />
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    done && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-background text-primary ring-3 ring-primary/20",
                    !done && !isCurrent && "text-muted-foreground",
                  )}
                  title={labels[stage]}
                >
                  {done ? <CheckIcon className="size-3.5" /> : i + 1}
                  <span className="sr-only">{labels[stage]}</span>
                </span>
                <span
                  className={cn(
                    "h-px flex-1",
                    i === PIPELINE_ORDER.length - 1 ? "bg-transparent" : i < reachedIndex ? "bg-primary" : "bg-border",
                  )}
                />
              </div>
              <span
                aria-hidden
                className={cn(
                  "hidden text-center text-xs @[32rem]:block",
                  isCurrent ? "font-medium" : "text-muted-foreground",
                )}
              >
                {labels[stage]}
              </span>
            </li>
          );
        })}
      </ol>
      {!lost && (
        <p className="text-sm text-muted-foreground @[32rem]:hidden">
          {won ? "Won" : `Step ${reachedIndex + 1} of ${PIPELINE_ORDER.length}: ${labels[reached]}`}
        </p>
      )}
      {lost && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          <XCircleIcon className="size-4 shrink-0" />
          Lost at {labels[reached]}
        </p>
      )}
    </div>
  );
}
