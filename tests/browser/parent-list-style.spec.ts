import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The parent task list in the new look (U2 of the Stitch restyle): the duty card and its status pill, the status
 * filter, and the empty and "no match" states. The look is checked through computed styles, sizes and layout (the
 * owner compares the screens with the design by eye). The seeded parent account is signed in once per test.
 */
const world = bindSeededSchema();
const LIST = "/szulo/feladatok";

async function openList(page: Page, width = 1280, query = "") {
  await page.setViewportSize({ width, height: 900 });
  await signInAs(page, world().account("parent-1"));
  await page.goto(`${LIST}${query}`);
  await page.evaluate(() => document.fonts.ready);
}

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
};

/** Opens the list filtered to the first state that has no duty for this family, so the "no match" message shows. */
async function openNoMatch(page: Page, width = 1280) {
  await openList(page, width);
  const values = await page
    .getByTestId("duty-filter-select")
    .locator("option")
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  for (const value of values.filter(Boolean)) {
    await page.goto(`${LIST}?allapot=${encodeURIComponent(value)}`);
    if (await page.getByTestId("duties-filter-empty").isVisible()) return value;
  }
  throw new Error("NO_EMPTY_FILTER: every state has a duty for this family");
}

test("a duty card is a cream panel with a 16 px radius, a Vollkorn title and a Karla date", async ({
  page,
}) => {
  await openList(page);
  const card = page.locator("[data-testid^='duty-card-']").first();
  await expect(card).toBeVisible();
  const look = await card.evaluate((element) => {
    const computed = getComputedStyle(element);
    const link = element.querySelector("a")!;
    return {
      background: computed.backgroundColor,
      radius: computed.borderTopLeftRadius,
      shadow: computed.boxShadow,
      title: getComputedStyle(element.querySelector("h2")!).fontFamily,
      date: getComputedStyle(element.querySelector("a > p")!).fontFamily,
      linkHeight: link.getBoundingClientRect().height,
    };
  });
  expect(look.background).toBe(rgb("#fffaf1"));
  expect(look.radius).toBe("16px");
  expect(look.shadow).not.toBe("none");
  expect(look.title).toMatch(/vollkorn/i);
  expect(look.date).toMatch(/karla/i);
  expect(look.linkHeight).toBeGreaterThanOrEqual(44);
});

test("the whole card opens the duty and the status pill keeps its icon and its Hungarian word", async ({
  page,
}) => {
  await openList(page);
  const card = page.locator("[data-testid^='duty-card-']").first();
  const badge = card.locator(".parent-state-badge");
  const look = await badge.evaluate((element) => ({
    radius: getComputedStyle(element).borderTopLeftRadius,
    text: element.textContent?.trim() ?? "",
    iconWidth: element.querySelector("svg")?.getBoundingClientRect().width ?? 0,
  }));
  expect(look.radius).toBe("999px");
  expect(look.text.length).toBeGreaterThan(0);
  expect(look.iconWidth).toBeGreaterThan(8);
  await expect(badge.locator("svg[aria-hidden='true']")).toBeVisible();
  await card.locator("h2").click();
  await expect(page).toHaveURL(/\/szulo\/feladatok\/[^/?]+/);
});

test("every status pill on the list keeps its text readable (4.5:1) on its own fill", async ({
  page,
}) => {
  await openList(page);
  const pills = page.locator("[data-testid^='duty-card-'] .parent-state-badge");
  expect(await pills.count()).toBeGreaterThan(0);
  const ratios = await pills.evaluateAll((elements) => {
    const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const [r, g, b] = channels(value).map((channel) => {
        const unit = channel / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    return elements.map((element) => {
      const style = getComputedStyle(element);
      const [light, dark] = [luminance(style.color), luminance(style.backgroundColor)].sort(
        (a, b) => b - a,
      );
      return { text: element.textContent?.trim(), ratio: (light! + 0.05) / (dark! + 0.05) };
    });
  });
  for (const { text, ratio } of ratios) {
    expect(ratio, `status pill "${text}"`).toBeGreaterThanOrEqual(4.5);
  }
});

test("a hovered card rises by 2 px, and stays put when the person asked for less motion", async ({
  page,
}) => {
  await openList(page);
  const card = page.locator("[data-testid^='duty-card-']").first();
  const top = async () => (await card.boundingBox())!.y;
  const before = await top();
  await card.hover();
  await expect.poll(top).toBeCloseTo(before - 2, 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(0, 0);
  await expect.poll(top).toBeCloseTo(before, 0);
  await card.hover();
  await page.waitForTimeout(300);
  expect(await top()).toBeCloseTo(before, 0);
});

test("the status pill sits beside the title on a wide screen and under the date on a phone", async ({
  page,
}) => {
  await openList(page, 1280);
  const card = page.locator("[data-testid^='duty-card-']").first();
  const rects = () =>
    card.evaluate((element) => {
      const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
      return { title: box("h2"), date: box("a > p"), badge: box(".parent-state-badge") };
    });
  const wide = await rects();
  expect(wide.badge.left).toBeGreaterThan(wide.title.right - 1);
  expect(wide.badge.top).toBeLessThan(wide.date.top);
  await page.setViewportSize({ width: 320, height: 900 });
  const narrow = await rects();
  expect(narrow.badge.top).toBeGreaterThanOrEqual(narrow.date.bottom - 1);
});

for (const width of [320, 1280]) {
  test(`the filter shows its label above the select, both at least 44 px and aligned, at ${width} px`, async ({
    page,
  }) => {
    await openList(page, width);
    const label = await page.locator("label[for='allapot']").boundingBox();
    const select = await page.getByTestId("duty-filter-select").boundingBox();
    const button = await page.getByTestId("duty-filter-submit-button").boundingBox();
    expect(label!.y + label!.height).toBeLessThanOrEqual(select!.y + 1);
    expect(select!.height).toBeGreaterThanOrEqual(44);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    if (width >= 640) {
      expect(Math.abs(select!.y + select!.height - (button!.y + button!.height))).toBeLessThan(1.5);
    }
    const panel = await page.getByTestId("duty-filter-form").evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        radius: computed.borderTopLeftRadius,
        border: computed.borderTopWidth,
        label: getComputedStyle(element.querySelector("label")!).fontFamily,
      };
    });
    expect(panel).toEqual({
      background: rgb("#fffaf1"),
      radius: "16px",
      border: "1px",
      label: expect.stringMatching(/karla/i),
    });
  });
}

