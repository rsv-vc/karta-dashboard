import { defineConfig, devices } from "@playwright/test";

// Browser tests: `npm run test:a11y` (axe scans) and `npm run test:e2e` (core flows).
// They sign in with the one-click demo accounts, so the target must run with
// NEXT_PUBLIC_DEMO_MODE=true against the demo Supabase project, never real data.
// Locally they reuse a running `npm run dev`; in CI they build and start the app.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    // The demo calendar is frozen; keep the browser in the same zone as the data.
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
