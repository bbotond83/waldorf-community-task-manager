import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the directory, "Fiókom" and records pages on the 30-family set (NFR9.1: under 2 seconds). It does nothing
 * unless `DIRECTORY_TIMING` is set, so the ordinary runs never fill the schema with the large set.
 */
test.skip(
  !process.env.DIRECTORY_TIMING,
  "set DIRECTORY_TIMING=1 to time the directory pages on the 30-family set",
);

const world = bindSeededSchema({ seed: false });

test.beforeAll(async () => {
  const schema = world().schema;
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
  await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "large" });
});

/** The slowest of three loads, so one cold start does not hide a slow page. */
async function slowest(page: Page, path: string): Promise<number> {
  let worst = 0;
  for (let run = 0; run < 3; run += 1) {
    const started = Date.now();
    await page.goto(path, { waitUntil: "load" });
    worst = Math.max(worst, Date.now() - started);
  }
  return worst;
}

test("directory, Fiókom and records pages on the 30-family set", async ({ page }) => {
  const schema = world().schema;
  const account = (tag: string) => seedAccount(schema, tag, "large");
  const results: Record<string, number> = {};

  await signInAs(page, account("parent-1"));
  results["parent-directory"] = await slowest(page, "/szulo/szulok");
  results["parent-account"] = await slowest(page, "/szulo/fiokom");
  await page.goto("/szulo/szulok");
  const cards = await page.locator("[data-testid^='directory-family-']").count();
  const input = page.getByTestId("directory-search-input");
  const typingStarted = Date.now();
  await input.pressSequentially("a", { delay: 0 });
  await expect(page.getByTestId("directory-count")).toBeVisible();
  results["search-typing"] = Date.now() - typingStarted;

  await signInAs(page, account("teacher-1"));
  results["teacher-directory"] = await slowest(page, "/teacher/szulok");

  await signInAs(page, account("super-admin"));
  results["admin-directory"] = await slowest(page, "/admin/szulok");
  results["admin-records"] = await slowest(page, "/admin/nyilvantartasok");
  const href = await page
    .locator('a[href^="/admin/nyilvantartasok/"]')
    .first()
    .getAttribute("href");
  results["admin-family-record"] = await slowest(page, href!);

  console.log(`DIRECTORY_TIMING ${JSON.stringify({ cards, ...results })}`);
  expect(cards).toBeGreaterThanOrEqual(30);
  for (const [name, ms] of Object.entries(results)) {
    expect(ms, name).toBeLessThan(2000);
  }
});
