"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, LoaderIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type DefaultValues,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";
import { toast } from "sonner";
import { checkDuplicates, createLead, updateLead, type DuplicateMatch } from "@/app/(app)/leads/actions";
import { StageBadge } from "@/components/shared/stage-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CITIES,
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  INDUSTRIES,
  PRIORITIES,
  PRIORITY_LABELS,
  SOURCES,
  SOURCE_LABELS,
  TODAY,
} from "@/lib/constants";
import { createLeadSchema, leadFormSchema, type LeadFormValues } from "@/lib/leads/schemas";
import { formatINR, formatINRShort } from "@/lib/utils";

type Option = { value: string; label: string };
const toOptions = (values: readonly string[], labels?: Record<string, string>): Option[] =>
  values.map((v) => ({ value: v, label: labels?.[v] ?? v }));

const INDUSTRY_OPTIONS = toOptions(INDUSTRIES);
const SIZE_OPTIONS = toOptions(COMPANY_SIZES, COMPANY_SIZE_LABELS);
const CITY_OPTIONS = toOptions(CITIES);
const SOURCE_OPTIONS = toOptions(SOURCES, SOURCE_LABELS);
const PRIORITY_OPTIONS = toOptions(PRIORITIES, PRIORITY_LABELS);

type Name = FieldPath<LeadFormValues>;

/**
 * Create / edit form for a lead. Validation runs on the client with the shared
 * zod schema and again in the Server Action. A debounced duplicate check warns
 * when the company already exists and requires an explicit "create anyway".
 */
