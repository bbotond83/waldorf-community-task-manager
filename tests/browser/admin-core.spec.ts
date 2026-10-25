import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { requestCancellation } from "./support/scenarios.ts";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async ({ page }) => {
  await world().reseed();
  await signInAs(page, world().account("group-admin-1"));
});

test("Group Administrator sees scoped core dashboard without import", async ({ page }) => {
  const startedAt = Date.now();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Áttekintés" })).toBeFocused();
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-admin-records")).toBeVisible();
  await expect(page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
});

test("records remain scoped and crafted outside-scope identifiers are denied", async ({ page }) => {
  await page.goto("/admin/nyilvantartasok");
  await expect(page.getByText("Szabó család")).toBeVisible();
  // The second family belongs to the other group.
  await expect(page.getByText("Kiss család")).toHaveCount(0);
  await page.goto(`/admin/nyilvantartasok/${world().id("family:2")}`);
  await expect(page.getByText("Nincs jogosultság")).toBeVisible();
  await expect(page.getByText("Kiss család")).toHaveCount(0);
});

test("assignment capacity conflict and approval success are explicit", async ({
  page,
  browser,
}) => {
  // The decorating task has two places and one is taken: the second family fits, the third does not.
  const decorating = world().id("task:1:2");
  await page.goto(`/admin/feladatok/${decorating}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("admin-assignment-family-select").selectOption({ label: "Szabó család" });
  await page.getByTestId("admin-assignment-form-submit-button").click();
  await expect(page.getByTestId("admin-assignment-form-state-success")).toBeVisible();
  await page.goto(`/admin/feladatok/${decorating}`);
  await page.waitForLoadState("networkidle");
  await page
    .getByTestId("admin-assignment-family-select")
    .selectOption({ label: "Horváth család" });
  await page.getByTestId("admin-assignment-form-submit-button").click();
  await expect(page.getByTestId("admin-assignment-form-state-conflict")).toContainText(
    "kapacitását",
  );

  // A family asks to give up a task; the administrator approves it.
  const parentContext = await browser.newContext({ baseURL: page.url().split("/admin")[0] });
  const parentPage = await parentContext.newPage();
  try {
    await requestCancellation(parentPage, world());
  } finally {
    await parentContext.close();
  }
  await page.goto("/admin/jovahagyasok");
  const href = await page.locator(".admin-collection li a").first().getAttribute("href");
  await page.goto(href!);
  await page.getByTestId("admin-approval-decision-form-submit-button").click();
  await expect(page.getByTestId("admin-approval-decision-form-state-success")).toContainText(
    "jóváhagyva",
  );
});

test("a whole approval item opens its detail and shows Hungarian states", async ({
  page,
  browser,
}) => {
  const parentContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const parentPage = await parentContext.newPage();
  try {
    await requestCancellation(parentPage, world());
  } finally {
    await parentContext.close();
  }
  await page.goto("/admin/jovahagyasok");
  const list = page.getByTestId("admin-approvals-list");
  await expect(list).not.toContainText(/pending|approved|active|archived/);
  await expect(list.locator("li").first()).toContainText("Függőben");
  // Clicking the state word (not the title) still opens the item.
  await list.locator("li").first().locator(".status-badge").click();
  await expect(page).toHaveURL(/\/admin\/jovahagyasok\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Állapot: (Függőben|Jóváhagyva)/)).toBeVisible();
});

test("archiving a family keeps it in the archive and out of the active list", async ({ page }) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto(`/admin/nyilvantartasok/${world().id("family:5")}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("admin-record-archive-form-submit-button").click();
  await expect(page.getByTestId("admin-record-archive-form-state-success")).toBeVisible();
  await page.goto("/admin/archivum");
  await expect(page.getByTestId("admin-archive-page")).toContainText("Molnár család");
  await page.goto(`/admin/archivum/${world().id("family:5")}`);
  await expect(page.getByText("Állapot: Archivált")).toBeVisible();
});

test("Group Administrator direct import access is generically denied", async ({ page }) => {
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();
  await expect(page.getByText("import", { exact: false })).toHaveCount(0);
});

test("@a11y administrator keyboard and automated accessibility checks pass", async ({ page }) => {
  await page.goto("/admin/nyilvantartasok");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("app-shell-skip-link")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});
