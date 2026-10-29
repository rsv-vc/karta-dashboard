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
import { useAppConfig } from "@/components/config/config-provider";
import { StageBadge } from "@/components/shared/stage-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DealCalculatorFields } from "@/components/leads/deal-calculator-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { activeIndustries } from "@/lib/config";
import {
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  SOURCES,
  SOURCE_LABELS,
  TODAY,
} from "@/lib/constants";
import { createLeadSchema, leadFormSchema, type LeadFormValues } from "@/lib/leads/schemas";
import { SCORE_CRITERIA } from "@/lib/scoring";

type Option = { value: string; label: string };
const toOptions = (values: readonly string[], labels?: Record<string, string>): Option[] =>
  values.map((v) => ({ value: v, label: labels?.[v] ?? v }));

const SIZE_OPTIONS = toOptions(COMPANY_SIZES, COMPANY_SIZE_LABELS);
const SOURCE_OPTIONS = toOptions(SOURCES, SOURCE_LABELS);
const PRIORITY_OPTIONS = toOptions(PRIORITIES, PRIORITY_LABELS);

type Name = FieldPath<LeadFormValues>;

/**
 * Create / edit form for an account. Validation runs on the client with the shared
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
  const config = useAppConfig();
  // Active industries from the masters, plus this account's own if it was retired since.
  const industries = activeIndustries(config);
  const current = defaultValues.industry;
  const industryOptions = toOptions(current && !industries.includes(current) ? [...industries, current] : industries);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(mode === "create" ? createLeadSchema : leadFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const companyName = useWatch({ control, name: "companyName" }) ?? "";

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
        toast.success(mode === "create" ? "Account created" : "Account updated");
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
      <Section title="Account">
        <TextField register={register} errors={formState.errors} name="companyName" label="Company name" placeholder="Nimbus Finance Ltd" />
        {duplicates.length > 0 && (
          <DuplicateWarning matches={duplicates} control={control} error={formState.errors.duplicateAcknowledged?.message} />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField control={control} name="industry" label="Segment" options={industryOptions} />
          <SelectField control={control} name="source" label="Lead source" options={SOURCE_OPTIONS} />
          {ownerOptions ? (
            <SelectField control={control} name="ownerId" label="Owner" options={ownerOptions} />
          ) : (
            <SelectField control={control} name="priority" label="Priority" options={PRIORITY_OPTIONS} />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField register={register} errors={formState.errors} name="city" label="City (optional)" placeholder="Mumbai" list="city-options" />
          <SelectField control={control} name="companySize" label="Company size (optional)" options={SIZE_OPTIONS} />
          {ownerOptions && <SelectField control={control} name="priority" label="Priority" options={PRIORITY_OPTIONS} />}
        </div>
        <datalist id="city-options">
          {config.cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Section>

      <Section title="Contact" description="Email and phone are optional: the source trackers may keep them.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField register={register} errors={formState.errors} name="pocName" label="Name" placeholder="Asha Rao" />
          <TextField register={register} errors={formState.errors} name="pocDesignation" label="Title (optional)" placeholder="Head of Customer Support" />
          <TextField register={register} errors={formState.errors} name="pocEmail" label="Email (optional)" type="email" placeholder="asha@company.in" />
          <TextField
            register={register}
            errors={formState.errors}
            name="pocPhone"
            label="Mobile (optional)"
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

      <Section title="Qualification" description="The score adds stage points to these three. Hot is 30+, Warm 20–29, Nurture 10–19.">
        <div className="grid gap-4 sm:grid-cols-3">
          {SCORE_CRITERIA.map((c) => (
            <Field key={c.key} data-invalid={Boolean(formState.errors[c.key])}>
              <FieldLabel htmlFor={c.key}>
                {c.label} (0–{c.max})
              </FieldLabel>
              <Input
                id={c.key}
                type="number"
                inputMode="numeric"
                min={0}
                max={c.max}
                aria-invalid={Boolean(formState.errors[c.key])}
                aria-describedby={`${c.key}-guide`}
                {...register(c.key, { setValueAs: (v) => (v === "" ? 0 : Number(v)) })}
              />
              <FieldDescription id={`${c.key}-guide`}>{c.guide}</FieldDescription>
              <FieldError errors={[formState.errors[c.key]]} />
            </Field>
          ))}
        </div>
      </Section>

      <Section
        title="Volume & deal value"
        description="Volume = calls × minutes; deal value = volume × price a minute × contract months. Leave a field empty to use its default."
      >
        <DealCalculatorFields register={register} control={control} errors={formState.errors} />
      </Section>

      <Section title="Next step & notes">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TextField register={register} errors={formState.errors} name="nextStep" label="Next step" placeholder="Follow-up meeting with IT" />
          </div>
          <TextField
            register={register}
            errors={formState.errors}
            name="nextFollowUpDate"
            label="Next step date (optional)"
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
          {mode === "create" ? "Create account" : "Save changes"}
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
  list,
}: {
  register: UseFormRegister<LeadFormValues>;
  errors: Partial<Record<Name, { message?: string }>>;
  name: Name;
  label: string;
  type?: string;
  placeholder?: string;
  min?: string;
  /** id of a <datalist> of suggestions. */
  list?: string;
}) {
  const error = errors[name];
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} type={type} placeholder={placeholder} min={min} list={list} aria-invalid={Boolean(error)} {...register(name)} />
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
  name: "industry" | "companySize" | "source" | "priority" | "ownerId";
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
