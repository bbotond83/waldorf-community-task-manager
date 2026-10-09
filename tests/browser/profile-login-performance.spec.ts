import { cpus, platform, release } from "node:os";
import { expect, test } from "@playwright/test";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";
import { measureProfileLogin, startLoginServer } from "./support/profile-login-server.ts";
import {
  permittedNavigationIds,
  type LoginMeasurement,
} from "./support/profile-login-measurement.ts";

const allLinks = [
  ...new Set(SYNTHETIC_PROFILES.flatMap((profile) => [...permittedNavigationIds(profile)])),
];

for (const mode of ["development", "production"] as const) {
  for (const [index, profile] of SYNTHETIC_PROFILES.entries()) {
    test(`${mode}: first and switch to ${profile.id} complete within 5000 ms`, async ({
      page,
      browser,
    }, testInfo) => {
      const server = await startLoginServer(mode, 3800 + index);
      const measurements: (LoginMeasurement & { kind: string })[] = [];
      try {
        await page.goto(server.origin);
        await expect(page.getByTestId("profile-selector")).toBeVisible();
        await measureProfileLogin(page, profile, (measurement) =>
          measurements.push({ kind: "first", ...measurement }),
        );
        const forbidden = allLinks.filter((id) => !permittedNavigationIds(profile).has(id));
        for (const id of forbidden)
          await expect(page.getByTestId(`app-shell-navigation-${id}`)).toHaveCount(0);
        await page.getByTestId("app-shell-switch-profile-button").click();
        const previous = SYNTHETIC_PROFILES[(index + 1) % SYNTHETIC_PROFILES.length];
        await measureProfileLogin(page, previous, (measurement) =>
          measurements.push({ kind: "switch-source-setup", ...measurement }),
        );
        await page.getByTestId("app-shell-switch-profile-button").click();
        await measureProfileLogin(page, profile, (measurement) =>
          measurements.push({ kind: "switch", ...measurement }),
        );
        for (const id of forbidden)
          await expect(page.getByTestId(`app-shell-navigation-${id}`)).toHaveCount(0);
        await expect(page.getByTestId("app-shell-profile-summary")).not.toContainText(
          previous.label,
        );
        if (profile.role === "parent" || profile.role === "kindergarten-teacher") {
          await page.goto(`${server.origin}/admin/import`);
          await expect(
            page.getByRole("heading", { name: "Nincs jogosultság", exact: true }),
          ).toBeVisible();
        }
      } finally {
        await server.stop();
        await testInfo.attach("login-timings", {
          body: JSON.stringify(
            {
              mode,
              profile: profile.id,
              from: SYNTHETIC_PROFILES[(index + 1) % SYNTHETIC_PROFILES.length].id,
              measurements,
              cache: server.cache,
              node: process.version,
              browser: browser.version(),
              machine: { platform: platform(), release: release(), cpu: cpus()[0]?.model },
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        await testInfo.attach("server-output", {
          body: server.output(),
          contentType: "text/plain",
        });
      }
    });
  }
}
