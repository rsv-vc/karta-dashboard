"use client";

import { LoaderIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteLead } from "@/app/(app)/leads/actions";
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

/** Admin-only delete with a confirmation step. */
export function DeleteLeadButton({ leadId, companyName }: { leadId: string; companyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteLead(leadId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${companyName} deleted`);
      setOpen(false);
      router.push("/leads");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete lead" className="text-destructive hover:text-destructive">
          <Trash2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {companyName}?</DialogTitle>
          <DialogDescription>
            This removes the lead and its activity history for everyone. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <LoaderIcon className="animate-spin" />}
            Delete lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
