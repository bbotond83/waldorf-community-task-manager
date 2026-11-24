import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the checklist and template screens for the owner's comparison with the Stitch designs (team
 * practice: owner review, no automatic picture comparison). It does nothing unless `CHECKLIST_SCREENSHOTS` names the
 * folder to write to. Every shot first checks that the page is the intended one and not an error, denied or not-found
 * page.
 */
const FOLDER = process.env.CHECKLIST_SCREENSHOTS;
test.skip(!FOLDER, "set CHECKLIST_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema({ seed: false });

test.beforeAll(async () => {
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema: world().schema });
  await seedSchema(
    { ...defaultSeedDeps(), log: () => undefined },
    { schema: world().schema, size: "small" },
  );
});

async function shoot(page: Page, name: string, expectHeading: string | RegExp, width = 390) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.waitForLoadState("networkidle");
  const heading = await page.locator("h1").first().innerText();
  expect(heading, `${name}: the page is the intended one`).toMatch(expectHeading);
  const body = await page.locator("main").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|nem érhető el|nem kezelheted|This page could not be found|Application error|Internal Server Error/,
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${FOLDER}/${name}.png`, fullPage: true });
}

function inDays(days: number, hour: number): string {
  const date = new Date(Date.now() + days * 24 * 3600 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

test("screenshots of the checklist and template screens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  const account = (tag: string) => seedAccount(world().schema, tag, "small");
  const group = seedId(world().schema, "group:1");

  // The new-event form with a template chosen, then the event made from it.
  await signInAs(page, account("group-admin-1"));
  await page.goto("/szulo/esemenyek/uj");
  await page.getByTestId("event-title-input").fill("Őszi nagytakarítás");
  await page.getByTestId("event-group-select").selectOption({ label: "Játszókert" });
  await page.getByTestId("event-starts-at-input").fill(inDays(25, 9));
  await page.getByTestId("event-ends-at-input").fill(inDays(25, 15));
  await page.getByTestId("event-location-input").fill("Iskolaudvar és kiskert");
  await page.getByTestId("event-template-select").selectOption({ label: "Hajó javítás" });
  await shoot(page, "2-uj-esemeny-sablonnal", /Új esemény/);
  await page.getByTestId("event-core-form-submit-button").click();
  await expect(page.getByTestId("checklist-editor-page")).toBeVisible();
  await shoot(page, "3-feladatlista-szerkeszto", /feladatlista/);
  await page.getByTestId("checklist-back-link").click();
  await expect(page.getByTestId("event-checklist")).toBeVisible();
  const eventUrl = page.url();

  // The event page as a parent, with one task taken.
  await signInAs(page, account("parent-1"));
  await page.goto(eventUrl);
  await page
    .locator('[data-testid^="checklist-claim-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(page.locator('[data-testid^="checklist-withdraw-"]').first()).toBeVisible();
  await shoot(page, "1-esemeny-feladatlista", /Őszi nagytakarítás/);

  // The templates: the administrator's list and editor, and the coordinator's group page.
  await signInAs(page, account("super-admin"));
  await page.goto("/admin/sablonok");
  await expect(page.getByTestId("template-list-page")).toBeVisible();
  await shoot(page, "4-sablonok-lista", /Sablonok/, 1280);
  await page.getByRole("link", { name: /Szerkesztés: Hajó javítás/ }).click();
  await expect(page.getByTestId("template-editor-page")).toBeVisible();
  await shoot(page, "5-sablon-szerkeszto", /Sablon szerkesztése/, 1280);

  await signInAs(page, account("group-admin-1"));
  await page.goto(`/szulo/munkacsoportok/${group}/sablonok`);
  await expect(page.getByTestId("template-list-page")).toBeVisible();
  await shoot(page, "6-csoport-sablonok", /Sablonok/);
});
