import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function resetAndSelectTeacher(page: Page) {
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
  await page.getByTestId("profile-selector-kindergarten-teacher-local-button").click();
}

test.beforeEach(async ({ page }) => resetAndSelectTeacher(page));

test("Teacher filters, list, detail, and return preserve authorized context under two seconds", async ({
  page,
}, testInfo) => {
  const startedAt = Date.now();
  await page.goto("/teacher/schedule");
  await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
  const initialItem =
    testInfo.project.name === "mobile-chrome"
      ? page.getByTestId("teacher-schedule-card-schedule-garden")
      : page.getByTestId("teacher-schedule-row-schedule-garden");
  await expect(initialItem).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(2_000);

  await page.getByTestId("teacher-schedule-from-input").fill("2026-08-14");
  await page.getByTestId("teacher-schedule-to-input").fill("2026-08-14");
  await page.getByTestId("teacher-schedule-filter-submit-button").click();
  await expect(
    page.getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "teacher-schedule-card-schedule-crafts"
        : "teacher-schedule-row-schedule-crafts",
    ),
  ).toBeVisible();
  await page
    .getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "teacher-schedule-card-open-schedule-crafts"
        : "teacher-schedule-open-schedule-crafts",
    )
    .click();
  await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText("Tölgyfa csoport");
  await page.getByTestId("teacher-schedule-detail-back-link").click();
  await expect(page.getByTestId("teacher-schedule-from-input")).toHaveValue("2026-08-14");
});

test("empty state clears filters and invalid ranges never expose rows", async ({
  page,
}, testInfo) => {
  await page.goto("/teacher/schedule?from=2026-09-01&to=2026-09-05");
  await expect(page.getByTestId("teacher-schedule-empty")).toBeVisible();
  await page.getByTestId("teacher-schedule-clear-link").click();
  await expect(
    page.getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "teacher-schedule-card-schedule-garden"
        : "teacher-schedule-row-schedule-garden",
    ),
  ).toBeVisible();

  await page.goto("/teacher/schedule?from=2026-08-01&to=2026-09-02");
  await expect(page.getByTestId("teacher-schedule-validation")).toBeFocused();
  await expect(page.getByTestId("teacher-schedule-table")).toHaveCount(0);
});

test("out-of-scope group and crafted row are generically denied", async ({ page }) => {
  await page.goto("/teacher/schedule?groupId=group-ungranted&from=2026-08-12&to=2026-08-20");
  await expect(page.getByTestId("teacher-schedule-denied")).toContainText("nem érhető el");
  await expect(page.getByTestId("teacher-schedule-denied")).toBeFocused();
  await expect(page.locator("body")).not.toContainText("group-ungranted");

  await page.goto("/teacher/schedule/schedule-unrelated?from=2026-08-12&to=2026-08-20");
  await expect(page.getByTestId("teacher-detail-denied")).toContainText("nem érhető el");
  await expect(page.locator("body")).not.toContainText("schedule-unrelated");
});

test("retryable failure preserves filters while terminal failure has no retry", async ({
  page,
}, testInfo) => {
  const retryUrl =
    "/teacher/schedule?groupId=group-oak&from=2026-08-14&to=2026-08-14&fixture=retryable";
  await page.goto(retryUrl);
  await expect(page.getByTestId("app-shell-main")).toBeFocused();
  await page.getByTestId("teacher-schedule-retry-link").click();
  await expect(page.getByTestId("teacher-schedule-from-input")).toHaveValue("2026-08-14");
  await expect(
    page.getByTestId(
      testInfo.project.name === "mobile-chrome"
        ? "teacher-schedule-card-schedule-crafts"
        : "teacher-schedule-row-schedule-crafts",
    ),
  ).toBeVisible();

  await page.goto("/teacher/schedule?fixture=terminal");
  await expect(page.getByTestId("app-shell-main")).toBeFocused();
  await expect(page.getByTestId("teacher-schedule-retry-link")).toHaveCount(0);
});

