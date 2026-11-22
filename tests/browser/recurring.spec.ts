import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical recurring-duty flow (U9): a coordinator adds a schedule for the group, a member of the group marks the
 * first occurrence done and takes it back, the coordinator skips an occurrence with a reason, and the bottle-cleaning
 * line shows on the duty card of a water week. A teacher reads the list and has no button. Each page the flow opens is
 * checked for serious or critical accessibility violations. All names are invented.
 */
const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

/** A date field value for today, in the form a date field takes. */
function today(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS), label).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} overflows sideways`).toBeLessThanOrEqual(0);
}

test("a coordinator adds a schedule, a member marks it done and takes it back, the coordinator skips with a reason", async ({
  page,
}) => {
  const group = world().id("group:1");
  const groupPage = `/szulo/munkacsoportok/${group}/ismetlodo`;

  // The coordinator adds a weekly schedule that starts today.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(groupPage);
  await expect(page.getByTestId("recurring-group-page")).toBeVisible();
  await expectAccessible(page, "group page of the coordinator");
  await page.getByTestId("recurring-new-link").click();
  await expect(page.getByTestId("recurring-form-page")).toBeVisible();
  await expectAccessible(page, "new schedule form");
  await page.getByTestId("recurring-title").fill("Homokozó átforgatása");
  await page.getByTestId("recurring-interval").fill("0");
  await page.getByTestId("recurring-start").fill(today());
  await page.getByTestId("recurring-schedule-form-submit-button").click();
  // A wrong interval is shown next to the field and nothing is saved.
  await expect(page.getByTestId("recurring-interval-error")).toBeVisible();
  await expectAccessible(page, "form with the interval error");
  await page.getByTestId("recurring-interval").fill("1");
  await page.getByTestId("recurring-schedule-form-submit-button").click();
  await expect(page.getByTestId("recurring-schedule-form-state-success")).toBeVisible();

  // The new duty is due today on the group page.
  await page.goto(groupPage);
  const card = page
    .locator('[data-testid^="recurring-item-"]', { hasText: "Homokozó átforgatása" })
    .first();
  await expect(card).toBeVisible();
  const cardId = (await card.getAttribute("data-testid"))!.replace("recurring-item-", "");

  // A member of the group marks it done, and the screen says who and when.
  await signInAs(page, world().account("parent-4"));
  await page.goto(groupPage);
  await expectAccessible(page, "group page of a member");
  await page.getByTestId(`recurring-done-form-${cardId}-submit-button`).click();
  await expect(page.getByTestId(`recurring-status-${cardId}`)).toHaveText(/Kész/);
  await expect(page.getByTestId(`recurring-undo-form-${cardId}`)).toBeVisible();

  // The member takes the mark back.
  await page.getByTestId(`recurring-undo-form-${cardId}-submit-button`).click();
  await expect(page.getByTestId(`recurring-done-form-${cardId}`)).toBeVisible();
  await expect(page.getByTestId(`recurring-undo-form-${cardId}`)).toHaveCount(0);

  // The coordinator skips it with a reason, and the reason is on the screen.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(groupPage);
  await page.getByTestId(`recurring-skip-toggle-${cardId}`).click();
  await page.getByTestId(`recurring-skip-reason-${cardId}`).fill("Esős időben kimarad.");
  await page.getByTestId(`recurring-skip-form-${cardId}-submit-button`).click();
  await expect(page.getByTestId(`recurring-status-${cardId}`)).toHaveText(/Kihagyva/);
  await expect(page.getByTestId(`recurring-item-${cardId}`)).toContainText("Esős időben kimarad.");
  await expectAccessible(page, "group page after the skip");

  // A teacher reads the same list and has no button to change anything.
  await signInAs(page, world().account("teacher-1"));
  await page.goto(`/teacher/munkacsoportok/${group}/ismetlodo`);
  await expect(page.getByTestId("recurring-group-page")).toBeVisible();
  await expect(page.getByTestId(`recurring-item-${cardId}`)).toBeVisible();
  await expect(page.locator("main button")).toHaveCount(0);
  await expect(page.getByTestId("recurring-new-link")).toHaveCount(0);
  await expectAccessible(page, "group page of a teacher");
});

test("my duties list the family's and the groups' duties, and the duty card of a water week has the bottle line", async ({
  page,
}) => {
  // The small seed holds a draft of the rotas; a published plan gives the water weeks their bottle-cleaning occurrences.
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema: world().schema });
  await seedSchema(
    { ...defaultSeedDeps(), log: () => undefined },
    { schema: world().schema, size: "small", rotaPlan: "published" },
  );
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/ismetlodo");
  await expect(page.getByTestId("recurring-mine-page")).toBeVisible();
  await expect(page.getByText("Komposztláda kiürítése").first()).toBeVisible();
  await expectAccessible(page, "my recurring duties");

  // Find the duty card of a water week with a bottle-cleaning occurrence still to do, as the family that holds it. A
  // card whose occurrence is already done (an earlier week of the seed) is remembered in case no open one is in the window.
  const line = page.getByTestId("recurring-bottle-line");
  const doneButton = page.locator(
    '[data-testid^="recurring-done-form-"][data-testid$="-submit-button"]',
  );
  let open = false;
  let seenDone = false;
  for (const tag of ["parent-1", "parent-2", "parent-3", "parent-4", "parent-5"]) {
    await signInAs(page, world().account(tag));
    await page.goto("/szulo/beosztas");
    const links = page.locator(
      '[data-testid="rota-job-water_carrying"] a[href^="/szulo/beosztas/"]',
    );
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")!),
    );
    for (const href of hrefs) {
      await page.goto(href);
      if (!(await line.isVisible())) continue;
      if ((await doneButton.count()) > 0) {
        open = true;
        break;
      }
      seenDone = true;
    }
    if (open) break;
  }
  expect(open || seenDone, "a duty card with the bottle-cleaning line").toBe(true);
  await expect(line).toContainText("Vizespalackok tisztítása");
  await expectAccessible(page, "duty card with the bottle line");
  if (!open) {
    await expect(line).toContainText("Kész:");
    return;
  }
  await doneButton.first().click();
  await expect(page.locator('[data-testid^="recurring-undo-form-"]').first()).toBeVisible();
  await expect(line).toContainText("Kész:");
  await page
    .locator('[data-testid^="recurring-undo-form-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(doneButton.first()).toBeVisible();
});

test("the school calendar offers one number for the bottle interval and saves it", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/tanev");
  await expect(page.getByTestId("recurring-bottle-form")).toBeVisible();
  await page.getByTestId("recurring-bottle-interval").fill("3");
  await page.getByTestId("recurring-bottle-form-submit-button").click();
  await expect(page.getByTestId("recurring-bottle-form-state-success")).toBeVisible();
  await expectAccessible(page, "school calendar with the bottle interval");
});