test("the focus ring on the select is 3 px #1f4e79", async ({ page }) => {
  await openList(page);
  await page.getByTestId("duty-filter-select").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const ring = await page.getByTestId("duty-filter-select").evaluate((element) => {
    const computed = getComputedStyle(element);
    return { width: computed.outlineWidth, colour: computed.outlineColor };
  });
  expect(ring).toEqual({ width: "3px", colour: rgb("#1f4e79") });
});

test("the 'Nincs találat.' state is a cream panel with a blue bar and Vollkorn text", async ({
  page,
}) => {
  await openNoMatch(page);
  const empty = page.getByTestId("duties-filter-empty");
  await expect(empty).toHaveText("Nincs találat.");
  const look = await empty.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      background: computed.backgroundColor,
      bar: computed.borderLeftColor,
      barWidth: computed.borderLeftWidth,
      font: computed.fontFamily,
    };
  });
  expect(look.background).toBe(rgb("#fffaf1"));
  expect(look.bar).toBe(rgb("#1f4e79"));
  // 0.35rem; a browser may round it to whole device pixels.
  expect(Number.parseFloat(look.barWidth)).toBeGreaterThanOrEqual(4.5);
  expect(look.font).toMatch(/vollkorn/i);
});

test("a notice keeps a blue bar and an error keeps the alert role with a terracotta bar", async ({
  page,
}) => {
  await openList(page);
  const bars = await page.evaluate(() => {
    const make = (role: "status" | "alert") => {
      const section = document.createElement("section");
      section.className = "parent-state";
      section.setAttribute("role", role);
      section.innerHTML = "<h2>Cím</h2><p>Szöveg</p>";
      document.querySelector("main")!.append(section);
      const computed = getComputedStyle(section);
      const result = {
        role: section.getAttribute("role"),
        bar: computed.borderLeftColor,
        width: computed.borderLeftWidth,
        heading: getComputedStyle(section.querySelector("h2")!).fontFamily,
      };
      section.remove();
      return result;
    };
    return [make("status"), make("alert")];
  });
  expect(bars[0]).toMatchObject({ role: "status", bar: rgb("#1f4e79") });
  expect(bars[1]).toMatchObject({ role: "alert", bar: rgb("#98452f") });
  for (const bar of bars) expect(Number.parseFloat(bar.width)).toBeGreaterThanOrEqual(4.5);
  expect(bars[0]!.heading).toMatch(/vollkorn/i);
});

test("a long Hungarian title wraps at 320 px: no sideways scroll and nothing cut off", async ({
  page,
}) => {
  await openList(page, 320);
  await page
    .locator("[data-testid^='duty-card-'] h2")
    .first()
    .evaluate((element) => {
      element.textContent = "Megszentségteleníthetetlenségeitekért ".repeat(3);
    });
  const result = await page.evaluate(() => {
    const card = document.querySelector("[data-testid^='duty-card-']")!.getBoundingClientRect();
    const title = document.querySelector("[data-testid^='duty-card-'] h2")!;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titleRight: title.getBoundingClientRect().right,
      cardRight: card.right,
      clipped: title.scrollWidth > title.clientWidth + 1,
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(0);
  expect(result.titleRight).toBeLessThanOrEqual(result.cardRight);
  expect(result.clipped).toBe(false);
});

test("@a11y the task list and its 'no match' state have no serious or critical findings", async ({
  page,
}) => {
  await openList(page);
  const list = await new AxeBuilder({ page }).analyze();
  expect(list.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
  await openNoMatch(page);
  const empty = await new AxeBuilder({ page }).analyze();
  expect(empty.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
});
