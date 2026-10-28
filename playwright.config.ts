import { defineConfig, devices } from "@playwright/test";

// Browser tests: `npm run test:e2e` (core flows) and `npm run test:a11y` (axe scans).
// They run ONLY against the test project (karta-test, fictional demo data): the
// app is started on port 3100 with .env.test.local, never the live workspace.
// Locally they reuse a running `npm run dev:test`; in CI they build and start the
// app with the test project's settings from the environment.
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // No local test env file (CI passes the variables directly).
}

const baseURL = "http://localhost:3100";

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
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: process.env.CI ? "npm run build && npx next start -p 3100" : "npm run dev:test",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