export function LeadForm({
  mode,
  leadId,
  defaultValues,
  ownerOptions,
  cancelHref,
}: {
  mode: "create" | "edit";
  leadId?: string;
  defaultValues: DefaultValues<LeadFormValues>;
  /** Present only for admins, who pick (or change) the owner. */
  ownerOptions?: Option[];
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(mode === "create" ? createLeadSchema : leadFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const companyName = useWatch({ control, name: "companyName" }) ?? "";
  const dealValue = useWatch({ control, name: "dealValue" });

  // Debounced duplicate lookup; skipped in edit mode until the name changes.
  useEffect(() => {
    const unchanged = mode === "edit" && companyName.trim() === defaultValues.companyName;
    const timer = setTimeout(async () => {
      setDuplicates(unchanged || companyName.trim().length < 3 ? [] : await checkDuplicates(companyName, leadId));
    }, 400);
    return () => clearTimeout(timer);
  }, [companyName, mode, leadId, defaultValues.companyName]);

  const onSubmit = handleSubmit((values) => {
    if (duplicates.length > 0 && !values.duplicateAcknowledged) {
      setError("duplicateAcknowledged", { message: "Confirm this is a different company to continue" });
      return;
    }
    startTransition(async () => {
      const result = mode === "create" ? await createLead(values) : await updateLead(leadId!, values);
      if (result.ok) {
        toast.success(mode === "create" ? "Lead created" : "Lead updated");
        router.push(`/leads/${result.id}`);
        return;
      }
      if (result.error === "possible-duplicate") {
        setError("duplicateAcknowledged", { message: "This company may already exist. Confirm to continue." });
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as Name, { message });
      }
      toast.error(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Section title="Company">
        <TextField register={register} errors={formState.errors} name="companyName" label="Company name" placeholder="Nimbus Logistics Pvt Ltd" />
        {duplicates.length > 0 && (
          <DuplicateWarning matches={duplicates} control={control} error={formState.errors.duplicateAcknowledged?.message} />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField control={control} name="industry" label="Industry" options={INDUSTRY_OPTIONS} />
          <SelectField control={control} name="companySize" label="Company size" options={SIZE_OPTIONS} />
          <SelectField control={control} name="city" label="City" options={CITY_OPTIONS} />
        </div>
      </Section>

      <Section title="Point of contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField register={register} errors={formState.errors} name="pocName" label="Name" placeholder="Asha Rao" />
          <TextField register={register} errors={formState.errors} name="pocDesignation" label="Designation" placeholder="Head of Procurement" />
          <TextField register={register} errors={formState.errors} name="pocEmail" label="Email" type="email" placeholder="asha@company.in" />
          <TextField
            register={register}
            errors={formState.errors}
            name="pocPhone"
            label="Mobile"
            type="tel"
            placeholder="+91 98765 43210"
          />
        </div>
        <TextField
          register={register}
          errors={formState.errors}
          name="pocLinkedIn"
          label="LinkedIn (optional)"
          type="url"
          placeholder="https://www.linkedin.com/in/…"
        />
      </Section>

      <Section title="Deal">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={Boolean(formState.errors.dealValue)}>
            <FieldLabel htmlFor="dealValue">Deal value (₹)</FieldLabel>
            <Input
              id="dealValue"
              type="number"
              inputMode="numeric"
              step={10000}
              min={0}
              placeholder="1500000"
              aria-invalid={Boolean(formState.errors.dealValue)}
              {...register("dealValue", { valueAsNumber: true })}
            />
            {Number.isFinite(dealValue) && dealValue > 0 && (
              <FieldDescription>
                {formatINR(dealValue)} · {formatINRShort(dealValue)}
              </FieldDescription>
            )}
            <FieldError errors={[formState.errors.dealValue]} />
          </Field>
          <SelectField control={control} name="priority" label="Priority" options={PRIORITY_OPTIONS} />
          <SelectField control={control} name="source" label="Source" options={SOURCE_OPTIONS} />
        </div>
        {ownerOptions && <SelectField control={control} name="ownerId" label="Owner" options={ownerOptions} />}
      </Section>

      <Section title="Follow-up & notes">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            register={register}
            errors={formState.errors}
            name="nextFollowUpDate"
            label="Next follow-up (optional)"
            type="date"
            min={TODAY}
          />
        </div>
        <Field data-invalid={Boolean(formState.errors.notes)}>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea id="notes" rows={3} placeholder="Context for whoever picks this up next" {...register("notes")} />
          <FieldError errors={[formState.errors.notes]} />
        </Field>
      </Section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderIcon className="animate-spin" />}
          {mode === "create" ? "Create lead" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  );
}

function TextField({
  register,
  errors,
  name,
  label,
  type = "text",
  placeholder,
  min,
}: {
  register: UseFormRegister<LeadFormValues>;
  errors: Partial<Record<Name, { message?: string }>>;
  name: Name;
  label: string;
  type?: string;
  placeholder?: string;
  min?: string;
}) {
  const error = errors[name];
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} type={type} placeholder={placeholder} min={min} aria-invalid={Boolean(error)} {...register(name)} />
      <FieldError errors={[error]} />
    </Field>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
}: {
  control: Control<LeadFormValues>;
  name: "industry" | "companySize" | "city" | "source" | "priority" | "ownerId";
  label: string;
  options: Option[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger id={name} className="w-full" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Masked list of possible duplicates plus the required "create anyway" confirmation. */
function DuplicateWarning({
  matches,
  control,
  error,
}: {
  matches: DuplicateMatch[];
  control: Control<LeadFormValues>;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/50">
      <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
        <AlertTriangleIcon className="size-4" />
        This company may already be in the pipeline
      </p>
      <ul className="flex flex-col gap-1.5">
        {matches.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2">
            {m.canOpen ? (
              <Link href={`/leads/${m.id}`} target="_blank" className="font-medium underline-offset-2 hover:underline">
                {m.companyName}
              </Link>
            ) : (
              <span className="font-medium">{m.companyName}</span>
            )}
            <span className="text-muted-foreground">· {m.ownerName}</span>
            <StageBadge stage={m.stage} />
          </li>
        ))}
      </ul>
      <Controller
        control={control}
        name="duplicateAcknowledged"
        render={({ field }) => (
          <Field orientation="horizontal" data-invalid={Boolean(error)}>
            <Checkbox
              id="duplicateAcknowledged"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            <FieldLabel htmlFor="duplicateAcknowledged" className="font-normal">
              I&apos;ve checked: this is a different company (create anyway)
            </FieldLabel>
          </Field>
        )}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
