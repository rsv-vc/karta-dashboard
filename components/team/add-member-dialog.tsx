"use client";

import { LoaderIcon, UserPlusIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { addMember } from "@/app/(app)/team/actions";
import { PasswordReveal } from "@/components/team/password-reveal";
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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toFieldErrors } from "@/lib/leads/schemas";
import { MEMBER_TYPE_LABELS, addMemberSchema, type AddMemberValues } from "@/lib/team";
import type { Role } from "@/types/user";

const EMPTY: AddMemberValues = { name: "", email: "", role: "sales_agent", title: "" };

const TYPE_HINTS: Record<Role, string> = {
  admin: "In-house staff. Full admin access: every lead, the team and reports.",
  sales_agent: "Outsourced seller. Sees and works only their own leads.",
};

/** Admin: create an employee or sales agent and hand over a one-time temporary password. */
export function AddMemberDialog({ companyDomains, disabled }: { companyDomains: string[]; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<AddMemberValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof AddMemberValues>(key: K, value: AddMemberValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const domains = companyDomains.map((d) => `@${d}`).join(", ");

  function reset() {
    setValues(EMPTY);
    setErrors({});
    setCreated(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = addMemberSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await addMember(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(`${parsed.data.name} added`);
      setCreated({ email: parsed.data.email, password: result.password ?? "" });
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
        <Button variant="outline" disabled={disabled}>
          <UserPlusIcon />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Member added" : "Add member"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Give them these details to sign in."
              : "Creates their account with a temporary password. No email is sent."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <>
            <PasswordReveal email={created.email} password={created.password} />
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Add another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Type</FieldLegend>
                <RadioGroup value={values.role} onValueChange={(v) => set("role", v as Role)}>
                  {(["admin", "sales_agent"] as const).map((role) => (
                    <Field key={role} orientation="horizontal">
                      <RadioGroupItem value={role} id={`member-role-${role}`} />
                      <FieldContent>
                        <FieldLabel htmlFor={`member-role-${role}`} className="font-medium">
                          {MEMBER_TYPE_LABELS[role]}
                        </FieldLabel>
                        <FieldDescription>{TYPE_HINTS[role]}</FieldDescription>
                      </FieldContent>
                    </Field>
                  ))}
                </RadioGroup>
              </FieldSet>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="member-name">Name</FieldLabel>
                  <Input
                    id="member-name"
                    required
                    aria-invalid={Boolean(errors.name)}
                    value={values.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                  <FieldError>{errors.name}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.title)}>
                  <FieldLabel htmlFor="member-title">Job title (optional)</FieldLabel>
                  <Input
                    id="member-title"
                    placeholder={MEMBER_TYPE_LABELS[values.role]}
                    aria-invalid={Boolean(errors.title)}
                    value={values.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                  <FieldError>{errors.title}</FieldError>
                </Field>
              </div>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="member-email">Email</FieldLabel>
                <Input
                  id="member-email"
                  type="email"
                  required
                  autoComplete="off"
                  aria-describedby="member-email-hint"
                  aria-invalid={Boolean(errors.email)}
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                />
                <FieldDescription id="member-email-hint">
                  {values.role === "admin"
                    ? `Employees need a company address (${domains}).`
                    : `A company address (${domains}) or one on the allowed outside emails list.`}
                </FieldDescription>
                <FieldError>{errors.email}</FieldError>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <LoaderIcon className="animate-spin" />}
                  Add {MEMBER_TYPE_LABELS[values.role].toLowerCase()}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