test("Teacher DOM has no sensitive or mutating capability", async ({ page }) => {
  await page.goto("/teacher/schedule/schedule-garden?from=2026-08-12&to=2026-08-20");
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

test("@a11y Teacher supports keyboard, focus, zoom, touch, mobile cards, and axe", async ({
  page,
}, testInfo) => {
  await page.goto("/teacher/schedule");
  await page.getByTestId("app-shell-skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("app-shell-main")).toBeFocused();
  // Exercise wider text metrics as well as page zoom across operating systems.
  await page.addStyleTag({ content: ".teacher-table { font-size: 1.2rem; }" });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);

  if (testInfo.project.name === "mobile-chrome") {
    await expect(page.getByTestId("teacher-schedule-card-list")).toBeVisible();
    const box = await page.getByTestId("teacher-schedule-card-open-schedule-garden").boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
});

test("Teacher current responsibility assignment status and absence match list/detail layouts", async ({
  page,
}, testInfo) => {
  await page.goto("/teacher/schedule");
  const row = page.getByTestId(
    testInfo.project.name === "mobile-chrome"
      ? "teacher-schedule-card-schedule-garden"
      : "teacher-schedule-row-schedule-garden",
  );
  // The source word "Ütemezett" is shown as the shared status word "Ütemezve".
  for (const text of ["Kitalált Dóra", "Kitalált Eszter", "Ütemezve"])
    await expect(row).toContainText(text);
  await page.goto("/teacher/schedule/schedule-garden");
  for (const text of ["Kitalált Dóra", "Kitalált Eszter", "Ütemezve"])
    await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText(text);
  await page.goto("/teacher/schedule?groupId=group-sunflower");
  const missing = page.getByTestId(
    testInfo.project.name === "mobile-chrome"
      ? "teacher-schedule-card-schedule-coverage"
      : "teacher-schedule-row-schedule-coverage",
  );
  for (const text of ["Nincs kijelölt felelős", "Nincs beosztott", "Nincs elérhető állapot"])
    await expect(missing).toContainText(text);
  await page.goto("/teacher/schedule/schedule-coverage?groupId=group-sunflower");
  for (const text of ["Nincs kijelölt felelős", "Nincs beosztott", "Nincs elérhető állapot"])
    await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText(text);
});
test("Teacher old bookmarks redirect safely and destination independently denies or validates", async ({
  page,
}) => {
  const response = await page.request.get(
    "/munkatars/beosztas?csoport=group-oak&kezdet=2026-08-14&veg=2026-08-14&scenario=terminal&returnTo=https://evil.invalid",
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(307);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(response.headers()["location"]).toBe(
    "/teacher/schedule?groupId=group-oak&from=2026-08-14&to=2026-08-14",
  );
  await page.goto("/munkatars/beosztas?csoport=group-ungranted&kezdet=bad");
  await expect(page.getByTestId("teacher-schedule-denied")).toBeVisible();
  await page.goto("/munkatars/beosztas?csoport=group-oak&csoport=group-sunflower");
  await expect(page.getByTestId("teacher-schedule-validation")).toBeVisible();
  await expect(page.getByTestId("teacher-schedule-table")).toHaveCount(0);
});

test("Teacher opens an entry with a click on any part of its row or card and by keyboard", async ({
  page,
}, testInfo) => {
  const isMobile = testInfo.project.name === "mobile-chrome";
  await page.goto("/teacher/schedule");
  const item = page.getByTestId(
    isMobile ? "teacher-schedule-card-schedule-garden" : "teacher-schedule-row-schedule-garden",
  );
  // A click on the item's text outside its title opens the same detail page.
  // The stretched link covers the item, so click by position like a person would.
  const target = isMobile ? item.locator("dd").first() : item.getByRole("cell").nth(3);
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/teacher\/schedule\/schedule-garden/);
  await expect(page.getByTestId("teacher-schedule-detail-fields")).toBeVisible();
  await page.getByTestId("teacher-schedule-detail-back-link").click();
  // The list was unfiltered, so the way back is the bare schedule address.
  await expect(page).toHaveURL(/\/teacher\/schedule$/);

  // Keyboard: the one link of the row or card is reachable and opens the entry with Enter.
  const link = page.getByTestId(
    isMobile
      ? "teacher-schedule-card-open-schedule-garden"
      : "teacher-schedule-open-schedule-garden",
  );
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/teacher\/schedule\/schedule-garden/);
});

test("Teacher has no menu and finds the way back to Beosztás from other pages", async ({
  page,
}) => {
  await page.goto("/teacher/schedule");
  await expect(page.getByTestId("app-shell-navigation")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-toggle")).toHaveCount(0);
  await expect(page.getByTestId("brand-link")).toHaveAttribute("href", "/teacher/schedule");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Vissza a beosztáshoz" }).click();
  await expect(page).toHaveURL(/\/teacher\/schedule$/);
});
