"use client";

import { KeyRoundIcon, LoaderIcon, MoreHorizontalIcon, TargetIcon, UserCheckIcon, UserCogIcon, UserXIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetMemberPassword, setMonthlyTarget, updateMemberAccess } from "@/app/(app)/team/actions";
import { UserAvatar } from "@/components/auth/user-avatar";
import { PasswordReveal } from "@/components/team/password-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TODAY } from "@/lib/constants";
import type { MemberRow } from "@/lib/data/leads";
import { MEMBER_TYPE_LABELS } from "@/lib/team";
import { formatDate, formatINR, formatMonth } from "@/lib/utils";
import type { Role, UserStatus } from "@/types/user";

type Pending =
  | { kind: "reset"; member: MemberRow }
  | { kind: "access"; member: MemberRow; role: Role; status: UserStatus }
  | { kind: "targets"; member: MemberRow };

/** Admin table of everyone with access, with per-member account actions. */
export function MembersCard({
  people,
  viewerId,
  canManageAccounts,
  actions,
}: {
  people: MemberRow[];
  viewerId: string;
  canManageAccounts: boolean;
  actions?: React.ReactNode;
}) {
  const [dialog, setDialog] = useState<Pending | null>(null);
  const active = people.filter((p) => p.status === "active");
  const inactive = people.filter((p) => p.status === "inactive");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members &amp; access</CardTitle>
        <CardDescription>
          Employees have admin access; sales agents see only their own leads. {active.length} active
          {inactive.length > 0 ? `, ${inactive.length} deactivated` : ""}.
        </CardDescription>
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent>
        {!canManageAccounts && (
          <p className="mb-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Adding members and resetting passwords are switched off until the server has its Supabase secret key
            (SUPABASE_SECRET_KEY).
          </p>
        )}
        <ul className="divide-y">
          {[...active, ...inactive].map((m) => (
            <MemberItem
              key={m.id}
              member={m}
              isSelf={m.id === viewerId}
              canManageAccounts={canManageAccounts}
              onAction={setDialog}
            />
          ))}
        </ul>
      </CardContent>

      {dialog?.kind === "reset" && <ResetPasswordDialog member={dialog.member} onClose={() => setDialog(null)} />}
      {dialog?.kind === "access" && (
        <AccessDialog
          member={dialog.member}
          role={dialog.role}
          status={dialog.status}
          agents={active.filter((p) => p.id !== dialog.member.id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "targets" && <TargetsDialog member={dialog.member} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function MemberItem({
  member: m,
  isSelf,
  canManageAccounts,
  onAction,
}: {
  member: MemberRow;
  isSelf: boolean;
  canManageAccounts: boolean;
  onAction: (p: Pending) => void;
}) {
  const isAgent = m.role === "sales_agent";
  const isActive = m.status === "active";
  return (
    <li className="flex items-center gap-3 py-3">
      <UserAvatar name={m.name} className={isActive ? "size-9" : "size-9 opacity-50"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{m.name}</span>
          {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
          <Badge variant={isAgent ? "secondary" : "default"}>{MEMBER_TYPE_LABELS[m.role]}</Badge>
          {!isActive && <Badge variant="outline">Deactivated</Badge>}
          {isActive && m.mustChangePassword && <Badge variant="outline">Temporary password</Badge>}
          {m.isDemo && <Badge variant="outline">Demo</Badge>}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {m.email} · {m.title || MEMBER_TYPE_LABELS[m.role]}
          {isActive && m.activeLeads > 0 ? ` · ${m.activeLeads} open ${m.activeLeads === 1 ? "account" : "accounts"}` : ""} · joined{" "}
          {formatDate(m.joinedAt)}
        </p>
      </div>
      {!isSelf && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${m.name}`}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isActive && (isAgent || m.activeLeads > 0) && (
              <DropdownMenuItem onSelect={() => onAction({ kind: "targets", member: m })}>
                <TargetIcon />
                Edit targets
              </DropdownMenuItem>
            )}
            {isActive && (
              <DropdownMenuItem disabled={!canManageAccounts || m.isDemo} onSelect={() => onAction({ kind: "reset", member: m })}>
                <KeyRoundIcon />
                Reset password
              </DropdownMenuItem>
            )}
            {isActive && (
              <DropdownMenuItem
                onSelect={() =>
                  onAction({ kind: "access", member: m, role: isAgent ? "admin" : "sales_agent", status: "active" })
                }
              >
                <UserCogIcon />
                Make {MEMBER_TYPE_LABELS[isAgent ? "admin" : "sales_agent"].toLowerCase()}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {isActive ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onAction({ kind: "access", member: m, role: m.role, status: "inactive" })}
              >
                <UserXIcon />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onAction({ kind: "access", member: m, role: m.role, status: "active" })}>
                <UserCheckIcon />
                Reactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function ResetPasswordDialog({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const [password, setPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    startTransition(async () => {
      const result = await resetMemberPassword(member.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPassword(result.password ?? "");
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password · {member.name}</DialogTitle>
          <DialogDescription>
            {password
              ? "Their old password no longer works."
              : "They get a new temporary password and must choose their own at the next sign-in. Their current password stops working."}
          </DialogDescription>
        </DialogHeader>
        {password !== null && <PasswordReveal email={member.email} password={password} />}
        <DialogFooter>
          {password === null ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={reset} disabled={pending}>
                {pending && <LoaderIcon className="animate-spin" />}
                Reset password
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({
  member,
  role,
  status,
  agents,
  onClose,
}: {
  member: MemberRow;
  role: Role;
  status: UserStatus;
  agents: MemberRow[];
  onClose: () => void;
}) {
  const [reassignTo, setReassignTo] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // Only deactivation needs someone to take over open accounts (admins can own accounts too).
  const needsRecipient = status !== "active" && member.activeLeads > 0;

  const copy =
    status === "inactive"
      ? {
          title: `Deactivate ${member.name}?`,
          body: "They are signed out and cannot sign in. Their history stays. You can reactivate them later.",
          action: "Deactivate",
        }
      : member.status === "inactive"
        ? { title: `Reactivate ${member.name}?`, body: "They can sign in again with their existing password.", action: "Reactivate" }
        : {
            title: `Make ${member.name} ${role === "admin" ? "an employee" : "a sales agent"}?`,
            body:
              role === "admin"
                ? "Employees get admin access to every lead, the team and reports. They need a company email address."
                : "Sales agents see and work only their own accounts.",
            action: `Make ${MEMBER_TYPE_LABELS[role].toLowerCase()}`,
          };

  function submit() {
    if (needsRecipient && !reassignTo) {
      setError("Pick who takes over their open accounts");
      return;
    }
    startTransition(async () => {
      const result = await updateMemberAccess(member.id, { role, status, reassignTo: reassignTo || undefined });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`${member.name} updated`);
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        {needsRecipient && (
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="reassign-to">
              Move their {member.activeLeads} open {member.activeLeads === 1 ? "account" : "accounts"} to
            </FieldLabel>
            <Select value={reassignTo || undefined} onValueChange={setReassignTo}>
              <SelectTrigger id="reassign-to" className="w-full" aria-invalid={Boolean(error)}>
                <SelectValue placeholder="Select agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.activeLeads} active)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Each account records the reassignment in its activity.</FieldDescription>
          </Field>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={status === "inactive" ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending && <LoaderIcon className="animate-spin" />}
            {copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** This month and the next two: targets are set ahead, not rewritten for the past. */
function targetMonths(): string[] {
  const [y, m] = TODAY.split("-").map(Number);
  return [0, 1, 2].map((i) => {
    const index = y * 12 + (m - 1) + i;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  });
}

function TargetsDialog({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const months = targetMonths();
  const [values, setValues] = useState({
    month: months[0],
    wonValue: String(member.target?.wonValue ?? 0),
    newLeads: String(member.target?.newLeads ?? 0),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await setMonthlyTarget({ userId: member.id, ...values });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`Targets saved for ${member.name}, ${formatMonth(values.month)}`);
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Targets · {member.name}</DialogTitle>
          <DialogDescription>
            This month: {formatINR(member.target?.wonValue ?? 0)} won and {member.target?.newLeads ?? 0} new leads.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="target-month">Month</FieldLabel>
            <Select value={values.month} onValueChange={(month) => setValues((v) => ({ ...v, month }))}>
              <SelectTrigger id="target-month" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.wonValue)}>
              <FieldLabel htmlFor="target-won">Deals won (₹)</FieldLabel>
              <Input
                id="target-won"
                type="number"
                inputMode="numeric"
                min={0}
                step={100000}
                aria-invalid={Boolean(errors.wonValue)}
                value={values.wonValue}
                onChange={(e) => setValues((v) => ({ ...v, wonValue: e.target.value }))}
              />
              <FieldError>{errors.wonValue}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.newLeads)}>
              <FieldLabel htmlFor="target-leads">New leads</FieldLabel>
              <Input
                id="target-leads"
                type="number"
                inputMode="numeric"
                min={0}
                aria-invalid={Boolean(errors.newLeads)}
                value={values.newLeads}
                onChange={(e) => setValues((v) => ({ ...v, newLeads: e.target.value }))}
              />
              <FieldError>{errors.newLeads}</FieldError>
            </Field>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <LoaderIcon className="animate-spin" />}
            Save targets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
