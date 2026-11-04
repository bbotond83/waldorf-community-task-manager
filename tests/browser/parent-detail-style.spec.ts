import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The parent task detail page in the new look (U3 of the Stitch restyle): the detail panel and its status pill, the
 * signup button and its confirmation, the notices, the follow-up actions and the note forms. The look is checked
 * through computed styles, sizes and layout (the owner compares the screens with the design by eye). A signup changes
 * the seeded data, so every test starts from the same seed again, as parent-web.spec.ts does.
 */
const world = bindSeededSchema();

// The seed gives the first parent's family the baking task (signed up, with an allergen note) and leaves the
// decorating task of the same group open with one place left.
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

async function open(page: Page, key: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/szulo/feladatok/${world().id(key)}`);
  await page.evaluate(() => document.fonts.ready);
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

test("the facts are one cream panel of rows with a Vollkorn title and muted Karla labels", async ({
  page,
}) => {
  await open(page, DECORATING);
  const panel = await page.locator(".parent-detail-grid").evaluate((element) => {
    const computed = getComputedStyle(element);
    const row = getComputedStyle(element.querySelector(":scope > div")!);
    const label = getComputedStyle(element.querySelector("dt")!);
    const value = getComputedStyle(element.querySelector("dd")!);
    return {
      background: computed.backgroundColor,
      radius: computed.borderTopLeftRadius,
      border: computed.borderTopWidth,
      shadow: computed.boxShadow,
      rowCount: element.querySelectorAll(":scope > div").length,
      rowBackground: row.backgroundColor,
      rowRadius: row.borderTopLeftRadius,
      rowSideBorder: row.borderLeftWidth,
      title: getComputedStyle(document.querySelector("h1")!).fontFamily,
      labelFont: label.fontFamily,
      labelSize: Number.parseFloat(label.fontSize),
      valueSize: Number.parseFloat(value.fontSize),
    };
  });
  expect(panel.background).toBe(rgb("#fffaf1"));
  expect(panel.radius).toBe("16px");
  expect(panel.border).toBe("1px");
  expect(panel.shadow).not.toBe("none");
  expect(panel.rowCount).toBe(3);
  // No card inside the card: the rows have no fill, radius or side border of their own.
  expect(panel.rowBackground).toBe("rgba(0, 0, 0, 0)");
  expect(panel.rowRadius).toBe("0px");
  expect(panel.rowSideBorder).toBe("0px");
  expect(panel.title).toMatch(/vollkorn/i);
  expect(panel.labelFont).toMatch(/karla/i);
  expect(panel.valueSize).toBeGreaterThan(panel.labelSize);
  // The label sits above its value.
  const rects = await page
    .locator(".parent-detail-grid > div")
    .first()
    .evaluate((row) => ({
      dt: row.querySelector("dt")!.getBoundingClientRect(),
      dd: row.querySelector("dd")!.getBoundingClientRect(),
    }));
  expect(rects.dt.bottom).toBeLessThanOrEqual(rects.dd.top + 1);
  const back = await page.getByTestId("duty-detail-back-link").boundingBox();
  // Firefox reports 43.99998 for a 44 px box.
  expect(Math.round(back!.height)).toBeGreaterThanOrEqual(44);
});

test("the status pill keeps its icon and Hungarian word and reads at 4.5:1 in both states", async ({
  page,
}) => {
  for (const key of [DECORATING, BAKING]) {
    await open(page, key);
    const state = page.getByTestId("duty-detail-state");
    const badge = state.locator(".status-badge");
    const look = await badge.evaluate((element) => ({
      radius: getComputedStyle(element).borderTopLeftRadius,
      text: element.textContent?.trim() ?? "",
      iconWidth: element.querySelector("svg")?.getBoundingClientRect().width ?? 0,
    }));
    expect(look.radius).toBe("999px");
    expect(look.text.length).toBeGreaterThan(0);
    expect(look.iconWidth).toBeGreaterThan(8);
    await expect(badge.locator("svg[aria-hidden='true']")).toBeVisible();
    expect(await contrastOf(badge), `status pill "${look.text}"`).toBeGreaterThanOrEqual(4.5);
  }
});

test("a real signup shows a green status confirmation with a bar, and the button is a 44 px pill", async ({
  page,
}) => {
  await open(page, DECORATING);
  const button = page.getByTestId("signup-form-submit-button");
  await expect(button).toHaveText("Jelentkezem");
  const buttonLook = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { radius: computed.borderTopLeftRadius, height: element.getBoundingClientRect().height };
  });
  expect(buttonLook.radius).toBe("999px");
  expect(buttonLook.height).toBeGreaterThanOrEqual(44);
  await page.waitForLoadState("networkidle");
  await button.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const ring = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { width: computed.outlineWidth, colour: computed.outlineColor };
  });
  expect(ring).toEqual({ width: "3px", colour: rgb("#1f4e79") });

  await button.click();
  const confirmation = page.getByTestId("signup-form-state-success");
  await expect(confirmation).toContainText("jelentkezés sikerült");
  await expect(confirmation).toHaveAttribute("role", "status");
  const look = await confirmation.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      bar: computed.borderLeftColor,
      barWidth: computed.borderLeftWidth,
      message: getComputedStyle(element.querySelector("strong")!).fontFamily,
    };
  });
  expect(look.background).toBe(rgb("#e8f3e6"));
  expect(look.bar).toBe(rgb("#2f6b3a"));
  // 0.35rem; a browser may round it to whole device pixels.
  expect(Number.parseFloat(look.barWidth)).toBeGreaterThanOrEqual(4.5);
  expect(look.message).toMatch(/vollkorn/i);
  expect(await contrastOf(confirmation)).toBeGreaterThanOrEqual(4.5);
});

test("a refused signup keeps the alert role, the terracotta bar and readable text", async ({
  page,
  browser,
  baseURL,
}) => {
  await open(page, DECORATING);
  await page.waitForLoadState("networkidle");
  // Another family takes the last place first, so this family's attempt on the page it already loaded is refused.
  const other = await browser.newContext({ baseURL });
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage, world().account("parent-3"));
    await otherPage.goto(`/szulo/feladatok/${world().id(DECORATING)}`);
    await otherPage.getByTestId("signup-form-submit-button").click();
    await expect(otherPage.getByTestId("signup-form-state-success")).toBeVisible();
  } finally {
    await other.close();
  }
  await page.getByTestId("signup-form-submit-button").click();
  const refusal = page.locator("[data-testid^='signup-form-state-']");
  await expect(refusal).toHaveAttribute("role", "alert");
  await expect(refusal).not.toHaveAttribute("data-testid", "signup-form-state-success");
  await expect(refusal).toBeFocused();
  const look = await refusal.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      bar: computed.borderLeftColor,
      barWidth: computed.borderLeftWidth,
    };
  });
  expect(look.background).toBe(rgb("#fbe9e3"));
  expect(look.bar).toBe(rgb("#98452f"));
  expect(Number.parseFloat(look.barWidth)).toBeGreaterThanOrEqual(4.5);
  expect(await contrastOf(refusal)).toBeGreaterThanOrEqual(4.5);
});

test("notices keep their blue bar: a full task, an ineligible one and a waiting request", async ({
  page,
  browser,
  baseURL,
}) => {
  // The first family takes the last place of the decorating task; another family of the group then finds it full.
  await open(page, DECORATING);
  await page.getByTestId("signup-form-submit-button").click();
  await expect(page.getByTestId("signup-form-state-success")).toBeVisible();
  const other = await browser.newContext({ baseURL });
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage, world().account("parent-3"));
    await otherPage.goto(`/szulo/feladatok/${world().id(DECORATING)}`);
    const full = otherPage.getByTestId("duty-full-state");
    await expect(full).toBeVisible();
    await expect(full).toHaveText("A feladat betelt; jelentkezés nem indítható.");
    const look = await full.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        bar: computed.borderLeftColor,
        barWidth: computed.borderLeftWidth,
      };
    });
    expect(look).toMatchObject({ background: rgb("#f5ecd9"), bar: rgb("#1f4e79") });
    expect(Number.parseFloat(look.barWidth)).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(full)).toBeGreaterThanOrEqual(4.5);
    // The ineligible task never occurs in the seed; the same class gives the same look.
    await otherPage.evaluate(() => {
      const notice = document.createElement("p");
      notice.className = "parent-notice";
      notice.dataset.testid = "probe-ineligible";
      notice.textContent = "A család ehhez a feladathoz most nem jogosult.";
      document.querySelector("main")!.append(notice);
    });
    const probe = otherPage.locator("[data-testid='probe-ineligible']");
    expect(await probe.evaluate((element) => getComputedStyle(element).borderLeftColor)).toBe(
      rgb("#1f4e79"),
    );
    expect(await contrastOf(probe)).toBeGreaterThanOrEqual(4.5);
  } finally {
    await other.close();
  }

  // A cancellation request waiting on the baking task shows the pending notice and hides the follow-up actions.
  await page.goto(`/szulo/feladatok/${world().id(BAKING)}/lemondas`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
  await page.getByTestId("cancellation-request-form-submit-button").click();
  await expect(page.getByTestId("cancellation-request-form-state-success")).toBeVisible();
  await open(page, BAKING);
  const pending = page.getByTestId("pending-request-notice");
  await expect(page.getByTestId("pending-cancellation-notice")).toBeVisible();
  const pendingLook = await pending.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { bar: computed.borderLeftColor, background: computed.backgroundColor };
  });
  expect(pendingLook).toEqual({ bar: rgb("#1f4e79"), background: rgb("#f5ecd9") });
  expect(await contrastOf(pending)).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByTestId("swap-request-link")).toHaveCount(0);
});

for (const width of [320, 1280]) {
  test(`the follow-up actions are 44 px outlined pills and the note form stacks its label, at ${width} px`, async ({
    page,
  }) => {
    await open(page, BAKING, width);
    const links = [
      page.getByTestId("swap-request-link"),
      page.getByTestId("cancellation-request-link"),
    ];
    for (const link of links) {
      await expect(link).toBeVisible();
      const look = await link.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          radius: computed.borderTopLeftRadius,
          border: computed.borderTopWidth,
          colour: computed.borderTopColor,
          height: element.getBoundingClientRect().height,
          right: element.getBoundingClientRect().right,
        };
      });
      expect(look.radius).toBe("999px");
      expect(Number.parseFloat(look.border)).toBeGreaterThanOrEqual(1);
      expect(look.colour).toBe(rgb("#6f2f1f"));
      expect(look.height).toBeGreaterThanOrEqual(44);
      expect(look.right).toBeLessThanOrEqual(width);
    }
    const note = page.getByTestId("permitted-allergen-note");
    const noteLook = await note.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        bar: computed.borderLeftColor,
        heading: getComputedStyle(element.querySelector("h2")!).fontFamily,
      };
    });
    expect(noteLook).toMatchObject({
      background: rgb("#f5ecd9"),
      bar: rgb("#a8661a"),
      heading: expect.stringMatching(/vollkorn/i),
    });
    expect(await contrastOf(note)).toBeGreaterThanOrEqual(4.5);
    const label = await page.locator("label[for='note']").boundingBox();
    const textarea = await page.getByTestId("contribution-note-input").boundingBox();
    expect(label!.y + label!.height).toBeLessThanOrEqual(textarea!.y + 1);
    expect(textarea!.height).toBeGreaterThanOrEqual(44);
    const hint = page.locator("[data-testid='contribution-form'] .form-hint");
    await expect(hint).toBeVisible();
    expect(await contrastOf(hint)).toBeGreaterThanOrEqual(4.5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("a long Hungarian title wraps at 320 px: no sideways scroll and nothing cut off", async ({
  page,
}) => {
  await open(page, BAKING, 320);
  await page.evaluate(() => {
    document.querySelector("h1")!.textContent = "Megszentségteleníthetetlenségeitekért ".repeat(3);
    document.querySelector(".parent-detail-grid dd")!.textContent =
      "Megszentségteleníthetetlenségeitekért".repeat(2);
  });
  const result = await page.evaluate(() => {
    const title = document.querySelector("h1")!;
    const panel = document.querySelector(".parent-detail-grid")!.getBoundingClientRect();
    const value = document.querySelector(".parent-detail-grid dd")!;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titleRight: title.getBoundingClientRect().right,
      panelRight: panel.right,
      titleClipped: title.scrollWidth > title.clientWidth + 1,
      valueRight: value.getBoundingClientRect().right,
      valueClipped: value.scrollWidth > value.clientWidth + 1,
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(0);
  expect(result.titleRight).toBeLessThanOrEqual(result.panelRight);
  expect(result.titleClipped).toBe(false);
  expect(result.valueRight).toBeLessThanOrEqual(result.panelRight);
  expect(result.valueClipped).toBe(false);
});

test("@a11y the detail page has no serious or critical findings: open task, confirmation, signed-up task", async ({
  page,
}) => {
  await open(page, DECORATING);
  const available = await new AxeBuilder({ page }).analyze();
  expect(available.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("signup-form-submit-button").click();
  await expect(page.getByTestId("signup-form-state-success")).toBeVisible();
  const confirmed = await new AxeBuilder({ page }).analyze();
  expect(confirmed.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await open(page, BAKING);
  await expect(page.getByTestId("swap-request-link")).toBeVisible();
  const signedUp = await new AxeBuilder({ page }).analyze();
  expect(signedUp.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
});
