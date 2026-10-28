"use client";

import { LoaderIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { setNewPassword } from "@/app/auth/set-password/actions";
import { NewPasswordFields } from "@/components/settings/new-password-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { toFieldErrors } from "@/lib/leads/schemas";
import { newPasswordSchema } from "@/lib/team";

/** First sign-in after an admin set a temporary password. */
export function SetPasswordForm() {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = newPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      // Redirects into the app on success.
      const result = await setNewPassword(parsed.data);
      setErrors({ ...(result.fieldErrors ?? {}), _form: result.error });
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <NewPasswordFields
          password={values.password}
          confirm={values.confirm}
          errors={errors}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
        {errors._form && (
          <p role="alert" className="text-sm text-destructive">
            {errors._form}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <LoaderIcon className="animate-spin" />}
          Save password and continue
        </Button>
      </FieldGroup>
    </form>
  );
}
