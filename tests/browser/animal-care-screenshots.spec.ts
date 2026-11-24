import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the animal-care and information screens for the owner's comparison with the Stitch designs
 * (team practice: owner review, no automatic picture comparison). It does nothing unless `ANIMAL_SCREENSHOTS` names the
 * folder to write to. Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.ANIMAL_SCREENSHOTS;
test.skip(!FOLDER, "set ANIMAL_SCREENSHOTS to a folder to take the screenshots");

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
  const body = await page.locator("main").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|nem érhető el|nem szerkesztheted|This page could not be found|Application error|Internal Server Error/,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${FOLDER}/${name}-${size}.png`, fullPage: true });
}

test("screenshots of the sign-up page, the information page, the editor and the settings", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  await signInAs(page, world().account("parent-1"));

  await page.goto("/szulo/allatok");
  await expect(page.getByTestId("animal-page")).toBeVisible();
  await shoot(page, "1-allatgondozas", "phone", /Állatgondozás/);

  await page.goto("/informacio#morning");
  await expect(page.getByTestId("info-section-morning")).toHaveAttribute("open", "");
  await shoot(page, "2-informacio", "phone", /Információ/);

  await signInAs(page, world().account("super-admin"));
  await page.goto("/informacio?szerkesztes=morning#morning");
  await expect(page.getByTestId("info-section-form")).toBeVisible();
  await shoot(page, "3-szakasz-szerkeszto", "phone", /Információ/);

  await page.goto("/admin/allatgondozas");
  await expect(page.getByTestId("admin-animal-page")).toBeVisible();
  await shoot(page, "4-allatgondozas-beallitasok", "computer", /Állatgondozás/);

  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/allatok");
  await expect(page.getByTestId("animal-page")).toBeVisible();
  await shoot(page, "5-allatgondozas-ovono", "phone", /Állatgondozás/);
});
