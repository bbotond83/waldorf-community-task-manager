import { defineConfig, devices } from "@playwright/test";
import { firefoxLaunchOptions } from "./scripts/verification/firefox-launch.ts";

const basePort = Number(process.env.APP_PORT ?? 3100);
const serverEnvironment = (port: number) => ({
  ...process.env,
  APP_RUNTIME_MODE: "synthetic",
  APP_SYNTHETIC_FIXTURE_VERSION: "waldorf-local-v1",
  APP_HOST: "127.0.0.1",
  APP_PORT: String(port),
});

export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: "profile-login-performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [0, 1, 2].map((offset) => ({
    command: "npm run start",
    env: serverEnvironment(basePort + offset),
    url: `http://127.0.0.1:${basePort + offset}/api/readiness`,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${basePort}` },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        baseURL: `http://127.0.0.1:${basePort + 1}`,
        launchOptions: firefoxLaunchOptions(),
      },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], baseURL: `http://127.0.0.1:${basePort + 2}` },
    },
  ],
});
