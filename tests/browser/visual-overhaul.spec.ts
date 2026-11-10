import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { requestCancellation, withOtherPage } from "./support/scenarios.ts";
import { SERIOUS, signInAs, bindSeededSchema, expectSignedIn } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

for (const width of [320, 375]) {
  test(`sign-in screen has no horizontal overflow and no clipped text at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/bejelentkezes");
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // Nothing inside the centred panel is wider than the panel itself.
    const clipped = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-testid='sign-in-page'] *")].filter(
          (element) => element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0,
        ).length,
    );
    expect(clipped).toBe(0);
  });
}

test("the sign-in form is reached and sent with mouse and with keyboard", async ({ page }) => {
  await page.goto("/bejelentkezes");
  const account = world().account("parent-1");
  await page.getByTestId("sign-in-email").focus();
  await expect(page.getByTestId("sign-in-email")).toBeFocused();
  await page.keyboard.type(account.email);
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("sign-in-password")).toBeFocused();
  await page.keyboard.type(account.password);
  await page.keyboard.press("Enter");
  await expectSignedIn(page);
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "Értesítések", exact: true });
  await expect(heading).toBeFocused();
  // The heading takes focus for screen readers but no box is drawn around it.
  expect(await heading.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
});

test("the header logo returns to the person's default page", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/feladatok");
  await page.getByTestId("brand-link").click();
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await expect(page.getByRole("heading", { name: "Értesítések", exact: true })).toBeVisible();
});

test("admin overview card opens pending approvals with the same count", async ({
  page,
  browser,
}, testInfo) => {
  await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
    requestCancellation(other, world()),
  );
  await signInAs(page, world().account("group-admin-1"));
  await page.goto("/admin");
  const count = Number(await page.getByTestId("admin-dashboard-summary").innerText());
  expect(count).toBeGreaterThan(0);
  await page.getByTestId("admin-dashboard-approvals").click();
  await expect(page).toHaveURL(/\/admin\/jovahagyasok\?state=pending$/);
  await expect(page.getByTestId("admin-approvals-list").locator("li")).toHaveCount(count);
  await expect(page.getByTestId("admin-dashboard-queue")).toHaveCount(0);
});

test("a parent task card opens the task detail anywhere on the card", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/feladatok");
  const card = page.locator('[data-testid^="duty-card-"]').first();
  await card.locator("h2").click();
  await expect(page).toHaveURL(/\/szulo\/feladatok\/[^/?]+/);
});

test("the sign-in screen stays usable and stable when images fail to load (R-05)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/bejelentkezes");
  await page.waitForLoadState("networkidle");
  const loaded = await page.getByRole("heading", { level: 1 }).boundingBox();

  await page.route("**/_next/image*", (route) => route.abort());
  await page.reload();
  const failed = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(failed?.y).toBeCloseTo(loaded!.y, 0);
  await signInAs(page, world().account("parent-1"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Értesítések", exact: true })).toBeVisible();
});

// The reported defect: after sign-in the browser stayed on the sign-in page with no menu. Each seeded role
// must land on the home page of its role, with the menu that role is allowed to see.
const ROLE_LANDINGS = [
  { tag: "super-admin", path: /\/admin$/, menuItems: 11 },
  { tag: "group-admin-1", path: /\/admin$/, menuItems: 6 },
  { tag: "parent-1", path: /\/szulo\/ertesitesek$/, menuItems: 5 },
  { tag: "teacher-1", path: /\/teacher\/schedule$/, menuItems: 3 },
] as const;

for (const { tag, path, menuItems } of ROLE_LANDINGS) {
  test(`signing in as ${tag} lands on the role home with its menu`, async ({ page }) => {
    await signInAs(page, world().account(tag));
    await expect(page).toHaveURL(path);
    await expect(page.getByTestId("app-shell-navigation").locator("li")).toHaveCount(menuItems);
    await expect(page.getByTestId("sign-out-button").first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS)).toEqual([]);
  });
}
