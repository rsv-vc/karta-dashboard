"use client";

import { ArrowRightLeftIcon, ClockIcon, LoaderIcon, SearchIcon } from "lucide-react";
import { createContext, use, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { reassignLeads } from "@/app/(app)/leads/actions";
import { FollowUpLabel } from "@/components/leads/follow-up-label";
import { StageBadge } from "@/components/shared/stage-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReassignableLead } from "@/lib/data/leads";
import type { Role } from "@/types/user";

export interface AllocatableMember {
  id: string;
  name: string;
  role: Role;
}

const ANYONE = "anyone";

// One allocation dialog for the Team page; the header button and each card's
// "Allocate leads" button open it (a card pre-fills who receives the leads).
const AllocateContext = createContext<((toId?: string) => void) | null>(null);

/** Admin tool: give open accounts (from anyone) to a sales agent or an employee. Each account records the hand-over. */
export function AllocateProvider({
  members,
  leads,
  children,
}: {
  members: AllocatableMember[];
  leads: ReassignableLead[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState("");
  const [fromId, setFromId] = useState(ANYONE);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown";
  const agents = members.filter((m) => m.role === "sales_agent");
  const employees = members.filter((m) => m.role === "admin");
  const owners = [...new Set(leads.map((l) => l.ownerId))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const q = query.trim().toLowerCase();
  const visible = leads.filter(
    (l) => l.ownerId !== toId && (fromId === ANYONE || l.ownerId === fromId) && (!q || l.companyName.toLowerCase().includes(q)),
  );
  const allVisibleSelected = visible.length > 0 && visible.every((l) => selected.has(l.id));
  const toName = toId ? nameOf(toId) : "";

  function openFor(to?: string) {
    setToId(to ?? "");
    setFromId(ANYONE);
    setQuery("");
    setSelected(new Set());
    setOpen(true);
  }

  function pickTo(id: string) {
    setToId(id);
    // Accounts the new owner already has cannot be allocated to them.
    setSelected((prev) => new Set([...prev].filter((leadId) => leads.find((l) => l.id === leadId)?.ownerId !== id)));
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const l of visible) {
        if (checked) next.add(l.id);
        else next.delete(l.id);
      }
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await reassignLeads({ leadIds: [...selected], toOwnerId: toId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Allocated ${result.moved} ${result.moved === 1 ? "account" : "accounts"} to ${toName}`);
      setOpen(false);
    });
  }

  const memberItems = (list: AllocatableMember[]) =>
    list.map((m) => (
      <SelectItem key={m.id} value={m.id}>
        {m.name}
      </SelectItem>
    ));

  return (
    <AllocateContext value={openFor}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Allocate leads</DialogTitle>
            <DialogDescription>
              Give open accounts to a sales agent or an employee. They see them under My leads straight away and get a
              notification; each account records the hand-over.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="allocateTo">Allocate to</FieldLabel>
              <Select value={toId || undefined} onValueChange={pickTo}>
                <SelectTrigger id="allocateTo" className="w-full">
                  <SelectValue placeholder="Pick a person…" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Sales agents</SelectLabel>
                      {memberItems(agents)}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>Employees</SelectLabel>
                    {memberItems(employees)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="allocateFrom">Currently with</FieldLabel>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger id="allocateFrom" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANYONE}>Anyone ({leads.length})</SelectItem>
                  {owners.map((id) => (
                    <SelectItem key={id} value={id}>
                      {nameOf(id)} ({leads.filter((l) => l.ownerId === id).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search accounts"
                placeholder="Search accounts…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Field orientation="horizontal">
              <Checkbox id="allocateAll" checked={allVisibleSelected} disabled={visible.length === 0} onCheckedChange={(c) => toggleVisible(c === true)} />
              <FieldLabel htmlFor="allocateAll" className="font-normal">
                Select all {visible.length} shown
              </FieldLabel>
              {selected.size > 0 && <span className="ml-auto text-sm text-muted-foreground tabular-nums">{selected.size} selected</span>}
            </Field>
            <ScrollArea className="h-72 rounded-lg border">
              {visible.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No open accounts match.</p>
              ) : (
                <ul className="divide-y">
                  {visible.map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                        <Checkbox checked={selected.has(l.id)} onCheckedChange={(c) => toggle(l.id, c === true)} aria-label={l.companyName} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{l.companyName}</span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="text-muted-foreground">{nameOf(l.ownerId)}</span>
                            <StageBadge stage={l.stage} />
                            <FollowUpLabel date={l.nextFollowUpAt} />
                            {l.stale && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <ClockIcon className="size-3" aria-hidden="true" /> stale
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || selected.size === 0 || !toId}>
              {pending && <LoaderIcon className="animate-spin" />}
              Allocate {selected.size} {selected.size === 1 ? "account" : "accounts"}
              {toName ? ` to ${toName}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AllocateContext>
  );
}

/** Opens the Team page's allocation dialog, optionally for one person. */
export function AllocateButton({
  toId,
  children = "Allocate leads",
  variant = "default",
  size = "default",
}: {
  toId?: string;
  children?: ReactNode;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  const open = use(AllocateContext);
  if (!open) throw new Error("AllocateButton must be used within an AllocateProvider");
  return (
    <Button variant={variant} size={size} onClick={() => open(toId)}>
      <ArrowRightLeftIcon />
      {children}
    </Button>
  );
}
