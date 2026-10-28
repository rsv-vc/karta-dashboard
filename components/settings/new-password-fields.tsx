"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH, passwordStrength, type PasswordStrength } from "@/lib/team";
import { cn } from "@/lib/utils";

const STRENGTH_STYLE: Record<PasswordStrength, { width: string; bar: string }> = {
  "too short": { width: "w-1/12", bar: "bg-muted-foreground/40" },
  weak: { width: "w-1/3", bar: "bg-red-600 dark:bg-red-400" },
  fair: { width: "w-2/3", bar: "bg-amber-500" },
  strong: { width: "w-full", bar: "bg-green-600 dark:bg-green-400" },
};

/** New password + confirmation, with a strength hint that never relies on colour alone. */
export function NewPasswordFields({
  password,
  confirm,
  onChange,
  errors,
  idPrefix = "new",
}: {
  password: string;
  confirm: string;
  onChange: (key: "password" | "confirm", value: string) => void;
  errors: Record<string, string>;
  idPrefix?: string;
}) {
  const strength = passwordStrength(password);
  const style = STRENGTH_STYLE[strength];
  return (
    <>
      <Field data-invalid={Boolean(errors.password)}>
        <FieldLabel htmlFor={`${idPrefix}-password`}>New password</FieldLabel>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={`${idPrefix}-password-hint`}
          aria-invalid={Boolean(errors.password)}
          value={password}
          onChange={(e) => onChange("password", e.target.value)}
        />
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className={cn("h-full rounded-full transition-all motion-reduce:transition-none", style.width, style.bar)} />
        </div>
        <FieldDescription id={`${idPrefix}-password-hint`} aria-live="polite">
          {password ? `Strength: ${strength}. ` : ""}At least {MIN_PASSWORD_LENGTH} characters; a short phrase is
          easiest to remember.
        </FieldDescription>
        <FieldError>{errors.password}</FieldError>
      </Field>
      <Field data-invalid={Boolean(errors.confirm)}>
        <FieldLabel htmlFor={`${idPrefix}-confirm`}>Repeat new password</FieldLabel>
        <Input
          id={`${idPrefix}-confirm`}
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.confirm)}
          value={confirm}
          onChange={(e) => onChange("confirm", e.target.value)}
        />
        <FieldError>{errors.confirm}</FieldError>
      </Field>
    </>
  );
}
