"use client";

import { ArrowRightIcon, LoaderIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeStage } from "@/app/(app)/leads/actions";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_LABELS } from "@/lib/constants";
import { changeStageSchema, toFieldErrors } from "@/lib/leads/schemas";
import type { LeadStage } from "@/types/lead";

/** Move a lead one step forward, or mark it lost with a reason. */
export function ChangeStageDialog({
  leadId,
  current,
  allowed,
  dealValue,
}: {
  leadId: string;
  current: LeadStage;
  allowed: LeadStage[];
  dealValue: number;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<LeadStage>(allowed[0]);
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [finalDealValue, setFinalDealValue] = useState(String(dealValue));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    const values = {
      to,
      note,
      lostReason,
      finalDealValue: to === "won" && finalDealValue ? Number(finalDealValue) : undefined,
    };
    const parsed = changeStageSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await changeStage(leadId, parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${STAGE_LABELS[to]}`);
      setOpen(false);
      setNote("");
      setLostReason("");
      setErrors({});
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ArrowRightIcon />
          Change stage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change stage</DialogTitle>
          <DialogDescription>Currently {STAGE_LABELS[current]}. Leads move one step at a time, or drop out as lost.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <RadioGroup value={to} onValueChange={(v) => setTo(v as LeadStage)} aria-label="New stage">
            {allowed.map((stage) => (
              <Field key={stage} orientation="horizontal">
                <RadioGroupItem value={stage} id={`stage-${stage}`} />
                <FieldLabel htmlFor={`stage-${stage}`} className="font-normal">
                  {stage === "lost" ? "Mark as lost" : `Advance to ${STAGE_LABELS[stage]}`}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>

          {to === "lost" ? (
            <Field data-invalid={Boolean(errors.lostReason)}>
              <FieldLabel htmlFor="lostReason">Why was it lost?</FieldLabel>
              <Textarea id="lostReason" rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Went with a competitor on price" />
              <FieldError>{errors.lostReason}</FieldError>
            </Field>
          ) : (
            <Field data-invalid={Boolean(errors.note)}>
              <FieldLabel htmlFor="stageNote">Note (optional)</FieldLabel>
              <Textarea id="stageNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <FieldError>{errors.note}</FieldError>
            </Field>
          )}

          {to === "won" && (
            <Field data-invalid={Boolean(errors.finalDealValue)}>
              <FieldLabel htmlFor="finalDealValue">Final deal value (₹)</FieldLabel>
              <Input id="finalDealValue" type="number" inputMode="numeric" value={finalDealValue} onChange={(e) => setFinalDealValue(e.target.value)} />
              <FieldError>{errors.finalDealValue}</FieldError>
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} variant={to === "lost" ? "destructive" : "default"}>
            {pending && <LoaderIcon className="animate-spin" />}
            {to === "lost" ? "Mark as lost" : `Move to ${STAGE_LABELS[to]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
