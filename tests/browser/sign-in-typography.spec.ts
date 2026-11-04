import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema } from "./support/seeded-schema.ts";

/**
 * The sign-in page and the page frame in the new look (U1 of the Stitch restyle): self-hosted fonts, shared control
 * shapes, no sideways scroll, wrapping, focus and the automated accessibility scan. The sign-in page needs no
 * account, so these tests seed nothing.
 */
const SIGN_IN = "/bejelentkezes";
// The page needs no account; the helper only empties this project's schema like every other spec does (NFR3.20).
bindSeededSchema({ seed: false });

async function open(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(SIGN_IN);
  await expect(page.getByTestId("sign-in-page")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const style = (page: Page, testId: string, property: string) =>
  page.getByTestId(testId).evaluate((element, name) => {
    return getComputedStyle(element).getPropertyValue(name);
  }, property);

test("the heading is set in Vollkorn and the text in Karla, served from the app itself", async ({
  page,
  baseURL,
}) => {
  const outside: string[] = [];
  const appHost = new URL(baseURL!).host;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.host !== appHost) outside.push(request.url());
  });
  await open(page);
  const heading = page.getByRole("heading", { level: 1 });
  expect(await heading.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(
    /vollkorn/i,
  );
  expect(await style(page, "sign-in-forgot-link", "font-family")).toMatch(/karla/i);
  // The fonts are really in use: the browser has loaded them (the check reads the document's font set).
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family),
  );
  expect(loaded.join(" ")).toMatch(/vollkorn/i);
  expect(loaded.join(" ")).toMatch(/karla/i);
  expect(outside).toEqual([]);
});

test("the Hungarian letters ő and ű use the latin-ext font files", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    document.querySelector("h1")!.textContent = "Őszi kűrősök";
    return document.fonts.ready;
  });
  await page.evaluate(() =>
    document.fonts.load(
      `700 1em ${getComputedStyle(document.querySelector("h1")!).fontFamily}`,
      "ő",
    ),
  );
  const ranges = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.unicodeRange),
  );
  expect(ranges.some((range) => /U\+0*100-2BA/i.test(range))).toBe(true);
});

test("the primary button is a pill of at least 44 px and the fields are at least 44 px", async ({
  page,
}) => {
  await open(page);
  const box = await page.getByTestId("sign-in-submit").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await style(page, "sign-in-submit", "border-top-left-radius")).toBe("999px");
  for (const id of ["sign-in-email", "sign-in-password"]) {
    expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("the focus ring is 3 px #1f4e79 after Tab, and the skip link is first and visible on focus", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press("Tab");
  const skip = page.getByTestId("sign-in-skip-link");
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  const ring = await focused.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      width: computed.outlineWidth,
      colour: computed.outlineColor,
      offset: computed.outlineOffset,
    };
  });
  expect(ring).toEqual({ width: "3px", colour: "rgb(31, 78, 121)", offset: "3px" });
});

for (const width of [320, 375, 1280]) {
  test(`the sign-in page has no sideways scroll at ${width} px and shows in light mode`, async ({
    page,
  }) => {
    await open(page, width);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const colour = await page.evaluate(() => getComputedStyle(document.body).colorScheme);
    expect(colour).toBe("light");
  });
}

test("long Hungarian words wrap instead of being clipped at 320 px", async ({ page }) => {
  await open(page, 320);
  await page.evaluate(() => {
    const h1 = document.querySelector("h1")!;
    h1.textContent = "Megszentségteleníthetetlenségeitekért".repeat(2);
  });
  const result = await page.evaluate(() => {
    const h1 = document.querySelector("h1")!.getBoundingClientRect();
    return {
      right: h1.right,
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    };
  });
  expect(result.right).toBeLessThanOrEqual(result.viewport);
  expect(result.scroll).toBeLessThanOrEqual(result.viewport);
});

test("the sign-in page is usable at 200% zoom (a 640 px wide page at double size)", async ({
  page,
}) => {
  await open(page, 640);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("@a11y the sign-in page has no serious or critical accessibility violations", async ({
  page,
}) => {
  await open(page);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(blocking.map((violation) => violation.id)).toEqual([]);
});

// Regression: the Hungarian letters ő and ű sit in the latin-ext font files. A system stand-in font named inside the first
// family once drew them instead, so they looked thinner than the letters beside them. The browser's own report of the
// fonts it drew (Chromium only) must name only Vollkorn and Karla.
test("the letters ő and ű are drawn by Vollkorn and Karla, not by a system font", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The report of drawn fonts exists only in Chromium.");
  await open(page);
  await page.evaluate(() => {
    const heading = document.createElement("h2");
    heading.id = "hu-heading-probe";
    heading.textContent = "Szülő Űrlap";
    const text = document.createElement("p");
    text.id = "hu-text-probe";
    text.textContent = "FELADATKEZELŐ képernyőmodellbe";
    document.body.append(heading, text);
  });
  await page.evaluate(() => document.fonts.ready);
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument", { depth: 0 });
  for (const [selector, family] of [
    ["#hu-heading-probe", /vollkorn/i],
    ["#hu-text-probe", /karla/i],
  ] as const) {
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.length, selector).toBeGreaterThan(0);
    for (const font of fonts) expect(font.familyName, selector).toMatch(family);
  }
});
