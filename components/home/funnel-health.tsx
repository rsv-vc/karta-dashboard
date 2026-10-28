"use client";

import { LoaderIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFunnelAction, saveFunnelAction, setFunnelActionStatus } from "@/app/(app)/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABELS,
  FUNNELS,
  funnelActionSchema,
  type ActionStatusValue,
  type FunnelActionValues,
} from "@/lib/dashboard/funnel-health";
import type { FunnelAction } from "@/lib/data/repo";
import { toFieldErrors } from "@/lib/leads/schemas";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ActionStatusValue, string> = {
  open: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  started: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  scheduled: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  under_review: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

const EMPTY: FunnelActionValues = { funnel: 1, problem: "", fix: "", owner: "", due: "", status: "open" };

/** The three funnels' problems and fixes. Everyone reads it; admins edit it. */
export function FunnelHealth({ actions, canEdit }: { actions: FunnelAction[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<{ id: number | null; values: FunnelActionValues } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funnel health</CardTitle>
        <CardDescription>The problem in each funnel, the fix, who owns it and where it stands. Update weekly.</CardDescription>
        {canEdit && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setEditing({ id: null, values: EMPTY })}>
              <PlusIcon />
              Add
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {([1, 2, 3] as const).map((funnel) => {
          const rows = actions.filter((a) => a.funnel === funnel);
          return (
            <section key={funnel} aria-labelledby={`funnel-${funnel}`}>
              <h3 id={`funnel-${funnel}`} className="mb-2 text-sm font-medium">
                {funnel}. {FUNNELS[funnel]}
              </h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing logged.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {rows.map((a) => (
                    <ActionRow
                      key={a.id}
                      action={a}
                      canEdit={canEdit}
                      onEdit={() =>
                        setEditing({
                          id: a.id,
                          values: { funnel: a.funnel, problem: a.problem, fix: a.fix, owner: a.owner, due: a.due, status: a.status },
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </CardContent>
      {editing && <ActionDialog id={editing.id} initial={editing.values} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ActionRow({ action: a, canEdit, onEdit }: { action: FunnelAction; canEdit: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function changeStatus(status: string) {
    startTransition(async () => {
      const result = await setFunnelActionStatus(a.id, status);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <li className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{a.problem}</p>
        {a.fix && <p className="text-muted-foreground">Fix: {a.fix}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {[a.owner && `Owner: ${a.owner}`, a.due && `Due: ${a.due}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canEdit ? (
          <>
            <Select value={a.status} onValueChange={changeStatus} disabled={pending}>
              <SelectTrigger size="sm" className="w-40" aria-label={`Status of: ${a.problem}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ACTION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit: ${a.problem}`} onClick={onEdit}>
              <PencilIcon />
            </Button>
          </>
        ) : (
          <Badge variant="outline" className={cn("border-transparent", STATUS_STYLE[a.status])}>
            {ACTION_STATUS_LABELS[a.status]}
          </Badge>
        )}
      </div>
    </li>
  );
}

function ActionDialog({ id, initial, onClose }: { id: number | null; initial: FunnelActionValues; onClose: () => void }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof FunnelActionValues>(key: K, value: FunnelActionValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  function save() {
    const parsed = funnelActionSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await saveFunnelAction(id, parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(id === null ? "Added to funnel health" : "Saved");
      onClose();
    });
  }

  function remove() {
    if (id === null) return;
    startTransition(async () => {
      const result = await deleteFunnelAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{id === null ? "Add to funnel health" : "Edit funnel health"}</DialogTitle>
          <DialogDescription>A problem in one of the three funnels, and the fix the team agreed.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="health-funnel">Funnel</FieldLabel>
              <Select value={String(values.funnel)} onValueChange={(v) => set("funnel", Number(v) as 1 | 2 | 3)}>
                <SelectTrigger id="health-funnel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([1, 2, 3] as const).map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      {f}. {FUNNELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="health-status">Status</FieldLabel>
              <Select value={values.status} onValueChange={(v) => set("status", v as ActionStatusValue)}>
                <SelectTrigger id="health-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ACTION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.problem)}>
            <FieldLabel htmlFor="health-problem">Problem</FieldLabel>
            <Textarea id="health-problem" rows={2} value={values.problem} onChange={(e) => set("problem", e.target.value)} aria-invalid={Boolean(errors.problem)} />
            <FieldError>{errors.problem}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.fix)}>
            <FieldLabel htmlFor="health-fix">Fix</FieldLabel>
            <Textarea id="health-fix" rows={2} value={values.fix} onChange={(e) => set("fix", e.target.value)} />
            <FieldError>{errors.fix}</FieldError>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="health-owner">Owner</FieldLabel>
              <Input id="health-owner" value={values.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Nishma, Vijaypal" />
            </Field>
            <Field>
              <FieldLabel htmlFor="health-due">Due</FieldLabel>
              <Input id="health-due" value={values.due} onChange={(e) => set("due", e.target.value)} placeholder="Next sync" />
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter className="sm:justify-between">
          {id !== null ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={pending}>
              <Trash2Icon />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending && <LoaderIcon className="animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
