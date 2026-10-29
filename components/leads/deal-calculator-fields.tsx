"use client";

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { useAppConfig } from "@/components/config/config-provider";
import { DealBreakdown } from "@/components/leads/deal-breakdown";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { calculateDeal, industryAverageFor } from "@/lib/deal-calculator";
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
  const config = useAppConfig();
  const { pricing } = config;
  const clean = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  const deal = calculateDeal({
    segment: segment ?? "",
    callsPerMonth: clean(callsPerMonth),
    minutesPerCall: clean(minutesPerCall),
    pricePerMinute: clean(pricePerMinute),
    contractMonths: clean(contractMonths),
  }, config);
  const industry = industryAverageFor(segment ?? "", config);
  const minutes = deal.defaults.minutes ? deal.minutesPerCall : pricing.minutesPerCall;

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
      placeholder: String(minutes),
      hint: `Empty = ${minutes} minutes${industry ? ` (${industry.label})` : ""}`,
      step: "0.5",
    },
    {
      key: "pricePerMinute",
      label: "Price a minute (₹)",
      placeholder: String(pricing.pricePerMinute),
      hint: `Empty = ₹${pricing.pricePerMinute} (₹${pricing.priceLow}–${pricing.priceHigh} range)`,
      step: "0.25",
    },
    {
      key: "contractMonths",
      label: "Contract (months)",
      placeholder: String(pricing.contractMonths),
      hint: `Empty = ${pricing.contractMonths} months`,
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
