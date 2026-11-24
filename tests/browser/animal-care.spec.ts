import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical animal-care and information flow (U8): a parent opens the sign-up page, takes a free slot and gives it
 * up again; a duty link opens its section on the information page; a super admin edits the text of a section, which a
 * parent then reads, while a parent has no edit link. Each page the flow opens is checked for serious or critical
 * accessibility violations. All names are invented.
 */
const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS), label).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} overflows sideways`).toBeLessThanOrEqual(0);
}

test("a parent takes a free animal-care slot and gives it up again", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/allatok");
  await expect(page.getByTestId("animal-page")).toBeVisible();
  await expect(page.getByTestId("animal-fair-share")).toBeVisible();
  await expectAccessible(page, "animal-care page");

  // The first free slot far enough ahead to be given up again.
  const signUp = page
    .locator('[data-testid^="animal-signup-"][data-testid$="-submit-button"]')
    .last();
  await expect(signUp).toBeVisible();
  const label = (await signUp.getAttribute("aria-label")) ?? "";
  expect(label).toContain("Elvállalom:");
  await signUp.click();
  await expect(page.getByTestId("animal-status")).toContainText("Az időpontot elvállaltad.");
  const mine = page.locator('[data-testid^="animal-mine-"]');
  await expect(mine.first()).toBeVisible();
  await expectAccessible(page, "animal-care page after taking a slot");

  const giveUp = page.locator('[data-testid^="animal-giveup-"] summary').first();
  await expect(giveUp).toBeVisible();
  await giveUp.click();
  await page
    .locator('[data-testid^="animal-giveup-form-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(page.getByTestId("animal-status")).toContainText("Az időpontot lemondtad.");
});

test("a duty link opens its section, and a super admin edits a section a parent then reads", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/informacio#morning");
  await expect(page.getByTestId("info-page")).toBeVisible();
  await expect(page.getByTestId("info-section-morning")).toHaveAttribute("open", "");
  await expect(page.locator('[data-testid^="info-edit-"]')).toHaveCount(0);
  await expectAccessible(page, "information page");

  await signInAs(page, world().account("super-admin"));
  await page.goto("/informacio");
  // The edit link sits inside the section, so the section is opened first.
  await page.locator(".info-summary").first().click();
  const edit = page.locator('[data-testid^="info-edit-"]').first();
  await expect(edit).toBeVisible();
  const testId = (await edit.getAttribute("data-testid")) ?? "";
  const key = testId.replace("info-edit-", "");
  await edit.click();
  await expect(page.getByTestId("info-section-form")).toBeVisible();
  await expect(page.getByTestId("info-body-warning")).toBeVisible();
  await expectAccessible(page, "section editor");
  await page.getByTestId("info-body").fill("Új, **fontos** tudnivaló.\n\n- első\n- második");
  await page.getByTestId("info-section-form-submit-button").click();
  await expect(page.getByTestId("info-page")).toBeVisible();

  await signInAs(page, world().account("parent-1"));
  await page.goto(`/informacio#${key}`);
  await expect(page.getByTestId(`info-section-${key}`)).toContainText("Új, fontos tudnivaló.");
  await expect(page.getByTestId(`info-section-${key}`).locator("li")).toHaveCount(2);
});

test("a super admin saves the animal-care times", async ({ page }) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/allatgondozas");
  await expect(page.getByTestId("admin-animal-page")).toBeVisible();
  await expectAccessible(page, "animal-care settings");
  await page.getByTestId("animal-morning").fill("07:30");
  await page.getByTestId("animal-calendar-form-submit-button").click();
  await expect(page.getByTestId("animal-calendar-form-state-success")).toBeVisible();
});

test("a teacher reads who looks after the animals, with no sign-up control", async ({ page }) => {
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/allatok");
  await expect(page.getByTestId("animal-page")).toBeVisible();
  await expect(page.getByTestId("animal-days")).toBeVisible();
  await expect(page.locator('[data-testid^="animal-signup-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="animal-giveup-"]')).toHaveCount(0);
  await expectAccessible(page, "teacher animal-care page");
});
