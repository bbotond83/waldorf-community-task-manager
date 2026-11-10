import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ROLE_PROFILES, shellProfile } from "../support/role-profiles.ts";
import {
  addCleaningNotice,
  requestCancellation,
  signUpForDecorating,
  withOtherPage,
} from "./support/scenarios.ts";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

/** The role profiles the specs loop over, each with the seeded account that signs in as that role. */
const ROLES = ROLE_PROFILES.map((profile) => ({
  ...profile,
  label: shellProfile(profile.id).label,
  tag: {
    parent: "parent-1",
    teacher: "teacher-1",
    "group-admin": "group-admin-1",
    "super-admin": "super-admin",
  }[profile.id],
}));
type RoleEntry = (typeof ROLES)[number];

/** Signs in as the account of a role and opens the page its role starts on. */
async function signInRole(page: Page, tag: string) {
  await world().reseed();
  await signInAs(page, world().account(tag));
  await page.goto("/");
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const ENGLISH_STATUS_WORDS = /\b(pending|approved|rejected|active|archived|open|scheduled)\b/i;

function menuPages(profile: RoleEntry): string[] {
  return profile.navigation.map((item) => item.href);
}

for (const profile of ROLES) {
  test(`${profile.id} opens its default page with no welcome page and no heading box`, async ({
    page,
  }) => {
    await signInRole(page, profile.tag);
    await expect(page).toHaveURL(new RegExp(`${profile.homePath}$`));
    await expect(page.getByText("Üdvözlünk")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-profile-summary")).toContainText(profile.label);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeFocused();
    expect(await heading.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
      "none",
    );
    // Opening "/" with an active session goes straight to the same page.
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`${profile.homePath}$`));
    await expect(page.getByTestId("profile-selector")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-switch-profile-button")).toHaveCount(0);
  });

  test(`${profile.id} sees the same menu on every page and the current page is marked`, async ({
    page,
  }) => {
    await signInRole(page, profile.tag);
    const expectedLabels = profile.navigation.map((item) => item.label);
    if (expectedLabels.length === 0) {
      // The teacher has a single page: no menu, no menu toggle.
      await expect(page.getByTestId("app-shell-navigation")).toHaveCount(0);
      await expect(page.getByTestId("app-shell-navigation-toggle")).toHaveCount(0);
      await expect(page.getByTestId("brand-link")).toHaveAttribute("href", profile.homePath);
      return;
    }
    for (const path of menuPages(profile)) {
      await page.goto(path);
      const links = page.getByTestId("app-shell-navigation").getByRole("link");
      await expect(links).toHaveText(expectedLabels);
      const current = page.getByTestId("app-shell-navigation").locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute("href", path);
      for (const link of await links.all()) {
        const box = await link.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(page.getByTestId("brand-link")).toHaveAttribute("href", profile.homePath);
  });

  test(`@a11y ${profile.id} default page has no serious or critical accessibility violations`, async ({
    page,
  }) => {
    await signInRole(page, profile.tag);
    await expect(page).toHaveURL(new RegExp(`${profile.homePath}$`));
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS)).toEqual([]);
  });

  test(`${profile.id} default page and menu fit 320 px without horizontal scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await signInRole(page, profile.tag);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    for (const path of menuPages(profile)) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
  });
}

test("the teacher gets back to Beosztás from a detail page and from a denied page", async ({
  page,
}, testInfo) => {
  const isMobile = testInfo.project.name === "mobile-chrome";
  await signInRole(page, "teacher-1");
  await page
    .locator(
      isMobile
        ? '[data-testid^="teacher-schedule-card-open-"]'
        : '[data-testid^="teacher-schedule-open-"]',
    )
    .first()
    .click();
  await expect(page).toHaveURL(/\/teacher\/schedule\/[^/?]+/);
  await page.getByRole("link", { name: "Vissza a beosztáshoz" }).click();
  await expect(page).toHaveURL(/\/teacher\/schedule(\?.*)?$/);

  for (const deniedPath of ["/admin", "/admin/beallitasok", "/szulo/feladatok"]) {
    await page.goto(deniedPath);
    await expect(
      page.getByRole("heading", { name: "Nincs jogosultság", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Vissza a beosztáshoz" }).click();
    await expect(page).toHaveURL(/\/teacher\/schedule(\?.*)?$/);
  }

  await page.getByTestId("brand-link").click();
  await expect(page).toHaveURL(/\/teacher\/schedule$/);
});

test("admin list items open on a click anywhere on the item and show Hungarian states", async ({
  page,
  browser,
}, testInfo) => {
  await signInRole(page, "super-admin");
  // One open request for the approvals list and one archived family for the archive.
  await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
    requestCancellation(other, world()),
  );
  await page.goto(`/admin/nyilvantartasok/${world().id("family:5")}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("admin-record-archive-form-submit-button").click();
  await expect(page.getByTestId("admin-record-archive-form-state-success")).toBeVisible();
  for (const basePath of [
    "/admin/jovahagyasok",
    "/admin/nyilvantartasok",
    "/admin/feladatok",
    "/admin/archivum",
  ]) {
    await page.goto(basePath);
    const list = page.locator(".admin-collection");
    await expect(list, basePath).toBeVisible();
    expect(await list.innerText(), basePath).not.toMatch(ENGLISH_STATUS_WORDS);
    const first = list.locator("li").first();
    await expect(first.getByRole("link")).toHaveCount(1);
    await expect(first).not.toContainText("Részletek");
    // The state word is not the title; clicking it still opens the item.
    await first.locator(".status-badge").click();
    await expect(page).toHaveURL(new RegExp(`${basePath}/[^/?]+`));
    await expect(page.locator("main")).not.toContainText(
      /Állapot: (pending|approved|active|archived|open|scheduled)/,
    );
  }
});

test("admin filters keep their values and show Hungarian words", async ({
  page,
  browser,
}, testInfo) => {
  await signInRole(page, "group-admin-1");
  await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
    requestCancellation(other, world()),
  );
  await page.goto("/admin/jovahagyasok?state=pending");
  const select = page.getByTestId("admin-filter-state-select");
  await expect(select).toHaveValue("pending");
  await expect(select.locator("option")).toHaveText([
    "Minden állapot",
    "◔ Függőben",
    "✓ Jóváhagyva",
    "✕ Elutasítva",
  ]);
  expect(await page.locator(".admin-collection").innerText()).toContain("Függőben");
});

