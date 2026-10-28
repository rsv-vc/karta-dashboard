"use client";

import { LoaderIcon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { addAllowedEmail, removeAllowedEmail } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { allowedEmailSchema } from "@/lib/team";

/** Outside addresses (not on a company domain) that may be used for sales agent accounts. */
export function AllowedEmailsCard({ companyDomains, allowedEmails }: { companyDomains: string[]; allowedEmails: string[] }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  function add(e: FormEvent) {
    e.preventDefault();
    const parsed = allowedEmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    startTransition(async () => {
      const result = await addAllowedEmail(parsed.data);
      if (!result.ok) {
        setError(result.fieldErrors?.email ?? result.error);
        return;
      }
      setEmail("");
      setError("");
      toast.success(`${parsed.data} allowed`);
    });
  }

  function remove(address: string) {
    setRemoving(address);
    startTransition(async () => {
      const result = await removeAllowedEmail(address);
      setRemoving(null);
      if (!result.ok) toast.error(result.error);
      else toast.success(`${address} removed`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allowed outside emails</CardTitle>
        <CardDescription>
          Company addresses ({companyDomains.map((d) => `@${d}`).join(", ")}) are always allowed. Add outsourced
          agents&apos; own addresses here before creating their accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={add} noValidate className="flex items-start gap-2">
          <Field data-invalid={Boolean(error)} className="flex-1">
            <FieldLabel htmlFor="allowed-email" className="sr-only">
              Email address to allow
            </FieldLabel>
            <Input
              id="allowed-email"
              type="email"
              placeholder="agent@example.com"
              autoComplete="off"
              aria-invalid={Boolean(error)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending && !removing ? <LoaderIcon className="animate-spin" /> : <PlusIcon />}
            Allow
          </Button>
        </form>
        {allowedEmails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outside emails yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {allowedEmails.map((address) => (
              <li key={address} className="flex items-center justify-between gap-2 py-1 pr-1 pl-3">
                <span className="truncate text-sm">{address}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${address}`}
                  disabled={removing === address}
                  onClick={() => remove(address)}
                >
                  {removing === address ? <LoaderIcon className="animate-spin" /> : <XIcon />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
