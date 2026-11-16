import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the group page, as a parent and as a super admin, on the 30-family set (NFR9.1: under 2 seconds). It does
 * nothing unless `WORKING_GROUP_TIMING` is set, so the ordinary runs never fill the schema with the large set.
 */
test.skip(
  !process.env.WORKING_GROUP_TIMING,
  "set WORKING_GROUP_TIMING=1 to time the group pages on the 30-family set",
);

const world = bindSeededSchema({ seed: false });

test.beforeAll(async () => {
  const schema = world().schema;
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
  await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "large" });
});

/**
 * The slowest of three loads, so one cold start does not hide a slow page. The clock runs until the member list is on
 * screen, because the page streams its content after the load event (the area's loading screen comes first).
 */
async function slowest(page: Page, path: string, ready: string): Promise<number> {
  let worst = 0;
  for (let run = 0; run < 3; run += 1) {
    const started = Date.now();
    await page.goto(path, { waitUntil: "load" });
    await page.getByTestId(ready).waitFor();
    worst = Math.max(worst, Date.now() - started);
  }
  return worst;
}

test("the parent and the admin group page on the 30-family set", async ({ page }) => {
  const schema = world().schema;
  const account = (tag: string) => seedAccount(schema, tag, "large");
  const group = seedId(schema, "group:1");
  const results: Record<string, number> = {};

  await signInAs(page, account("parent-1"));
  results["parent-group"] = await slowest(
    page,
    `/szulo/munkacsoportok/${group}`,
    "parent-group-members",
  );
  const members = await page.getByTestId("parent-group-members").getByRole("listitem").count();

  await signInAs(page, account("teacher-1"));
  results["teacher-group"] = await slowest(
    page,
    `/teacher/munkacsoportok/${group}`,
    "teacher-group-members",
  );

  await signInAs(page, account("super-admin"));
  results["admin-group"] = await slowest(
    page,
    `/admin/munkacsoportok/${group}`,
    "admin-group-members",
  );
  const managed = await page.getByTestId("admin-group-members").getByRole("button").count();

  console.log(`WORKING_GROUP_TIMING ${JSON.stringify({ members, managed, ...results })}`);
  expect(members).toBeGreaterThanOrEqual(5);
  expect(managed).toBe(members);
  for (const [name, ms] of Object.entries(results)) {
    expect(ms, name).toBeLessThan(2000);
  }
});
