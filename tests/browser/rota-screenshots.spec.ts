import { test, type Page } from "@playwright/test";
import { signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

/**
 * Takes the screenshots of the new calendar and rota screens for the owner's comparison with the Stitch designs
 * (team practice: owner review, no automatic picture comparison). It does nothing unless `ROTA_SCREENSHOTS` names the
 * folder to write to, so the ordinary runs never produce pictures.
 */
const FOLDER = process.env.ROTA_SCREENSHOTS;
test.skip(!FOLDER, "set ROTA_SCREENSHOTS to a folder to take the screenshots");

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

test("screenshots of Tanév, Beosztás tervezése, the overview and the duty card", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/tanev");
  await shoot(page, "1-tanev");
  await page.goto("/admin/beosztas");
  await shoot(page, "2-beosztas-nincs-terv");
  await page.getByTestId("admin-rota-draft-form-submit-button").click();
  await page.getByTestId("admin-rota-weeks").waitFor();
  await shoot(page, "3-beosztas-tervezet");

  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/beosztas");
  await shoot(page, "4-attekintes-nincs-kozzetett");

  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beosztas");
  await page.getByTestId("admin-rota-publish-form-submit-button").click();
  await page.getByText("Közzétéve").first().waitFor();
  await shoot(page, "5-beosztas-kozzetett");

  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/beosztas");
  await shoot(page, "6-attekintes");
  const href = await page.locator('a[href^="/szulo/beosztas/"]').first().getAttribute("href");
  await page.goto(href!);
  await shoot(page, "7-feladatlap");
});
