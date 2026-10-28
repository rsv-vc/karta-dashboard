import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { mockUsers } from "@/data/mock-users";
import { settled, signInAs } from "./helpers";

// Core flows end to end, as one story on a temporary lead so the shared demo
// data is left as it was: an agent creates a lead (through the duplicate
// warning), moves it, logs a call and reschedules it; an admin rebalances it
// to another agent, exports CSV, and deletes it. Demo project only.

const COMPANY = `Zenith Retail E2E ${Date.now().toString(36)}`;
let leadPath = "";

test.describe.configure({ mode: "serial" });

// Whatever happens above, the temporary lead must not stay in the shared demo data.
test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const password = process.env.DEMO_PASSWORD;
  if (!url || !key || !password) return;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const email = mockUsers.find((u) => u.role === "admin")!.email;
  await admin.auth.signInWithPassword({ email, password });
  await admin.from("leads").delete().eq("company_name", COMPANY);
  await admin.auth.signOut({ scope: "local" });
});

async function pick(page: Page, label: string, option?: string) {
  await page.getByLabel(label, { exact: true }).click();
  const options = page.getByRole("option");
  await (option ? options.filter({ hasText: option }).first() : options.first()).click();
}

test("agent creates a lead through the duplicate warning", async ({ page }) => {
  await signInAs(page, "Priya Sharma");
  await page.goto("/leads/new");
  await settled(page);

  await page.getByLabel("Company name").fill(COMPANY);
  await pick(page, "Industry");
  await pick(page, "Company size");
  await pick(page, "City");
  await page.getByLabel("Name", { exact: true }).fill("Test Contact");
  await page.getByLabel("Designation").fill("Head of Testing");
  await page.getByLabel("Email", { exact: true }).fill("test.contact@example.com");
  await page.getByLabel("Mobile").fill("+91 98765 43210");
  await page.getByLabel("Deal value (₹)").fill("500000");
  await pick(page, "Source");

  // "Zenith Retail …" matches the seeded Zenith leads: a masked warning appears.
  const confirm = page.getByLabel(/this is a different company/);
  await expect(confirm).toBeVisible();
  await page.getByRole("button", { name: "Create lead" }).click();
  await expect(page.getByText(/Confirm/).first()).toBeVisible();
  await confirm.check();
  await page.getByRole("button", { name: "Create lead" }).click();

  await page.waitForURL(/\/leads\/L-\d+$/);
  leadPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible();
});

test("agent moves it forward, logs a call and reschedules", async ({ page }) => {
  await signInAs(page, "Priya Sharma");
  await page.goto(leadPath);
  await settled(page);

  await page.getByRole("button", { name: "Change stage" }).click();
  await page.getByLabel("Advance to Contacted").check();
  await page.getByRole("button", { name: "Move to Contacted" }).click();
  await expect(page.getByText("Moved to Contacted")).toBeVisible();

  await page.getByRole("button", { name: "Log activity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("What happened?").fill("Intro call, sending a deck");
  const tomorrow = await page.evaluate(() => {
    const d = new Date(Date.now() + 86_400_000);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  });
  await dialog.getByLabel("Next follow-up (optional)").fill(tomorrow);
  await dialog.getByRole("button", { name: "Log call" }).click();
  await expect(page.getByText("Call logged")).toBeVisible();
  await expect(page.getByText("Intro call, sending a deck")).toBeVisible();

  await page.goto("/follow-ups");
  await settled(page);
  await page.getByRole("button", { name: `Reschedule follow-up for ${COMPANY}` }).click();
  await page.getByRole("button", { name: /Next week/ }).click();
  await expect(page.getByText(`${COMPANY}: follow-up moved to`)).toBeVisible();
});

test("admin rebalances it, exports CSV and deletes it", async ({ page }) => {
  await signInAs(page, "Admin User");
  await page.goto("/team");
  await settled(page);

  await page.getByRole("button", { name: "Rebalance leads" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("From", { exact: true }).click();
  await page.getByRole("option", { name: /Priya Sharma/ }).click();
  await dialog.getByLabel("To", { exact: true }).click();
  await page.getByRole("option", { name: "Rohan Mehta" }).click();
  await dialog.getByText(COMPANY).click();
  await dialog.getByRole("button", { name: /Move 1 lead to Rohan Mehta/ }).click();
  await expect(page.getByText("Moved 1 lead to Rohan Mehta")).toBeVisible();

  await page.goto(`/leads?q=${encodeURIComponent(COMPANY)}`);
  await settled(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.split("\n")[0]).toContain("Company");
  expect(csv).toContain(COMPANY);
  expect(csv).toContain("Rohan Mehta");

  await page.goto(leadPath);
  await settled(page);
  await page.getByRole("button", { name: "Delete lead" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete lead" }).click();
  await page.waitForURL("**/leads");
  await page.goto(leadPath);
  await expect(page.getByRole("heading", { name: "Lead not found" })).toBeVisible();
});

test("phone: cards and the filter sheet @mobile", async ({ page }) => {
  await signInAs(page, "Priya Sharma");
  await page.goto("/leads");
  await settled(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("table")).toBeHidden();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stage" }).click();
  await page.getByRole("option", { name: /Won/ }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/stage=won/);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Filters · 1" })).toBeVisible();
});
