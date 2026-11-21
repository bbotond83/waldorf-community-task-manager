import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical event flow (U10): a coordinator creates an event, a parent opens the list and the event, signs up with a
 * note, offers a dish, changes the dish and withdraws both, and the coordinator cancels the event. Each page the flow
 * opens is checked for serious or critical accessibility violations. All names are invented.
 */
const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

const TITLE = "Kerti délután";

/** A local date-time field value a few weeks from now, so the new event is open for sign-up. */
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

/** Opens the event of the list by its title and answers the address of its page. */
async function openEventFromList(page: Page, title: string): Promise<string> {
  await page.goto("/szulo/esemenyek");
  await expect(page.getByTestId("event-list-page")).toBeVisible();
  await page
    .getByRole("link", { name: new RegExp(title) })
    .first()
    .click();
  await expect(page.getByTestId("event-detail-page")).toBeVisible();
  return page.url();
}

test("a coordinator creates an event, a parent signs up and offers a dish, the coordinator cancels it", async ({
  page,
}) => {
  // The coordinator creates a food-enabled event of the first group.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto("/szulo/esemenyek/uj");
  await expect(page.getByTestId("event-form-page")).toBeVisible();
  await expectAccessible(page, "new event form");
  await page.getByTestId("event-title-input").fill(TITLE);
  await page.getByTestId("event-group-select").selectOption({ label: "Játszókert" });
  await page.getByTestId("event-starts-at-input").fill(inDays(20, 14));
  await page.getByTestId("event-ends-at-input").fill(inDays(20, 17));
  await page.getByTestId("event-location-input").fill("Az óvoda kertje");
  await page.getByTestId("event-food-on-input").check();
  await page.getByTestId("event-core-form-submit-button").click();
  await expect(page.getByTestId("event-saved")).toBeVisible();
  await expect(page.getByTestId("event-title-input")).toHaveValue(TITLE);
  const managerUrl = await openEventFromList(page, TITLE);
  await expect(page.getByTestId("event-manager-strip")).toBeVisible();
  await expect(page.getByTestId("event-edit-link")).toBeVisible();

  // The parent opens the list and the event, signs up with a note.
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/esemenyek");
  await expect(page.getByTestId("event-list-page")).toBeVisible();
  await expectAccessible(page, "event list");
  const card = page.getByRole("link", { name: new RegExp(TITLE) }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId("event-detail-page")).toBeVisible();
  await expect(page.getByTestId("event-manager-strip")).toHaveCount(0);
  await expectAccessible(page, "open event");

  await page.getByTestId("event-signup-note-input").fill("Hozok egy takarót");
  await page.getByTestId("event-signup-form-submit-button").click();
  await expect(page.locator('[data-testid^="event-own-signup-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="event-own-signup-"]').first()).toContainText(
    "Hozok egy takarót",
  );
  await expectAccessible(page, "signed-up event");

  // The parent adds a food offer, changes it and withdraws it.
  await page.getByTestId("event-offer-category-select").selectOption({ index: 1 });
  await page.getByTestId("event-offer-text-input").fill("Almás pite");
  await page.getByTestId("event-offer-hasMilk").check();
  await page.getByTestId("event-offer-form-submit-button").click();
  const edit = page.locator('[data-testid^="event-offer-edit-"]').first();
  await expect(edit).toBeVisible();
  await expect(
    page.getByTestId("event-roles").or(page.getByTestId("event-detail-page")),
  ).toContainText("Almás pite");
  await edit.locator("summary").click();
  const changeText = page.locator('[data-testid^="event-offer-change-text-"]').first();
  await changeText.fill("Mézes pogácsa");
  await page.locator('[data-testid$="-submit-button"][data-testid^="event-offer-change-"]').click();
  await expect(page.getByTestId("event-detail-page")).toContainText("Mézes pogácsa");
  await page
    .locator('[data-testid^="event-offer-withdraw-"][data-testid$="-submit-button"]')
    .click();
  await expect(page.getByTestId("event-detail-page")).not.toContainText("Mézes pogácsa");

  // The parent withdraws the sign-up.
  await page
    .locator('[data-testid^="event-signup-withdraw-"][data-testid$="-submit-button"]')
    .click();
  await expect(page.locator('[data-testid^="event-own-signup-"]')).toHaveCount(0);
  await expect(page.getByTestId("event-signup-form")).toBeVisible();

  // The coordinator cancels the event after a confirmation; the parent then sees it as cancelled.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(managerUrl);
  await page.getByTestId("event-cancel-button").click();
  await expect(page.getByTestId("event-cancel-confirm")).toBeVisible();
  await page.getByTestId("event-cancel-form-submit-button").click();
  await expect(page.getByTestId("event-state")).toContainText("Elmarad");
  await signInAs(page, world().account("parent-1"));
  await page.goto(managerUrl);
  await expect(page.getByTestId("event-state")).toContainText("Elmarad");
  await expect(page.getByTestId("event-signup-form")).toHaveCount(0);
  await expectAccessible(page, "cancelled event");
});

test("the group page shows its events and the seeded event page lists notices, roles and offers", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto(`/szulo/munkacsoportok/${world().id("group:1")}`);
  await expect(page.getByTestId("group-events")).toBeVisible();
  await expectAccessible(page, "group page with events");
  await page.getByTestId("group-events").getByRole("link").first().click();
  await expect(page.getByTestId("event-detail-page")).toBeVisible();
  await expect(page.getByTestId("event-notices")).toContainText("Hozzon váltócipőt");
  await expect(page.getByTestId("event-roles")).toContainText("Süteménysütő");
  await expectAccessible(page, "seeded event");
});
