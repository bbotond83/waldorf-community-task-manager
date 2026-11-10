import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

/** The role walk of functional-spec.md, "Today's Screens After the Change": every screen as every role. */
const ROLES = ["parent-1", "group-admin-1", "teacher-1", "super-admin"] as const;
type Tag = (typeof ROLES)[number];

const PARENT_PAGES = [
  "/szulo/ertesitesek",
  "/szulo/feladatok",
  "/szulo/cserek",
  "/szulo/beosztas",
] as const;
const WORK_PAGES = [
  "/admin",
  "/admin/feladatok",
  "/admin/jovahagyasok",
  "/admin/archivum",
] as const;
const SUPER_PAGES = [
  "/admin/emlekeztetok",
  "/admin/adatvedelem",
  "/admin/beallitasok",
  "/admin/tanev",
  "/admin/beosztas",
] as const;

const ALLOWED: Record<Tag, readonly string[]> = {
  "parent-1": [...PARENT_PAGES, "/szulo/munkacsoportok"],
  // The group administrator is also a parent of the first family.
  "group-admin-1": [
    ...PARENT_PAGES,
    "/szulo/munkacsoportok",
    ...WORK_PAGES,
    "/admin/munkacsoportok",
  ],
  "teacher-1": ["/teacher/schedule", "/teacher/munkacsoportok", "/teacher/beosztas"],
  "super-admin": [...WORK_PAGES, "/admin/nyilvantartasok", ...SUPER_PAGES, "/admin/munkacsoportok"],
};

const ALL_ROUTES = [
  ...PARENT_PAGES,
  "/szulo/munkacsoportok",
  ...WORK_PAGES,
  "/admin/nyilvantartasok",
  "/admin/munkacsoportok",
  ...SUPER_PAGES,
  "/teacher/schedule",
  "/teacher/munkacsoportok",
  "/teacher/beosztas",
];

/** A whole area refuses with a heading; a page inside a person's own area with a line in its content. */
const denied = (page: Page) => page.getByText("Nincs jogosultság", { exact: true }).first();

for (const tag of ROLES) {
  test(`${tag}: every screen of the role opens, and every other one is refused`, async ({
    page,
  }) => {
    await signInAs(page, world().account(tag));
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      if (ALLOWED[tag].includes(route)) {
        await expect(page.locator("#fo-tartalom h1").first(), `${tag} ${route}`).toBeVisible();
        await expect(denied(page), `${tag} may open ${route}`).toHaveCount(0);
      } else {
        await expect(denied(page), `${tag} may not open ${route}`).toBeVisible();
      }
    }
  });

  test(`${tag}: the old import answers page not found`, async ({ page }) => {
    await signInAs(page, world().account(tag));
    const response = await page.goto("/admin/import");
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
  });
}

