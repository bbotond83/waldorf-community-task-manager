import { expect, test, type Page } from "@playwright/test";
import { seedAccount, seedId } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the to-do screens for the owner's comparison with the Stitch designs (team practice: owner
 * review, no automatic picture comparison). It does nothing unless `TODO_SCREENSHOTS` names the folder to write to. Every
 * shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.TODO_SCREENSHOTS;
test.skip(!FOLDER, "set TODO_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema();

async function shoot(
  page: Page,
  name: string,
  expectHeading: string | RegExp,
  width: 390 | 1280 = 390,
) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.waitForLoadState("networkidle");
  const heading = await page.locator("h1").first().innerText();
  expect(heading, `${name}: the page is the intended one`).toMatch(expectHeading);
  const body = await page.locator("main").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|nem érhető el|nem kezelheted|This page could not be found|Application error|Internal Server Error/,
  );
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${FOLDER}/${name}-${width === 390 ? "phone" : "desktop"}.png`,
    fullPage: true,
  });
}

test("screenshots of the to-do screens", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  const account = (tag: string) => seedAccount(world().schema, tag, "small");
  const id = (key: string) => seedId(world().schema, key);

  // A parent: the list, a free task's page, My tasks.
  await signInAs(page, account("parent-2"));
  await page.goto("/szulo/teendok");
  await expect(page.getByTestId("todo-list-page")).toBeVisible();
  await shoot(page, "1-kozos-teendok", /Közös teendők/);
  await page.goto(`/szulo/teendok/${id("todo:1")}`);
  await expect(page.getByTestId("todo-detail-page")).toBeVisible();
  await shoot(page, "2-teendo-reszletei", /Kerítés festése/);

  await signInAs(page, account("parent-1"));
  await page.goto("/szulo/feladataim");
  await expect(page.getByTestId("my-tasks-page")).toBeVisible();
  await shoot(page, "3-feladataim", /Feladataim/);

  // The coordinator: the management page, the new-task form and the pull list.
  await signInAs(page, account("group-admin-1"));
  await page.goto(`/szulo/munkacsoportok/${id("group:1")}/kezeles`);
  await expect(page.getByTestId("manage-page")).toBeVisible();
  await shoot(page, "4-munkacsoport-kezelese", /Munkacsoport kezelése/);
  await shoot(page, "4-munkacsoport-kezelese", /Munkacsoport kezelése/, 1280);
  await page.goto(`/szulo/munkacsoportok/${id("group:1")}/kezeles/teendo`);
  await expect(page.getByTestId("todo-form-page")).toBeVisible();
  await shoot(page, "5-uj-teendo", /Új teendő/);
  await page.goto(`/szulo/esemenyek/${id("event:1")}/teendok`);
  await expect(page.getByTestId("todo-pull-page")).toBeVisible();
  await shoot(page, "6-teendok-hozzaadasa", /Teendők hozzáadása/);
});
