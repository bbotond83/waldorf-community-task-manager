import { cpus, platform, release } from "node:os";
import { expect, test } from "@playwright/test";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";
import { measureProfileLogin, startLoginServer } from "./support/profile-login-server.ts";

const allLinks = [
  ...new Set(SYNTHETIC_PROFILES.flatMap((profile) => profile.navigation.map((item) => item.id))),
];

for (const mode of ["development", "production"] as const) {
  for (const [index, profile] of SYNTHETIC_PROFILES.entries()) {
    test(`${mode}: first and switch to ${profile.id} complete within 5000 ms`, async ({
      page,
      browser,
    }, testInfo) => {
      const server = await startLoginServer(mode, 3800 + index);
      const measurements: { kind: string; elapsed: number }[] = [];
      try {
        await page.goto(server.origin);
        await expect(page.getByTestId("profile-selector")).toBeVisible();
        measurements.push({ kind: "first", elapsed: await measureProfileLogin(page, profile) });
        const forbidden = allLinks.filter(
          (id) => !profile.navigation.some((item) => item.id === id),
        );
        for (const id of forbidden)
          await expect(page.getByTestId(`app-shell-navigation-${id}`)).toHaveCount(0);
        await page.getByTestId("app-shell-switch-profile-button").click();
        const previous = SYNTHETIC_PROFILES[(index + 1) % SYNTHETIC_PROFILES.length];
        await measureProfileLogin(page, previous);
        await page.getByTestId("app-shell-switch-profile-button").click();
        measurements.push({ kind: "switch", elapsed: await measureProfileLogin(page, profile) });
        for (const id of forbidden)
          await expect(page.getByTestId(`app-shell-navigation-${id}`)).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: `Üdvözlünk, ${previous.label}!`, exact: true }),
        ).toHaveCount(0);
        if (profile.role === "parent" || profile.role === "staff") {
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
