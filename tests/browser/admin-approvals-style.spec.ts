import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { requestCancellation, withOtherPage } from "./support/scenarios.ts";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The admin approvals in the new look (U5 of the Stitch restyle): the list, the detail panel and the decision form with
 * its outcomes. A real decision changes the seeded data, so every test starts from the same seed again.
 */
const world = bindSeededSchema();

test.beforeEach(async ({ page, browser, baseURL }) => {
  await world().reseed();
  // A family asks to give up a task, so the list holds a pending approval.
  await withOtherPage(browser, baseURL, (other) => requestCancellation(other, world()));
  await signInAs(page, world().account("group-admin-1"));
});

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
};

/** The contrast of an element's text on the first opaque fill at or above it (the fills in this unit are opaque). */
async function contrastOf(locator: Locator) {
  return locator.evaluate((element) => {
    const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const [r, g, b] = channels(value).map((channel) => {
        const unit = channel / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const style = getComputedStyle(element);
    let fill: Element | null = element;
    while (fill && getComputedStyle(fill).backgroundColor === "rgba(0, 0, 0, 0)") {
      fill = fill.parentElement;
    }
    const background = fill ? getComputedStyle(fill).backgroundColor : "rgb(255, 255, 255)";
    const [light, dark] = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
    return (light! + 0.05) / (dark! + 0.05);
  });
}

const overflowOf = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function open(page: Page, path: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

async function openDetail(page: Page, width = 1280) {
  await open(page, "/admin/jovahagyasok", width);
  const href = await page.locator(".admin-collection li a").first().getAttribute("href");
  await open(page, href!, width);
}

test("the list card is a cream panel with a Vollkorn title and a readable state pill", async ({
  page,
}) => {
  await open(page, "/admin/jovahagyasok");
  const card = page.locator(".admin-collection li").first();
  // Firefox can leave the pointer over the card after the page load, which shows the hover fill.
  await page.mouse.move(0, 0);
  await expect
    .poll(() => card.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(rgb("#fffaf1"));
  const look = await card.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      radius: computed.borderTopLeftRadius,
      shadow: computed.boxShadow,
    };
  });
  expect(look.background).toBe(rgb("#fffaf1"));
  expect(look.radius).toBe("16px");
  expect(look.shadow).not.toBe("none");
  expect(await card.locator("strong").evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(
    /vollkorn/i,
  );
  const pill = card.locator(".status-badge");
  await expect(pill).toContainText("Függőben");
  expect(await pill.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("999px");
  expect(await contrastOf(pill)).toBeGreaterThanOrEqual(4.5);
  expect((await card.locator("a").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // The pager is made of quiet outlined pills of at least 44 px.
  const pager = page.getByTestId("admin-pagination").locator("span").first();
  expect((await pager.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await pager.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("999px");
  expect(await contrastOf(pager)).toBeGreaterThanOrEqual(4.5);
});

test("the filter is a cream panel with 44 px controls", async ({ page }) => {
  await open(page, "/admin/jovahagyasok");
  const filter = page.getByTestId("admin-filter-form");
  expect(await filter.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none");
  expect(
    (await page.getByTestId("admin-filter-query-input").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  expect(
    (await page.getByTestId("admin-filter-submit-button").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
});

test("the detail is a cream panel and the decision form a second panel with 44 px controls and a blue focus ring", async ({
  page,
}) => {
  await openDetail(page);
  const panel = page.locator(".admin-detail-grid > section");
  const look = await panel.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, shadow: computed.boxShadow };
  });
  expect(look.background).toBe(rgb("#fffaf1"));
  expect(look.shadow).not.toBe("none");
  expect(await panel.locator("h2").evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(
    /vollkorn/i,
  );
  expect(await contrastOf(panel.locator(".status-badge"))).toBeGreaterThanOrEqual(4.5);
  expect(
    await panel.locator(".admin-safe-reason").evaluate((e) => getComputedStyle(e).overflowWrap),
  ).toBe("break-word");

  const form = page.getByTestId("admin-approval-decision-form");
  const formLook = await form.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, shadow: computed.boxShadow };
  });
  expect(formLook.background).toBe(rgb("#fffaf1"));
  expect(formLook.shadow).not.toBe("none");
  for (const id of ["admin-approval-approve-radio", "admin-approval-reject-radio"]) {
    const label = page.getByTestId(id).locator("xpath=ancestor::label");
    expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const button = page.getByTestId("admin-approval-decision-form-submit-button");
  const buttonLook = await button.evaluate((e) => ({
    radius: getComputedStyle(e).borderTopLeftRadius,
    height: e.getBoundingClientRect().height,
  }));
  expect(buttonLook.radius).toBe("999px");
  expect(buttonLook.height).toBeGreaterThanOrEqual(44);
  await button.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const ring = await button.evaluate((e) => ({
    width: getComputedStyle(e).outlineWidth,
    colour: getComputedStyle(e).outlineColor,
  }));
  expect(ring).toEqual({ width: "3px", colour: rgb("#1f4e79") });
});

test("a real approval shows a green status confirmation with readable text", async ({ page }) => {
  await openDetail(page);
  await page.getByTestId("admin-approval-decision-form-submit-button").click();
  const state = page.getByTestId("admin-approval-decision-form-state-success");
  await expect(state).toBeVisible();
  await expect(state).toHaveAttribute("role", "status");
  const look = await state.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, bar: computed.borderLeftColor };
  });
  expect(look).toEqual({ background: rgb("#e8f3e6"), bar: rgb("#2f6b3a") });
  expect(await contrastOf(state)).toBeGreaterThanOrEqual(4.5);
});

test("a second decision on a decided request is refused with an alert and a terracotta bar", async ({
  page,
}) => {
  await openDetail(page);
  const submit = page.getByTestId("admin-approval-decision-form-submit-button");
  await submit.click();
  await expect(page.getByTestId("admin-approval-decision-form-state-success")).toBeVisible();
  await submit.click();
  const refusal = page.getByTestId("admin-approval-decision-form").locator("[role='alert']");
  await expect(refusal).toBeVisible();
  await expect(refusal).toBeFocused();
  const look = await refusal.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, bar: computed.borderLeftColor };
  });
  expect(look).toEqual({ background: rgb("#fbe9e3"), bar: rgb("#98452f") });
  expect(await contrastOf(refusal)).toBeGreaterThanOrEqual(4.5);
});

for (const width of [320, 1280]) {
  test(`no sideways scroll at ${width} px on the list, the detail and a decision`, async ({
    page,
  }) => {
    await open(page, "/admin/jovahagyasok", width);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    await openDetail(page, width);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    await page.getByTestId("admin-approval-decision-form-submit-button").click();
    await expect(page.getByTestId("admin-approval-decision-form-state-success")).toBeVisible();
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
  });
}

test("@a11y the list and the detail with its confirmation have no serious or critical findings", async ({
  page,
}) => {
  await open(page, "/admin/jovahagyasok");
  const list = await new AxeBuilder({ page }).analyze();
  expect(list.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await openDetail(page);
  const detail = await new AxeBuilder({ page }).analyze();
  expect(detail.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await page.getByTestId("admin-approval-decision-form-submit-button").click();
  await expect(page.getByTestId("admin-approval-decision-form-state-success")).toBeVisible();
  const decided = await new AxeBuilder({ page }).analyze();
  expect(decided.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
});
