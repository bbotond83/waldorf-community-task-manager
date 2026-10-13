import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { parseEnvFile, PUBLIC_ENV_FILE, SERVICE_ENV_FILE } from "./scripts/db/common.ts";
import { firefoxLaunchOptions } from "./scripts/verification/firefox-launch.ts";

const basePort = Number(process.env.APP_PORT ?? 3100);

/** Values the local stack wrote with `npm run db:start` (git-ignored); absent when no stack is running. */
function stackFile(path: string): Record<string, string> {
  try {
    return parseEnvFile(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}
const stack = { ...stackFile(PUBLIC_ENV_FILE), ...stackFile(SERVICE_ENV_FILE) };
// One generated secret for every server of this run: never a fixed value, never written anywhere.
const sessionSecret = process.env.APP_SESSION_SECRET ?? randomBytes(32).toString("hex");

const serverEnvironment = (port: number) => ({
  ...process.env,
  APP_RUNTIME_MODE: "synthetic",
  APP_SYNTHETIC_FIXTURE_VERSION: "waldorf-local-v1",
  APP_HOST: "127.0.0.1",
  APP_PORT: String(port),
  // Test mode: adds the per-browser copies of the parent fixtures so each project mutates its own.
  SYNTHETIC_TEST_COPIES: "1",
  // The real identity screens (U2) talk to the local stack; the old synthetic screens ignore these.
  // The browser tests use their own schema so they never touch the data of other database tests.
  SUPABASE_URL: process.env.SUPABASE_URL ?? stack.SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? stack.SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? stack.SUPABASE_SERVICE_ROLE_KEY ?? "",
  DATABASE_SCHEMA: process.env.IDENTITY_BROWSER_SCHEMA ?? "worker_4",
  APP_SESSION_SECRET: sessionSecret,
  APP_PUBLIC_URL: `http://127.0.0.1:${port}`,
  SMTP_HOST: process.env.SMTP_HOST ?? stack.SMTP_HOST ?? "127.0.0.1",
  SMTP_PORT: process.env.SMTP_PORT ?? stack.SMTP_PORT ?? "54325",
  SMTP_FROM: process.env.SMTP_FROM ?? "no-reply@example.test",
});

export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: ["profile-login-performance.spec.ts", "profile-login-existing.spec.ts"],
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
