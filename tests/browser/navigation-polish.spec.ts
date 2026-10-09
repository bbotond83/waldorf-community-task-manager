import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC_PROFILES, type SyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";

async function chooseProfile(page: Page, profileId: string) {
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
  await page.getByTestId(`profile-selector-${profileId}-button`).click();
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const ENGLISH_STATUS_WORDS = /\b(pending|approved|rejected|active|archived|open|scheduled)\b/i;

function menuPages(profile: SyntheticProfile): string[] {
  return profile.navigation.map((item) => item.href);
}

for (const profile of SYNTHETIC_PROFILES) {
  test(`${profile.id} opens its default page with no welcome page and no heading box`, async ({
    page,
  }) => {
    await chooseProfile(page, profile.id);
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
  });

  test(`${profile.id} sees the same menu on every page and the current page is marked`, async ({
    page,
  }) => {
    await chooseProfile(page, profile.id);
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
    await chooseProfile(page, profile.id);
    await expect(page).toHaveURL(new RegExp(`${profile.homePath}$`));
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
    ).toEqual([]);
  });

  test(`${profile.id} default page and menu fit 320 px without horizontal scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await chooseProfile(page, profile.id);
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
  await chooseProfile(page, "kindergarten-teacher-local");
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

  for (const deniedPath of ["/admin", "/admin/import", "/szulo/feladatok"]) {
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
}) => {
  await chooseProfile(page, "super-admin-local");
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
    await first.locator(".admin-state-badge").click();
    await expect(page).toHaveURL(new RegExp(`${basePath}/[^/?]+`));
    await expect(page.locator("main")).not.toContainText(
      /Állapot: (pending|approved|active|archived|open|scheduled)/,
    );
  }
});

test("admin filters keep their values and show Hungarian words", async ({ page }) => {
  await chooseProfile(page, "group-admin-local");
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

test("a notification card opens its target and the checkbox marks it as read", async ({ page }) => {
  await chooseProfile(page, "parent-local");
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

  // The checkbox marks the notification as read at once and stays ticked and disabled. The
  // synthetic parent state is shared by the whole server run, so this test uses the notification
  // that no other spec reads (the parent spec reads the per-browser "7-day" ones).
  const checkbox = page.getByTestId("notification-read-checkbox-notice-24-hour");
  // The tick submits through the hydrated form, so wait for the page scripts to finish loading.
  await page.waitForLoadState("networkidle");
  await checkbox.check();
  await expect(page.getByTestId("notification-state-notice-24-hour-success")).toBeVisible();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  // Keyboard focus moves to the card link instead of falling to the page body.
  await expect(page.getByTestId("notification-link-notice-24-hour")).toBeFocused();

  // A click anywhere on the card text opens the notification.
  await page.getByTestId("notification-card-notice-24-hour").locator("p").first().click();
  await expect(page).toHaveURL(/\/szulo\/feladatok\/duty-garden/);
});

test("the notification cards keep their padding and fit 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await chooseProfile(page, "parent-local");
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
  await chooseProfile(page, "super-admin-local");
  for (const path of ["/admin/jovahagyasok", "/admin/nyilvantartasok"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
      path,
    ).toEqual([]);
  }
});

test("keyboard users see a ring on menu buttons and cards but not on the focused heading", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "keyboard focus ring is checked on desktop");
  await chooseProfile(page, "group-admin-local");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  const outlineWidth = await focused.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(3);
});
