"use client";

import { LoaderIcon } from "lucide-react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import type { MasterResult } from "@/app/(app)/masters/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";

/** Empty input = null; anything else as a number (NaN when not one, for zod to reject). */
export const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Shared shell for the master edit dialogs: a form, its field errors, and a
 * toast with how many accounts were recalculated.
 */
export function useMasterForm(onDone: () => void) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<MasterResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      const recalculated = result.recalculated ? ` ${result.recalculated} account${result.recalculated === 1 ? "" : "s"} recalculated.` : "";
      toast.success(`${success}.${recalculated}`);
      onDone();
    });
  }

  return { errors, pending, run };
}

export function MasterDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  onSubmit,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  pending: boolean;
  onSubmit: () => void;
  children: ReactNode;
  /** Extra buttons on the left (e.g. Delete). */
  footer?: ReactNode;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <FieldGroup>{children}</FieldGroup>
          <DialogFooter className="sm:justify-between">
            <div>{footer}</div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderIcon className="animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
