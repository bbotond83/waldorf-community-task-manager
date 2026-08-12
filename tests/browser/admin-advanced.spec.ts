import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("/api/synthetic/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
  });
}

async function selectProfile(
  page: Page,
  id: "group-admin-local" | "kindergarten-admin-local" | "super-admin-local",
) {
  await page.goto("/");
  const button = page.getByTestId(`profile-selector-${id}-button`);
  if (!(await button.isVisible().catch(() => false))) {
    await page.getByTestId("app-shell-switch-profile-button").click();
  }
  await page.getByTestId(`profile-selector-${id}-button`).click();
}

test.beforeEach(async ({ page }) => reset(page));

test("advanced navigation observes strict administrator role boundaries", async ({ page }) => {
  await selectProfile(page, "group-admin-local");
  await page.goto("/admin");
  await expect(page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-admin-reminders")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-admin-settings")).toHaveCount(0);
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();

  await selectProfile(page, "kindergarten-admin-local");
  await page.goto("/admin/beallitasok");
  await expect(page.getByTestId("admin-recipient-settings")).toBeVisible();
  await expect(page.getByTestId("admin-governance-section")).toHaveCount(0);
});

test("Kindergarten Administrator completes seven-step import once", async ({ page }) => {
  await selectProfile(page, "kindergarten-admin-local");
  const startedAt = Date.now();
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Importálás" })).toBeFocused();
  await page.getByTestId("admin-import-preview-form-submit-button").press("Enter");
  await expect(page.getByTestId("admin-import-preview")).toBeVisible();
  await page.getByLabel("Importált adat használata").check();
  await page.getByTestId("admin-import-conflict-form-submit-button").click();
  await expect(page.getByTestId("admin-import-commit-form")).toBeVisible();
  await page.getByTestId("admin-import-confirm-checkbox").check();
  await page.getByTestId("admin-import-commit-form-submit-button").click();
  await expect(page.getByTestId("admin-import-outcome")).toContainText("3 rekord");
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  await expect(page.locator("body")).not.toContainText(/email|provider body|telefonszám/i);
});

test("interrupted import recovers without partial outcome", async ({ page }) => {
  await selectProfile(page, "kindergarten-admin-local");
  await page.goto("/admin/import");
  await page.getByTestId("admin-import-preview-form-submit-button").click();
  await page.getByLabel("Meglévő adat megtartása").check();
  await page.getByTestId("admin-import-conflict-form-submit-button").click();
  await page.getByLabel("Mentési forgatókönyv").selectOption("interrupted");
  await page.getByTestId("admin-import-confirm-checkbox").check();
  await page.getByTestId("admin-import-commit-form-submit-button").click();
  await expect(page.getByTestId("admin-import-recovery-form")).toContainText("részleges");
  await page.getByTestId("admin-import-recovery-form-submit-button").click();
  await expect(page.getByTestId("admin-import-outcome")).toBeVisible();
});

test("reminder retry preserves correlation identity and blocks non-retryable jobs", async ({
  page,
}) => {
  await selectProfile(page, "kindergarten-admin-local");
  await page.goto("/admin/emlekeztetok");
  await expect(page.getByTestId("admin-reminder-job-lampas")).toContainText("corr-lampas-01");
  await page.getByTestId("admin-reminder-retry-job-lampas-submit-button").click();
  await expect(page.getByTestId("admin-reminder-job-lampas")).toContainText("retrying");
  await expect(
    page.getByTestId("admin-reminder-job-kert").getByRole("button", { name: "Újrapróbálás" }),
  ).toHaveCount(0);
});

test("Super Administrator revocation denies the affected profile on its next request", async ({
  page,
}) => {
  await selectProfile(page, "super-admin-local");
  await page.goto("/admin/beallitasok");
  await expect(page.getByTestId("admin-governance-section")).toBeVisible();
  await page.getByTestId("admin-grant-revoke-grant-group-target-submit-button").press("Enter");
  await expect(
    page.getByTestId("admin-grant-revoke-grant-group-target-state-success"),
  ).toContainText("következő kérés");
  await selectProfile(page, "group-admin-local");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation")).toHaveCount(0);
});

test("lifecycle blocker, atomic completion, and allowlisted settings are explicit", async ({
  page,
}) => {
  await selectProfile(page, "kindergarten-admin-local");
  await page.goto("/admin/adatvedelem");
  await expect(page.getByTestId("admin-lifecycle-family-retained")).toContainText("megőrzési");
  await expect(page.getByTestId("admin-lifecycle-family-retained").getByRole("button")).toHaveCount(
    0,
  );
  await page.getByTestId("admin-lifecycle-run-family-delete").getByRole("checkbox").check();
  await page.getByTestId("admin-lifecycle-run-family-delete-submit-button").click();
  await expect(page.getByTestId("admin-lifecycle-family-delete")).toHaveCount(0);
  await page.goto("/admin/beallitasok");
  await expect(page.getByLabel("Címzetti kör").locator("option")).toHaveCount(2);
  await page.getByLabel("Címzetti kör").selectOption("recipient-group");
  await page.getByTestId("admin-settings-form-submit-button").press("Enter");
  await expect(page.getByTestId("admin-settings-form-state-success")).toBeVisible();
});

test("@a11y advanced admin supports keyboard, focus, zoom, mobile touch, and axe", async ({
  page,
}) => {
  await selectProfile(page, "kindergarten-admin-local");
  await page.goto("/admin/import");
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
  await expect(page.getByTestId("admin-import-page")).toBeVisible();
  const submitBox = await page.getByTestId("admin-import-preview-form-submit-button").boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(submitBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});
