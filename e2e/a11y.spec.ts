import { expect, test, type Page } from "@playwright/test";
import { seriousViolations, settled, signInAs, applyTheme, type DemoUser, type Theme } from "./helpers";

// Accessibility scans (axe-core, WCAG 2.2 AA) of every page in both themes, as
// an agent and as an admin, including the dialogs people use most. A page
// passes with zero serious or critical violations.

interface Scan {
  name: string;
  path: string;
  /** Opens a dialog or menu before scanning. */
  open?: (page: Page) => Promise<void>;
}

const AGENT_PAGES: Scan[] = [
  { name: "dashboard", path: "/dashboard" },
  { name: "my leads", path: "/leads" },
  { name: "lead directory", path: "/leads/directory" },
  {
    name: "own lead + log activity dialog",
    path: "/leads",
    open: async (page) => {
      await page.getByRole("table").getByRole("link").first().click();
      await page.waitForURL(/\/leads\/L-\d+$/);
      await settled(page);
      await page.getByRole("button", { name: "Log activity" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  { name: "follow-ups", path: "/follow-ups" },
  { name: "settings", path: "/settings" },
  { name: "add lead form", path: "/leads/new" },
];

const ADMIN_PAGES: Scan[] = [
  { name: "team overview", path: "/dashboard" },
  { name: "all leads", path: "/leads" },
  { name: "team", path: "/team" },
  {
    name: "team + add member dialog",
    path: "/team",
    open: async (page) => {
      const add = page.getByRole("button", { name: "Add member" });
      // Disabled when the server has no secret key; the page itself is still scanned.
      if (await add.isEnabled()) {
        await add.click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    },
  },
  { name: "reports", path: "/reports" },
  {
    name: "search menu",
    path: "/dashboard",
    open: async (page) => {
      await page.getByRole("button", { name: "Search…" }).click();
      await page.getByRole("combobox").fill("zen");
      await expect(page.getByRole("option").first()).toBeVisible();
    },
  },
];

async function scan(page: Page, { path, open }: Scan) {
  await page.goto(path);
  await settled(page);
  if (open) await open(page);
  // Let dialog and chart animations finish so colours are measured at rest.
  await page.waitForTimeout(400);
  expect(await seriousViolations(page)).toEqual([]);
}

for (const theme of ["light", "dark"] as Theme[]) {
  test.describe(`a11y · ${theme}`, () => {
    test.beforeEach(async ({ page }) => applyTheme(page, theme));

    test("sign-in page", async ({ page }) => {
      await page.goto("/login");
      await settled(page);
      expect(await seriousViolations(page)).toEqual([]);
    });

    const roles: [DemoUser, Scan[]][] = [
      ["Priya Sharma", AGENT_PAGES],
      ["Admin User", ADMIN_PAGES],
    ];
    for (const [user, pages] of roles) {
      for (const page of pages) {
        test(`${user === "Admin User" ? "admin" : "agent"} · ${page.name}`, async ({ page: browserPage }) => {
          await signInAs(browserPage, user);
          await scan(browserPage, page);
        });
      }
    }
  });
}
