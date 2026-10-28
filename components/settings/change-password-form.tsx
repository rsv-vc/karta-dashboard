"use client";

import { LoaderIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { changePassword } from "@/app/(app)/settings/actions";
import { NewPasswordFields } from "@/components/settings/new-password-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const EMPTY = { current: "", password: "", confirm: "" };

/** Change your own password; the server checks the current one first. */
export function ChangePasswordForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setValues(EMPTY);
      setErrors({});
      toast.success("Password changed");
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.current)}>
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.current)}
            value={values.current}
            onChange={(e) => setValues((v) => ({ ...v, current: e.target.value }))}
          />
          <FieldError>{errors.current}</FieldError>
        </Field>
        <NewPasswordFields
          idPrefix="change"
          password={values.password}
          confirm={values.confirm}
          errors={errors}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
        <div>
          <Button type="submit" disabled={pending}>
            {pending && <LoaderIcon className="animate-spin" />}
            Change password
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
