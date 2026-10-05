import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "profile-login-existing.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  outputDir: "test-results/login-existing",
  reporter: [["list"], ["json", { outputFile: "test-results/login-existing.json" }]],
  use: { baseURL: "http://127.0.0.1:3000", trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});
