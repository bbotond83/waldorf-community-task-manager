import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SERIOUS, signInAs, signOut, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test("signs in as a parent and renders its permitted shell", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/");
  // The parent lands on Értesítések; there is no welcome page.
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await expect(page.getByRole("heading", { name: "Értesítések", exact: true })).toBeFocused();
  await expect(page.getByText("Üdvözlünk")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-parent-duties")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-parent-notifications")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
  // There is no way to pick another profile any more: only the sign-out control.
  await expect(page.getByTestId("app-shell-switch-profile-button")).toHaveCount(0);
  await expect(page.getByTestId("sign-out-button")).toBeVisible();
});

test("signing out and signing in as another role clears the prior projection", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/ertesitesek");
  await expect(page.getByRole("heading", { name: "Értesítések", exact: true })).toBeFocused();
  await signOut(page);
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/");
  await expect(page).toHaveURL(/\/teacher\/schedule$/);
  await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeVisible();
  // The teacher has a single page, so there is no menu and no menu toggle.
  await expect(page.getByTestId("app-shell-navigation")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-toggle")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-parent-duties")).toHaveCount(0);
});

test("@a11y root flow has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Biztonságos bejelentkezés" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("sign-out and history cannot restore a previous person's protected content", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/feladatok");
  await expect(page.getByTestId("duty-list")).toBeVisible();
  await signOut(page);
  await page.goBack();
  await expect(page.getByTestId("duty-list")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-profile-summary")).toHaveCount(0);
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/szulo/feladatok");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság", exact: true })).toBeVisible();
  await expect(page.getByTestId("duty-list")).toHaveCount(0);
});
