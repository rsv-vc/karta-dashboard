"use client";

import { ArrowRightLeftIcon, ClockIcon, LoaderIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reassignLeads } from "@/app/(app)/leads/actions";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { StageBadge } from "@/components/shared/stage-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReassignableLead } from "@/lib/data/leads";

/** Admin tool: move a selection of one agent's active leads to another agent. */
export function ReassignDialog({ agents, leads }: { agents: { id: string; name: string }[]; leads: ReassignableLead[] }) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const fromLeads = leads.filter((l) => l.ownerId === fromId);
  const toName = agents.find((a) => a.id === toId)?.name;
  const allSelected = fromLeads.length > 0 && fromLeads.every((l) => selected.has(l.id));

  function pickFrom(id: string) {
    setFromId(id);
    setSelected(new Set());
    if (id === toId) setToId("");
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function reset() {
    setFromId("");
    setToId("");
    setSelected(new Set());
  }

  function submit() {
    startTransition(async () => {
      const result = await reassignLeads({ leadIds: [...selected], toOwnerId: toId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved ${result.moved} ${result.moved === 1 ? "lead" : "leads"} to ${toName}`);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <ArrowRightLeftIcon />
          Rebalance leads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rebalance leads</DialogTitle>
          <DialogDescription>Move active leads from one agent to another. Each lead records the reassignment.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="fromAgent">From</FieldLabel>
            <Select value={fromId || undefined} onValueChange={pickFrom}>
              <SelectTrigger id="fromAgent" className="w-full">
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({leads.filter((l) => l.ownerId === a.id).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="toAgent">To</FieldLabel>
            <Select value={toId || undefined} onValueChange={setToId}>
              <SelectTrigger id="toAgent" className="w-full">
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter((a) => a.id !== fromId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {fromId && (
          <div className="flex flex-col gap-2">
            <Field orientation="horizontal">
              <Checkbox
                id="selectAll"
                checked={allSelected}
                onCheckedChange={(c) => setSelected(c === true ? new Set(fromLeads.map((l) => l.id)) : new Set())}
              />
              <FieldLabel htmlFor="selectAll" className="font-normal">
                Select all {fromLeads.length} active leads
              </FieldLabel>
            </Field>
            <ScrollArea className="h-64 rounded-lg border">
              <ul className="divide-y">
                {fromLeads.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={(c) => toggle(l.id, c === true)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{l.companyName}</span>
                        <span className="flex items-center gap-2 text-xs">
                          <StageBadge stage={l.stage} />
                          <FollowUpLabel date={l.nextFollowUpAt} />
                          {l.stale && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <ClockIcon className="size-3" /> stale
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || selected.size === 0 || !toId}>
            {pending && <LoaderIcon className="animate-spin" />}
            Move {selected.size} {selected.size === 1 ? "lead" : "leads"}
            {toName ? ` to ${toName}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
