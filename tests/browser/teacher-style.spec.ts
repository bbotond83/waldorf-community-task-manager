import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The teacher schedule in the new look (U5 of the Stitch restyle): filter, table on wide screens, cards under 44rem and
 * the detail panel. The look is checked through computed styles, sizes and layout (the owner compares the screens with
 * the design by eye). The screens only read data, but the spec reseeds before each test like its neighbours.
 */
const world = bindSeededSchema();

test.beforeEach(async ({ page }) => {
  await world().reseed();
  await signInAs(page, world().account("teacher-1"));
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

const detailPath = () =>
  `/teacher/schedule/${world().id("task:1:1")}?groupId=${world().id("group:1")}`;

test("the filter is a cream panel with a Vollkorn legend and 44 px controls", async ({ page }) => {
  await open(page, "/teacher/schedule");
  const filter = page.getByTestId("teacher-schedule-filter-form");
  const look = await filter.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, shadow: computed.boxShadow };
  });
  expect(look.background).toBe(rgb("#fffaf1"));
  expect(look.shadow).not.toBe("none");
  expect(await filter.locator("legend").evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(
    /vollkorn/i,
  );
  const submit = page.getByTestId("teacher-schedule-filter-submit-button");
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(
    (await page.getByTestId("teacher-schedule-group-select").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
});

test("the table is a cream panel with muted caps headers and a whole-row link of at least 44 px", async ({
  page,
}) => {
  await open(page, "/teacher/schedule");
  const wrapper = page.locator(".teacher-table-wrapper");
  const panel = await wrapper.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      radius: computed.borderTopLeftRadius,
      shadow: computed.boxShadow,
    };
  });
  expect(panel.background).toBe(rgb("#fffaf1"));
  expect(panel.radius).toBe("16px");
  expect(panel.shadow).not.toBe("none");
  const header = page.locator(".teacher-table thead th").first();
  const headerLook = await header.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { font: computed.fontFamily, transform: computed.textTransform, colour: computed.color };
  });
  expect(headerLook.font).toMatch(/karla/i);
  expect(headerLook.transform).toBe("uppercase");
  expect(headerLook.colour).toBe(rgb("#62564a"));
  expect(await contrastOf(header)).toBeGreaterThanOrEqual(4.5);
  const link = page.getByTestId(`teacher-schedule-open-${world().id("task:1:1")}`);
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const row = page.getByTestId(`teacher-schedule-row-${world().id("task:1:1")}`);
  await row.click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(/\/teacher\/schedule\/[0-9a-f-]{36}/);
});

test("the status pill in the table keeps one line and readable text", async ({ page }) => {
  await open(page, "/teacher/schedule");
  const pill = page.locator(".teacher-table .status-badge").first();
  const look = await pill.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { radius: computed.borderTopLeftRadius, height: element.getBoundingClientRect().height };
  });
  expect(look.radius).toBe("999px");
  // One line of 0.9rem text plus padding, not a pill broken over two lines.
  expect(look.height).toBeLessThan(40);
  expect(await contrastOf(pill)).toBeGreaterThanOrEqual(4.5);
});

test("the table and the cards switch at 44rem: cards at 600 px, table at 1280 px", async ({
  page,
}) => {
  await open(page, "/teacher/schedule", 600);
  await expect(page.getByTestId("teacher-schedule-card-list")).toBeVisible();
  await expect(page.getByTestId("teacher-schedule-table")).toBeHidden();
  const card = page.getByTestId(`teacher-schedule-card-${world().id("task:1:1")}`);
  const look = await card.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, shadow: computed.boxShadow };
  });
  expect(look.background).toBe(rgb("#fffaf1"));
  expect(look.shadow).not.toBe("none");
  const title = card.locator("h2");
  expect(await title.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/vollkorn/i);
  expect(
    (await page.getByTestId(`teacher-schedule-card-open-${world().id("task:1:1")}`).boundingBox())!
      .height,
  ).toBeGreaterThanOrEqual(44);
  expect(await contrastOf(card.locator(".status-badge"))).toBeGreaterThanOrEqual(4.5);
  await open(page, "/teacher/schedule", 1280);
  await expect(page.getByTestId("teacher-schedule-table")).toBeVisible();
  await expect(page.getByTestId("teacher-schedule-card-list")).toBeHidden();
});

test("the detail is one cream panel of divided rows with a label above each value", async ({
  page,
}) => {
  await open(page, detailPath());
  const grid = page.getByTestId("teacher-schedule-detail-fields");
  const panel = await grid.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      radius: computed.borderTopLeftRadius,
      shadow: computed.boxShadow,
    };
  });
  expect(panel.background).toBe(rgb("#fffaf1"));
  expect(panel.radius).toBe("16px");
  expect(panel.shadow).not.toBe("none");
  const rows = grid.locator("> div");
  const second = await rows.nth(1).evaluate((e) => getComputedStyle(e).borderTopWidth);
  expect(second).toBe("1px");
  const row = await rows.first().evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, border: computed.borderTopWidth };
  });
  expect(row.background).toBe("rgba(0, 0, 0, 0)");
  expect(row.border).toBe("0px");
  const dt = await grid.locator("dt").first().boundingBox();
  const dd = await grid.locator("dd").first().boundingBox();
  expect(dt!.y + dt!.height).toBeLessThanOrEqual(dd!.y + 1);
  const back = page.getByTestId("teacher-schedule-detail-back-link");
  expect(Math.round((await back.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  expect(await page.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(
    /vollkorn/i,
  );
});

for (const width of [320, 1280]) {
  test(`no sideways scroll at ${width} px on the list and the detail`, async ({ page }) => {
    await open(page, "/teacher/schedule", width);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    await open(page, detailPath(), width);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
  });
}

test("@a11y the list and the detail have no serious or critical findings", async ({ page }) => {
  await open(page, "/teacher/schedule");
  const list = await new AxeBuilder({ page }).analyze();
  expect(list.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await open(page, detailPath());
  const detail = await new AxeBuilder({ page }).analyze();
  expect(detail.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
});
