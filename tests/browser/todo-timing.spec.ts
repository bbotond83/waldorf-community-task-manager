import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the to-do screens on the 30-family set with its 300 tasks (NFR9.17: pages under 2 seconds, a command under 1
 * second): the list, a task page, My tasks, the group page with its to-do section, the management page and the pull
 * list, and one claim and one give-back. It does nothing unless `TODO_TIMING` is set, so the ordinary runs never fill
 * the schema with the large set.
 */
test.skip(
  !process.env.TODO_TIMING,
  "set TODO_TIMING=1 to time the to-do screens on the 30-family set",
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

test("the list, a task, My tasks, the group page, the management page, the pull list and two commands on the 300-task set", async ({
  page,
}) => {
  const schema = world().schema;
  const account = (tag: string) => seedAccount(schema, tag, "large");
  const group = seedId(schema, "group:1");
  const event = seedId(schema, "event:1");
  const results: Record<string, number> = {};

  await signInAs(page, account("parent-1"));
  results["list"] = await slowest(page, "/szulo/teendok", "todo-list-page");
  const firstTask = (await page
    .locator('[data-testid^="todo-link-"]')
    .first()
    .getAttribute("data-testid"))!.replace("todo-link-", "");
  results["task"] = await slowest(page, `/szulo/teendok/${firstTask}`, "todo-detail-page");
  results["my-tasks"] = await slowest(page, "/szulo/feladataim", "my-tasks-page");
  results["group-page"] = await slowest(page, `/szulo/munkacsoportok/${group}`, "group-todo");

  await signInAs(page, account("group-admin-1"));
  results["management"] = await slowest(
    page,
    `/szulo/munkacsoportok/${group}/kezeles`,
    "manage-page",
  );
  results["pull-list"] = await slowest(page, `/szulo/esemenyek/${event}/teendok`, "todo-pull-page");

  // One claim and one give-back, each from the press of the button to its confirmation.
  await signInAs(page, account("parent-1"));
  await page.goto("/szulo/teendok");
  const claim = page
    .locator('[data-testid^="todo-claim-form-"][data-testid$="-submit-button"]')
    .first();
  await claim.waitFor();
  const claimId = (await claim.getAttribute("data-testid"))!
    .replace("todo-claim-form-", "")
    .replace("-submit-button", "");
  let started = Date.now();
  await claim.click();
  await page.getByTestId(`todo-done-form-${claimId}`).waitFor();
  results["command-claim"] = Date.now() - started;
  await page.goto(`/szulo/teendok/${claimId}`);
  started = Date.now();
  await page.getByTestId(`todo-giveback-form-${claimId}-submit-button`).click();
  await page.getByTestId(`todo-claim-form-${claimId}`).waitFor();
  results["command-giveback"] = Date.now() - started;

  console.log(`TODO_TIMING ${JSON.stringify(results)}`);
  for (const [name, ms] of Object.entries(results)) {
    expect(ms, name).toBeLessThan(name.startsWith("command-") ? 1000 : 2000);
  }
});
