"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** A temporary password, shown once, with a copy button. */
export function PasswordReveal({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">Sign-in email</p>
        <p className="truncate text-sm font-medium">{email}</p>
        <p className="mt-3 text-xs text-muted-foreground">Temporary password</p>
        <div className="flex items-center justify-between gap-2">
          <code className="font-mono text-base font-semibold tracking-wide select-all">{password}</code>
          <Button variant="outline" size="sm" onClick={copy} aria-label="Copy the temporary password">
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        Share it privately (in person or a direct message). It is shown only now; they will choose their own password the
        first time they sign in.
      </p>
    </div>
  );
}
