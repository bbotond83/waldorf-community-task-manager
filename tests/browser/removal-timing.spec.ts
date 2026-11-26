import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the removal screens for the busiest family of the 30-family set (NFR9.1 to NFR9.4: under 2 seconds): the
 * confirmation with its preview, the removal from the press of the button to the result, and the result opened again.
 * The later run needs a family archived for 30 days, which no screen can bring about, so
 * `tests/database/removal-reads.test.ts` times it. It does nothing unless `REMOVAL_TIMING` is set, so the ordinary runs
 * never fill the schema with the large set.
 */
test.skip(
  !process.env.REMOVAL_TIMING,
  "set REMOVAL_TIMING=1 to time the removal screens on the 30-family set",
);

const world = bindSeededSchema({ seed: false });
/** The family the large seed gives records of every kind (see `scripts/db/seed/data.ts`). */
const BUSIEST = "family:1";
const LIMIT_MS = 2000;

test.beforeAll(async () => {
  const schema = world().schema;
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
  await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "large" });
});

/** The slowest of three loads, so one cold start does not hide a slow page; the clock runs until the content shows. */
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

test("the preview, the removal and the result for the busiest family of the large set", async ({
  page,
}) => {
  const schema = world().schema;
  const family = seedId(schema, BUSIEST);
  const base = `/admin/nyilvantartasok/${family}/eltavolitas`;
  const results: Record<string, number> = {};

  await signInAs(page, seedAccount(schema, "super-admin", "large"));
  results["preview"] = await slowest(page, base, "admin-family-remove-form");
  await page.waitForLoadState("networkidle");
  const started = Date.now();
  await page.getByTestId("admin-family-remove-form-submit-button").click();
  await page.getByTestId("admin-removal-success").waitFor();
  results["removal"] = Date.now() - started;
  results["result"] = await slowest(page, `${base}/eredmeny`, "admin-removal-flagged");

  console.log(`REMOVAL_TIMING ${JSON.stringify(results)}`);
  for (const [name, ms] of Object.entries(results)) {
    expect(ms, name).toBeLessThan(LIMIT_MS);
  }
});
