import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the library screens for the owner's comparison with the Stitch designs (team practice: owner
 * review, no automatic picture comparison). It does nothing unless `LIBRARY_SCREENSHOTS` names the folder to write to.
 * Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.LIBRARY_SCREENSHOTS;
test.skip(!FOLDER, "set LIBRARY_SCREENSHOTS to a folder to take the screenshots");

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

test("screenshots of the library list, the book pages and the book form", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  await signInAs(page, world().account("parent-1"));

  await page.goto("/szulo/konyvtar");
  await expect(page.getByTestId("library-list-page")).toBeVisible();
  await shoot(page, "1-konyvtar-lista", "phone", /Könyvtár/);

  // A book that is available and not the parent's own: the borrow form with its date.
  await page.getByRole("link", { name: "A gyermek korai évei" }).first().click();
  await expect(page.getByTestId("library-book-page")).toBeVisible();
  await shoot(page, "2-konyv-elerheto", "phone", /A gyermek korai évei/);

  // A book the parent holds late: the date change, the return reminder.
  await page.goto("/szulo/konyvtar");
  await page.getByRole("link", { name: "Mese a hóemberről" }).first().click();
  await expect(page.getByTestId("library-book-page")).toBeVisible();
  await shoot(page, "3-konyv-nalad-van", "phone", /Mese a hóemberről/);

  // The parent's own book that is out: the owner's view with the return button.
  await signInAs(page, world().account("parent-2"));
  await page.goto("/szulo/konyvtar");
  await page.getByRole("link", { name: "Pál utcai fiúk" }).first().click();
  await expect(page.getByTestId("library-book-page")).toBeVisible();
  await shoot(page, "4-konyv-tulajdonos", "phone", /Pál utcai fiúk/);

  await page.goto("/szulo/konyvtar/uj");
  await expect(page.getByTestId("library-form-page")).toBeVisible();
  await shoot(page, "5-uj-konyv", "phone", /Új könyv/);

  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/konyvtar");
  await expect(page.getByTestId("library-list-page")).toBeVisible();
  await shoot(page, "6-ovono-lista", "computer", /Könyvtár/);
});
