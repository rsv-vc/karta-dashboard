import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export type DemoUser = "Admin User" | "Priya Sharma" | "Rohan Mehta" | "Ananya Iyer" | "Karan Singh";
export type Theme = "light" | "dark";

/** Dev-only overlays (the "viewing as" switcher) can sit on top of controls in local runs. */
async function hideDevTools(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "[data-dev-only], nextjs-portal { display: none !important; }";
      document.head.append(style);
    });
  });
}

/** Signs in with a one-click demo account (demo mode only) and waits for the dashboard. */
export async function signInAs(page: Page, user: DemoUser) {
  await hideDevTools(page);
  await page.goto("/login");
  await page.getByRole("button", { name: `Sign in as ${user}` }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("main")).toBeVisible();
}

/** next-themes reads localStorage before paint, so the first render already has the theme. */
export async function applyTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
}

/** Waits until streamed content (Suspense skeletons) has been replaced. */
export async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/**
 * WCAG 2.2 A/AA scan; returns serious and critical violations only. Dev-only UI
 * (Next.js dev overlay, the "viewing as" switcher) is not part of the product.
 */
export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .exclude("[data-dev-only]")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      detail: v.nodes[0]?.failureSummary?.split(/\n/).slice(0, 3).join(" "),
      html: v.nodes[0]?.html.slice(0, 160),
    }));
}
