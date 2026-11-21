import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical library flow (U13): a parent opens the list, searches, opens a book and borrows it with a return date;
 * another parent asks to be told when it is back; the owner marks it returned. A teacher reads the list and a book page
 * and has no button to change anything. Each page the flow opens is checked for serious or critical accessibility
 * violations. All names are invented.
 */
const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

/** A date field value some days from today, in the form a date field takes. */
function inDays(days: number): string {
  const date = new Date(Date.now() + days * 24 * 3600 * 1000);
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

test("a parent searches and borrows a book with a date, another asks to be told, the owner marks it returned", async ({
  page,
}) => {
  // The borrower finds the book by search and borrows it with a return date.
  await signInAs(page, world().account("parent-2"));
  await page.goto("/szulo/konyvtar");
  await expect(page.getByTestId("library-list-page")).toBeVisible();
  await expectAccessible(page, "library list");
  await page.getByTestId("library-search-input").fill("korai évei");
  await page.getByTestId("library-search-button").click();
  await expect(page.getByRole("link", { name: "A gyermek korai évei" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pál utcai fiúk" })).toHaveCount(0);
  await page.getByRole("link", { name: "A gyermek korai évei" }).click();
  await expect(page.getByTestId("library-book-page")).toBeVisible();
  await expect(page.getByTestId("library-book-available")).toBeVisible();
  await expectAccessible(page, "book page");
  const bookUrl = page.url();
  await page.getByTestId("library-borrow-until").fill(inDays(14));
  await page.getByTestId("library-borrow-form-submit-button").click();
  await expect(page.getByTestId("library-book-borrowed")).toBeVisible();
  await expect(page.getByTestId("library-book-mine")).toBeVisible();
  await expect(page.getByTestId("library-until-form")).toBeVisible();

  // Another parent sees it is out and asks to be told when it is back.
  await signInAs(page, world().account("parent-5"));
  await page.goto(bookUrl);
  await expect(page.getByTestId("library-book-borrowed")).toBeVisible();
  await expect(page.getByTestId("library-borrow-form")).toHaveCount(0);
  await expectAccessible(page, "borrowed book page");
  await page.getByTestId("library-watch-form-submit-button").click();
  await expect(page.getByTestId("library-unwatch-form")).toBeVisible();

  // The owner marks the book returned; it reads available again.
  await signInAs(page, world().account("parent-4"));
  await page.goto(bookUrl);
  await expect(page.getByTestId("library-edit-link")).toBeVisible();
  await page.getByTestId("library-return-form-submit-button").click();
  await expect(page.getByTestId("library-book-available")).toBeVisible();
  await expect(page.getByTestId("library-return-form")).toHaveCount(0);
});

test("a parent adds a book and changes its description, and the owner of another may not", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/konyvtar/uj");
  await expect(page.getByTestId("library-form-page")).toBeVisible();
  await expectAccessible(page, "new book form");
  await page.getByTestId("library-title").fill("Az erdő meséi");
  await page.getByTestId("library-authors").fill("Teszt Szerző");
  await page.getByTestId("library-book-form-submit-button").click();
  await expect(page.getByTestId("library-book-page")).toBeVisible();
  await expect(page.getByTestId("library-book-title")).toHaveText("Az erdő meséi");
  await page.getByTestId("library-edit-link").click();
  await expect(page.getByTestId("library-form-page")).toBeVisible();
  await page.getByTestId("library-description").fill("Rövid mese az erdőről.");
  await page.getByTestId("library-book-form-submit-button").click();
  await expect(page.getByTestId("library-book-description")).toHaveText("Rövid mese az erdőről.");
  const url = page.url();

  await signInAs(page, world().account("parent-2"));
  await page.goto(`${url}/szerkesztes`);
  await expect(page.getByTestId("library-book-form")).toHaveCount(0);
});

test("a teacher reads the list and a book page and finds nothing to change", async ({ page }) => {
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/konyvtar");
  await expect(page.getByTestId("library-list-page")).toBeVisible();
  await expect(page.getByTestId("library-new-link")).toHaveCount(0);
  await expectAccessible(page, "teacher library list");
  await page.getByRole("link", { name: "A gyermek korai évei" }).first().click();
  await expect(page.getByTestId("library-book-page")).toBeVisible();
  await expect(page.getByTestId("library-actions")).toHaveCount(0);
  await expectAccessible(page, "teacher book page");
});

test("a book address that is not a book shows the not-found page, and an unknown book reads as unavailable", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  const response = await page.goto("/szulo/konyvtar/nem-azonosito");
  expect(response?.status()).toBe(404);
  await page.goto("/szulo/konyvtar/00000000-0000-4000-8000-000000000000");
  await expect(page.getByTestId("library-book-state-denied")).toBeVisible();
});
