import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.request.post("/api/synthetic/reset", {
    headers: { origin: new URL(page.url()).origin },
  });
});

async function selectGroupAdministrator(page: Page) {
  await page.goto("/");
  if (
    await page
      .getByTestId("profile-selector-group-admin-local-button")
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId("profile-selector-group-admin-local-button").click();
  } else {
    await page.getByTestId("app-shell-switch-profile-button").click();
    await page.getByTestId("profile-selector-group-admin-local-button").click();
  }
}

test("Group Administrator sees scoped core dashboard without import", async ({ page }) => {
  await selectGroupAdministrator(page);
  const startedAt = Date.now();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Áttekintés" })).toBeFocused();
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-admin-records")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
});

test("records remain scoped and crafted outside-scope identifiers are denied", async ({ page }) => {
  await selectGroupAdministrator(page);
  await page.goto("/admin/nyilvantartasok");
  await expect(page.getByText("Fenyő család")).toBeVisible();
  await expect(page.getByText("Napraforgó család")).toHaveCount(0);
  await page.goto("/admin/nyilvantartasok/family-napraforgo");
  await expect(page.getByText("Nincs jogosultság")).toBeVisible();
  await expect(page.getByText("Napraforgó család")).toHaveCount(0);
});

test("assignment capacity conflict and approval success are explicit", async ({
  page,
}, testInfo) => {
  await selectGroupAdministrator(page);
  await page.goto("/admin/feladatok/task-kert?scenario=full");
  await page.getByTestId("admin-assignment-form-submit-button").click();
  await expect(page.getByTestId("admin-assignment-form-state-conflict")).toContainText(
    "kapacitását",
  );
  const approvalId =
    testInfo.project.name === "firefox"
      ? "approval-lemondas"
      : testInfo.project.name === "mobile-chrome"
        ? "approval-mobile"
        : "approval-csere";
  await page.goto(`/admin/jovahagyasok/${approvalId}`);
  await page.getByTestId("admin-approval-decision-form-submit-button").click();
  await expect(page.getByTestId("admin-approval-decision-form-state-success")).toContainText(
    "jóváhagyva",
  );
});

test("a whole approval item opens its detail and shows Hungarian states", async ({ page }) => {
  await selectGroupAdministrator(page);
  await page.goto("/admin/jovahagyasok");
  const list = page.getByTestId("admin-approvals-list");
  await expect(list).not.toContainText(/pending|approved|active|archived/);
  await expect(list.locator("li").first()).toContainText("Függőben");
  // Clicking the state word (not the title) still opens the item.
  await list.locator("li").first().locator(".admin-state-badge").click();
  await expect(page).toHaveURL(/\/admin\/jovahagyasok\/approval-/);
  await expect(page.getByText(/Állapot: (Függőben|Jóváhagyva)/)).toBeVisible();
});

test("archive restore conflict preserves the archived item", async ({ page }) => {
  await page.goto("/");
  if (
    !(await page
      .getByTestId("profile-selector-super-admin-local-button")
      .isVisible()
      .catch(() => false))
  ) {
    await page.getByTestId("app-shell-switch-profile-button").click();
  }
  await page.getByTestId("profile-selector-super-admin-local-button").click();
  await page.goto("/admin/archivum/year-2026?scenario=conflict");
  await page.getByTestId("admin-record-restore-form-submit-button").click();
  await expect(page.getByTestId("admin-record-restore-form-state-conflict")).toContainText(
    "nem állítható vissza",
  );
  await expect(page.getByText("Állapot: Archivált")).toBeVisible();
});

test("Group Administrator direct import access is generically denied", async ({ page }) => {
  await selectGroupAdministrator(page);
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();
  await expect(page.getByText("import", { exact: false })).toHaveCount(0);
});

test("@a11y administrator keyboard and automated accessibility checks pass", async ({ page }) => {
  await selectGroupAdministrator(page);
  await page.goto("/admin/nyilvantartasok");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("app-shell-skip-link")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});
