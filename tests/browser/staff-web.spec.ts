import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function resetAndSelectStaff(page: Page) {
  await page.goto("/");
  await page.request.post("/api/synthetic/reset", {
    headers: { origin: new URL(page.url()).origin },
  });
  if (
    await page
      .getByTestId("app-shell-switch-profile-button")
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId("app-shell-switch-profile-button").click();
  }
  await page.getByTestId("profile-selector-staff-local-button").click();
}

test.beforeEach(async ({ page }) => resetAndSelectStaff(page));

test("Staff filters, list, detail, and return preserve authorized context under two seconds", async ({
  page,
}, testInfo) => {
  const startedAt = Date.now();
  await page.goto("/munkatars/beosztas");
  await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
  const initialItem =
    testInfo.project.name === "mobile-chrome"
      ? page.getByTestId("staff-schedule-card-schedule-garden")
      : page.getByTestId("staff-schedule-row-schedule-garden");
  await expect(initialItem).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(2_000);

  await page.getByTestId("staff-schedule-from-input").fill("2026-08-14");
  await page.getByTestId("staff-schedule-to-input").fill("2026-08-14");
  await page.getByTestId("staff-schedule-filter-submit-button").click();
  await expect(
    page.getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "staff-schedule-card-schedule-crafts"
        : "staff-schedule-row-schedule-crafts",
    ),
  ).toBeVisible();
  await page
    .getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "staff-schedule-card-open-schedule-crafts"
        : "staff-schedule-open-schedule-crafts",
    )
    .click();
  await expect(page.getByTestId("staff-schedule-detail-fields")).toContainText("Tölgyfa csoport");
  await page.getByTestId("staff-schedule-detail-back-link").click();
  await expect(page.getByTestId("staff-schedule-from-input")).toHaveValue("2026-08-14");
});

test("empty state clears filters and invalid ranges never expose rows", async ({
  page,
}, testInfo) => {
  await page.goto("/munkatars/beosztas?kezdet=2026-09-01&veg=2026-09-05");
  await expect(page.getByTestId("staff-schedule-empty")).toBeVisible();
  await page.getByTestId("staff-schedule-clear-link").click();
  await expect(
    page.getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "staff-schedule-card-schedule-garden"
        : "staff-schedule-row-schedule-garden",
    ),
  ).toBeVisible();

  await page.goto("/munkatars/beosztas?kezdet=2026-08-01&veg=2026-09-02");
  await expect(page.getByTestId("staff-schedule-validation")).toBeFocused();
  await expect(page.getByTestId("staff-schedule-table")).toHaveCount(0);
});

test("out-of-scope group and crafted row are generically denied", async ({ page }) => {
  await page.goto("/munkatars/beosztas?csoport=group-ungranted&kezdet=2026-08-12&veg=2026-08-20");
  await expect(page.getByTestId("staff-schedule-denied")).toContainText("nem érhető el");
  await expect(page.getByTestId("staff-schedule-denied")).toBeFocused();
  await expect(page.locator("body")).not.toContainText("group-ungranted");

  await page.goto("/munkatars/beosztas/schedule-unrelated?kezdet=2026-08-12&veg=2026-08-20");
  await expect(page.getByTestId("staff-detail-denied")).toContainText("nem érhető el");
  await expect(page.locator("body")).not.toContainText("schedule-unrelated");
});

test("retryable failure preserves filters while terminal failure has no retry", async ({
  page,
}, testInfo) => {
  const retryUrl =
    "/munkatars/beosztas?csoport=group-oak&kezdet=2026-08-14&veg=2026-08-14&scenario=retryable";
  await page.goto(retryUrl);
  await expect(page.getByTestId("staff-schedule-dependency-failure-retryable")).toBeFocused();
  await page.getByTestId("staff-schedule-retry-link").click();
  await expect(page.getByTestId("staff-schedule-from-input")).toHaveValue("2026-08-14");
  await expect(
    page.getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "staff-schedule-card-schedule-crafts"
        : "staff-schedule-row-schedule-crafts",
    ),
  ).toBeVisible();

  await page.goto("/munkatars/beosztas?scenario=terminal");
  await expect(page.getByTestId("staff-schedule-dependency-failure-terminal")).toBeFocused();
  await expect(page.getByTestId("staff-schedule-retry-link")).toHaveCount(0);
});

test("Staff DOM has no sensitive or mutating capability", async ({ page }) => {
  await page.goto("/munkatars/beosztas/schedule-garden?kezdet=2026-08-12&veg=2026-08-20");
  const body = page.locator("body");
  await expect(body).not.toContainText(
    /e-mail|email|telefon|lakhely|családi|védett indok|hozzárendelés/iu,
  );
  await expect(page.locator("form")).toHaveCount(1);
  await expect(
    page.locator('button:not([data-testid="app-shell-switch-profile-button"])'),
  ).toHaveCount(0);
  await expect(
    page.locator('input:not([data-testid="app-shell-switch-profile-input"])'),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /szerkeszt|módosít|mentés|törlés/iu })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: /szerkeszt|módosít|mentés|törlés/iu })).toHaveCount(
    0,
  );
});

test("@a11y Staff supports keyboard, focus, zoom, touch, mobile cards, and axe", async ({
  page,
}, testInfo) => {
  await page.goto("/munkatars/beosztas");
  await page.getByTestId("app-shell-skip-link").focus();
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

  if (testInfo.project.name === "mobile-chrome") {
    await expect(page.getByTestId("staff-schedule-card-list")).toBeVisible();
    const box = await page.getByTestId("staff-schedule-card-open-schedule-garden").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
});
