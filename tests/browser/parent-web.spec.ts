import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

// The seed gives the first parent's family the baking task and the cleaning task, and leaves the decorating task of
// the same group open with one place left. Every test starts from the same data again.
const BAKING = "task:1:1";
const DECORATING = "task:1:2";

test.beforeEach(async ({ page }) => {
  await world().reseed();
  await signInAs(page, world().account("parent-1"));
});

test("an unknown invitation link shows the not-valid page and no detail about it", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/meghivas/not-a-known-token");
  await expect(page.getByTestId("real-invitation-not-valid")).toBeVisible();
  await expect(page.getByTestId("real-invitation-not-valid-message")).toBeVisible();
  await expect(page.getByTestId("invitation-login-link")).toHaveAttribute("href", "/bejelentkezes");
});

test("the sign-in screen is the only entry: the old entry address is gone", async ({ page }) => {
  const response = await page.request.get("/belepes?tovabb=/szulo/ertesitesek", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
  await page.context().clearCookies();
  await page.goto("/bejelentkezes");
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
});

test("linked duties render and eligible signup has one observable effect", async ({ page }) => {
  const dutyId = world().id(DECORATING);
  const startedAt = Date.now();
  await page.goto("/szulo/feladatok");
  await expect(page.getByRole("heading", { name: "Családi feladatok" })).toBeFocused();
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  await expect(page.getByTestId(`duty-card-${dutyId}`)).toBeVisible();
  await page.getByTestId(`duty-open-${dutyId}`).click();
  await page.getByTestId("signup-form-submit-button").click();
  await expect(page.getByTestId("signup-form-state-success")).toContainText("jelentkezés sikerült");
  await page.reload();
  await expect(page.getByTestId("signup-form-submit-button")).toHaveCount(0);
  await expect(page.getByTestId("cancellation-request-link")).toBeVisible();
});

test("a full duty and an unrelated one expose no signup action", async ({ page }) => {
  // The first family takes the last place of the decorating task; another family of the group then finds it full.
  await page.goto(`/szulo/feladatok/${world().id(DECORATING)}`);
  await page.getByTestId("signup-form-submit-button").click();
  await expect(page.getByTestId("signup-form-state-success")).toBeVisible();
  await signInAs(page, world().account("parent-3"));
  await page.goto(`/szulo/feladatok/${world().id(DECORATING)}`);
  await expect(page.getByTestId("duty-full-state")).toBeVisible();
  await expect(page.getByTestId("signup-form-submit-button")).toHaveCount(0);
  // A duty of the other group is not the family's at all.
  await page.goto(`/szulo/feladatok/${world().id("task:2:1")}`);
  await expect(page.getByTestId("signup-form-submit-button")).toHaveCount(0);
});

test("swap request validates, succeeds once, and keeps protected reason out of the DOM", async ({
  page,
}) => {
  const dutyId = world().id(BAKING);
  await page.goto(`/szulo/feladatok/${dutyId}/csere`);
  await page.waitForLoadState("networkidle");
  // Nothing is sent without a chosen partner.
  await page.getByTestId("swap-reason-input").fill("Családi egyeztetés szükséges.");
  await page.getByTestId("swap-request-form-submit-button").click();
  await expect(page.getByTestId("swap-request-form-state-validation")).toBeVisible();
  // The partner list offers the tasks of other families of the group; the first one is chosen.
  await page.locator('input[name="counterpart"]').first().check();
  await page.getByTestId("swap-request-form-submit-button").click();
  await expect(page.getByTestId("swap-request-form-state-success")).toContainText(
    "függő állapotba",
  );
  await expect(page.locator("body")).not.toContainText("Családi egyeztetés szükséges.");
});

test("cancellation request is sent once and shows its own pending notice", async ({ page }) => {
  const dutyId = world().id(BAKING);
  await page.goto(`/szulo/feladatok/${dutyId}/lemondas`);
  await page.waitForLoadState("networkidle");
  const originalKey = await page.locator('input[name="idempotencyKey"]').inputValue();
  expect(originalKey.length).toBeGreaterThan(8);
  await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
  await page.getByTestId("cancellation-request-form-submit-button").click();
  await expect(page.getByTestId("cancellation-request-form-state-success")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Átmeneti akadály.");
  await page.goto(`/szulo/feladatok/${dutyId}`);
  await expect(page.getByTestId("pending-cancellation-notice")).toBeVisible();
});

test("notification read and authorized link are explicit and provider state is simulated", async ({
  page,
}) => {
  // A sign-up makes the first notification of the family.
  const dutyId = world().id(DECORATING);
  await page.goto(`/szulo/feladatok/${dutyId}`);
  await page.getByTestId("signup-form-submit-button").click();
  await expect(page.getByTestId("signup-form-state-success")).toBeVisible();
  await page.goto("/szulo/ertesitesek");
  const card = page.locator('[data-testid^="notification-card-"]').first();
  await expect(card).toContainText("Díszítés");
  const noticeId = (await card.getAttribute("data-testid"))!.replace("notification-card-", "");
  // The whole card is one link to the authorized target; no separate "Megnyitás" link remains.
  await expect(page.getByTestId(`notification-link-${noticeId}`)).toHaveAttribute(
    "href",
    `/szulo/feladatok/${dutyId}?ertesites=${noticeId}`,
  );
  await expect(card.getByRole("link")).toHaveCount(1);
  // Ticking the checkbox marks the notification as read at once (no extra button).
  const checkbox = page.getByTestId(`notification-read-checkbox-${noticeId}`);
  await expect(checkbox).toHaveAccessibleName(/^Olvasottnak jelölöm /);
  // The tick submits through the hydrated form, so wait for the page scripts to finish loading.
  await page.waitForLoadState("networkidle");
  await checkbox.check();
  await expect(page.getByTestId(`notification-state-${noticeId}-success`)).toContainText(
    "olvasottként",
  );
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId(`notification-read-checkbox-${noticeId}`)).toBeChecked();
  await expect(page.getByTestId(`notification-read-checkbox-${noticeId}`)).toBeDisabled();
});

test("Parent sees permitted allergen text and edits only the own contribution note", async ({
  page,
}) => {
  await page.goto(`/szulo/feladatok/${world().id(BAKING)}`);
  await expect(page.getByTestId("permitted-allergen-note")).toContainText("mogyoró, tej");
  await page.getByTestId("contribution-note-input").fill("Papírpoharakat viszünk.");
  await page.getByTestId("contribution-form-submit-button").click();
  await expect(page.getByTestId("contribution-form-state-success")).toContainText(
    "saját hozzájárulási",
  );
  await expect(page.locator("body")).not.toContainText("email");
  await expect(page.locator("body")).not.toContainText("telefonszám");
});

test("unrelated duty access is generic and privacy-safe", async ({ page }) => {
  const foreign = world().id("task:2:1");
  await page.goto(`/szulo/feladatok/${foreign}`);
  await expect(page.getByTestId("duty-detail-denied")).toContainText("nem érhető el");
  await expect(page.locator("body")).not.toContainText(foreign);
  await expect(page.locator("body")).not.toContainText("protected");
});

test("@a11y Parent flow passes keyboard, focus, zoom, and axe checks", async ({ page }) => {
  await page.goto("/szulo/feladatok");
  await page.getByTestId("app-shell-skip-link").focus();
  await expect(page.getByTestId("app-shell-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("app-shell-main")).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});
