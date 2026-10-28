import { z } from "zod";
import type { Role, User } from "@/types/user";

// Team lookups for pure modules. The team itself comes from the database
// (lib/data/repo.ts fetchTeam) or, in check scripts, from the seed fixture.

export type NameOf = (userId: string) => string;

/** id -> display name, with a fallback for people who are no longer on the team. */
export function nameLookup(team: readonly Pick<User, "id" | "name">[], fallback = "Unknown"): NameOf {
  const names = new Map(team.map((u) => [u.id, u.name]));
  return (id) => names.get(id) ?? fallback;
}

/** Active sales agents: the people who can own leads. */
export function activeAgents<T extends Pick<User, "role" | "status">>(team: readonly T[]): T[] {
  return team.filter((u) => u.role === "sales_agent" && u.status === "active");
}

// Members --------------------------------------------------------------------

/** What the team page calls each role: in-house employees are admins, outsourced sellers are agents. */
export const MEMBER_TYPE_LABELS: Record<Role, string> = {
  admin: "Employee",
  sales_agent: "Sales agent",
};

const nameField = z.string().trim().min(1, "Enter their name").max(120, "Keep the name under 120 characters");
const titleField = z.string().trim().max(80, "Keep the title under 80 characters");

export const addMemberSchema = z.object({
  name: nameField,
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  role: z.enum(["admin", "sales_agent"]),
  title: titleField,
});
export type AddMemberValues = z.input<typeof addMemberSchema>;

export const profileSchema = z.object({ name: nameField, title: titleField });
export type ProfileValues = z.input<typeof profileSchema>;

export const MIN_PASSWORD_LENGTH = 10;
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords do not match" });
export type NewPasswordValues = z.input<typeof newPasswordSchema>;

export const allowedEmailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

/** The part after "@", lower-cased. */
export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/**
 * Mirrors private.email_allowed in the database (which has the final say):
 * employees need a company address; agents a company or allowed outside address.
 */
export function isEmailAllowed(email: string, role: Role, companyDomains: readonly string[], allowed: readonly string[]): boolean {
  const normalized = email.trim().toLowerCase();
  if (companyDomains.includes(emailDomain(normalized))) return true;
  return role === "sales_agent" && allowed.includes(normalized);
}

// Unambiguous characters only (no 0/O, 1/l/I), so a password read aloud or copied by hand survives.
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** A random temporary password, e.g. "7hQm-x3Kd-PwZ9-tR4e" (16 random characters). */
export function generateTempPassword(): string {
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export type PasswordStrength = "too short" | "weak" | "fair" | "strong";

/** A rough hint for the new-password form; length matters most. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return "too short";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const score = kinds + (password.length >= 14 ? 1 : 0) + (password.length >= 18 ? 1 : 0);
  return score >= 4 ? "strong" : score >= 3 ? "fair" : "weak";
}
