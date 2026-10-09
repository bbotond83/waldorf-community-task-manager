import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";

async function resetToChooser(page: Page) {
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
  await expect(page.getByTestId("profile-selector")).toBeVisible();
}

for (const width of [320, 375]) {
  test(`chooser has no horizontal overflow and unbroken role names at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await resetToChooser(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // A role name may only wrap at its syllable breaks, so it never overflows its card.
    const clipped = await page.evaluate(
      () =>
        [...document.querySelectorAll(".profile-card")].filter(
          (card) => card.scrollWidth > card.clientWidth,
        ).length,
    );
    expect(clipped).toBe(0);
    for (const profile of SYNTHETIC_PROFILES) {
      await expect(page.getByTestId(`profile-selector-${profile.id}-button`)).toBeVisible();
    }
  });
}

test("a chooser card selects the profile with mouse and with keyboard", async ({ page }) => {
  await resetToChooser(page);
  await page.getByTestId("profile-selector-parent-local-button").click();
  const heading = page.getByRole("heading", { name: "Értesítések", exact: true });
  await expect(heading).toBeFocused();
  // The heading takes focus for screen readers but no box is drawn around it.
  expect(await heading.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
  await page.getByTestId("app-shell-switch-profile-button").click();
  const card = page.getByTestId("profile-selector-kindergarten-teacher-local-button");
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeVisible();
});

test("the header logo returns to the profile's default page", async ({ page }) => {
  await resetToChooser(page);
  await page.getByTestId("profile-selector-parent-local-button").click();
  await page.goto("/szulo/feladatok");
  await page.getByTestId("brand-link").click();
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await expect(page.getByRole("heading", { name: "Értesítések", exact: true })).toBeVisible();
});

test("admin overview card opens pending approvals with the same count", async ({ page }) => {
  await resetToChooser(page);
  await page.getByTestId("profile-selector-group-admin-local-button").click();
  await page.goto("/admin");
  const count = Number(await page.getByTestId("admin-dashboard-summary").innerText());
  expect(count).toBeGreaterThan(0);
  await page.getByTestId("admin-dashboard-approvals").click();
  await expect(page).toHaveURL(/\/admin\/jovahagyasok\?state=pending$/);
  await expect(page.getByTestId("admin-approvals-list").locator("li")).toHaveCount(count);
  await expect(page.getByTestId("admin-dashboard-queue")).toHaveCount(0);
});

test("a parent task card opens the task detail anywhere on the card", async ({ page }) => {
  await resetToChooser(page);
  await page.getByTestId("profile-selector-parent-local-button").click();
  await page.goto("/szulo/feladatok");
  const card = page.locator('[data-testid^="duty-card-"]').first();
  await card.locator("h2").click();
  await expect(page).toHaveURL(/\/szulo\/feladatok\/[^/?]+/);
});

test("the cover photo is served resized for a narrow screen (NFR4)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const sizes: number[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/_next/image") && response.url().includes("cover")) {
      sizes.push((await response.body()).length);
    }
  });
  await resetToChooser(page);
  await page.waitForLoadState("networkidle");
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.max(...sizes)).toBeLessThanOrEqual(250 * 1024);
});

test("the chooser stays usable and stable when images fail to load (R-05)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await resetToChooser(page);
  await page.waitForLoadState("networkidle");
  const loaded = await page.getByRole("heading", { level: 1 }).boundingBox();

  await page.route("**/_next/image*", (route) => route.abort());
  await page.reload();
  const failed = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(failed?.y).toBeCloseTo(loaded!.y, 0);
  await page.getByTestId("profile-selector-parent-local-button").click();
  await expect(page.getByRole("heading", { name: "Értesítések", exact: true })).toBeVisible();
});
