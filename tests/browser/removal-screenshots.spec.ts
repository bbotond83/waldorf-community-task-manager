import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the removal screens for the owner's comparison with the Stitch designs (team practice: owner
 * review, no automatic picture comparison). It does nothing unless `REMOVAL_SCREENSHOTS` names the folder to write to.
 * Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.REMOVAL_SCREENSHOTS;
test.skip(!FOLDER, "set REMOVAL_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema();

async function shoot(page: Page, name: string, heading: string, ready: string) {
  await expect(page.getByTestId(ready)).toBeVisible();
  for (const width of [390, 1280] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1").first()).toHaveText(heading);
    await expect(page.locator("main"), `${name}: no error or denied page`).not.toContainText(
      /Nincs jogosultság|Hiba történt|nem érhető el|nem sikerült|This page could not be found|Application error|Internal Server Error/,
    );
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `${FOLDER}/${name}-${width === 390 ? "phone" : "desktop"}.png`,
      fullPage: true,
    });
  }
}

test("screenshots of the removal screens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  await signInAs(page, world().account("super-admin"));

  await page.goto(
    `/admin/nyilvantartasok/${world().id("family:3")}/szulo/${world().id("parent:3:1")}/eltavolitas`,
  );
  await shoot(page, "1-szulo-megerosites", "Szülő eltávolítása", "admin-parent-remove-form");

  const family = world().id("family:1");
  await page.goto(`/admin/nyilvantartasok/${family}/eltavolitas`);
  await shoot(page, "2-csalad-megerosites", "Család eltávolítása", "admin-family-remove-form");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId("admin-family-remove-form-submit-button").click();
  await expect(page.getByTestId("admin-removal-success")).toBeVisible();
  await shoot(page, "3-eredmeny", "Az eltávolítás eredménye", "admin-removal-flagged");

  await page.goto(`/admin/archivum/${family}`);
  // The heading is read only once the record is on screen; before that the page shows its loading heading.
  await expect(page.getByTestId("admin-family-restore-summary")).toBeVisible();
  const archiveHeading = await page.locator("h1").first().innerText();
  await shoot(page, "4-visszaallitas", archiveHeading, "admin-family-restore-summary");
});
