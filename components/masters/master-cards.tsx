"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  deleteCity,
  deleteIndustry,
  deleteReason,
  saveCity,
  saveIndustry,
  savePricing,
  saveReason,
  saveStage,
} from "@/app/(app)/masters/actions";
import { MasterDialog, numberOrNull, useMasterForm } from "@/components/masters/master-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DropReasonScope } from "@/lib/config";
import type { CityMaster, IndustryMaster, MastersData, ReasonMaster, StageMaster } from "@/lib/data/masters";
import { formatNumber } from "@/lib/utils";

const SCOPE_LABELS: Record<DropReasonScope, string> = { both: "Lost and deferred", lost: "Lost only", deferred: "Deferred only" };

function accountsLabel(n: number) {
  return `${n} account${n === 1 ? "" : "s"}`;
}

function MasterCard({
  title,
  description,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  description: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {onAdd && (
          <CardAction>
            <Button size="sm" onClick={onAdd}>
              <PlusIcon />
              {addLabel}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <PencilIcon />
    </Button>
  );
}

function Status({ active }: { active: boolean }) {
  return active ? null : <Badge variant="outline">Inactive</Badge>;
}

function ActiveField({ checked, onChange, hint }: { checked: boolean; onChange: (v: boolean) => void; hint: string }) {
  return (
    <Field orientation="horizontal">
      <Checkbox id="master-active" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <div>
        <FieldLabel htmlFor="master-active" className="font-normal">
          Active
        </FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </div>
    </Field>
  );
}

function DeleteButton({ inUse, onClick, pending }: { inUse: number; onClick: () => void; pending: boolean }) {
  if (inUse > 0) return null;
  return (
    <Button type="button" variant="ghost" className="text-destructive" onClick={onClick} disabled={pending}>
      <Trash2Icon />
      Delete
    </Button>
  );
}

// Industries --------------------------------------------------------------------------------

type IndustryDraft = { original: string; name: string; avgCallsPerMonth: string; minutesPerCall: string; active: boolean; accounts: number };

export function IndustriesCard({ industries }: { industries: IndustryMaster[] }) {
  const [draft, setDraft] = useState<IndustryDraft | null>(null);
  const { errors, pending, run } = useMasterForm(() => setDraft(null));
  const set = (patch: Partial<IndustryDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const open = (i?: IndustryMaster) =>
    setDraft(
      i
        ? { original: i.name, name: i.name, avgCallsPerMonth: i.avgCallsPerMonth === null ? "" : String(i.avgCallsPerMonth), minutesPerCall: String(i.minutesPerCall), active: i.active, accounts: i.accounts }
        : { original: "", name: "", avgCallsPerMonth: "", minutesPerCall: "5", active: true, accounts: 0 },
    );

  const calls = draft ? numberOrNull(draft.avgCallsPerMonth) : null;
  const mins = draft ? Number(draft.minutesPerCall) : 0;
  const preview = calls !== null && Number.isFinite(calls) && mins > 0 ? `${formatNumber(Math.round(calls * mins))} minutes a month` : "No average: enter the calls per account";

  return (
    <MasterCard
      title="Industries"
      description="The segments an account can belong to, and each one's average volume. Accounts with no calls entered use their industry's average."
      onAdd={() => open()}
      addLabel="Add industry"
    >
      <Table scrollLabel="Industries">
        <TableHeader>
          <TableRow>
            <TableHead>Industry</TableHead>
            <TableHead className="text-right">Avg calls / month</TableHead>
            <TableHead className="text-right">Min / call</TableHead>
            <TableHead className="text-right">Avg volume (min / month)</TableHead>
            <TableHead className="text-right">Accounts</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Edit</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {industries.map((i) => (
            <TableRow key={i.name}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {i.name}
                  <Status active={i.active} />
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{i.avgCallsPerMonth === null ? "—" : formatNumber(i.avgCallsPerMonth)}</TableCell>
              <TableCell className="text-right tabular-nums">{i.minutesPerCall}</TableCell>
              <TableCell className="text-right tabular-nums">
                {i.avgCallsPerMonth === null ? "—" : formatNumber(Math.round(i.avgCallsPerMonth * i.minutesPerCall))}
              </TableCell>
              <TableCell className="text-right tabular-nums">{i.accounts}</TableCell>
              <TableCell>
                <EditButton label={`Edit ${i.name}`} onClick={() => open(i)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {draft && (
        <MasterDialog
          open
          onOpenChange={(o) => !o && setDraft(null)}
          title={draft.original ? `Edit ${draft.original}` : "Add industry"}
          description={
            draft.original && draft.accounts > 0
              ? `${accountsLabel(draft.accounts)} use it. Renaming renames it on them; their volume and deal value are recalculated (Won accounts keep theirs).`
              : undefined
          }
          pending={pending}
          onSubmit={() =>
            run(
              () =>
                saveIndustry({
                  original: draft.original,
                  name: draft.name,
                  avgCallsPerMonth: numberOrNull(draft.avgCallsPerMonth),
                  minutesPerCall: Number(draft.minutesPerCall),
                  active: draft.active,
                }),
              draft.original ? "Industry saved" : "Industry added",
            )
          }
          footer={draft.original && <DeleteButton inUse={draft.accounts} pending={pending} onClick={() => run(() => deleteIndustry(draft.original), "Industry deleted")} />}
        >
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="industry-name">Name</FieldLabel>
            <Input id="industry-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.avgCallsPerMonth)}>
              <FieldLabel htmlFor="industry-calls">Average calls a month</FieldLabel>
              <Input id="industry-calls" type="number" inputMode="numeric" min={0} placeholder="No average" value={draft.avgCallsPerMonth} onChange={(e) => set({ avgCallsPerMonth: e.target.value })} />
              <FieldError>{errors.avgCallsPerMonth}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.minutesPerCall)}>
              <FieldLabel htmlFor="industry-minutes">Minutes a call</FieldLabel>
              <Input id="industry-minutes" type="number" inputMode="decimal" step="0.5" min={0} value={draft.minutesPerCall} onChange={(e) => set({ minutesPerCall: e.target.value })} />
              <FieldError>{errors.minutesPerCall}</FieldError>
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">Average volume: {preview}</p>
          <ActiveField checked={draft.active} onChange={(active) => set({ active })} hint="Inactive industries stay on their accounts but are not offered for new ones." />
        </MasterDialog>
      )}
    </MasterCard>
  );
}

// Cities -------------------------------------------------------------------------------------

type CityDraft = { original: string; name: string; active: boolean; accounts: number };

export function CitiesCard({ cities }: { cities: CityMaster[] }) {
  const [draft, setDraft] = useState<CityDraft | null>(null);
  const { errors, pending, run } = useMasterForm(() => setDraft(null));

  return (
    <MasterCard
      title="Cities"
      description="Suggested when adding an account (any city can still be typed)."
      onAdd={() => setDraft({ original: "", name: "", active: true, accounts: 0 })}
      addLabel="Add city"
    >
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((c) => (
          <li key={c.name} className="flex items-center gap-2 rounded-lg border py-1 pr-1 pl-3">
            <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
            <Status active={c.active} />
            <span className="text-sm text-muted-foreground tabular-nums">{c.accounts}</span>
            <EditButton label={`Edit ${c.name}`} onClick={() => setDraft({ original: c.name, name: c.name, active: c.active, accounts: c.accounts })} />
          </li>
        ))}
      </ul>

      {draft && (
        <MasterDialog
          open
          onOpenChange={(o) => !o && setDraft(null)}
          title={draft.original ? `Edit ${draft.original}` : "Add city"}
          description={draft.accounts > 0 ? `${accountsLabel(draft.accounts)} are in this city; a new name is applied to them too.` : undefined}
          pending={pending}
          onSubmit={() => run(() => saveCity({ original: draft.original, name: draft.name, active: draft.active }), draft.original ? "City saved" : "City added")}
          footer={draft.original && <DeleteButton inUse={draft.accounts} pending={pending} onClick={() => run(() => deleteCity(draft.original), "City deleted")} />}
        >
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="city-name">Name</FieldLabel>
            <Input id="city-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <ActiveField checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} hint="Inactive cities are no longer suggested." />
        </MasterDialog>
      )}
    </MasterCard>
  );
}

// Pricing ------------------------------------------------------------------------------------

export function PricingCard({ pricing }: { pricing: MastersData["pricing"] }) {
  const initial = {
    pricePerMinute: String(pricing.pricePerMinute),
    priceLow: String(pricing.priceLow),
    priceHigh: String(pricing.priceHigh),
    minutesPerCall: String(pricing.minutesPerCall),
    contractMonths: String(pricing.contractMonths),
  };
  const [values, setValues] = useState(initial);
  const [editing, setEditing] = useState(false);
  const { errors, pending, run } = useMasterForm(() => setEditing(false));

  const rows: { key: keyof typeof initial; label: string; hint: string; step?: string; show: string }[] = [
    { key: "pricePerMinute", label: "Default price a minute (₹)", hint: "Used when an account has no price of its own", step: "0.25", show: `₹${pricing.pricePerMinute}` },
    { key: "priceLow", label: "Range: low (₹)", hint: "Shown as the deal's low estimate", step: "0.25", show: `₹${pricing.priceLow}` },
    { key: "priceHigh", label: "Range: high (₹)", hint: "Shown as the deal's high estimate", step: "0.25", show: `₹${pricing.priceHigh}` },
    { key: "minutesPerCall", label: "Minutes a call", hint: "When neither the account nor its industry sets one", step: "0.5", show: String(pricing.minutesPerCall) },
    { key: "contractMonths", label: "Contract length (months)", hint: "When the account has no length of its own", show: String(pricing.contractMonths) },
  ];

  return (
    <MasterCard title="Pricing" description="Defaults for the volume and deal value calculator. Saving recalculates every account that uses a default (Won accounts keep their value).">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border p-3">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{r.show}</dd>
          </div>
        ))}
      </dl>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => {
          setValues(initial);
          setEditing(true);
        }}
      >
        <PencilIcon />
        Edit pricing
      </Button>

      {editing && (
        <MasterDialog
          open
          onOpenChange={setEditing}
          title="Edit pricing"
          description="Accounts with their own price, minutes or contract length keep them."
          pending={pending}
          onSubmit={() =>
            run(
              () =>
                savePricing({
                  pricePerMinute: Number(values.pricePerMinute),
                  priceLow: Number(values.priceLow),
                  priceHigh: Number(values.priceHigh),
                  minutesPerCall: Number(values.minutesPerCall),
                  contractMonths: Number(values.contractMonths),
                }),
              "Pricing saved",
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <Field key={r.key} data-invalid={Boolean(errors[r.key])}>
                <FieldLabel htmlFor={`pricing-${r.key}`}>{r.label}</FieldLabel>
                <Input
                  id={`pricing-${r.key}`}
                  type="number"
                  inputMode="decimal"
                  step={r.step ?? "1"}
                  min={0}
                  value={values[r.key]}
                  onChange={(e) => setValues({ ...values, [r.key]: e.target.value })}
                />
                <FieldDescription>{r.hint}</FieldDescription>
                <FieldError>{errors[r.key]}</FieldError>
              </Field>
            ))}
          </div>
        </MasterDialog>
      )}
    </MasterCard>
  );
}

