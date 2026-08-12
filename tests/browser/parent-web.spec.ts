import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function projectSuffix(projectName: string): string {
  if (projectName === "firefox") return "-firefox";
  if (projectName === "mobile-chrome") return "-mobile";
  return "";
}

async function resetAndSelectParent(page: Page) {
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
  await page.getByTestId("profile-selector-parent-local-button").click();
}

test.beforeEach(async ({ page }) => resetAndSelectParent(page));

test("invitation states are exact and resend remains non-enumerating", async ({ page }) => {
  await page.goto("/meghivas/parent-valid-invitation");
  await expect(page.getByTestId("invitation-page-valid")).toBeVisible();
  await page.goto("/meghivas/parent-expired-invitation");
  await expect(page.getByTestId("invitation-page-expired")).toBeVisible();
  await page.getByTestId("invitation-resend-identifier").fill("unknown@example.test");
  await page.getByTestId("invitation-resend-button").click();
  await expect(page.getByTestId("invitation-resend-success")).toContainText("Ha a megadott címhez");
  await page.goto("/meghivas/parent-used-invitation");
  await expect(page.getByTestId("invitation-page-used")).toBeVisible();
  await page.goto("/meghivas/not-a-known-token");
  await expect(page.getByTestId("invitation-page-invalid")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("unknown@example.test");
});

test("authentication entry preserves a safe destination and shows upcoming duty", async ({
  page,
}) => {
  await page.goto("/belepes?tovabb=/szulo/ertesitesek");
  await expect(page.getByTestId("upcoming-duty-notice")).toContainText("Lámpás ünnep");
  await expect(page.getByTestId("upcoming-duty-link")).toHaveAttribute(
    "href",
    "/szulo/ertesitesek",
  );
});

test("linked duties render and eligible signup has one observable effect", async ({
  page,
}, testInfo) => {
  const dutyId = `duty-garden${projectSuffix(testInfo.project.name)}`;
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

test("full and ineligible duties expose no signup action", async ({ page }) => {
  await page.goto("/szulo/feladatok/duty-full");
  await expect(page.getByTestId("duty-full-state")).toBeVisible();
  await expect(page.getByTestId("signup-form-submit-button")).toHaveCount(0);
  await page.goto("/szulo/feladatok/duty-ineligible");
  await expect(page.getByTestId("duty-ineligible-state")).toBeVisible();
  await expect(page.getByTestId("signup-form-submit-button")).toHaveCount(0);
});

test("swap request validates, succeeds once, and keeps protected reason out of the DOM", async ({
  page,
}, testInfo) => {
  const dutyId = `duty-assigned${projectSuffix(testInfo.project.name)}`;
  await page.goto(`/szulo/feladatok/${dutyId}/csere`);
  await page.getByTestId("swap-reason-input").fill("Családi egyeztetés szükséges.");
  await page.getByTestId("swap-request-form-submit-button").click();
  await expect(page.getByTestId("swap-request-form-state-success")).toContainText(
    "függő állapotba",
  );
  await expect(page.locator("body")).not.toContainText("Családi egyeztetés szükséges.");
});

test("cancellation retry preserves the original idempotency key", async ({ page }, testInfo) => {
  const dutyId = `duty-assigned${projectSuffix(testInfo.project.name)}`;
  await page.goto(`/szulo/feladatok/${dutyId}/lemondas?scenario=retryable`);
  const originalKey = await page.locator('input[name="idempotencyKey"]').inputValue();
  await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
  await page.getByTestId("cancellation-request-form-submit-button").click();
  await expect(page.getByTestId("cancellation-request-form-state-retryable")).toContainText(
    "újrapróbálható",
  );
  await expect(page.locator('input[name="idempotencyKey"]')).toHaveValue(originalKey);
  await expect(page.locator("body")).not.toContainText("Átmeneti akadály.");
});

test("notification read and authorized link are explicit and provider state is simulated", async ({
  page,
}, testInfo) => {
  const suffix = projectSuffix(testInfo.project.name);
  const noticeId = `notice-7-day${suffix}`;
  const dutyId = `duty-assigned${suffix}`;
  await page.goto("/szulo/ertesitesek");
  await expect(page.getByTestId(`notification-card-${noticeId}`)).toContainText(
    "Szimulált szolgáltató",
  );
  await page.getByTestId(`notification-read-button-${noticeId}`).click();
  await expect(page.getByTestId(`notification-state-${noticeId}-success`)).toContainText(
    "olvasottként",
  );
  await expect(page.getByTestId(`notification-result-link-${noticeId}`)).toHaveAttribute(
    "href",
    `/szulo/feladatok/${dutyId}`,
  );
});

test("Parent sees permitted allergen text and edits only the own contribution note", async ({
  page,
}) => {
  await page.goto("/szulo/feladatok/duty-assigned");
  await expect(page.getByTestId("permitted-allergen-note")).toContainText("összetevőit");
  await page.getByTestId("contribution-note-input").fill("Papírpoharakat viszünk.");
  await page.getByTestId("contribution-form-submit-button").click();
  await expect(page.getByTestId("contribution-form-state-success")).toContainText(
    "saját hozzájárulási",
  );
  await expect(page.locator("body")).not.toContainText("email");
  await expect(page.locator("body")).not.toContainText("telefonszám");
});

test("unrelated duty access is generic and privacy-safe", async ({ page }) => {
  await page.goto("/szulo/feladatok/duty-unrelated-family");
  await expect(page.getByTestId("duty-detail-denied")).toContainText("nem érhető el");
  await expect(page.locator("body")).not.toContainText("unrelated");
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
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});
