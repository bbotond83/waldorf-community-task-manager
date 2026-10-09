import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Locator } from "@playwright/test";

type ProfileId =
  "parent-local" | "kindergarten-teacher-local" | "group-admin-local" | "super-admin-local";

async function resetAndSelect(page: Page, profile: ProfileId) {
  await page.goto("/");
  await page.request.post("/api/synthetic/reset", {
    headers: { origin: new URL(page.url()).origin },
  });
  await page.goto("/");
  if (
    await page
      .getByTestId("app-shell-switch-profile-button")
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId("app-shell-switch-profile-button").click();
  }
  await page.getByTestId(`profile-selector-${profile}-button`).click();
}

const SERIOUS = ({ impact }: { impact?: string | null }) =>
  impact === "serious" || impact === "critical";

const isMobile = (name: string) => name === "mobile-chrome";

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
  test.beforeEach(async ({ page }) => resetAndSelect(page, "kindergarten-teacher-local"));

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
      "Minden csoport",
      "Tölgyfa csoport",
      "Napraforgó csoport",
    ]);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(3);
  });

  test("a typed, unsubmitted value is cleared and focus moves to the heading", async ({
    page,
  }, testInfo) => {
    await page.goto("/teacher/schedule");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("teacher-schedule-from-input").fill("2026-08-14");
    await page.getByTestId("teacher-schedule-group-select").selectOption("group-sunflower");
    await page.getByTestId("teacher-schedule-filter-clear-link").click();
    await expectTeacherFieldsEmpty(page);
    await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(3);
  });

  test("an address with filters is cleared too, and everything the teacher may see shows", async ({
    page,
  }, testInfo) => {
    await page.goto("/teacher/schedule?groupId=group-sunflower&from=2026-08-17&to=2026-08-19");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("teacher-schedule-group-select")).toHaveValue("group-sunflower");
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(1);
    await page.getByTestId("teacher-schedule-filter-clear-link").click();
    await expect(page).toHaveURL(/\/teacher\/schedule$/);
    await expectTeacherFieldsEmpty(page);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeFocused();
  });

  test("a single date is a one-sided limit", async ({ page }, testInfo) => {
    await page.goto("/teacher/schedule");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("teacher-schedule-from-input").fill("2026-08-14");
    await page.getByTestId("teacher-schedule-filter-submit-button").click();
    await expect(page).toHaveURL(/from=2026-08-14/);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(2);
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
    await page.goto("/teacher/schedule?groupId=group-oak&from=2026-08-13&to=2026-08-15");
    await page.waitForLoadState("networkidle");
    await open("schedule-garden").click();
    await expect(page.getByTestId("teacher-schedule-detail-page")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("teacher-schedule-group-select")).toHaveValue("group-oak");
    await expect(page.getByTestId("teacher-schedule-from-input")).toHaveValue("2026-08-13");
    await expect(page.getByTestId("teacher-schedule-to-input")).toHaveValue("2026-08-15");

    await page.getByTestId("teacher-schedule-filter-clear-link").click();
    await expectTeacherFieldsEmpty(page);
    await open("schedule-garden").click();
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
          ? "teacher-schedule-card-open-schedule-coverage"
          : "teacher-schedule-open-schedule-coverage",
      )
      .click();
    await expect(page.getByTestId("teacher-schedule-detail-fields")).toContainText(
      "Napraforgó csoport",
    );
    await page.getByTestId("teacher-schedule-detail-back-link").click();
    await expect(page).toHaveURL(/\/teacher\/schedule$/);
    await expect(scheduleItems(page, testInfo.project.name)).toHaveCount(3);
  });

  test("the status shows its symbol and the shared word", async ({ page }, testInfo) => {
    await page.goto("/teacher/schedule");
    const item = page.getByTestId(
      isMobile(testInfo.project.name)
        ? "teacher-schedule-card-schedule-garden"
        : "teacher-schedule-row-schedule-garden",
    );
    await expect(item).toContainText("Ütemezve");
    await expect(item).not.toContainText("Ütemezett");
    const icon = item.locator("svg[data-status-icon='calendar']");
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
    }) => {
      await resetAndSelect(page, "super-admin-local");
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

  test("Back after a clear and a detail shows empty fields", async ({ page }) => {
    await resetAndSelect(page, "group-admin-local");
    await page.goto("/admin/jovahagyasok?state=pending&q=a");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("admin-filter-clear-link").click();
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
    profile: "kindergarten-teacher-local",
    path: "/teacher/schedule",
    form: '[data-testid="teacher-schedule-filter-form"]',
    count: 3,
  },
  {
    profile: "super-admin-local",
    path: "/admin/nyilvantartasok",
    form: '[data-testid="admin-filter-form"]',
    count: 2,
  },
  {
    profile: "super-admin-local",
    path: "/admin/feladatok",
    form: '[data-testid="admin-filter-form"]',
    count: 2,
  },
  {
    profile: "super-admin-local",
    path: "/admin/jovahagyasok",
    form: '[data-testid="admin-filter-form"]',
    count: 2,
  },
  {
    profile: "parent-local",
    path: "/szulo/feladatok",
    form: '[data-testid="duty-filter-form"]',
    count: 1,
  },
  {
    profile: "super-admin-local",
    path: "/admin/emlekeztetok",
    form: '[data-testid="admin-reminder-filter"]',
    count: 1,
  },
  {
    profile: "group-admin-local",
    path: "/admin/nyilvantartasok/uj",
    form: '[data-testid="admin-record-create-form"]',
    count: 2,
  },
  {
    profile: "group-admin-local",
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
    await resetAndSelect(page, "super-admin-local");
    await page.goto("/admin/feladatok");
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
      await resetAndSelect(page, "group-admin-local");
      await page.goto(entry.list);
      const link = page.getByTestId(entry.link);
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
  }) => {
    await resetAndSelect(page, "group-admin-local");
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
      page.getByRole("link", { name: /^Feladatcsere-kérelem (Függőben|Jóváhagyva)$/ }),
    ).toHaveCount(1);
  });

  test("the dropdown options of the admin lists, reminders and the parent filter carry symbols", async ({
    page,
  }) => {
    await resetAndSelect(page, "super-admin-local");
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
    await resetAndSelect(page, "parent-local");
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

  test("the detail pages show the symbol in the Állapot line", async ({ page }) => {
    await resetAndSelect(page, "group-admin-local");
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
    ["kindergarten-teacher-local", "/teacher/schedule"],
    ["kindergarten-teacher-local", "/teacher/schedule?from=2026-09-01&to=2026-09-05"],
    ["super-admin-local", "/admin/nyilvantartasok"],
    ["super-admin-local", "/admin/feladatok"],
    ["super-admin-local", "/admin/jovahagyasok"],
    ["super-admin-local", "/admin/nyilvantartasok/uj"],
    ["parent-local", "/szulo/feladatok"],
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
