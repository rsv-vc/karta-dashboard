import { CheckCircle2Icon } from "lucide-react";

/** Progress toward a target: label, "actual of target", and a primary-on-tinted-track bar. */
export function TargetMeter({
  label,
  actual,
  target,
  format,
}: {
  label: string;
  actual: number;
  target: number;
  format: (n: number) => string;
}) {
  const ratio = target > 0 ? actual / target : 0;
  const pct = Math.round(ratio * 100);
  const met = ratio >= 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{format(actual)}</span> of {format(target)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {met ? (
          <>
            <CheckCircle2Icon className="size-3.5 text-green-600 dark:text-green-400" />
            Target met ({pct}%)
          </>
        ) : (
          `${pct}% of target`
        )}
      </span>
    </div>
  );
}
