import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The parent cancellation request page in the new look (U4 of the Stitch restyle): the header, the reason form, the
 * confirmation after a real request and the "not cancellable" state. The swap request page shares the form and notice
 * rules, so one check keeps it from breaking. The look is checked through computed styles, sizes and layout (the owner
 * compares the screens with the design by eye). A request changes the seeded data, so every test starts from the same
 * seed again, as parent-detail-style.spec.ts does.
 */
const world = bindSeededSchema();

// The first parent's family is signed up for the baking task and not for the decorating task of the same group.
const BAKING = "task:1:1";
const DECORATING = "task:1:2";

test.beforeEach(async ({ page }) => {
  await world().reseed();
  await signInAs(page, world().account("parent-1"));
});

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
};

async function open(page: Page, key: string, suffix: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/szulo/feladatok/${world().id(key)}/${suffix}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
}

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

test("the header is a 44 px back link above a Vollkorn title", async ({ page }) => {
  await open(page, BAKING, "lemondas");
  const back = page.getByTestId("cancellation-back-link");
  await expect(back).toHaveClass(/parent-back-link/);
  const box = await back.boundingBox();
  // Firefox reports 43.99998 for a 44 px box.
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
  const title = page.locator("h1");
  await expect(title).toHaveText("Lemondási kérelem");
  const look = await title.evaluate((element) => ({
    font: getComputedStyle(element).fontFamily,
    size: Number.parseFloat(getComputedStyle(element).fontSize),
  }));
  expect(look.font).toMatch(/vollkorn/i);
  // The headline-lg size of the task detail page (at most 2.25rem), not the larger page-title size.
  expect(look.size).toBeLessThanOrEqual(36);
  expect(box!.y + box!.height).toBeLessThanOrEqual((await title.boundingBox())!.y + 1);
});

test("the reason form is a cream panel: label above the field, 44 px field and pill button, blue focus ring", async ({
  page,
}) => {
  await open(page, BAKING, "lemondas");
  const form = page.getByTestId("cancellation-request-form");
  const panel = await form.evaluate((element) => {
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

  const label = await page.locator("label[for='reason']").boundingBox();
  const field = page.getByTestId("cancellation-reason-input");
  const fieldBox = await field.boundingBox();
  expect(label!.y + label!.height).toBeLessThanOrEqual(fieldBox!.y + 1);
  expect(fieldBox!.height).toBeGreaterThanOrEqual(44);
  // The reason field is at least 7rem tall (112 px).
  expect(fieldBox!.height).toBeGreaterThanOrEqual(112);
  const hint = form.locator(".form-hint");
  await expect(hint).toBeVisible();
  expect(await contrastOf(hint)).toBeGreaterThanOrEqual(4.5);

  const button = page.getByTestId("cancellation-request-form-submit-button");
  const buttonLook = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { radius: computed.borderTopLeftRadius, height: element.getBoundingClientRect().height };
  });
  expect(buttonLook.radius).toBe("999px");
  expect(buttonLook.height).toBeGreaterThanOrEqual(44);

  await field.focus();
  const ring = await field.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { width: computed.outlineWidth, colour: computed.outlineColor };
  });
  expect(ring).toEqual({ width: "3px", colour: rgb("#1f4e79") });
});

test("a real request shows a green status confirmation and the pending notice with a 44 px link", async ({
  page,
}) => {
  await open(page, BAKING, "lemondas");
  await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
  await page.getByTestId("cancellation-request-form-submit-button").click();
  const confirmation = page.getByTestId("cancellation-request-form-state-success");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveAttribute("role", "status");
  const look = await confirmation.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, bar: computed.borderLeftColor };
  });
  expect(look).toEqual({ background: rgb("#e8f3e6"), bar: rgb("#2f6b3a") });
  expect(await contrastOf(confirmation)).toBeGreaterThanOrEqual(4.5);

  const panel = page.getByTestId("cancellation-pending-panel");
  await expect(panel.getByTestId("pending-cancellation-notice")).toBeVisible();
  const notice = page.getByTestId("pending-request-notice");
  const noticeLook = await notice.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, bar: computed.borderLeftColor };
  });
  expect(noticeLook).toEqual({ background: rgb("#f5ecd9"), bar: rgb("#1f4e79") });
  expect(await contrastOf(notice)).toBeGreaterThanOrEqual(4.5);
  const link = panel.getByTestId("cancellation-pending-panel-back-link");
  const linkLook = await link.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      radius: computed.borderTopLeftRadius,
      colour: computed.borderTopColor,
      height: element.getBoundingClientRect().height,
    };
  });
  expect(linkLook.radius).toBe("999px");
  expect(linkLook.colour).toBe(rgb("#6f2f1f"));
  expect(linkLook.height).toBeGreaterThanOrEqual(44);
  expect(await contrastOf(link)).toBeGreaterThanOrEqual(4.5);

  // The same page opened again later still shows the waiting request, not the form.
  await open(page, BAKING, "lemondas");
  await expect(page.getByTestId("cancellation-pending-panel")).toBeVisible();
  await expect(page.getByTestId("cancellation-request-form-submit-button")).toHaveCount(0);
});

test("a task the family has not signed up for shows a quiet notice with a blue bar", async ({
  page,
}) => {
  await open(page, DECORATING, "lemondas");
  const state = page.getByTestId("cancellation-ineligible-state");
  await expect(state).toHaveText("Ehhez a feladathoz nincs lemondható saját megbízás.");
  const look = await state.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      bar: computed.borderLeftColor,
      barWidth: computed.borderLeftWidth,
    };
  });
  expect(look).toMatchObject({ background: rgb("#f5ecd9"), bar: rgb("#1f4e79") });
  expect(Number.parseFloat(look.barWidth)).toBeGreaterThanOrEqual(4.5);
  expect(await contrastOf(state)).toBeGreaterThanOrEqual(4.5);
});

for (const width of [320, 1280]) {
  test(`no sideways scroll at ${width} px on the cancellation page, its confirmation and the swap page`, async ({
    page,
  }) => {
    await open(page, BAKING, "lemondas", width);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    const submit = page.getByTestId("cancellation-request-form-submit-button");
    expect(
      (await submit.boundingBox())!.x + (await submit.boundingBox())!.width,
    ).toBeLessThanOrEqual(width);

    await open(page, BAKING, "csere", width);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    const swapSubmit = page.getByTestId("swap-request-form-submit-button");
    await expect(swapSubmit).toBeVisible();
    const swapBox = await swapSubmit.boundingBox();
    expect(swapBox!.height).toBeGreaterThanOrEqual(44);
    expect(swapBox!.x + swapBox!.width).toBeLessThanOrEqual(width);

    await open(page, BAKING, "lemondas", width);
    await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
    await submit.click();
    await expect(page.getByTestId("cancellation-pending-panel")).toBeVisible();
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
  });
}

test("@a11y the cancellation form, its confirmation and the ineligible state have no serious or critical findings", async ({
  page,
}) => {
  await open(page, BAKING, "lemondas");
  const form = await new AxeBuilder({ page }).analyze();
  expect(form.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
  await page.getByTestId("cancellation-request-form-submit-button").click();
  await expect(page.getByTestId("cancellation-pending-panel")).toBeVisible();
  const confirmed = await new AxeBuilder({ page }).analyze();
  expect(confirmed.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await open(page, DECORATING, "lemondas");
  await expect(page.getByTestId("cancellation-ineligible-state")).toBeVisible();
  const ineligible = await new AxeBuilder({ page }).analyze();
  expect(ineligible.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
});
