import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the swap and duty-change screens for the owner's comparison with the Stitch designs (team
 * practice: owner review, no automatic picture comparison). It does nothing unless `SWAP_SCREENSHOTS` names the folder
 * to write to. Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.SWAP_SCREENSHOTS;
test.skip(!FOLDER, "set SWAP_SCREENSHOTS to a folder to take the screenshots");

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
    /Nincs jogosultság|Hiba történt|nem érhető el|This page could not be found|Application error|Internal Server Error/,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${FOLDER}/${name}-${size}.png`, fullPage: true });
}

test("screenshots of the parent swap board and the administrator swap list", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");

  // The family that is asked: the swap with its reason and the two buttons.
  await signInAs(page, world().account("parent-5"));
  await page.goto("/szulo/cserek");
  await expect(page.getByTestId("swap-incoming-section")).toBeVisible();
  await shoot(page, "1-cserek-beerkezett", "phone", /Cserék/);
  await shoot(page, "1-cserek-beerkezett", "computer", /Cserék/);

  // The family that asked: its own open swap with the withdraw button.
  await signInAs(page, world().account("parent-3"));
  await page.goto("/szulo/cserek");
  await expect(page.getByTestId("swap-outgoing-section")).toBeVisible();
  await shoot(page, "2-cserek-sajat-kerelem", "phone", /Cserék/);

  // The family with an open cancellation request.
  await signInAs(page, world().account("parent-6"));
  await page.goto("/szulo/cserek");
  await shoot(page, "3-cserek-lemondas", "phone", /Cserék/);

  // After the confirmation: the swap is listed as ended.
  await signInAs(page, world().account("parent-5"));
  await page.goto("/szulo/cserek");
  await page.getByRole("button", { name: /^Megerősítés:/ }).click();
  await expect(page.getByTestId("swap-board-state-success")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("swap-ended-section")).toBeVisible();
  await shoot(page, "4-cserek-lezart", "phone", /Cserék/);

  // The administrator's swap list with the reverse form.
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/cserek");
  await shoot(page, "5-admin-cserek", "computer", /Cserék/);
  await shoot(page, "5-admin-cserek", "phone", /Cserék/);

  // The duty card of the rota with the hand-over panel, when a published week has one.
  await page.goto("/admin/beosztas");
  await shoot(page, "6-admin-beosztas", "computer", /Beosztás/);
});
