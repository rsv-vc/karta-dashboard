"use client";

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { DealBreakdown } from "@/components/leads/deal-breakdown";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_CONTRACT_MONTHS,
  DEFAULT_MINUTES_PER_CALL,
  DEFAULT_PRICE_PER_MINUTE,
  PRICE_RANGE,
  calculateDeal,
  industryAverageFor,
} from "@/lib/deal-calculator";
import type { LeadFormValues } from "@/lib/leads/schemas";
import { formatNumber } from "@/lib/utils";

type Key = "callsPerMonth" | "minutesPerCall" | "pricePerMinute" | "contractMonths";

/** Empty input = null = use the default. */
const asNumberOrNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

/**
 * Volume and deal value calculator: four optional inputs whose placeholders
 * show the defaults, and the live result. The server recalculates on save.
 */
export function DealCalculatorFields({
  register,
  control,
  errors,
}: {
  register: UseFormRegister<LeadFormValues>;
  control: Control<LeadFormValues>;
  errors: FieldErrors<LeadFormValues>;
}) {
  const [segment, callsPerMonth, minutesPerCall, pricePerMinute, contractMonths] = useWatch({
    control,
    name: ["industry", "callsPerMonth", "minutesPerCall", "pricePerMinute", "contractMonths"],
  });
  const clean = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  const deal = calculateDeal({
    segment: segment ?? "",
    callsPerMonth: clean(callsPerMonth),
    minutesPerCall: clean(minutesPerCall),
    pricePerMinute: clean(pricePerMinute),
    contractMonths: clean(contractMonths),
  });
  const industry = industryAverageFor(segment ?? "");

  const fields: { key: Key; label: string; placeholder: string; hint: string; step?: string }[] = [
    {
      key: "callsPerMonth",
      label: "Calls a month",
      placeholder: industry ? formatNumber(industry.callsPerMonth) : "Enter calls",
      hint: industry
        ? `Empty = ${industry.label} average (${formatNumber(industry.callsPerMonth)})`
        : segment
          ? "No industry average for this segment: enter the calls"
          : "Pick a segment for its industry average",
    },
    {
      key: "minutesPerCall",
      label: "Minutes a call",
      placeholder: String(DEFAULT_MINUTES_PER_CALL),
      hint: `Empty = ${DEFAULT_MINUTES_PER_CALL} minutes`,
      step: "0.5",
    },
    {
      key: "pricePerMinute",
      label: "Price a minute (₹)",
      placeholder: String(DEFAULT_PRICE_PER_MINUTE),
      hint: `Empty = ₹${DEFAULT_PRICE_PER_MINUTE} (₹${PRICE_RANGE.low}–${PRICE_RANGE.high} range)`,
      step: "0.25",
    },
    {
      key: "contractMonths",
      label: "Contract (months)",
      placeholder: String(DEFAULT_CONTRACT_MONTHS),
      hint: `Empty = ${DEFAULT_CONTRACT_MONTHS} months`,
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <Field key={f.key} data-invalid={Boolean(errors[f.key])}>
            <FieldLabel htmlFor={f.key}>{f.label}</FieldLabel>
            <Input
              id={f.key}
              type="number"
              inputMode="decimal"
              min={0}
              step={f.step ?? "1"}
              placeholder={f.placeholder}
              aria-invalid={Boolean(errors[f.key])}
              aria-describedby={`${f.key}-hint`}
              {...register(f.key, { setValueAs: asNumberOrNull })}
            />
            <FieldDescription id={`${f.key}-hint`}>{f.hint}</FieldDescription>
            <FieldError errors={[errors[f.key]]} />
          </Field>
        ))}
      </div>
      <DealBreakdown deal={deal} live />
    </>
  );
}
