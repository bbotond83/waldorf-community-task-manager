import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the library screens on the 30-family set with its 300 books (NFR9.1: under 2 seconds): the list, a search, the
 * page of the book with the most watches and the new-book form. It does nothing unless `LIBRARY_TIMING` is set, so the
 * ordinary runs never fill the schema with the large set.
 */
test.skip(
  !process.env.LIBRARY_TIMING,
  "set LIBRARY_TIMING=1 to time the library screens on the 30-family set",
);

const world = bindSeededSchema({ seed: false });

test.beforeAll(async () => {
  const schema = world().schema;
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
  await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "large" });
});

/** The median of five loads after one warm-up, so a cold start does not decide the result. */
async function median(page: Page, path: string, ready: string): Promise<number> {
  await page.goto(path, { waitUntil: "load" });
  await page.getByTestId(ready).waitFor();
  const times: number[] = [];
  for (let run = 0; run < 5; run += 1) {
    const started = Date.now();
    await page.goto(path, { waitUntil: "load" });
    await page.getByTestId(ready).waitFor();
    times.push(Date.now() - started);
  }
  return times.toSorted((a, b) => a - b)[2]!;
}

test("the library list, a search, the busiest book page and the form on the 300-book set", async ({
  page,
}) => {
  const schema = world().schema;
  const results: Record<string, number> = {};
  await signInAs(page, seedAccount(schema, "parent-1", "large"));
  results["list"] = await median(page, "/szulo/konyvtar", "library-list");
  results["search"] = await median(page, "/szulo/konyvtar?kereses=gyapjumesek", "library-list");
  results["book-most-watches"] = await median(
    page,
    `/szulo/konyvtar/${seedId(schema, "book:7")}`,
    "library-book-info",
  );
  results["new-book-form"] = await median(page, "/szulo/konyvtar/uj", "library-book-form");

  console.log(`LIBRARY_TIMING ${JSON.stringify(results)}`);
  for (const [name, ms] of Object.entries(results)) {
    expect(ms, name).toBeLessThan(2000);
  }
});