test("Munkacsoportok shows the six working groups read-only, by keyboard and at phone width", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/munkacsoportok");
  await expect(page.getByRole("heading", { name: "Munkacsoportok", exact: true })).toBeFocused();
  await expect(page.getByText("2026-2027-es nevelési év")).toBeVisible();
  await expect(page.getByTestId("workgroup-list").getByRole("listitem")).toHaveCount(6);
  for (const name of [
    "Játszókert",
    "Karbantartó",
    "Ünnep-előkészítő",
    "Kreatív-alkotó",
    "Nagytakarítás szervezése",
    "Állatgondozás",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("workgroup-list").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("workgroup-list").getByRole("link")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("a signed-out visitor gets the way to sign-in and sees no working group (BR2.4)", async ({
  page,
}) => {
  await page.goto("/szulo/munkacsoportok");
  await expect(page.getByTestId("parent-login-link")).toHaveAttribute("href", "/bejelentkezes");
  await expect(page.locator("body")).not.toContainText("Karbantartó");
  for (const route of ["/teacher/munkacsoportok", "/admin/munkacsoportok"]) {
    await page.goto(route);
    await expect(page.getByTestId("production-sign-in-link")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Karbantartó");
  }
});

test("the group administrator switches between the parent and administrator menus", async ({
  page,
}) => {
  await signInAs(page, world().account("group-admin-1"));
  await page.goto("/admin");
  await expect(page.getByTestId("app-shell-switch-link")).toHaveText("Szülői nézet");
  await page.getByTestId("app-shell-switch-link").click();
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await expect(page.getByTestId("app-shell-switch-link")).toHaveText("Adminisztráció");
  await expect(page.getByTestId("app-shell-navigation-parent-duties")).toBeVisible();
  await page.getByTestId("app-shell-switch-link").click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("a super admin without a family has no switch; a plain parent has none either", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin");
  await expect(page.getByTestId("app-shell-switch-link")).toHaveCount(0);
  await signInAs(page, world().account("parent-2"));
  await page.goto("/szulo/feladatok");
  await expect(page.getByTestId("app-shell-switch-link")).toHaveCount(0);
});

test("a group administrator reaches the items of every group they hold and no others", async ({
  page,
}) => {
  await signInAs(page, world().account("group-admin-2"));
  await page.goto(`/admin/feladatok/${world().id("task:2:1")}`);
  await expect(denied(page)).toHaveCount(0);
  await page.goto(`/admin/feladatok/${world().id("task:1:1")}`);
  await expect(page.locator("body")).not.toContainText("Sütés");

  await signInAs(page, world().account("group-admin-1"));
  await page.goto(`/admin/feladatok/${world().id("task:1:1")}`);
  await expect(denied(page)).toHaveCount(0);
  for (const item of ["task:2:1", "task:community:1"]) {
    await page.goto(`/admin/feladatok/${world().id(item)}`);
    await expect(page.getByTestId("admin-task-edit-form")).toHaveCount(0);
  }
});

test("a teacher reads the whole community and filters the community-wide items", async ({
  page,
}) => {
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/schedule");
  const options = page.getByTestId("teacher-schedule-group-select").locator("option");
  await expect(options).toHaveCount(8);
  await expect(options.nth(0)).toHaveText("Minden");
  await expect(options.nth(1)).toHaveText("Egész közösség");
  const main = page.locator("main");
  // The table and the cards hold the same entries: only one of them shows at a given width.
  await expect(main.getByText("Közös pakolás").filter({ visible: true }).first()).toBeVisible();
  await expect(main.getByText("Sütés").filter({ visible: true }).first()).toBeVisible();
  await page.getByTestId("teacher-schedule-group-select").selectOption("community");
  await page.getByTestId("teacher-schedule-filter-submit-button").click();
  await expect(page).toHaveURL(/groupId=community/);
  await expect(main.getByText("Közös pakolás").filter({ visible: true }).first()).toBeVisible();
  await expect(main.getByText("Sütés")).toHaveCount(0);
});

test("a revoked group administrator right stops at the next request, on the page and in the menu", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const adminPage = await context.newPage();
  try {
    await signInAs(adminPage, world().account("group-admin-1"));
    await adminPage.goto("/admin");
    await expect(adminPage.getByTestId("admin-dashboard-page")).toBeVisible();

    await signInAs(page, world().account("super-admin"));
    await page.goto("/admin/beallitasok");
    await page.waitForLoadState("networkidle");
    const grantId = world().account("group-admin-1").grantId;
    await page.getByTestId(`admin-grant-revoke-${grantId}-submit-button`).press("Enter");
    await expect(page.getByTestId(`admin-grant-revoke-${grantId}-state-success`)).toBeVisible();

    await adminPage.goto("/admin");
    await expect(denied(adminPage)).toBeVisible();
    await expect(adminPage.getByTestId("app-shell-navigation-admin-tasks")).toHaveCount(0);
    // The parent right stays: the same person still opens the parent pages.
    await adminPage.goto("/szulo/feladatok");
    await expect(denied(adminPage)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("an archived family stops its parent and its group administrator at the next request", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const parentPage = await context.newPage();
  const adminContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const adminPage = await adminContext.newPage();
  try {
    await signInAs(parentPage, world().account("parent-1"));
    await parentPage.goto("/szulo/feladatok");
    await expect(denied(parentPage)).toHaveCount(0);
    await signInAs(adminPage, world().account("group-admin-1"));
    await adminPage.goto("/admin");
    await expect(adminPage.getByTestId("admin-dashboard-page")).toBeVisible();

    await signInAs(page, world().account("super-admin"));
    await page.goto(`/admin/nyilvantartasok/${world().id("family:1")}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("admin-record-archive-form-submit-button").click();
    await expect(page.getByTestId("admin-record-archive-form-state-success")).toBeVisible();

    await parentPage.goto("/szulo/feladatok");
    await expect(denied(parentPage)).toBeVisible();
    await parentPage.goto("/szulo/munkacsoportok");
    await expect(denied(parentPage)).toBeVisible();
    await adminPage.goto("/admin");
    await expect(denied(adminPage)).toBeVisible();
    await expect(adminPage.getByTestId("app-shell-navigation-admin-tasks")).toHaveCount(0);
  } finally {
    await context.close();
    await adminContext.close();
  }
});
