import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "profile-login-performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"], ["json", { outputFile: "test-results/login-performance.json" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
