import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

test("advanced navigation observes strict administrator role boundaries", async ({ page }) => {
  await signInAs(page, world().account("group-admin-1"));
  await page.goto("/admin");
  await expect(page.getByTestId("app-shell-navigation-admin-reminders")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-admin-settings")).toHaveCount(0);
  await page.goto("/admin/emlekeztetok");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();

  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beallitasok");
  await expect(page.getByTestId("admin-recipient-settings")).toBeVisible();
  await expect(page.getByTestId("admin-governance-section")).toBeVisible();
});

test("the reminder page and the privacy page show their explicit empty states", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/emlekeztetok");
  await expect(page.getByTestId("admin-reminder-page")).toBeVisible();
  await expect(page.getByText("Nincs a szűrésnek megfelelő feladat.")).toBeVisible();
  // Technical correlation text never shows outside the closed developer section.
  await expect(page.locator("main")).not.toContainText(/corr-/);
  await page.goto("/admin/adatvedelem");
  await expect(page.getByTestId("admin-lifecycle-page")).toBeVisible();
  await expect(page.getByText("Nincs életciklus-jelölt.")).toBeVisible();
});

test("Super Administrator revocation denies the affected person on their next request", async ({
  page,
  browser,
}) => {
  const groupContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const groupPage = await groupContext.newPage();
  try {
    await signInAs(groupPage, world().account("group-admin-1"));
    await groupPage.goto("/admin");
    await expect(groupPage.getByTestId("admin-dashboard-page")).toBeVisible();

    await signInAs(page, world().account("super-admin"));
    await page.goto("/admin/beallitasok");
    await expect(page.getByTestId("admin-governance-section")).toBeVisible();
    const grantId = world().account("group-admin-1").grantId;
    await page.getByTestId(`admin-grant-revoke-${grantId}-submit-button`).press("Enter");
    await expect(page.getByTestId(`admin-grant-revoke-${grantId}-state-success`)).toContainText(
      "következő kérés",
    );

    await groupPage.goto("/admin");
    await expect(
      groupPage.getByRole("heading", { name: "Nincs jogosultság", exact: true }),
    ).toBeVisible();
    for (const hook of ["app-shell-navigation", "admin-dashboard-page", "admin-governance-section"])
      await expect(groupPage.getByTestId(hook)).toHaveCount(0);
    await groupPage.goto("/admin/nyilvantartasok");
    await expect(
      groupPage.getByRole("heading", { name: "Nincs jogosultság", exact: true }),
    ).toBeVisible();
  } finally {
    await groupContext.close();
  }
});

test("allowlisted settings are explicit", async ({ page }) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beallitasok");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Címzetti kör").locator("option")).toHaveCount(2);
  await page.getByLabel("Címzetti kör").selectOption({ index: 1 });
  await page.getByTestId("admin-settings-form-submit-button").press("Enter");
  await expect(page.getByTestId("admin-settings-form-state-success")).toBeVisible();
});

test("@a11y advanced admin supports keyboard, focus, zoom, mobile touch, and axe", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beallitasok");
  for (let step = 0; step < 15; step += 1) {
    const isFocused = await page
      .getByTestId("app-shell-skip-link")
      .evaluate((element) => element === document.activeElement);
    if (isFocused) break;
    await page.keyboard.press("Shift+Tab");
  }
  await expect(page.getByTestId("app-shell-skip-link")).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.getByTestId("admin-recipient-settings")).toBeVisible();
  const submitBox = await page.getByTestId("admin-settings-form-submit-button").boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(submitBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("Parent Teacher and Group admin direct advanced routes disclose no privileged content", async ({
  page,
}) => {
  for (const tag of ["parent-1", "teacher-1", "group-admin-1"]) {
    await signInAs(page, world().account(tag));
    for (const route of ["/admin/emlekeztetok", "/admin/adatvedelem", "/admin/beallitasok"]) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Nincs jogosultság", exact: true }),
      ).toBeVisible();
      for (const hook of [
        "admin-governance-section",
        "admin-recipient-settings",
        "admin-reminder-page",
        "admin-lifecycle-page",
      ])
        await expect(page.getByTestId(hook)).toHaveCount(0);
    }
  }
});
