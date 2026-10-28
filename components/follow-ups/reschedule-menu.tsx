"use client";

import { CalendarClockIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFollowUp } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { TODAY } from "@/lib/constants";
import { fromDayNumber, toDayNumber } from "@/lib/dates";
import { formatDate } from "@/lib/utils";

/** Days from TODAY as a date key; never uses the real clock's date. */
const inDays = (n: number) => fromDayNumber(toDayNumber(TODAY) + n);

const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

/** Quick reschedule for a follow-up: presets, a custom date, or clear. */
export function RescheduleMenu({ leadId, companyName }: { leadId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [pending, startTransition] = useTransition();

  function apply(date: string) {
    startTransition(async () => {
      const result = await setFollowUp(leadId, { date });
      if (!result.ok) {
        toast.error(result.fieldErrors?.date ?? result.error);
        return;
      }
      toast.success(date ? `${companyName}: follow-up moved to ${formatDate(date)}` : `${companyName}: follow-up cleared`);
      setOpen(false);
      setCustom("");
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Reschedule follow-up for ${companyName}`}>
          <CalendarClockIcon />
          <span className="hidden sm:inline">Reschedule</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="flex flex-col gap-0.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              className="justify-between"
              disabled={pending}
              onClick={() => apply(inDays(p.days))}
            >
              {p.label}
              <span className="text-xs text-muted-foreground">{formatDate(inDays(p.days)).slice(0, -5)}</span>
            </Button>
          ))}
        </div>
        <Separator className="my-2" />
        <div className="flex gap-2">
          <Input
            type="date"
            min={TODAY}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Pick a date"
            className="h-8"
          />
          <Button size="sm" className="h-8" disabled={!custom || pending} onClick={() => apply(custom)}>
            Set
          </Button>
        </div>
        <Separator className="my-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          disabled={pending}
          onClick={() => apply("")}
        >
          Clear follow-up
        </Button>
      </PopoverContent>
    </Popover>
  );
}
