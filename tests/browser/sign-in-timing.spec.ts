import { expect, test } from "@playwright/test";
import { SEED_TARGETS_MS } from "../../scripts/db/seed-support.ts";
import { signInAs, signOut, bindSeededSchema } from "./support/seeded-schema.ts";

/**
 * The sign-in timing check of the browser phase (NFR4.19, NFR4.20), on seeded data. It replaces the profile-picker
 * timing specs: a person of each role signs in through the real sign-in screen, and the time from pressing the button
 * to the signed-in confirmation stays inside the 5000 ms budget. The measured times go to the report as annotations.
 */
const world = bindSeededSchema();

const ROLES = ["parent-1", "teacher-1", "group-admin-1", "super-admin"] as const;

test("every seeded role signs in within the budget and lands on its own page", async ({
  page,
}, testInfo) => {
  const homes: Record<(typeof ROLES)[number], RegExp> = {
    "parent-1": /\/szulo\/ertesitesek$/,
    "teacher-1": /\/teacher\/schedule$/,
    "group-admin-1": /\/admin$/,
    "super-admin": /\/admin$/,
  };
  const measured: string[] = [];
  for (const tag of ROLES) {
    const elapsed = await signInAs(page, world().account(tag));
    measured.push(`${tag}: ${elapsed} ms`);
    expect(elapsed, `${tag} sign-in`).toBeLessThan(SEED_TARGETS_MS.signIn);
    await page.goto("/");
    await expect(page).toHaveURL(homes[tag]);
    await page.goto("/bejelentkezes");
    await signOut(page);
  }
  console.log(`SIGN-IN TIMES (${testInfo.project.name}): ${measured.join(", ")}`);
  testInfo.annotations.push({ type: "sign-in times", description: measured.join(", ") });
});

test("the sign-in screen itself opens inside the budget", async ({ page }) => {
  const started = Date.now();
  await page.goto("/bejelentkezes");
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(SEED_TARGETS_MS.signIn);
});
