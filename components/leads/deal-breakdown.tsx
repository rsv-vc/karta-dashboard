import type { DealCalculation } from "@/lib/deal-calculator";
import { cn, formatINR, formatINRShort, formatNumber } from "@/lib/utils";

const tag = (isDefault: boolean, label = "default") =>
  isDefault ? <span className="text-xs text-muted-foreground"> ({label})</span> : null;

/**
 * The calculation written out: calls × minutes = volume; volume × ₹/min ×
 * months = deal value. Used live in the form and on the account page.
 */
export function DealBreakdown({ deal, live = false, className }: { deal: DealCalculation; live?: boolean; className?: string }) {
  return (
    <div
      className={cn("rounded-lg border bg-muted/40 p-3 text-sm", className)}
      // Live in the form: announce the new totals politely as inputs change.
      aria-live={live ? "polite" : undefined}
    >
      {deal.volume === null ? (
        <p className="text-muted-foreground">
          Volume unknown: enter the calls a month, or pick a segment with an industry average (Bank, Insurance, NBFC,
          Housing finance, Wealth &amp; AMC, Fintech).
        </p>
      ) : (
        <dl className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt className="text-muted-foreground">
              Volume = {formatNumber(deal.callsPerMonth ?? 0)} calls{tag(deal.defaults.calls, `${deal.industry?.label ?? "industry"} average`)} ×{" "}
              {formatNumber(deal.minutesPerCall)} min{tag(deal.defaults.minutes)}
            </dt>
            <dd className="font-medium tabular-nums">{formatNumber(deal.volume)} min / month</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt className="text-muted-foreground">
              Deal value = volume × ₹{deal.pricePerMinute}/min{tag(deal.defaults.price)} × {deal.contractMonths} months
              {tag(deal.defaults.months)}
            </dt>
            <dd className="font-semibold tabular-nums">
              {formatINR(deal.dealValue)} <span className="font-normal text-muted-foreground">({formatINRShort(deal.dealValue)})</span>
            </dd>
          </div>
          {deal.range && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-muted-foreground">
              <dt>At ₹3–5 a minute</dt>
              <dd className="tabular-nums">
                {formatINRShort(deal.range.low)} – {formatINRShort(deal.range.high)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
