// Volume and deal value calculator. Pure, shared by the form (live preview),
// the Server Actions (which recompute and store the result), the importer and
// the account page, so every number is calculated one way.
//
//   Volume (minutes / month) = calls a month × minutes per call
//   Deal value (₹)           = volume × price per minute × contract months
//
// Any input left empty falls back to its default from the masters: calls from
// the account's industry (its average), minutes a call from the industry,
// and the pricing defaults (₹ a minute with its range, contract months).
// Without masters it uses the original values (₹4 in a ₹3–5 range, 5 minutes,
// 12 months, and the four industry averages).

import type { AppConfig } from "@/lib/config";

export interface IndustryAverage {
  label: string;
  callsPerMonth: number;
  minutesPerCall: number;
}

export interface CalculatorConfig {
  industries: AppConfig["industries"];
  pricing: AppConfig["pricing"];
}

const FALLBACK: CalculatorConfig = {
  industries: [
    { name: "Bank", avgCallsPerMonth: 1_500_000, minutesPerCall: 5, active: true },
    { name: "Insurance", avgCallsPerMonth: 1_000_000, minutesPerCall: 5, active: true },
    { name: "NBFC", avgCallsPerMonth: 800_000, minutesPerCall: 5, active: true },
    { name: "Housing finance", avgCallsPerMonth: 800_000, minutesPerCall: 5, active: true },
    { name: "Wealth & AMC", avgCallsPerMonth: 800_000, minutesPerCall: 5, active: true },
    { name: "Fintech", avgCallsPerMonth: 500_000, minutesPerCall: 5, active: true },
    { name: "Healthcare", avgCallsPerMonth: null, minutesPerCall: 5, active: true },
    { name: "Other", avgCallsPerMonth: null, minutesPerCall: 5, active: true },
  ],
  pricing: { pricePerMinute: 4, priceLow: 3, priceHigh: 5, minutesPerCall: 5, contractMonths: 12 },
};

export const DEFAULT_MINUTES_PER_CALL = FALLBACK.pricing.minutesPerCall;
export const DEFAULT_CONTRACT_MONTHS = FALLBACK.pricing.contractMonths;
export const PRICE_RANGE = { low: FALLBACK.pricing.priceLow, high: FALLBACK.pricing.priceHigh } as const;
export const DEFAULT_PRICE_PER_MINUTE = FALLBACK.pricing.pricePerMinute;

export function industryAverageFor(segment: string, config: CalculatorConfig = FALLBACK): IndustryAverage | null {
  const industry = config.industries.find((i) => i.name === segment);
  if (!industry || industry.avgCallsPerMonth === null) return null;
  return { label: industry.name, callsPerMonth: industry.avgCallsPerMonth, minutesPerCall: industry.minutesPerCall };
}

export interface DealInputs {
  segment: string;
  /** null = the industry's average calls. */
  callsPerMonth: number | null;
  /** null = the industry's minutes a call (else the pricing default). */
  minutesPerCall: number | null;
  /** null = the default price a minute. */
  pricePerMinute: number | null;
  /** null = the default contract length. */
  contractMonths: number | null;
}

export interface DealCalculation {
  callsPerMonth: number | null;
  minutesPerCall: number;
  pricePerMinute: number;
  contractMonths: number;
  /** Minutes a month; null when neither calls nor an industry average is known. */
  volume: number | null;
  /** Whole rupees; 0 when the volume is unknown. */
  dealValue: number;
  /** The same deal at the low and high price (only when the price is the default). */
  range: { low: number; high: number; lowPrice: number; highPrice: number } | null;
  /** Which values came from defaults, for "industry average" / "default" labels. */
  defaults: { calls: boolean; minutes: boolean; price: boolean; months: boolean };
  industry: IndustryAverage | null;
}

const value = (n: number, months: number, price: number) => Math.round(n * price * months);

export function calculateDeal(inputs: DealInputs, config: CalculatorConfig = FALLBACK): DealCalculation {
  const industry = industryAverageFor(inputs.segment, config);
  const industryMinutes = config.industries.find((i) => i.name === inputs.segment)?.minutesPerCall;
  const callsPerMonth = inputs.callsPerMonth ?? industry?.callsPerMonth ?? null;
  const minutesPerCall = inputs.minutesPerCall ?? industryMinutes ?? config.pricing.minutesPerCall;
  const pricePerMinute = inputs.pricePerMinute ?? config.pricing.pricePerMinute;
  const contractMonths = inputs.contractMonths ?? config.pricing.contractMonths;
  const volume = callsPerMonth === null ? null : Math.round(callsPerMonth * minutesPerCall);
  const priceIsDefault = inputs.pricePerMinute === null;

  return {
    callsPerMonth,
    minutesPerCall,
    pricePerMinute,
    contractMonths,
    volume,
    dealValue: volume === null ? 0 : value(volume, contractMonths, pricePerMinute),
    range:
      volume !== null && priceIsDefault
        ? {
            low: value(volume, contractMonths, config.pricing.priceLow),
            high: value(volume, contractMonths, config.pricing.priceHigh),
            lowPrice: config.pricing.priceLow,
            highPrice: config.pricing.priceHigh,
          }
        : null,
    defaults: {
      calls: inputs.callsPerMonth === null && industry !== null,
      minutes: inputs.minutesPerCall === null,
      price: priceIsDefault,
      months: inputs.contractMonths === null,
    },
    industry,
  };
}

/** Did any calculator input (or the segment, which sets the default calls) change? */
export function dealInputsChanged(a: DealInputs, b: DealInputs): boolean {
  return (
    a.segment !== b.segment ||
    a.callsPerMonth !== b.callsPerMonth ||
    a.minutesPerCall !== b.minutesPerCall ||
    a.pricePerMinute !== b.pricePerMinute ||
    a.contractMonths !== b.contractMonths
  );
}
