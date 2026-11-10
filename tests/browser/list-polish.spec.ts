import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { CLEANING_DAY, EVENT_DAY, seedDay } from "./support/dates.ts";
import { requestCancellation, withOtherPage } from "./support/scenarios.ts";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

/** The seeded accounts the specs sign in as, by the role the old profile names stood for. */
type ProfileId = "parent-1" | "teacher-1" | "group-admin-1" | "super-admin";

async function resetAndSelect(page: Page, profile: ProfileId) {
  await world().reseed();
  await signInAs(page, world().account(profile));
}

const isMobile = (name: string) => name === "mobile-chrome";
/** The tasks of the small seed: three in each of the two active groups and two community-wide ones. */
const WHOLE_COMMUNITY = 8;

/** One schedule item per entry: a table row on desktop, a card on a phone. */
function scheduleItems(page: Page, projectName: string): Locator {
  return page.locator(
    isMobile(projectName)
      ? '[data-testid^="teacher-schedule-card-"]:not([data-testid^="teacher-schedule-card-open-"]):not([data-testid="teacher-schedule-card-list"])'
      : '[data-testid^="teacher-schedule-row-"]',
  );
}

async function expectTeacherFieldsEmpty(page: Page) {
  await expect(page.getByTestId("teacher-schedule-group-select")).toHaveValue("");
  await expect(page.getByTestId("teacher-schedule-from-input")).toHaveValue("");
  await expect(page.getByTestId("teacher-schedule-to-input")).toHaveValue("");
}

