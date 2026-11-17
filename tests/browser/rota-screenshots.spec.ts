import { expect, test, type Page } from "@playwright/test";
import { signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

/**
 * Takes the screenshots of the calendar, rota, standings, unpicked list and weekend picker screens for the owner's
 * comparison with the Stitch designs (team practice: owner review, no automatic picture comparison). It does nothing
 * unless `ROTA_SCREENSHOTS` names the folder to write to, so the ordinary runs never produce pictures.
 *
 * Before each picture the page is checked for an error page: a wrong address would otherwise show an error screen
 * and the picture would silently be the wrong one.
 */
const FOLDER = process.env.ROTA_SCREENSHOTS;
test.skip(!FOLDER, "set ROTA_SCREENSHOTS to a folder to take the screenshots");

const SIZES = {
  phone: { width: 390, height: 844 },
  computer: { width: 1280, height: 900 },
} as const;

async function expectNoErrorPage(page: Page, name: string) {
  const text = await page.locator("main, body").first().innerText();
  for (const sentence of ["Hiba történt", "Nincs jogosultság", "404", "Nem található"]) {
    expect(text, `${name} shows an error page ("${sentence}")`).not.toContain(sentence);
  }
}

async function shoot(page: Page, name: string) {
  await expectNoErrorPage(page, name);
  for (const [label, size] of Object.entries(SIZES)) {
    await page.setViewportSize(size);
    // A page still loading would give a picture of the loading text, not of the screen.
    await expect(page.getByText("Betöltés folyamatban")).toHaveCount(0);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${FOLDER}/${name}-${label}.png`, fullPage: true });
  }
}

test("screenshots of Tanév, Beosztás tervezése, the dashboard, the overview and the duty cards", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/tanev");
  await shoot(page, "1-tanev-csaladok-helyzete");

  // The seed holds a draft of the four rotas.
  await page.goto("/admin/beosztas");
  await shoot(page, "2-beosztas-tervezet-belso-takaritas");
  await page.goto("/admin/beosztas?beosztas=weekend_animal_care");
  await shoot(page, "3-beosztas-tervezet-hetvegi-allatgondozas");

  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/beosztas");
  await shoot(page, "4-attekintes-nincs-kozzetett");

  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beosztas");
  await page.getByTestId("admin-rota-publish-form-submit-button").click();
  await expect(page.getByTestId("admin-rota-head")).toContainText("Közzétéve");
  await shoot(page, "5-beosztas-kozzetett");
  await page.goto("/admin");
  await expect(page.getByTestId("admin-unpicked")).toBeVisible();
  await shoot(page, "6-ki-nem-valasztott");

  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/beosztas");
  await expect(page.getByTestId("rota-weekend")).toBeAttached();
  await shoot(page, "7-attekintes-negy-beosztas");
  const hrefs = await page
    .locator(
      '[data-testid="rota-job-indoor_cleaning"] a[href^="/szulo/beosztas/"], [data-testid="rota-job-front_garden"] a[href^="/szulo/beosztas/"]',
    )
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
  let withPicker = false;
  for (const href of hrefs) {
    await page.goto(href!);
    if ((await page.getByTestId("weekend-pick-fieldset").count()) > 0) {
      await shoot(page, "8-feladatlap-hetvegi-valasztas");
      withPicker = true;
      break;
    }
  }
  expect(withPicker, "a card with the weekend picker was found").toBe(true);
  await page.goto(hrefs[0]!);
  await shoot(page, "9-feladatlap");
});
