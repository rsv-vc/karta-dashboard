// Member and password rules (lib/team.ts): `npm run check:accounts`.
import {
  MIN_PASSWORD_LENGTH,
  addMemberSchema,
  emailDomain,
  generateTempPassword,
  isEmailAllowed,
  newPasswordSchema,
  passwordStrength,
} from "@/lib/team";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const domains = ["getkarta.ai"];
const allowed = ["agent@gmail.com"];

check("company email is allowed for an employee", isEmailAllowed("Asha@GetKarta.ai", "admin", domains, allowed));
check("company email is allowed for an agent", isEmailAllowed("ravi@getkarta.ai", "sales_agent", domains, allowed));
check("allowed outside email works for an agent", isEmailAllowed(" Agent@Gmail.com ", "sales_agent", domains, allowed));
check("…but never for an employee", !isEmailAllowed("agent@gmail.com", "admin", domains, allowed));
check("unknown outside email is refused", !isEmailAllowed("someone@gmail.com", "sales_agent", domains, allowed));
check("look-alike domains are refused", !isEmailAllowed("x@getkarta.ai.evil.com", "admin", domains, allowed) && !isEmailAllowed("x@notgetkarta.ai", "admin", domains, allowed));
check("emailDomain lower-cases", emailDomain("A@B.CO") === "b.co");

const passwords = Array.from({ length: 200 }, generateTempPassword);
check("temporary passwords look like xxxx-xxxx-xxxx-xxxx", passwords.every((p) => /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/.test(p)));
check("…avoid look-alike characters", passwords.every((p) => !/[01OIl]/.test(p)));
check("…and do not repeat", new Set(passwords).size === passwords.length);
check("…and pass the new-password rule", passwords.every((p) => newPasswordSchema.safeParse({ password: p, confirm: p }).success));

check(`passwords under ${MIN_PASSWORD_LENGTH} characters are too short`, passwordStrength("Ab1!xyz") === "too short");
check("a long lowercase phrase is at least fair", passwordStrength("correct horse battery") !== "weak");
check("ten lowercase letters are weak", passwordStrength("abcdefghij") === "weak");
check("mixed classes and length are strong", passwordStrength("Tr0ub4dor&3-horse") === "strong");
check("mismatched confirmation is refused", !newPasswordSchema.safeParse({ password: "long enough pw", confirm: "long enough pW" }).success);

const member = addMemberSchema.safeParse({ name: "  Asha Rao ", email: " Asha@GetKarta.ai ", role: "admin", title: "" });
check("member input is trimmed and the email lower-cased", member.success && member.data.name === "Asha Rao" && member.data.email === "asha@getkarta.ai");
check("a member needs a name", !addMemberSchema.safeParse({ name: " ", email: "a@getkarta.ai", role: "admin", title: "" }).success);
check("roles are limited to employee/agent", !addMemberSchema.safeParse({ name: "A", email: "a@getkarta.ai", role: "owner", title: "" }).success);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll account checks passed");
