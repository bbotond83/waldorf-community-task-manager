import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type ProfileId = "parent-local" | "group-admin-local" | "super-admin-local";

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

test.describe("parent: notifications stay under Értesítések", () => {
  test.beforeEach(async ({ page }) => resetAndSelect(page, "parent-local"));

  test("the menu lists Értesítések first and the parent lands there", async ({ page }) => {
    await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
    const links = page.getByTestId("app-shell-navigation").getByRole("link");
    await expect(links).toHaveText(["Értesítések", "Feladatok"]);
    await expect(page.getByTestId("app-shell-navigation-parent-notifications")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("notification journey: open, menu stays, back link, read and greyed, tick and reload", async ({
    page,
  }) => {
    const card = page.getByTestId("notification-card-notice-7-day");
    await expect(card).not.toHaveClass(/notification-card-read/);
    await expect(card).toContainText("Olvasatlan");

    // Opening the card goes to the task page with the notification as context.
    await page.getByTestId("notification-link-notice-7-day").click();
    await expect(page).toHaveURL(/\/szulo\/feladatok\/duty-assigned\?ertesites=notice-7-day$/);
    await expect(page.getByTestId("duty-detail-page")).toBeVisible();
    // The menu keeps Értesítések as the current item, not Feladatok.
    await expect(page.getByTestId("app-shell-navigation-parent-notifications")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("app-shell-navigation-parent-duties")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    const back = page.getByTestId("duty-detail-back-link");
    await expect(back).toHaveText("Vissza az értesítésekhez");
    await expect(back).toHaveAttribute("href", "/szulo/ertesitesek");
    // Opening marks the notification read once the page has really been shown.
    await page.waitForLoadState("networkidle");

    await back.click();
    await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
    const read = page.getByTestId("notification-card-notice-7-day");
    await expect(read).toHaveClass(/notification-card-read/);
    await expect(read).toContainText("Olvasott");
    await expect(page.getByTestId("notification-read-checkbox-notice-7-day")).toBeChecked();
    await expect(page.getByTestId("notification-read-checkbox-notice-7-day")).toBeDisabled();
    // The read card is visibly greyer than an unread one.
    const unread = page.getByTestId("notification-card-notice-24-hour");
    await expect(unread).not.toHaveClass(/notification-card-read/);
    const background = (locator: typeof read) =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(await background(read)).not.toBe(await background(unread));

    // Ticking another notification marks it read, and the state survives a reload.
    await page.waitForLoadState("networkidle");
    await page.getByTestId("notification-read-checkbox-notice-24-hour").check();
    await expect(page.getByTestId("notification-state-notice-24-hour-success")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("notification-card-notice-24-hour")).toHaveClass(
      /notification-card-read/,
    );
    await expect(page.getByTestId("notification-read-checkbox-notice-24-hour")).toBeChecked();
  });

  test("a task opened from the task list keeps Feladatok and does not mark anything read", async ({
    page,
  }) => {
    await page.goto("/szulo/feladatok");
    await page.getByTestId("duty-open-duty-assigned").click();
    await expect(page.getByTestId("app-shell-navigation-parent-duties")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("duty-detail-back-link")).toHaveText("Vissza a feladatokhoz");
    await page.waitForLoadState("networkidle");
    await page.goto("/szulo/ertesitesek");
    await expect(page.getByTestId("notification-card-notice-7-day")).not.toHaveClass(
      /notification-card-read/,
    );
  });

  test("an unknown or foreign notification id is ignored", async ({ page }) => {
    for (const id of ["notice-unknown", "notice-24-hour", "notice-stale"]) {
      await page.goto(`/szulo/feladatok/duty-assigned?ertesites=${id}`);
      await expect(page).toHaveURL(/\/szulo\/feladatok\/duty-assigned$/);
      await expect(page.getByTestId("duty-detail-back-link")).toHaveText("Vissza a feladatokhoz");
    }
    await page.goto("/szulo/ertesitesek");
    await expect(page.getByTestId("notification-card-notice-24-hour")).not.toHaveClass(
      /notification-card-read/,
    );
  });

  test("@a11y the notification list, task page and request page have no serious findings", async ({
    page,
  }) => {
    for (const path of [
      "/szulo/ertesitesek",
      "/szulo/feladatok/duty-assigned?ertesites=notice-7-day",
      "/szulo/feladatok/duty-assigned/csere",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter(SERIOUS), path).toEqual([]);
    }
    // A read (greyed) card is checked as well.
    await page.goto("/szulo/ertesitesek");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("notification-read-checkbox-notice-24-hour").check();
    await expect(page.getByTestId("notification-state-notice-24-hour-success")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS)).toEqual([]);
  });
});

test.describe("parent: a request that is waiting", () => {
  test.beforeEach(async ({ page }) => resetAndSelect(page, "parent-local"));

  test("pending request journey: submit, notice, no duplicate, links hidden", async ({ page }) => {
    await page.goto("/szulo/feladatok/duty-assigned");
    await expect(page.getByTestId("swap-request-link")).toBeVisible();
    await expect(page.getByTestId("pending-request-notice")).toHaveCount(0);

    await page.goto("/szulo/feladatok/duty-assigned/csere");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("swap-reason-input").fill("Családi egyeztetés szükséges.");
    await page.getByTestId("swap-request-form-submit-button").click();
    // The confirmation stays, and the form is replaced by the notice and a link back.
    await expect(page.getByTestId("swap-request-form-state-success")).toContainText(
      "függő állapotba",
    );
    await expect(page.getByTestId("swap-pending-panel")).toContainText("Cserekérelem folyamatban");
    await expect(page.getByTestId("swap-request-form-submit-button")).toHaveCount(0);
    await expect(page.getByTestId("swap-reason-input")).toHaveCount(0);

    await page.getByTestId("swap-pending-panel-back-link").click();
    await expect(page).toHaveURL(/\/szulo\/feladatok\/duty-assigned$/);
    await expect(page.getByTestId("pending-swap-notice")).toHaveText("Cserekérelem folyamatban");
    await expect(page.getByTestId("swap-request-link")).toHaveCount(0);
    await expect(page.getByTestId("cancellation-request-link")).toHaveCount(0);

    // Both request pages show the notice instead of a form, so nothing can be sent twice.
    for (const path of ["csere", "lemondas"]) {
      await page.goto(`/szulo/feladatok/duty-assigned/${path}`);
      await expect(page.getByTestId("pending-request-notice")).toBeVisible();
      await expect(page.getByRole("button", { name: /elküldése/ })).toHaveCount(0);
      await expect(page.locator('textarea[name="reason"]')).toHaveCount(0);
    }
    // The task list and the task page use the same state word.
    await page.goto("/szulo/feladatok");
    await expect(page.getByTestId("duty-card-duty-assigned")).toContainText(
      "Cserekérelem folyamatban",
    );
  });

  test("a waiting cancellation shows its own notice", async ({ page }) => {
    await page.goto("/szulo/feladatok/duty-assigned/lemondas");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
    await page.getByTestId("cancellation-request-form-submit-button").click();
    await expect(page.getByTestId("cancellation-request-form-state-success")).toBeVisible();
    await expect(page.getByTestId("cancellation-pending-panel")).toContainText(
      "Lemondási kérelem folyamatban",
    );
    await page.goto("/szulo/feladatok/duty-assigned");
    await expect(page.getByTestId("pending-cancellation-notice")).toBeVisible();
    await expect(page.getByTestId("cancellation-request-link")).toHaveCount(0);
  });
});

const detailPages = [
  ["/admin/nyilvantartasok/family-feny", /\/admin\/nyilvantartasok$/, "group-admin-local"],
  ["/admin/feladatok/task-kert", /\/admin\/feladatok$/, "group-admin-local"],
  ["/admin/jovahagyasok/approval-csere", /\/admin\/jovahagyasok$/, "group-admin-local"],
  ["/admin/archivum/year-2026", /\/admin\/archivum$/, "super-admin-local"],
  ["/admin/nyilvantartasok/uj", /\/admin\/nyilvantartasok$/, "group-admin-local"],
  ["/admin/feladatok/uj", /\/admin\/feladatok$/, "group-admin-local"],
] as const;

test.describe("admin: the way back", () => {
  for (const [path, listUrl, profile] of detailPages) {
    test(`${path} has a back link that returns to its list`, async ({ page }) => {
      await resetAndSelect(page, profile);
      await page.goto(path);
      const back = page.getByTestId("admin-back-link");
      await expect(back).toBeVisible();
      await expect(back).toContainText("Vissza");
      const box = await back.boundingBox();
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
      await back.click();
      await expect(page).toHaveURL(listUrl);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("the back link keeps the list's filter", async ({ page }) => {
    await resetAndSelect(page, "group-admin-local");
    await page.goto("/admin/jovahagyasok?state=pending");
    await page.locator(".admin-collection li a").first().click();
    await page.getByTestId("admin-back-link").click();
    await expect(page).toHaveURL(/\/admin\/jovahagyasok\?state=pending$/);
    await expect(page.getByTestId("admin-filter-state-select")).toHaveValue("pending");
  });

  test("a successful create shows the confirmation with a link back to the list", async ({
    page,
  }) => {
    await resetAndSelect(page, "group-admin-local");
    await page.goto("/admin/feladatok/uj");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("admin-task-title-input").fill("Őszi kertészkedés");
    await page.getByTestId("admin-task-create-form-submit-button").click();
    await expect(page.getByTestId("admin-task-create-form-state-success")).toBeVisible();
    await page.getByTestId("admin-task-create-form-success-link").click();
    await expect(page).toHaveURL(/\/admin\/feladatok$/);
  });
});

test.describe("admin: filters offer only matching statuses", () => {
  const lists = [
    ["/admin/nyilvantartasok", ["Minden állapot", "● Aktív", "○ Archivált"]],
    ["/admin/feladatok", ["Minden állapot", "◐ Nyitott", "▦ Ütemezve"]],
    ["/admin/jovahagyasok", ["Minden állapot", "◔ Függőben", "✓ Jóváhagyva", "✕ Elutasítva"]],
  ] as const;

  for (const [path, labels] of lists) {
    test(`${path} offers ${labels.slice(1).join(", ")}`, async ({ page }) => {
      await resetAndSelect(page, "super-admin-local");
      await page.goto(path);
      const select = page.getByTestId("admin-filter-state-select");
      await expect(select.locator("option")).toHaveText([...labels]);
      // Every offered status answers with a list or an explicit empty state, by user action only.
      for (const label of labels.slice(1)) {
        await page.goto(path);
        await page.getByTestId("admin-filter-state-select").selectOption({ label });
        await page.getByTestId("admin-filter-submit-button").click();
        await expect(page).toHaveURL(/state=/);
        const items = page.locator(".admin-collection li");
        const empty = page.getByText(/nincs találata|Nincs a szűrésnek megfelelő/);
        await expect(items.first().or(empty.first())).toBeVisible();
        if (label !== "✕ Elutasítva") await expect(items.first()).toBeVisible();
      }
    });
  }

  test("approved requests can be found with Jóváhagyva", async ({ page }) => {
    await resetAndSelect(page, "group-admin-local");
    await page.goto("/admin/jovahagyasok");
    await page.getByTestId("admin-filter-state-select").selectOption({ label: "✓ Jóváhagyva" });
    await page.getByTestId("admin-filter-submit-button").click();
    await expect(page.locator(".admin-collection li").first()).toContainText("Jóváhagyva");
  });

  test("an old filter link shows the whole list with a note, not an error", async ({ page }) => {
    await resetAndSelect(page, "group-admin-local");
    await page.goto("/admin/feladatok?state=pending");
    await expect(page.getByTestId("admin-filter-unknown-note")).toBeVisible();
    await expect(page.locator(".admin-collection li").first()).toBeVisible();
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
  });
});

test.describe("admin: empty forms and technical text", () => {
  test("an empty submit of both new forms shows the message next to the field", async ({
    page,
  }) => {
    await resetAndSelect(page, "group-admin-local");
    for (const [path, form, field] of [
      ["/admin/nyilvantartasok/uj", "admin-record-create-form", "admin-record-title-input"],
      ["/admin/feladatok/uj", "admin-task-create-form", "admin-task-title-input"],
    ] as const) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.getByTestId(`${form}-submit-button`).click();
      const summary = page.getByTestId(`${form}-state-validation`);
      await expect(summary).toContainText("A megnevezés megadása kötelező.");
      await expect(summary).toBeFocused();
      await expect(page.getByTestId(`${field}-error`)).toHaveText(
        "A megnevezés megadása kötelező.",
      );
      await expect(page.getByTestId(field)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByTestId(`${form}-state-success`)).toHaveCount(0);
    }
  });

  test("technical text is only inside Fejlesztői részletek, which opens on request", async ({
    page,
  }) => {
    await resetAndSelect(page, "super-admin-local");
    for (const [path, texts] of [
      ["/admin/feladatok/task-kert", ["Verzió:", "Kapacitási helyzet"]],
      ["/admin/nyilvantartasok/family-feny", ["Verzió:"]],
      ["/admin/emlekeztetok", ["Korreláció", "corr-lampas-01"]],
      ["/admin/adatvedelem", ["Forgatókönyv"]],
      ["/admin/import", ["Ellenőrzési forgatókönyv"]],
      ["/admin/beallitasok", ["Ellenőrzési forgatókönyv"]],
    ] as const) {
      await page.goto(path);
      const details = page.getByTestId("developer-details");
      await expect(details, path).toBeVisible();
      await expect(details.locator("summary")).toHaveText("Fejlesztői részletek");
      for (const text of texts) {
        await expect(
          page.getByText(text, { exact: false }).first(),
          `${path} ${text}`,
        ).toBeHidden();
      }
      await page.getByTestId("developer-details-toggle").click();
      for (const text of texts) {
        await expect(
          page.getByText(text, { exact: false }).first(),
          `${path} ${text}`,
        ).toBeVisible();
      }
    }
  });

  test("@a11y changed admin pages have no serious findings", async ({ page }) => {
    await resetAndSelect(page, "super-admin-local");
    for (const path of [
      "/admin/feladatok/task-kert",
      "/admin/nyilvantartasok/uj",
      "/admin/jovahagyasok?state=approved",
      "/admin/emlekeztetok",
      "/admin/adatvedelem",
    ]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter(SERIOUS), path).toEqual([]);
    }
    await page.goto("/admin/nyilvantartasok/uj");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("admin-record-create-form-submit-button").click();
    await expect(page.getByTestId("admin-record-title-input-error")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS)).toEqual([]);
  });
});
