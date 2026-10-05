import { expect, test } from "@playwright/test";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";
import {
  exercisePrimaryControl,
  permittedNavigationIds,
  measureProfileLogin,
  type LoginMeasurement,
} from "./support/profile-login-measurement.ts";

const allLinks = [
  ...new Set(SYNTHETIC_PROFILES.flatMap((profile) => [...permittedNavigationIds(profile)])),
];

for (const [index, profile] of SYNTHETIC_PROFILES.entries()) {
  test(`existing server: ${profile.id} usable main page first/repeated/switch within 5000 ms`, async ({
    page,
    browser,
  }, testInfo) => {
    const measurements: (LoginMeasurement & { kind: string })[] = [];
    const record = (kind: string) => (measurement: LoginMeasurement) =>
      measurements.push({ kind, ...measurement });
    const previous = SYNTHETIC_PROFILES[(index + 1) % SYNTHETIC_PROFILES.length];
    const signOut = async () => {
      await page.getByTestId("app-shell-switch-profile-button").click();
      await expect(page.getByTestId("profile-selector")).toBeVisible();
    };
    try {
      await page.goto("/");
      await expect(page.getByTestId("profile-selector")).toBeVisible();
      for (let repeat = 0; repeat < 3; repeat++) {
        await measureProfileLogin(
          page,
          profile,
          record(repeat ? `first-repeat-${repeat}` : "first"),
        );
        await exercisePrimaryControl(page, profile);
        await signOut();
      }
      for (let repeat = 0; repeat < 3; repeat++) {
        await measureProfileLogin(page, previous, record("switch-source-setup"));
        await signOut();
        await measureProfileLogin(
          page,
          profile,
          record(repeat ? `switch-repeat-${repeat}` : "switch"),
        );
        for (const id of allLinks.filter((id) => !permittedNavigationIds(profile).has(id))) {
          await expect(page.getByTestId(`app-shell-navigation-${id}`)).toHaveCount(0);
        }
        await exercisePrimaryControl(page, profile);
        await signOut();
      }
    } finally {
      await testInfo.attach("login-timings", {
        body: JSON.stringify(
          {
            origin: "http://127.0.0.1:3000",
            browser: browser.version(),
            node: process.version,
            profile: profile.id,
            from: previous.id,
            browserState: "fresh context; natural cache retained; existing server not reset",
            measurements,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    }
  });
}
