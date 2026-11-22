import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical swap flow (U7): the seeded open swap is addressed to the fifth family (the third of the first group),
 * its parent confirms it on the swaps page, and an administrator reverses it on the swap list. Both screens have no
 * serious or critical accessibility violations. Each test starts from the same seed again.
 */
const world = bindSeededSchema();

test.beforeEach(async () => {
  await world().reseed();
});

test("the other family sees the open swap with its reason, confirms it, and it is then listed as ended", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-5"));
  await page.goto("/szulo/cserek");
  await page.waitForLoadState("networkidle");
  const board = page.getByTestId("swap-board");
  await expect(board.getByText("cserét kér")).toBeVisible();
  await expect(page.getByTestId("swap-incoming-section").getByTestId("swap-reason")).toContainText(
    "Időpont-ütközés",
  );
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(SERIOUS);
  expect(violations).toEqual([]);

  await board.getByRole("button", { name: /^Megerősítés:/ }).click();
  await expect(page.getByTestId("swap-board-state-success")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("swap-ended-section")).toContainText("Elfogadva");
});

test("an administrator reverses an applied swap from the swap list", async ({ page }) => {
  await signInAs(page, world().account("parent-5"));
  await page.goto("/szulo/cserek");
  await page.getByRole("button", { name: /^Megerősítés:/ }).click();
  await expect(page.getByTestId("swap-board-state-success")).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/cserek");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("admin-swaps-list")).toContainText("Elfogadva");
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(SERIOUS);
  expect(violations).toEqual([]);

  await page.getByRole("button", { name: "Visszafordítom" }).click();
  // The swap leaves the "can be reversed" state, so its form goes and the status chip is the confirmation.
  await expect(page.getByTestId("admin-swaps-list")).toContainText("Visszafordítva");
  await expect(page.getByRole("button", { name: "Visszafordítom" })).toHaveCount(0);
});
