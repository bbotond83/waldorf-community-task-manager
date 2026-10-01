import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { firefox, type LaunchOptions } from "@playwright/test";

export function firefoxLaunchOptions(): LaunchOptions {
  if (process.platform !== "darwin") return {};

  // macOS 27 protects the personal Firefox application-data directory.
  // A temporary profile alone does not isolate that directory. Use Gecko's
  // supported application metadata override with separate automation branding.
  // https://github.com/microsoft/playwright/issues/42768
  const resources = resolve(dirname(firefox.executablePath()), "../Resources");
  const metadata = readFileSync(join(resources, "application.ini"), "utf8")
    .replace(/^Vendor=.*$/m, "Vendor=WaldorfPlaywright")
    .replace(/^Name=.*$/m, "Name=WaldorfPlaywrightFirefox");
  // Gecko resolves application resources relative to this file, so it must
  // live beside the bundled browser resources rather than in the repository.
  const applicationFile = join(resources, "browser", "waldorf-application.ini");
  writeFileSync(applicationFile, metadata);

  return {
    env: { ...process.env, XUL_APP_FILE: applicationFile },
    timeout: 30_000,
  };
}