/** Two notifications for the first parent: a sign-up confirmation and one for the cleaning task. */
async function parentWithNotices(page: Page) {
  await world().reseed();
  await signUpForDecorating(page, world());
  await addCleaningNotice(world());
  await page.goto("/");
}

test("a notification card opens its target and the checkbox marks it as read", async ({ page }) => {
  await parentWithNotices(page);
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  const cards = page.locator('li[data-testid^="notification-card-"]');
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText("Megnyitás")).toHaveCount(0);
  for (const card of await cards.all()) {
    await expect(card.getByRole("link")).toHaveCount(1);
    const checkbox = card.getByRole("checkbox");
    await expect(checkbox).toHaveAccessibleName(/^Olvasottnak jelölöm /);
    const box = await checkbox.locator("xpath=..").boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // The checkbox marks the notification as read at once and stays ticked and disabled.
  const card = page.locator('li[data-testid^="notification-card-"]', { hasText: "Takarítás" });
  const noticeId = (await card.getAttribute("data-testid"))!.replace("notification-card-", "");
  const checkbox = page.getByTestId(`notification-read-checkbox-${noticeId}`);
  // The tick submits through the hydrated form, so wait for the page scripts to finish loading.
  await page.waitForLoadState("networkidle");
  await checkbox.check();
  await expect(page.getByTestId(`notification-state-${noticeId}-success`)).toBeVisible();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  // Keyboard focus moves to the card link instead of falling to the page body.
  await expect(page.getByTestId(`notification-link-${noticeId}`)).toBeFocused();

  // A click anywhere on the card text opens the notification.
  await page.getByTestId(`notification-card-${noticeId}`).locator("p").first().click();
  await expect(page).toHaveURL(new RegExp(`/szulo/feladatok/${world().id("task:1:3")}`));
});

test("the notification cards keep their padding and fit 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await parentWithNotices(page);
  await expect(page.locator('li[data-testid^="notification-card-"]').first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  const card = page.locator('li[data-testid^="notification-card-"]').first();
  const cardBox = await card.boundingBox();
  const titleBox = await card.locator("h2").boundingBox();
  // The text no longer touches the card border.
  expect((titleBox?.x ?? 0) - (cardBox?.x ?? 0)).toBeGreaterThanOrEqual(12);
  expect((titleBox?.y ?? 0) - (cardBox?.y ?? 0)).toBeGreaterThanOrEqual(12);
  const labelBox = await card.locator("label").boundingBox();
  expect((labelBox?.x ?? 0) + (labelBox?.width ?? 0)).toBeLessThanOrEqual(
    (cardBox?.x ?? 0) + (cardBox?.width ?? 0),
  );
  for (const path of ["/szulo/feladatok", "/admin", "/teacher/schedule"]) {
    await page.goto(path);
    expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
  }
});

test("@a11y whole-card lists have no serious or critical accessibility violations", async ({
  page,
}) => {
  await signInRole(page, "super-admin");
  for (const path of ["/admin/jovahagyasok", "/admin/nyilvantartasok"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS), path).toEqual([]);
  }
});

test("keyboard users see a ring on menu buttons and cards but not on the focused heading", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "keyboard focus ring is checked on desktop");
  await signInRole(page, "group-admin-1");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  const outlineWidth = await focused.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(3);
});
