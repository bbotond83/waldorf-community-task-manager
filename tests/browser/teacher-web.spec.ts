import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLEANING_DAY, EVENT_DAY, seedDay } from "./support/dates.ts";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();
const isMobile = (name: string) => name === "mobile-chrome";

test.beforeEach(async ({ page }) => signInAs(page, world().account("teacher-1")));

/** The schedule entry of a task: a table row on a desktop, a card on a phone. */
function entry(page: Page, project: string, taskId: string) {
  return page.getByTestId(
    isMobile(project) ? `teacher-schedule-card-${taskId}` : `teacher-schedule-row-${taskId}`,
  );
}
function entryOpen(page: Page, project: string, taskId: string) {
  return page.getByTestId(
    isMobile(project) ? `teacher-schedule-card-open-${taskId}` : `teacher-schedule-open-${taskId}`,
  );
}

test("Teacher filters, list, detail, and return preserve authorized context under two seconds", async ({
  page,
}, testInfo) => {
  const baking = world().id("task:1:1");
  const cleaning = world().id("task:1:3");
  const startedAt = Date.now();
  await page.goto("/teacher/schedule");
  await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
  await expect(entry(page, testInfo.project.name, baking)).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(2_000);

  const day = seedDay(CLEANING_DAY);
  await page.getByTestId("teacher-schedule-from-input").fill(day);
  await page.getByTestId("teacher-schedule-to-input").fill(day);
  await page.getByTestId("teacher-schedule-filter-submit-button").click();
  await expect(entry(page, testInfo.project.name, cleaning)).toBeVisible();
  await expect(entry(page, testInfo.project.name, baking)).toHaveCount(0);
  await entryOpen(page, testInfo.project.name, cleaning).click();
  await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText("Játszókert");
  await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText("Takarítás");
  await page.getByTestId("teacher-schedule-detail-back-link").click();
  await expect(page.getByTestId("teacher-schedule-from-input")).toHaveValue(day);
});

test("empty state clears filters and invalid ranges never expose rows", async ({
  page,
}, testInfo) => {
  const baking = world().id("task:1:1");
  await page.goto(`/teacher/schedule?from=${seedDay(40)}&to=${seedDay(45)}`);
  await expect(page.getByTestId("teacher-schedule-empty")).toBeVisible();
  await page.getByTestId("teacher-schedule-clear-link").click();
  await expect(entry(page, testInfo.project.name, baking)).toBeVisible();

  await page.goto(`/teacher/schedule?from=${seedDay(0)}&to=${seedDay(40)}`);
  await expect(page.getByTestId("teacher-schedule-validation")).toBeFocused();
  await expect(page.getByTestId("teacher-schedule-table")).toHaveCount(0);
});

test("an unknown group and a crafted row are generically denied", async ({ page }) => {
  const unknownGroup = "cccccccc-0000-4000-8000-00000000fffe";
  await page.goto(
    `/teacher/schedule?groupId=${unknownGroup}&from=${seedDay(0)}&to=${seedDay(EVENT_DAY + 2)}`,
  );
  await expect(page.getByTestId("teacher-schedule-denied")).toContainText("nem érhető el");
  await expect(page.getByTestId("teacher-schedule-denied")).toBeFocused();
  await expect(page.locator("body")).not.toContainText(unknownGroup);

  const foreignTask = "cccccccc-0000-4000-8000-00000000ffff";
  await page.goto(`/teacher/schedule/${foreignTask}`);
  await expect(page.getByTestId("teacher-detail-denied")).toContainText("nem érhető el");
  await expect(page.locator("body")).not.toContainText(foreignTask);
});

test("Teacher DOM has no sensitive or mutating capability", async ({ page }) => {
  await page.goto(`/teacher/schedule/${world().id("task:1:1")}`);
  const body = page.locator("body");
  await expect(body).not.toContainText(
    /e-mail|email|telefon|lakhely|családi|védett indok|hozzárendelés/iu,
  );
  // The one form of the page is the shell's sign-out form.
  await expect(page.locator("form")).toHaveCount(1);
  // The only controls are the shell's: the sign-out button, nothing that edits.
  await expect(page.locator('button:not([data-testid="sign-out-button"])')).toHaveCount(0);
  await expect(page.locator('input:not([type="hidden"])')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /szerkeszt|módosít|mentés|törlés/iu })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: /szerkeszt|módosít|mentés|törlés/iu })).toHaveCount(
    0,
  );
});

