"use client";

import { LoaderIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toFieldErrors } from "@/lib/leads/schemas";
import { profileSchema, type ProfileValues } from "@/lib/team";

/** Your own name and job title (the only profile fields people may change themselves). */
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const changed = values.name !== saved.name || values.title !== saved.title;

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      const result = await updateProfile(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setSaved(values);
      toast.success("Profile saved");
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <Input
              id="profile-name"
              autoComplete="name"
              required
              aria-invalid={Boolean(errors.name)}
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.title)}>
            <FieldLabel htmlFor="profile-title">Job title</FieldLabel>
            <Input
              id="profile-title"
              autoComplete="organization-title"
              aria-invalid={Boolean(errors.title)}
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            />
            <FieldError>{errors.title}</FieldError>
          </Field>
        </div>
        <div>
          <Button type="submit" disabled={pending || !changed}>
            {pending && <LoaderIcon className="animate-spin" />}
            Save profile
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