// Stages ------------------------------------------------------------------------------------

type StageDraft = { stage: StageMaster["stage"]; label: string; points: string };

export function StagesCard({ stages }: { stages: StageMaster[] }) {
  const [draft, setDraft] = useState<StageDraft | null>(null);
  const { errors, pending, run } = useMasterForm(() => setDraft(null));

  return (
    <MasterCard
      title="Stages"
      description="Stage names and the points each adds to an account's score (out of 40). The order and which moves are allowed stay fixed."
    >
      <Table scrollLabel="Stages">
        <TableHeader>
          <TableRow>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Score points</TableHead>
            <TableHead className="text-right">Accounts now</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Edit</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((s) => (
            <TableRow key={s.stage}>
              <TableCell className="font-medium">{s.label}</TableCell>
              <TableCell className="text-right tabular-nums">{s.points}</TableCell>
              <TableCell className="text-right tabular-nums">{s.accounts}</TableCell>
              <TableCell>
                <EditButton label={`Edit ${s.label}`} onClick={() => setDraft({ stage: s.stage, label: s.label, points: String(s.points) })} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {draft && (
        <MasterDialog
          open
          onOpenChange={(o) => !o && setDraft(null)}
          title="Edit stage"
          description="Scores and bands update everywhere straight away."
          pending={pending}
          onSubmit={() => run(() => saveStage({ stage: draft.stage, label: draft.label, points: Number(draft.points) }), "Stage saved")}
        >
          <Field data-invalid={Boolean(errors.label)}>
            <FieldLabel htmlFor="stage-label">Name</FieldLabel>
            <Input id="stage-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <FieldError>{errors.label}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.points)}>
            <FieldLabel htmlFor="stage-points">Score points (0–20)</FieldLabel>
            <Input id="stage-points" type="number" inputMode="numeric" min={0} max={20} value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
            <FieldError>{errors.points}</FieldError>
          </Field>
        </MasterDialog>
      )}
    </MasterCard>
  );
}

// Drop-off reasons ------------------------------------------------------------------------------

type ReasonDraft = { id: number | null; label: string; appliesTo: DropReasonScope; active: boolean; accounts: number };

export function ReasonsCard({ reasons }: { reasons: ReasonMaster[] }) {
  const [draft, setDraft] = useState<ReasonDraft | null>(null);
  const { errors, pending, run } = useMasterForm(() => setDraft(null));

  return (
    <MasterCard
      title="Drop-off reasons"
      description="Picked (required) when an account is marked Lost or Deferred. The Investor view breaks drop-offs down by these."
      onAdd={() => setDraft({ id: null, label: "", appliesTo: "both", active: true, accounts: 0 })}
      addLabel="Add reason"
    >
      <Table scrollLabel="Drop-off reasons">
        <TableHeader>
          <TableRow>
            <TableHead>Reason</TableHead>
            <TableHead>Used for</TableHead>
            <TableHead className="text-right">Accounts</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Edit</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reasons.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {r.label}
                  <Status active={r.active} />
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{SCOPE_LABELS[r.appliesTo]}</TableCell>
              <TableCell className="text-right tabular-nums">{r.accounts}</TableCell>
              <TableCell>
                <EditButton label={`Edit ${r.label}`} onClick={() => setDraft({ ...r })} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {draft && (
        <MasterDialog
          open
          onOpenChange={(o) => !o && setDraft(null)}
          title={draft.id ? "Edit reason" : "Add reason"}
          pending={pending}
          onSubmit={() =>
            run(() => saveReason({ id: draft.id, label: draft.label, appliesTo: draft.appliesTo, active: draft.active }), draft.id ? "Reason saved" : "Reason added")
          }
          footer={draft.id && <DeleteButton inUse={draft.accounts} pending={pending} onClick={() => run(() => deleteReason(draft.id!), "Reason deleted")} />}
        >
          <Field data-invalid={Boolean(errors.label)}>
            <FieldLabel htmlFor="reason-label">Reason</FieldLabel>
            <Input id="reason-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <FieldError>{errors.label}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="reason-scope">Used for</FieldLabel>
            <Select value={draft.appliesTo} onValueChange={(v) => setDraft({ ...draft, appliesTo: v as DropReasonScope })}>
              <SelectTrigger id="reason-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCOPE_LABELS) as DropReasonScope[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SCOPE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <ActiveField checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} hint="Inactive reasons stay on past accounts but are no longer offered." />
        </MasterDialog>
      )}
    </MasterCard>
  );
}