test("@a11y Teacher supports keyboard, focus, zoom, touch, mobile cards, and axe", async ({
  page,
}, testInfo) => {
  await page.goto("/teacher/schedule");
  await page.getByTestId("app-shell-skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("app-shell-main")).toBeFocused();
  // Exercise wider text metrics as well as page zoom across operating systems.
  await page.addStyleTag({ content: ".teacher-table { font-size: 1.2rem; }" });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);

  if (testInfo.project.name === "mobile-chrome") {
    await expect(page.getByTestId("teacher-schedule-card-list")).toBeVisible();
    const box = await entryOpen(page, testInfo.project.name, world().id("task:1:1")).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("Teacher current responsibility, assignment and status match list and detail layouts", async ({
  page,
}, testInfo) => {
  const baking = world().id("task:1:1");
  await page.goto("/teacher/schedule");
  const row = entry(page, testInfo.project.name, baking);
  // The seed places two families on the baking task; the first of them is the responsible one.
  for (const text of ["Szabó család", "Horváth család", "Nyitott", "Tóth Mária"])
    await expect(row).toContainText(text);
  await page.goto(`/teacher/schedule/${baking}`);
  for (const text of ["Szabó család", "Horváth család", "Nyitott"])
    await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText(text);
});

test("Teacher old bookmarks redirect safely and destination independently denies or validates", async ({
  page,
}) => {
  const group = world().id("group:1");
  const day = seedDay(EVENT_DAY);
  const response = await page.request.get(
    `/munkatars/beosztas?csoport=${group}&kezdet=${day}&veg=${day}&returnTo=https://evil.invalid`,
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(307);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(response.headers()["location"]).toBe(
    `/teacher/schedule?groupId=${group}&from=${day}&to=${day}`,
  );
  await page.goto(`/munkatars/beosztas?csoport=${world().id("group:2")}&kezdet=bad`);
  await expect(page.getByTestId("teacher-schedule-validation")).toBeVisible();
  await expect(page.getByTestId("teacher-schedule-table")).toHaveCount(0);
  await page.goto(`/munkatars/beosztas?csoport=${group}&csoport=${world().id("group:2")}`);
  await expect(page.getByTestId("teacher-schedule-validation")).toBeVisible();
  await expect(page.getByTestId("teacher-schedule-table")).toHaveCount(0);
});

test("Teacher opens an entry with a click on any part of its row or card and by keyboard", async ({
  page,
}, testInfo) => {
  const mobile = isMobile(testInfo.project.name);
  const baking = world().id("task:1:1");
  await page.goto("/teacher/schedule");
  const item = entry(page, testInfo.project.name, baking);
  // A click on the item's text outside its title opens the same detail page.
  // The stretched link covers the item, so click by position like a person would.
  const target = mobile ? item.locator("dd").first() : item.getByRole("cell").nth(3);
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(new RegExp(`/teacher/schedule/${baking}`));
  await expect(page.getByTestId("teacher-schedule-detail-fields")).toBeVisible();
  await page.getByTestId("teacher-schedule-detail-back-link").click();
  // The list was unfiltered, so the way back is the bare schedule address.
  await expect(page).toHaveURL(/\/teacher\/schedule$/);

  // Keyboard: the one link of the row or card is reachable and opens the entry with Enter.
  const link = entryOpen(page, testInfo.project.name, baking);
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/teacher/schedule/${baking}`));
});

test("Teacher's menu lists Beosztás and Munkacsoportok, and the way back works from other pages", async ({
  page,
}) => {
  await page.goto("/teacher/schedule");
  await expect(page.getByTestId("app-shell-navigation").getByRole("link")).toHaveText([
    "Beosztás",
    "Munkacsoportok",
  ]);
  await expect(page.getByTestId("brand-link")).toHaveAttribute("href", "/teacher/schedule");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Vissza a beosztáshoz" }).click();
  await expect(page).toHaveURL(/\/teacher\/schedule$/);
});
