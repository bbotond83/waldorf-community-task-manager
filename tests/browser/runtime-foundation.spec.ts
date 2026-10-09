import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.request.post("/api/synthetic/reset", {
    headers: { origin: new URL(page.url()).origin },
  });
});

test("selects a synthetic parent profile and renders its permitted shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Helyi tesztprofil kiválasztása" })).toBeVisible();
  await page.getByTestId("profile-selector-parent-local-button").click();
  await expect(page.getByRole("heading", { name: "Üdvözlünk, Szülő!" })).toBeFocused();
  await expect(page.getByTestId("app-shell-navigation-parent-duties")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
});

test("switching profiles clears the prior projection", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("profile-selector-parent-local-button").click();
  await expect(page.getByRole("heading", { name: "Üdvözlünk, Szülő!" })).toBeFocused();
  await page.getByTestId("app-shell-switch-profile-button").click();
  await expect(page.getByRole("heading", { name: "Helyi tesztprofil kiválasztása" })).toBeVisible();
  await page.getByTestId("profile-selector-kindergarten-teacher-local-button").click();
  await expect(page.getByRole("heading", { name: "Üdvözlünk, Óvónő!" })).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-teacher-tracking")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-parent-duties")).toHaveCount(0);
});

test("@a11y root flow has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockingViolations).toEqual([]);
});

test("sign-out and history cannot restore a previous profile's protected content", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("profile-selector-parent-local-button").click();
  await page.getByTestId("app-shell-navigation-parent-duties").click();
  await expect(page.getByTestId("duty-list")).toBeVisible();
  await page.getByTestId("app-shell-switch-profile-button").click();
  await expect(page.getByTestId("profile-selector")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("duty-list")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-profile-summary")).toHaveCount(0);
  await page.goto("/");
  await page.getByTestId("profile-selector-kindergarten-teacher-local-button").click();
  await page.goto("/szulo/feladatok");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság", exact: true })).toBeVisible();
  await expect(page.getByTestId("duty-list")).toHaveCount(0);
});
