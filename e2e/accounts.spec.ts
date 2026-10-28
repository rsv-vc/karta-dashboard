import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { settled, signInAs } from "./helpers";

// Admin-managed accounts end to end: an admin adds a sales agent (the email rule
// refuses an outside address for an employee), the member signs in with the
// one-time temporary password and must choose their own; an admin resets it,
// the old one stops working and the new one forces another change; Settings
// checks the current password; a deactivated member cannot sign in.
// Needs SUPABASE_SECRET_KEY. The test account is always deleted afterwards.

const SECRET = process.env.SUPABASE_SECRET_KEY;
const RUN = Date.now().toString(36);
const EMAIL = `e2e-${RUN}@getkarta.ai`;
const NAME = `E2E Member ${RUN}`;
const OWN_PASSWORD = `Karta e2e ${RUN} phrase!`;

test.describe.configure({ mode: "serial" });
test.skip(!SECRET, "SUPABASE_SECRET_KEY is not set");

let tempPassword = "";

test.afterAll(async () => {
  if (!SECRET || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, SECRET, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    // Deleting the Auth user removes the profile too (on delete cascade).
    if (user.email?.startsWith("e2e-") && user.email.endsWith("@getkarta.ai")) await admin.auth.admin.deleteUser(user.id);
  }
});

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function freshPage(browser: Browser) {
  return (await browser.newContext({ timezoneId: "Asia/Kolkata" })).newPage();
}

async function openMemberActions(page: Page) {
  await page.goto("/team");
  await settled(page);
  await page.getByRole("button", { name: `Actions for ${NAME}` }).click();
}

test("admin adds a sales agent and gets a one-time temporary password", async ({ page }) => {
  await signInAs(page, "Admin User");
  await page.goto("/team");
  await settled(page);
  await expect(page.getByText("SUPABASE_SECRET_KEY")).toBeHidden();

  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog");

  // Email rule: an employee with an outside address is refused.
  await dialog.getByLabel("Employee").check();
  await dialog.getByLabel("Name", { exact: true }).fill(NAME);
  await dialog.getByLabel("Email").fill(`outside-${RUN}@gmail.com`);
  await dialog.getByRole("button", { name: "Add employee" }).click();
  await expect(dialog.getByText(/Employees need a company email/).first()).toBeVisible();

  await dialog.getByLabel("Sales agent").check();
  await dialog.getByLabel("Email").fill(` ${EMAIL.toUpperCase()} `);
  await dialog.getByRole("button", { name: "Add sales agent" }).click();
  await expect(dialog.getByRole("heading", { name: "Member added" })).toBeVisible();
  await expect(dialog.getByText(EMAIL)).toBeVisible();
  tempPassword = (await dialog.locator("code").innerText()).trim();
  expect(tempPassword).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(page.getByText(NAME).first()).toBeVisible();
  await expect(page.getByText("Temporary password").first()).toBeVisible();
});

test("the member must replace the temporary password at first sign-in", async ({ browser }) => {
  const page = await freshPage(browser);
  await signInWithPassword(page, EMAIL, tempPassword);
  await page.waitForURL("**/auth/set-password");
  await expect(page.getByRole("heading", { name: `Welcome, ${NAME}` })).toBeVisible();

  // Nothing else is reachable until the password changes.
  await page.goto("/dashboard");
  await page.waitForURL("**/auth/set-password");

  await page.getByLabel("New password", { exact: true }).fill(OWN_PASSWORD);
  await page.getByLabel("Repeat new password").fill(`${OWN_PASSWORD}x`);
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await expect(page.getByText("The passwords do not match")).toBeVisible();

  await page.getByLabel("Repeat new password").fill(OWN_PASSWORD);
  await page.getByRole("button", { name: "Save password and continue" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText(`Welcome back, ${NAME.split(" ")[0]}`)).toBeVisible();

  // Settings checks the current password before changing it.
  await page.goto("/settings");
  await settled(page);
  await page.getByLabel("Current password").fill("not my password");
  await page.getByLabel("New password", { exact: true }).fill(`${OWN_PASSWORD} 2`);
  await page.getByLabel("Repeat new password").fill(`${OWN_PASSWORD} 2`);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password is not right")).toBeVisible();
  await page.context().close();

  // Their own password now works and goes straight in.
  const again = await freshPage(browser);
  await signInWithPassword(again, EMAIL, OWN_PASSWORD);
  await again.waitForURL("**/dashboard");
  await again.context().close();
});

test("an admin reset replaces the password and forces another change", async ({ page, browser }) => {
  await signInAs(page, "Admin User");
  await openMemberActions(page);
  await page.getByRole("menuitem", { name: "Reset password" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reset password" }).click();
  await expect(dialog.locator("code")).toBeVisible();
  const resetPassword = (await dialog.locator("code").innerText()).trim();
  expect(resetPassword).not.toBe(tempPassword);
  await dialog.getByRole("button", { name: "Done" }).click();

  const member = await freshPage(browser);
  await signInWithPassword(member, EMAIL, OWN_PASSWORD);
  await expect(member.getByText("Invalid email or password")).toBeVisible();

  await signInWithPassword(member, EMAIL, resetPassword);
  await member.waitForURL("**/auth/set-password");
  await member.context().close();
});

test("a deactivated member cannot sign in", async ({ page, browser }) => {
  await signInAs(page, "Admin User");
  await openMemberActions(page);
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText(`${NAME} updated`)).toBeVisible();
  await expect(page.getByText("Deactivated").first()).toBeVisible();

  const member = await freshPage(browser);
  await signInWithPassword(member, EMAIL, OWN_PASSWORD);
  await expect(member.getByText("Invalid email or password")).toBeVisible();
  await member.context().close();
});