test.describe("teacher schedule: Szűrők törlése empties every field", () => {
  test.beforeEach(async ({ page }) => resetAndSelect(page, "teacher-1"));

  test("the first visit is unfiltered: all groups, empty dates, nothing required", async ({
    page,
  }, testInfo) => {
    await page.goto("/teacher/schedule");
    await expectTeacherFieldsEmpty(page);
    await expect(page.getByTestId("teacher-schedule-from-input")).not.toHaveAttribute(
      "required",
      /.*/,
    );
    await expect(page.getByTestId("teacher-schedule-group-select").locator("option")).toHaveText([
      "Minden",
      "Egész közösség",
      "Állatgondozás",
      "Játszókert",
      "Karbantartó",
      "Kreatív-alkotó",
      "Nagytakarítás szervezése",
      "Ünnep-előkészítő",
    ]);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(WHOLE_COMMUNITY);
  });

  test("a typed, unsubmitted value is cleared and focus moves to the heading", async ({
    page,
  }, testInfo) => {
    await page.goto("/teacher/schedule");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("teacher-schedule-from-input").fill(seedDay(EVENT_DAY));
    await page.getByTestId("teacher-schedule-group-select").selectOption(world().id("group:1"));
    await page.getByTestId("teacher-schedule-filter-clear-link").click();
    await expectTeacherFieldsEmpty(page);
    await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(WHOLE_COMMUNITY);
  });

  test("an address with filters is cleared too, and everything the teacher may see shows", async ({
    page,
  }, testInfo) => {
    const group = world().id("group:1");
    await page.goto(
      `/teacher/schedule?groupId=${group}&from=${seedDay(CLEANING_DAY - 1)}&to=${seedDay(CLEANING_DAY + 1)}`,
    );
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("teacher-schedule-group-select")).toHaveValue(group);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(1);
    await page.getByTestId("teacher-schedule-filter-clear-link").click();
    await expect(page).toHaveURL(/\/teacher\/schedule$/);
    await expectTeacherFieldsEmpty(page);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(WHOLE_COMMUNITY);
    await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
  });

  test("a single date is a one-sided limit", async ({ page }, testInfo) => {
    await page.goto("/teacher/schedule");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("teacher-schedule-from-input").fill(seedDay(EVENT_DAY));
    await page.getByTestId("teacher-schedule-filter-submit-button").click();
    await expect(page).toHaveURL(new RegExp(`from=${seedDay(EVENT_DAY)}`));
    // Both groups' event tasks and the two community-wide tasks start on or after that day.
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(6);
  });

  test("Back after a filtered detail shows the address's values; after a clear it shows none", async ({
    page,
  }, testInfo) => {
    const open = (id: string) =>
      page.getByTestId(
        isMobile(testInfo.project.name)
          ? `teacher-schedule-card-open-${id}`
          : `teacher-schedule-open-${id}`,
      );
    const group = world().id("group:1");
    const from = seedDay(EVENT_DAY - 1);
    const to = seedDay(EVENT_DAY + 1);
    await page.goto(`/teacher/schedule?groupId=${group}&from=${from}&to=${to}`);
    await page.waitForLoadState("networkidle");
    await open(world().id("task:1:1")).click();
    await expect(page.getByTestId("teacher-schedule-detail-page")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("teacher-schedule-group-select")).toHaveValue(group);
    await expect(page.getByTestId("teacher-schedule-from-input")).toHaveValue(from);
    await expect(page.getByTestId("teacher-schedule-to-input")).toHaveValue(to);

    await page.getByTestId("teacher-schedule-filter-clear-link").click();
    await expect(page).toHaveURL(/\/teacher\/schedule$/);
    await expectTeacherFieldsEmpty(page);
    await open(world().id("task:1:1")).click();
    await expect(page.getByTestId("teacher-schedule-detail-page")).toBeVisible();
    await page.goBack();
    await expectTeacherFieldsEmpty(page);
  });

  test("the detail of an all-groups entry goes back to the all-groups list", async ({
    page,
  }, testInfo) => {
    await page.goto("/teacher/schedule");
    await page.waitForLoadState("networkidle");
    await page
      .getByTestId(
        isMobile(testInfo.project.name)
          ? `teacher-schedule-card-open-${world().id("task:1:3")}`
          : `teacher-schedule-open-${world().id("task:1:3")}`,
      )
      .click();
    await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText("Játszókert");
    await page.getByTestId("teacher-schedule-detail-back-link").click();
    await expect(page).toHaveURL(/\/teacher\/schedule$/);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(WHOLE_COMMUNITY);
  });

  test("the status shows its symbol and the shared word", async ({ page }, testInfo) => {
    await page.goto("/teacher/schedule");
    const item = page.getByTestId(
      isMobile(testInfo.project.name)
        ? `teacher-schedule-card-${world().id("task:1:1")}`
        : `teacher-schedule-row-${world().id("task:1:1")}`,
    );
    await expect(item).toContainText("Nyitott");
    await expect(item).not.toContainText("open");
    const icon = item.locator("svg[aria-hidden='true']").first();
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});

const ADMIN_LISTS = [
  { path: "/admin/nyilvantartasok", status: "archived", label: "records" },
  { path: "/admin/feladatok", status: "scheduled", label: "tasks" },
  { path: "/admin/jovahagyasok", status: "approved", label: "approvals" },
] as const;

test.describe("admin lists: Szűrők törlése", () => {
  for (const list of ADMIN_LISTS) {
    test(`${list.path} resets the search and the status and shows the whole list`, async ({
      page,
      browser,
    }, testInfo) => {
      await resetAndSelect(page, "super-admin");
      if (list.label === "approvals") {
        await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
          requestCancellation(other, world()),
        );
      }
      await page.goto(list.path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("admin-filter-clear-link")).toHaveText("Szűrők törlése");
      const unfiltered = await page.locator(".admin-collection li").count();
      expect(unfiltered).toBeGreaterThan(0);

      // Submitted values.
      await page.getByTestId("admin-filter-query-input").fill("zzz-nincs-ilyen");
      await page.getByTestId("admin-filter-state-select").selectOption(list.status);
      await page.getByTestId("admin-filter-submit-button").click();
      await expect(page).toHaveURL(/q=zzz-nincs-ilyen&state=/);
      await page.getByTestId("admin-filter-clear-link").click();
      await expect(page).toHaveURL(new RegExp(`${list.path}$`));
      await expect(page.getByTestId("admin-filter-query-input")).toHaveValue("");
      await expect(page.getByTestId("admin-filter-state-select")).toHaveValue("");
      await expect(page.locator(".admin-collection li")).toHaveCount(unfiltered);
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

      // A typed value that was never submitted.
      await page.getByTestId("admin-filter-query-input").fill("gépelt");
      await page.getByTestId("admin-filter-clear-link").click();
      await expect(page.getByTestId("admin-filter-query-input")).toHaveValue("");
    });
  }

  test("Back after a clear and a detail shows empty fields", async ({
    page,
    browser,
  }, testInfo) => {
    await resetAndSelect(page, "group-admin-1");
    await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
      requestCancellation(other, world()),
    );
    await page.goto("/admin/jovahagyasok?state=pending&q=a");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("admin-filter-clear-link").click();
    await expect(page).toHaveURL(/\/admin\/jovahagyasok$/);
    await expect(page.getByTestId("admin-filter-state-select")).toHaveValue("");
    await page.locator(".admin-collection li a").first().click();
    await expect(page.getByTestId("admin-back-link")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("admin-filter-query-input")).toHaveValue("");
    await expect(page.getByTestId("admin-filter-state-select")).toHaveValue("");
  });
});

/**
 * Label above field: every `label[for]` of the form ends above its control and starts at the same
 * left edge; the page never scrolls sideways.
 */
