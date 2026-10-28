"use client";

import { LoaderIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logActivity } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TODAY } from "@/lib/constants";
import { LOGGABLE_ACTIVITY_TYPES, logActivitySchema, toFieldErrors, type LogActivityValues } from "@/lib/leads/schemas";

const TYPE_LABELS: Record<LogActivityValues["type"], string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

const EMPTY: LogActivityValues = { type: "call", description: "", date: TODAY, nextFollowUpDate: "" };

/** Record a call, email, meeting or note, optionally scheduling the next follow-up. */
export function LogActivityDialog({
  leadId,
  createdDay,
  compact = false,
  companyName,
}: {
  leadId: string;
  createdDay: string;
  /** Small "Log" button for list rows instead of the full-size page action. */
  compact?: boolean;
  /** Shown in the dialog title when opened from a list. */
  companyName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<LogActivityValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof LogActivityValues>(key: K, value: LogActivityValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function submit() {
    const parsed = logActivitySchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await logActivity(leadId, parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`${TYPE_LABELS[values.type]} logged`);
      setOpen(false);
      setValues(EMPTY);
      setErrors({});
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="outline" size="sm" className="pointer-coarse:h-11" aria-label={companyName ? `Log activity for ${companyName}` : "Log activity"}>
            <PlusIcon />
            Log
          </Button>
        ) : (
          <Button variant="outline">
            <PlusIcon />
            Log activity
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{companyName ? `Log activity · ${companyName}` : "Log activity"}</DialogTitle>
          <DialogDescription>Calls, emails and meetings also update the last-contact date.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="activityType">Type</FieldLabel>
              <Select value={values.type} onValueChange={(v) => set("type", v as LogActivityValues["type"])}>
                <SelectTrigger id="activityType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGGABLE_ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={Boolean(errors.date)}>
              <FieldLabel htmlFor="activityDate">Date</FieldLabel>
              <Input id="activityDate" type="date" min={createdDay} max={TODAY} value={values.date} onChange={(e) => set("date", e.target.value)} />
              <FieldError>{errors.date}</FieldError>
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.description)}>
            <FieldLabel htmlFor="activityDescription">What happened?</FieldLabel>
            <Textarea
              id="activityDescription"
              rows={3}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Discussed pricing; they want a pilot for two cities"
            />
            <FieldError>{errors.description}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.nextFollowUpDate)}>
            <FieldLabel htmlFor="activityFollowUp">Next follow-up (optional)</FieldLabel>
            <Input
              id="activityFollowUp"
              type="date"
              min={TODAY}
              value={values.nextFollowUpDate}
              onChange={(e) => set("nextFollowUpDate", e.target.value)}
            />
            <FieldError>{errors.nextFollowUpDate}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <LoaderIcon className="animate-spin" />}
            Log {TYPE_LABELS[values.type].toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
