/**
 * The two removals in the browser (U14): the confirmation with its counts, the result with what is left to handle, and
 * the restore of an archived family. Every screen is checked for serious and critical accessibility violations and for
 * sideways scrolling at phone width.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, SERIOUS, signInAs } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

/** No serious or critical violation, and nothing wider than a phone's screen. */
async function checkScreen(page: Page, name: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS), `${name}: accessibility`).toEqual([]);
  const size = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width, `${name}: no sideways scrolling on a phone`).toBeLessThanOrEqual(390);
  if (size) await page.setViewportSize(size);
}

test("@a11y a family is previewed, removed by keyboard, reviewed and restored", async ({
  page,
}) => {
  await world().reseed();
  const family = world().id("family:1");
  await signInAs(page, world().account("super-admin"));
  await page.goto(`/admin/nyilvantartasok/${family}`);
  await expect(page.getByTestId("admin-record-archive-form")).toHaveCount(0);
  await page.getByTestId("admin-family-remove-link").click();

  await expect(page).toHaveURL(new RegExp(`/admin/nyilvantartasok/${family}/eltavolitas$`));
  const summary = page.getByTestId("admin-family-remove-summary");
  await expect(summary).toContainText("Szabó család eltávolítása");
  await expect(summary).toContainText("30 napig visszaállítható");
  const counts = page.getByTestId("admin-removal-counts");
  await expect(counts).toContainText("Összesen");
  await expect(page.getByTestId("admin-family-remove-form-cancel")).toHaveText("Mégsem");
  await checkScreen(page, "family confirmation");

  // A phone gets the cards instead of the table.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".admin-removal-cards")).toBeVisible();
  await expect(page.locator(".admin-removal-table")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".admin-removal-table")).toBeVisible();
  await expect(page.locator(".admin-removal-cards")).toBeHidden();
  await page.setViewportSize(size);

  const submit = page.getByTestId("admin-family-remove-form-submit-button");
  await submit.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/eltavolitas\/eredmeny\?allapot=eltavolitva/);
  const success = page.getByTestId("admin-removal-success");
  await expect(success).toHaveText("A család eltávolítva.");
  await expect(success).toHaveAttribute("role", "status");
  await expect(page.getByTestId("admin-removal-sign-out-warning")).toHaveCount(0);
  await expect(page.getByTestId("admin-removal-flagged")).toContainText("Intézendő tételek");
  await checkScreen(page, "removal result");

  // Later, from the archived family: what is left, without the success message.
  await page.goto(`/admin/archivum/${family}`);
  const restore = page.getByTestId("admin-family-restore-summary");
  await expect(restore).toContainText("Ami visszaáll:");
  await expect(restore).toContainText("Ami nem áll vissza:");
  await expect(restore).toContainText("minden szülőnek új meghívó kell");
  await checkScreen(page, "restore");
  await restore.getByRole("link", { name: "Intézendő tételek megtekintése" }).click();
  await expect(page.getByTestId("admin-removal-flagged")).toBeVisible();
  await expect(page.getByTestId("admin-removal-success")).toHaveCount(0);

  await page.goto(`/admin/archivum/${family}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("admin-record-restore-form-submit-button").click();
  await expect
    .poll(async () => {
      await page.goto(`/admin/nyilvantartasok/${family}`);
      return page.getByTestId("admin-family-remove-link").count();
    })
    .toBe(1);
  await expect(page.getByTestId("admin-parents-panel")).toContainText("Szabó Anna");
});

test("@a11y a parent is removed from the confirmation and the only parent is sent to the family's removal", async ({
  page,
}) => {
  await world().reseed();
  const family = world().id("family:3");
  const parent = world().id("parent:3:1");
  await signInAs(page, world().account("super-admin"));
  await page.goto(`/admin/nyilvantartasok/${family}/szulo/${parent}/eltavolitas`);
  await expect(page.getByTestId("admin-parent-remove-summary")).toContainText(
    "Horváth Éva eltávolítása",
  );
  await expect(page.getByTestId("admin-removal-counts")).toContainText("Összesen");
  await checkScreen(page, "parent confirmation");
  await page.getByTestId("admin-parent-remove-form-submit-button").click();

  await expect(page).toHaveURL(new RegExp(`/szulo/${parent}/eltavolitas/eredmeny\\?allapot=`));
  await expect(page.getByTestId("admin-removal-success")).toHaveText("A szülő eltávolítva.");
  await checkScreen(page, "parent removal result");
  await page.getByRole("link", { name: "Vissza a családhoz" }).click();
  await expect(page.getByTestId("admin-parents-panel")).not.toContainText("Horváth Éva");

  await page.goto(`/admin/nyilvantartasok/${family}/szulo/${world().id("parent:3:2")}/eltavolitas`);
  await expect(page.getByTestId("admin-parent-remove-last")).toBeVisible();
  await expect(page.getByTestId("admin-parent-remove-form")).toHaveCount(0);
  await page.getByRole("link", { name: "Család eltávolítása" }).click();
  await expect(page.getByTestId("admin-family-remove-form")).toBeVisible();
  await page.getByTestId("admin-family-remove-form-cancel").click();
  await expect(page).toHaveURL(new RegExp(`/admin/nyilvantartasok/${family}$`));
});
