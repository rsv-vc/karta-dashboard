"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFollowUp } from "@/app/(app)/leads/actions";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TODAY } from "@/lib/constants";
import { toDateKey } from "@/lib/dates";

/** Shows the next follow-up and lets the owner reschedule or clear it inline. */
export function FollowUpEditor({ leadId, current }: { leadId: string; current: string | null }) {
  const [date, setDate] = useState(current ? toDateKey(current) : "");
  const [pending, startTransition] = useTransition();
  const unchanged = date === (current ? toDateKey(current) : "");

  function save(next: string) {
    startTransition(async () => {
      const result = await setFollowUp(leadId, { date: next });
      if (!result.ok) {
        toast.error(result.fieldErrors?.date ?? result.error);
        return;
      }
      setDate(next);
      toast.success(next ? "Follow-up scheduled" : "Follow-up cleared");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm">
        <FollowUpLabel date={current} />
      </div>
      <div className="flex gap-2">
        <Input
          type="date"
          min={TODAY}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Next follow-up date"
          className="h-8"
        />
        <Button size="sm" className="h-8" onClick={() => save(date)} disabled={pending || unchanged || !date}>
          Save
        </Button>
        {current && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => save("")} disabled={pending}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
