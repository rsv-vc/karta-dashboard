"use client";

import { ArrowRightIcon, LoaderIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeStage } from "@/app/(app)/leads/actions";
import { useAppConfig } from "@/components/config/config-provider";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { activeReasons, stageLabelsOf, type DropKind } from "@/lib/config";
import { isWonStage } from "@/lib/constants";
import { changeStageSchema, toFieldErrors } from "@/lib/leads/schemas";
import type { LeadStage } from "@/types/lead";

/** What picking this stage means, in words. */
function optionLabel(current: LeadStage, stage: LeadStage, labels: Record<LeadStage, string>): string {
  if (stage === "lost") return `Mark as ${labels.lost}`;
  if (current === "lost") return `Re-open at ${labels[stage]}`;
  return `Advance to ${labels[stage]}`;
}

/** Move an account forward, re-open it, or mark it Lost / Deprioritised with a reason from the list. */
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
  const config = useAppConfig();
  const labels = stageLabelsOf(config);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<LeadStage>(allowed[0]);
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [dropKind, setDropKind] = useState<DropKind>("lost");
  const [reasonId, setReasonId] = useState("");
  const [finalDealValue, setFinalDealValue] = useState(String(dealValue));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const dropping = to === "lost";
  const reasons = activeReasons(config, dropKind);

  function pick(stage: LeadStage) {
    setTo(stage);
    setErrors({});
  }

  function submit() {
    const values = {
      to,
      note,
      lostReason: dropping ? lostReason : "",
      reasonId: dropping && reasonId ? Number(reasonId) : undefined,
      finalDealValue: isWonStage(to) && finalDealValue ? Number(finalDealValue) : undefined,
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
      toast.success(`Moved to ${labels[to]}`);
      setOpen(false);
      setNote("");
      setLostReason("");
      setReasonId("");
      setDropKind("lost");
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
          <DialogDescription>
            Currently {labels[current]}. {current === "lost" ? "Re-open it at any stage." : `Move forward (skipping steps is fine), or mark it ${labels.lost}.`}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <RadioGroup value={to} onValueChange={(v) => pick(v as LeadStage)} aria-label="New stage">
            {allowed.map((stage) => (
              <Field key={stage} orientation="horizontal">
                <RadioGroupItem value={stage} id={`stage-${stage}`} />
                <FieldLabel htmlFor={`stage-${stage}`} className="font-normal">
                  {optionLabel(current, stage, labels)}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>

          {dropping ? (
            <>
              <RadioGroup
                value={dropKind}
                onValueChange={(v) => {
                  setDropKind(v as DropKind);
                  // The two lists are different, so a reason from one does not carry over.
                  setReasonId("");
                }}
                aria-label="Lost or deprioritised"
                className="sm:grid-cols-2"
              >
                <Field orientation="horizontal">
                  <RadioGroupItem value="lost" id="drop-kind-lost" />
                  <FieldLabel htmlFor="drop-kind-lost" className="font-normal">
                    Lost
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="stuck" id="drop-kind-stuck" />
                  <FieldLabel htmlFor="drop-kind-stuck" className="font-normal">
                    Deprioritised (stuck)
                  </FieldLabel>
                </Field>
              </RadioGroup>
              <Field data-invalid={Boolean(errors.reasonId)}>
                <FieldLabel htmlFor="dropReason">{dropKind === "lost" ? "Why was it lost?" : "Why is it stuck?"}</FieldLabel>
                <Select value={reasonId} onValueChange={setReasonId}>
                  <SelectTrigger id="dropReason" aria-invalid={Boolean(errors.reasonId)} className="w-full">
                    <SelectValue placeholder="Pick a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.reasonId}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.lostReason)}>
                <FieldLabel htmlFor="lostReason">Details (optional)</FieldLabel>
                <Textarea
                  id="lostReason"
                  rows={2}
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder={dropKind === "lost" ? "Went with a competitor on price" : "Revisit after their budget cycle in April"}
                />
                <FieldError>{errors.lostReason}</FieldError>
              </Field>
            </>
          ) : (
            <Field data-invalid={Boolean(errors.note)}>
              <FieldLabel htmlFor="stageNote">Note (optional)</FieldLabel>
              <Textarea id="stageNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <FieldError>{errors.note}</FieldError>
            </Field>
          )}

          {isWonStage(to) && (
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
          <Button onClick={submit} disabled={pending} variant={dropping ? "destructive" : "default"}>
            {pending && <LoaderIcon className="animate-spin" />}
            {dropping ? `Mark as ${labels.lost}` : `Move to ${labels[to]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
