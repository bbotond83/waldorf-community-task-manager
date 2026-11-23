import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the recurring-duty screens for the owner's comparison with the Stitch designs (team practice:
 * owner review, no automatic picture comparison). It does nothing unless `RECURRING_SCREENSHOTS` names the folder to
 * write to. Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.RECURRING_SCREENSHOTS;
test.skip(!FOLDER, "set RECURRING_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema({ seed: false });

test.beforeAll(async () => {
  // A published plan gives the water weeks their bottle-cleaning occurrences for the duty card.
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema: world().schema });
  await seedSchema(
    { ...defaultSeedDeps(), log: () => undefined },
    { schema: world().schema, size: "small", rotaPlan: "published" },
  );
});

async function shoot(page: Page, name: string, expectHeading: string | RegExp) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForLoadState("networkidle");
  const heading = await page.locator("h1").first().innerText();
  expect(heading, `${name}: the page is the intended one`).toMatch(expectHeading);
  const body = await page.locator("main").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|nem érhető el|nem szerkesztheted|This page could not be found|Application error|Internal Server Error/,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${FOLDER}/${name}-phone.png`, fullPage: true });
}

test("screenshots of the recurring-duty screens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  const account = (tag: string) => seedAccount(world().schema, tag, "small");
  const group = seedId(world().schema, "group:1");

  // The coordinator's group page with the controls, and the form for a new duty.
  await signInAs(page, account("group-admin-1"));
  await page.goto(`/szulo/munkacsoportok/${group}/ismetlodo`);
  await expect(page.getByTestId("recurring-group-page")).toBeVisible();
  await shoot(page, "1-csoport-oldal", /Játszókert|Ismétlődő/);
  await page.goto(`/szulo/ismetlodo/uj?csoport=${group}`);
  await expect(page.getByTestId("recurring-form-page")).toBeVisible();
  await shoot(page, "2-uj-feladat-urlap", /Új ismétlődő feladat/);

  // A parent's own list.
  await signInAs(page, account("parent-1"));
  await page.goto("/szulo/ismetlodo");
  await expect(page.getByTestId("recurring-mine-page")).toBeVisible();
  await shoot(page, "3-az-en-feladataim", /Ismétlődő|feladat/i);

  // The duty card of a water week with the bottle line, as the family that holds it.
  let shot = false;
  for (const tag of ["parent-1", "parent-2", "parent-3", "parent-4", "parent-5"]) {
    await signInAs(page, account(tag));
    await page.goto("/szulo/beosztas");
    const hrefs = await page
      .locator('[data-testid="rota-job-water_carrying"] a[href^="/szulo/beosztas/"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")!),
      );
    for (const href of hrefs) {
      await page.goto(href);
      if (await page.getByTestId("recurring-bottle-line").isVisible()) {
        await shoot(page, "4-munkakartya-palackok", /./);
        shot = true;
        break;
      }
    }
    if (shot) break;
  }
  expect(shot, "a duty card with the bottle line").toBe(true);

  // The school calendar with the bottle interval.
  await signInAs(page, account("super-admin"));
  await page.goto("/admin/tanev");
  await expect(page.getByTestId("recurring-bottle-form")).toBeVisible();
  await shoot(page, "5-tanev-palack-intervallum", /Tanév/);
});
