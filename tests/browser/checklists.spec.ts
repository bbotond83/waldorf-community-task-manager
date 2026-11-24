import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical checklist flow (U11): a coordinator starts an event from a template, the event page shows the list, a
 * parent takes a task and gives it back, the team marks a task done and takes the mark back, and the administrator
 * opens the template list and the template editor. Each page the flow opens is checked for serious or critical
 * accessibility violations. All names are invented.
 */
const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

const TITLE = "Őszi nagytakarítás";

function inDays(days: number, hour: number): string {
  const date = new Date(Date.now() + days * 24 * 3600 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS), label).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} overflows sideways`).toBeLessThanOrEqual(0);
}

test("a coordinator starts an event from a template; a parent takes a task and gives it back; the team marks it done", async ({
  page,
}) => {
  await signInAs(page, world().account("group-admin-1"));
  await page.goto("/szulo/esemenyek/uj");
  await expect(page.getByTestId("event-form-page")).toBeVisible();
  await expectAccessible(page, "new event form with the template choice");
  await page.getByTestId("event-title-input").fill(TITLE);
  await page.getByTestId("event-group-select").selectOption({ label: "Játszókert" });
  await page.getByTestId("event-starts-at-input").fill(inDays(25, 9));
  await page.getByTestId("event-ends-at-input").fill(inDays(25, 15));
  await page.getByTestId("event-template-select").selectOption({ label: "Nagytakarítás" });
  await expect(page.getByTestId("event-notice-lead-input")).toHaveValue(/^\d+$/);
  await expect(page.getByTestId("event-template-summer-hint")).toBeVisible();
  await page.getByTestId("event-core-form-submit-button").click();

  // The event was created with the template's list, and the editor opens.
  await expect(page.getByTestId("checklist-editor-page")).toBeVisible();
  await expectAccessible(page, "checklist editor");
  await expect(page.getByTestId("checklist-editor-page")).toContainText("Padlásfeljáró");
  await page.getByTestId("checklist-back-link").click();
  await expect(page.getByTestId("event-checklist")).toBeVisible();
  const eventUrl = page.url();
  await expectAccessible(page, "event page with the checklist (team)");
  await expect(page.getByTestId("checklist-edit-link")).toBeVisible();

  // A parent takes the first free task and gives it back.
  await signInAs(page, world().account("parent-1"));
  await page.goto(eventUrl);
  await expect(page.getByTestId("event-checklist")).toBeVisible();
  await expect(page.getByTestId("checklist-edit-link")).toHaveCount(0);
  await expectAccessible(page, "event page with the checklist (parent)");
  const claim = page
    .locator('[data-testid^="checklist-claim-"][data-testid$="-submit-button"]')
    .first();
  const taskName = (await claim.getAttribute("aria-label"))!.replace("Elvállalom: ", "");
  await claim.click();
  const task = page.locator('[data-testid^="checklist-task-"]', { hasText: taskName }).first();
  await expect(task).toContainText("(Te)");
  await task.locator('[data-testid^="checklist-withdraw-"][data-testid$="-submit-button"]').click();
  await expect(task).not.toContainText("(Te)");

  // The team marks a task done and takes the mark back.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(eventUrl);
  await page
    .locator('[data-testid^="checklist-done-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(page.locator('[data-testid^="checklist-undo-"]').first()).toBeVisible();
  await page
    .locator('[data-testid^="checklist-undo-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(page.locator('[data-testid^="checklist-undo-"]')).toHaveCount(0);
});

test("the administrator keeps the templates: list, editor, and a new template", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/sablonok");
  await expect(page.getByTestId("template-list-page")).toBeVisible();
  await expect(page.getByTestId("template-list-page")).toContainText("Nagytakarítás");
  await expectAccessible(page, "template list");

  await page.getByTestId("template-new-link").click();
  await expect(page.getByTestId("template-editor-page")).toBeVisible();
  await expectAccessible(page, "new template");
  await page.getByTestId("template-name-input").fill("Tavaszi kerti nap");
  await page.getByTestId("template-lead-input").fill("10");
  await page.getByTestId("template-section-title-0").fill("Kert");
  await page.getByTestId("template-task-title-0-0").fill("Ágyások ásása");
  await page.getByTestId("template-add-task-0").click();
  await page.getByTestId("template-task-title-0-1").fill("Magvetés");
  await page.getByTestId("template-editor-form-submit-button").click();
  await expect(page.getByTestId("template-saved")).toBeVisible();
  await expect(page.getByTestId("template-list-page")).toContainText("Tavaszi kerti nap");

  // The new template is edited and then removed from the choice.
  await page.getByRole("link", { name: "Szerkesztés: Tavaszi kerti nap" }).click();
  await expect(page.getByTestId("template-task-title-0-1")).toHaveValue("Magvetés");
  await page.getByTestId("template-name-input").fill("Tavaszi kerti nap 2");
  await page.getByTestId("template-editor-form-submit-button").click();
  await expect(page.getByTestId("template-editor-form-state-success")).toBeVisible();
  await page.goto("/admin/sablonok");
  await page.getByRole("button", { name: "Törlés: Tavaszi kerti nap 2" }).click();
  await expect(
    page.getByRole("button", { name: "Visszaállítás: Tavaszi kerti nap 2" }),
  ).toBeVisible();
});
