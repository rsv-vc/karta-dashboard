// Volume and deal value calculator. Pure, shared by the form (live preview),
// the Server Actions (which recompute and store the result), the importer and
// the account page, so every number is calculated one way.
//
//   Volume (minutes / month) = calls a month × minutes per call
//   Deal value (₹)           = volume × price per minute × contract months
//
// Any input left empty falls back to its default: calls from the account's
// segment (industry average), 5 minutes a call, ₹4 a minute (the ₹3–5 range's
// midpoint), and a 12-month contract.

export const DEFAULT_MINUTES_PER_CALL = 5;
export const DEFAULT_CONTRACT_MONTHS = 12;
export const PRICE_RANGE = { low: 3, high: 5 } as const;
export const DEFAULT_PRICE_PER_MINUTE = (PRICE_RANGE.low + PRICE_RANGE.high) / 2;

export interface IndustryAverage {
  label: string;
  callsPerMonth: number;
}

export const INDUSTRY_AVERAGES = {
  banking: { label: "Banking", callsPerMonth: 1_500_000 },
  insurance: { label: "Insurance", callsPerMonth: 1_000_000 },
  financial_services: { label: "Financial services", callsPerMonth: 800_000 },
  fintech: { label: "Fintech", callsPerMonth: 500_000 },
} as const satisfies Record<string, IndustryAverage>;

/** Which industry average each segment uses; segments without one need calls entered. */
const SEGMENT_INDUSTRY: Record<string, keyof typeof INDUSTRY_AVERAGES> = {
  Bank: "banking",
  Insurance: "insurance",
  NBFC: "financial_services",
  "Housing finance": "financial_services",
  "Wealth & AMC": "financial_services",
  Fintech: "fintech",
};

export function industryAverageFor(segment: string): IndustryAverage | null {
  const key = SEGMENT_INDUSTRY[segment];
  return key ? INDUSTRY_AVERAGES[key] : null;
}

export interface DealInputs {
  segment: string;
  /** null = the segment's industry average. */
  callsPerMonth: number | null;
  /** null = 5. */
  minutesPerCall: number | null;
  /** null = ₹4 (midpoint of ₹3–5). */
  pricePerMinute: number | null;
  /** null = 12. */
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
  /** The same deal at ₹3 and ₹5 a minute (only when the price is the default). */
  range: { low: number; high: number } | null;
  /** Which values came from defaults, for "industry average" / "default" labels. */
  defaults: { calls: boolean; minutes: boolean; price: boolean; months: boolean };
  industry: IndustryAverage | null;
}

const value = (n: number, months: number, price: number) => Math.round(n * price * months);

export function calculateDeal(inputs: DealInputs): DealCalculation {
  const industry = industryAverageFor(inputs.segment);
  const callsPerMonth = inputs.callsPerMonth ?? industry?.callsPerMonth ?? null;
  const minutesPerCall = inputs.minutesPerCall ?? DEFAULT_MINUTES_PER_CALL;
  const pricePerMinute = inputs.pricePerMinute ?? DEFAULT_PRICE_PER_MINUTE;
  const contractMonths = inputs.contractMonths ?? DEFAULT_CONTRACT_MONTHS;
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
        ? { low: value(volume, contractMonths, PRICE_RANGE.low), high: value(volume, contractMonths, PRICE_RANGE.high) }
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
