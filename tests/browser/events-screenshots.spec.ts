import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the event screens for the owner's comparison with the Stitch designs (team practice: owner
 * review, no automatic picture comparison). It does nothing unless `EVENT_SCREENSHOTS` names the folder to write to.
 * Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.EVENT_SCREENSHOTS;
test.skip(!FOLDER, "set EVENT_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema();

const SIZES = {
  phone: { width: 390, height: 844 },
  computer: { width: 1280, height: 900 },
} as const;

async function shoot(
  page: Page,
  name: string,
  size: keyof typeof SIZES,
  expectHeading: string | RegExp,
) {
  await page.setViewportSize(SIZES[size]);
  await page.waitForLoadState("networkidle");
  const heading = await page.locator("h1").first().innerText();
  expect(heading, `${name}: the page is the intended one`).toMatch(expectHeading);
  const body = await page.locator("body").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|nem érhető el|nem kezelheted|This page could not be found|Application error|Internal Server Error/,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${FOLDER}/${name}-${size}.png`, fullPage: true });
}

test("screenshots of the event list, the event page, the event form and the group page section", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  await signInAs(page, world().account("parent-1"));

  await page.goto("/szulo/esemenyek");
  await expect(page.getByTestId("event-list-page")).toBeVisible();
  await shoot(page, "1-esemenyek-lista", "phone", /Események/);

  const card = page.getByRole("link", { name: /Őszi vásár/ }).first();
  await card.click();
  await expect(page.getByTestId("event-detail-page")).toBeVisible();
  await shoot(page, "2-esemeny-nyitott", "phone", /Őszi vásár/);
  const eventUrl = page.url();

  await page.getByTestId("event-signup-note-input").fill("Hozok egy takarót");
  await page.getByTestId("event-signup-form-submit-button").click();
  await expect(page.locator('[data-testid^="event-own-signup-"]').first()).toBeVisible();
  await shoot(page, "3-esemeny-jelentkezve", "phone", /Őszi vásár/);

  await page.goto(`/szulo/munkacsoportok/${world().id("group:1")}`);
  await expect(page.getByTestId("group-events")).toBeVisible();
  await shoot(page, "4-munkacsoport-esemenyek", "phone", /Játszókert/);

  await signInAs(page, world().account("group-admin-1"));
  await page.goto(eventUrl);
  await page.getByTestId("event-edit-link").click();
  await expect(page.getByTestId("event-form-page")).toBeVisible();
  await expect(page.getByTestId("event-notices-form")).toBeVisible();
  await shoot(page, "5-esemeny-szerkesztes", "computer", /Esemény szerkesztése/);
});