async function expectLabelsAbove(page: Page, formSelector: string, minimum: number) {
  const result = await page.evaluate((selector) => {
    const form = document.querySelector(selector);
    if (!form) return { error: `missing ${selector}` };
    const pairs = Array.from(form.querySelectorAll("label[for]")).flatMap((label) => {
      const control = document.getElementById(label.getAttribute("for") ?? "");
      if (!control) return [];
      // A tick box carries its label beside it, by design; only text fields and selects are measured.
      if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type))
        return [];
      const l = label.getBoundingClientRect();
      const c = control.getBoundingClientRect();
      return [{ text: label.textContent, gap: c.top - l.bottom, shift: Math.abs(c.left - l.left) }];
    });
    return {
      pairs,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, formSelector);
  expect(result.error).toBeUndefined();
  expect(result.pairs!.length).toBeGreaterThanOrEqual(minimum);
  for (const pair of result.pairs!) {
    expect(pair.gap, `${pair.text} is above its field`).toBeGreaterThanOrEqual(-1);
    expect(pair.shift, `${pair.text} shares its field's left edge`).toBeLessThanOrEqual(2);
  }
  expect(result.overflow).toBeLessThanOrEqual(0);
}

const FORMS = [
  {
    profile: "teacher-1",
    path: "/teacher/schedule",
    form: '[data-testid="teacher-schedule-filter-form"]',
    count: 3,
  },
  {
    profile: "super-admin",
    path: "/admin/nyilvantartasok",
    form: '[data-testid="admin-filter-form"]',
    count: 2,
  },
  {
    profile: "super-admin",
    path: "/admin/feladatok",
    form: '[data-testid="admin-filter-form"]',
    count: 2,
  },
  {
    profile: "super-admin",
    path: "/admin/jovahagyasok",
    form: '[data-testid="admin-filter-form"]',
    count: 2,
  },
  {
    profile: "parent-1",
    path: "/szulo/feladatok",
    form: '[data-testid="duty-filter-form"]',
    count: 1,
  },
  {
    profile: "super-admin",
    path: "/admin/emlekeztetok",
    form: '[data-testid="admin-reminder-filter"]',
    count: 1,
  },
  {
    profile: "group-admin-1",
    path: "/admin/nyilvantartasok/uj",
    form: '[data-testid="admin-record-create-form"]',
    count: 2,
  },
  {
    profile: "group-admin-1",
    path: "/admin/feladatok/uj",
    form: '[data-testid="admin-task-create-form"]',
    count: 2,
  },
] as const;

