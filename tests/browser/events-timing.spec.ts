import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the event screens on the 30-family set (NFR9.1: under 2 seconds): the list and an event page as a parent, the
 * group page with its events section, and the edit page of the event as a super admin. It does nothing unless
 * `EVENT_TIMING` is set, so the ordinary runs never fill the schema with the large set.
 */
test.skip(
  !process.env.EVENT_TIMING,
  "set EVENT_TIMING=1 to time the event screens on the 30-family set",
);

const world = bindSeededSchema({ seed: false });

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

test("the event list, event page, group section and edit page on the 30-family set", async ({
  page,
}) => {
  const schema = world().schema;
  const account = (tag: string) => seedAccount(schema, tag, "large");
  const group = seedId(schema, "group:1");
  const results: Record<string, number> = {};

  await signInAs(page, account("parent-1"));
  results["parent-list"] = await slowest(page, "/szulo/esemenyek", "event-list");
  await page
    .getByRole("link", { name: /Őszi vásár/ })
    .first()
    .click();
  await page.getByTestId("event-detail-page").waitFor();
  const eventPath = new URL(page.url()).pathname;
  results["parent-event"] = await slowest(page, eventPath, "event-signups");
  results["parent-group"] = await slowest(page, `/szulo/munkacsoportok/${group}`, "group-events");

  await signInAs(page, account("super-admin"));
  results["admin-edit"] = await slowest(
    page,
    `${eventPath.replace("/szulo/", "/admin/")}/szerkesztes`,
    "event-role-editor",
  );

  console.log(`EVENT_TIMING ${JSON.stringify(results)}`);
  for (const [name, ms] of Object.entries(results)) {
    expect(ms, name).toBeLessThan(2000);
  }
});
