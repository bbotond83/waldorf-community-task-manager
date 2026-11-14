import { test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

/**
 * Takes the screenshots of the directory, "Fiókom", e-mail confirmation and records screens for the owner's
 * comparison with the Stitch designs (team practice: owner review, no automatic picture comparison). It does nothing
 * unless `DIRECTORY_SCREENSHOTS` names the folder to write to, so the ordinary runs never produce pictures.
 */
const FOLDER = process.env.DIRECTORY_SCREENSHOTS;
test.skip(!FOLDER, "set DIRECTORY_SCREENSHOTS to a folder to take the screenshots");

const SIZES = {
  phone: { width: 390, height: 844 },
  computer: { width: 1280, height: 900 },
} as const;

async function shoot(page: Page, name: string) {
  for (const [label, size] of Object.entries(SIZES)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${FOLDER}/${name}-${label}.png`, fullPage: true });
  }
}

test("screenshots of the new U3 screens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");

  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/szulok");
  await shoot(page, "1-szulok");
  await page.getByTestId("directory-search-input").fill("zzzz");
  await shoot(page, "2-szulok-nincs-talalat");
  await page.goto("/szulo/fiokom");
  await shoot(page, "3-fiokom");
  const form = page.getByTestId("account-email-form");
  await form.getByLabel("Új e-mail-cím").fill("masik.cim@example.test");
  await form.getByLabel("Jelenlegi jelszó").fill(world().account("parent-1").password);
  await form.getByRole("button", { name: "Megerősítő levél küldése" }).click();
  await page.getByTestId("account-email-form-state-success").waitFor();
  await page.reload();
  await shoot(page, "4-fiokom-fuggo-cimvaltas");

  await page.goto(`/email-megerosites/${"A".repeat(43)}`);
  await shoot(page, "5-email-megerosites");
  await page.getByRole("button", { name: "E-mail-cím megerősítése" }).click();
  await page.getByTestId("email-confirm-not-valid").waitFor();
  await shoot(page, "6-email-megerosites-nem-ervenyes");

  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/szulok");
  await shoot(page, "7-pedagogus-szulok");

  await signInAs(page, world().account("super-admin"));
  const family = world().id("family:3");
  await page.goto(`/admin/nyilvantartasok/${family}`);
  await page.getByTestId("admin-parents-panel").waitFor();
  await shoot(page, "8-csaladi-adatlap");
  await page.goto(`/admin/nyilvantartasok/${family}/szulo/${world().id("parent:3:1")}/eltavolitas`);
  await page.getByTestId("admin-parent-remove-summary").waitFor();
  await shoot(page, "9-eltavolitas-megerosites");
  await page.goto("/admin/nyilvantartasok/uj");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForLoadState("networkidle");
  await shoot(page, "10-uj-csalad");
});