test.describe("labels stay above their fields on every screen size", () => {
  for (const item of FORMS) {
    for (const [name, width] of [
      ["320 px", 320],
      ["desktop", 1280],
    ] as const) {
      test(`${item.path} at ${name}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await resetAndSelect(page, item.profile);
        await page.goto(item.path);
        await page.waitForLoadState("networkidle");
        await expectLabelsAbove(page, item.form, item.count);
      });
    }
  }

  test("the filter buttons line up with the controls and stack on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await resetAndSelect(page, "super-admin");
    await page.goto("/admin/feladatok");
    await expect(page.getByTestId("admin-filter-form")).toBeVisible();
    const bottoms = await page
      .locator(
        '[data-testid="admin-filter-form"] :is(input, select, [data-testid="admin-filter-submit-button"], [data-testid="admin-filter-clear-link"])',
      )
      .evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().bottom)),
      );
    expect(new Set(bottoms).size).toBe(1);
    await page.setViewportSize({ width: 320, height: 900 });
    const tops = await page
      .locator(
        '[data-testid="admin-filter-form"] .filter-field, [data-testid="admin-filter-form"] .filter-actions',
      )
      .evaluateAll((elements) =>
        elements.map((element) => Math.round(element.getBoundingClientRect().top)),
      );
    expect(new Set(tops).size).toBe(tops.length);
  });
});

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error("The control was not reached with the Tab key");
}

test.describe("create entries are buttons and say Elem", () => {
  const entries = [
    {
      list: "/admin/nyilvantartasok",
      link: "admin-records-create-link",
      text: "Új elem",
      heading: "Új elem",
      label: "Elem típusa",
      submit: "Elem létrehozása",
    },
    {
      list: "/admin/feladatok",
      link: "admin-task-create-link",
      text: "Új feladat vagy esemény",
      heading: "Új feladat vagy esemény",
      label: "Típus",
      submit: "Létrehozás",
    },
  ] as const;

  for (const entry of entries) {
    test(`${entry.text} looks like Szűrés, is 44 px and shows the focus ring`, async ({ page }) => {
      await resetAndSelect(page, "group-admin-1");
      await page.goto(entry.list);
      const link = page.getByTestId(entry.link);
      // The page streams in behind a loading screen: measure only once the link is really shown.
      await expect(link).toBeVisible();
      await expect(link).toHaveText(entry.text);
      await expect(link).toHaveClass(/button-link/);
      const box = await link.boundingBox();
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
      const look = (locator: Locator) =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            background: style.backgroundColor,
            color: style.color,
            radius: style.borderTopLeftRadius,
          };
        });
      expect(await look(link)).toEqual(await look(page.getByTestId("admin-filter-submit-button")));
      await tabTo(page, link);
      await expect(link).toBeFocused();
      const ring = await link.evaluate((element) => {
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(ring.style).not.toBe("none");
      expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
      await link.click();
      await expect(page.getByRole("heading", { level: 1, name: entry.heading })).toBeVisible();
      await expect(page.getByLabel(entry.label)).toBeVisible();
      await expect(page.getByTestId(/-create-form-submit-button$/)).toHaveText(entry.submit);
      await expect(page.locator("main")).not.toContainText(/rekord/i);
    });
  }
});

test.describe("status symbols", () => {
  test("lists show an icon before each word, hidden from the accessibility tree", async ({
    page,
    browser,
  }, testInfo) => {
    await resetAndSelect(page, "group-admin-1");
    await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
      requestCancellation(other, world()),
    );
    await page.goto("/admin/jovahagyasok");
    const items = page.locator(".admin-collection li");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      const badge = items.nth(index).locator(".status-badge");
      await expect(badge.locator("svg[aria-hidden='true']")).toBeVisible();
      const name = await items
        .nth(index)
        .getByRole("link")
        .evaluate((element) => element.textContent?.trim());
      expect(name).toMatch(/\S$/);
    }
    // The link's accessible name is the title and the word, without any symbol text.
    await expect(
      page.getByRole("link", { name: /^Lemondási kérelem – Sütés (Függőben|Jóváhagyva)$/ }),
    ).toHaveCount(1);
  });

  test("the dropdown options of the admin lists, reminders and the parent filter carry symbols", async ({
    page,
  }) => {
    await resetAndSelect(page, "super-admin");
    const expected = {
      "/admin/nyilvantartasok": ["Minden állapot", "● Aktív", "○ Archivált"],
      "/admin/feladatok": ["Minden állapot", "◐ Nyitott", "▦ Ütemezve"],
      "/admin/jovahagyasok": ["Minden állapot", "◔ Függőben", "✓ Jóváhagyva", "✕ Elutasítva"],
    } as const;
    for (const [path, options] of Object.entries(expected)) {
      await page.goto(path);
      await expect(page.getByTestId("admin-filter-state-select").locator("option")).toHaveText([
        ...options,
      ]);
    }
    await page.goto("/admin/emlekeztetok");
    await expect(page.locator("#status option")).toHaveText([
      "Mind",
      "↻ Újrapróbálható",
      "→ Elküldve",
      "△ Elavult",
    ]);
  });

  test("the parent duty list and filter show the symbols", async ({ page }) => {
    await resetAndSelect(page, "parent-1");
    await page.goto("/szulo/feladatok");
    await expect(page.getByTestId("duty-filter-select").locator("option")).toHaveText([
      "Minden állapot",
      "● Jelentkezésre nyitott",
      "■ Betelt",
      "⊘ Nem jogosult",
      "✓ Vállalt feladat",
      "◔ Cserekérelem folyamatban",
      "◔ Lemondási kérelem folyamatban",
    ]);
    const badges = page.locator(".parent-state-badge");
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index++)
      await expect(badges.nth(index).locator("svg[aria-hidden='true']")).toBeVisible();
  });

  test("the detail pages show the symbol in the Állapot line", async ({
    page,
    browser,
  }, testInfo) => {
    await resetAndSelect(page, "group-admin-1");
    await withOtherPage(browser, testInfo.project.use.baseURL, (other) =>
      requestCancellation(other, world()),
    );
    await page.goto("/admin/jovahagyasok");
    await page.locator(".admin-collection li a").first().click();
    await expect(page).toHaveURL(/\/admin\/jovahagyasok\/[^/?]+/);
    await expect(page.locator("main .status-badge svg[aria-hidden='true']")).toBeVisible();
  });
});

test("@a11y the polished lists and forms have no serious or critical findings", async ({
  page,
}) => {
  const checks: ReadonlyArray<readonly [ProfileId, string]> = [
    ["teacher-1", "/teacher/schedule"],
    ["teacher-1", `/teacher/schedule?from=${seedDay(40)}&to=${seedDay(45)}`],
    ["super-admin", "/admin/nyilvantartasok"],
    ["super-admin", "/admin/feladatok"],
    ["super-admin", "/admin/jovahagyasok"],
    ["super-admin", "/admin/nyilvantartasok/uj"],
    ["parent-1", "/szulo/feladatok"],
  ];
  let current: ProfileId | undefined;
  for (const [profile, path] of checks) {
    if (profile !== current) {
      await resetAndSelect(page, profile);
      current = profile;
    }
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS), path).toEqual([]);
  }
});
