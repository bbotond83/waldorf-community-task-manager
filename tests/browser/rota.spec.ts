import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, signInAs, bindSeededSchema } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

/** The role walk of the calendar and rota screens (U2): each new screen as each role, drafts hidden from parents. */

const denied = (page: Page) => page.getByText("Nincs jogosultság", { exact: true }).first();

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
}

test("Tanév: the super admin sees the year, adds and removes a break week, and is told why a change is refused", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/tanev");
  await expect(page.getByRole("heading", { name: "Tanév", exact: true, level: 1 })).toBeFocused();
  await expect(page.getByTestId("admin-school-year-form")).toBeVisible();
  const breaks = page.locator('li[data-testid^="admin-break-week-"]');
  await expect(breaks).toHaveCount(4);
  await noSidewaysScroll(page);
  await expectNoSeriousViolations(page);

  // A day that is not a Monday is refused with its reason.
  await page.getByTestId("admin-break-add-start").fill("2026-09-02");
  await page.getByTestId("admin-break-add-form-submit-button").click();
  await expect(page.getByTestId("admin-break-add-form-state-validation")).toContainText(
    "hétfője legyen",
  );
  await expect(breaks).toHaveCount(4);

  await page.getByTestId("admin-break-add-start").fill("2027-05-24");
  await page.getByTestId("admin-break-add-label").fill("Pünkösdi szünet");
  await page.getByTestId("admin-break-add-form-submit-button").click();
  await expect(page.getByTestId("admin-break-add-form-state-success")).toBeVisible();
  await expect(breaks).toHaveCount(5);
  await expect(page.getByTestId("admin-break-week-2027-05-24")).toContainText("Pünkösdi szünet");

  await page.getByTestId("admin-break-remove-2027-05-24-submit-button").click();
  await expect(breaks).toHaveCount(4);

  // A changeover date before the year starts is refused.
  await page.getByTestId("admin-school-year-changeover").fill("2026-08-01");
  await page.getByTestId("admin-school-year-form-submit-button").click();
  await expect(page.getByTestId("admin-school-year-form-state-validation")).toBeVisible();
  await expect(page.getByTestId("admin-school-year-changeover-error")).toContainText(
    "nem lehet a tanév kezdete előtt",
  );
  await page.getByTestId("admin-school-year-changeover").fill("2027-07-15");
  await page.getByTestId("admin-school-year-form-submit-button").click();
  await expect(page.getByTestId("admin-school-year-form-state-success")).toBeVisible();
});

test("Beosztás tervezése: draft, change, discard, publish; parents and teachers see nothing until it is published", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beosztas");
  await expect(page.getByTestId("admin-rota-no-plan")).toBeVisible();
  await noSidewaysScroll(page);
  await expectNoSeriousViolations(page);

  await page.getByTestId("admin-rota-draft-form-submit-button").click();
  await expect(page.getByTestId("admin-rota-weeks")).toBeVisible();
  await expect(page.getByTestId("admin-rota-head")).toContainText("Tervezet");
  await expectNoSeriousViolations(page);

  // A draft is invisible to a parent and to a teacher.
  for (const tag of ["parent-1", "teacher-1"]) {
    await signInAs(page, world().account(tag));
    await page.goto(tag === "teacher-1" ? "/teacher/beosztas" : "/szulo/beosztas");
    await expect(page.getByTestId("rota-empty")).toHaveText("Még nincs közzétett beosztás.");
    await expect(page.getByTestId("rota-week-list")).toHaveCount(0);
  }

  // Empty one week: publishing is then blocked and says which week.
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beosztas");
  const firstRow = page
    .locator('tr[data-testid^="admin-rota-week-"]:not(.admin-rota-row-break)')
    .first();
  await firstRow.locator("select").selectOption("");
  await firstRow.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByTestId("admin-rota-blockers")).toBeVisible();
  await expect(page.getByTestId("admin-rota-publish-form")).toHaveCount(0);
  await expect(page.getByTestId("admin-rota-changed-weeks")).toContainText(
    "1 hét kézzel módosítva",
  );

  // Discard returns to the start; make the draft again.
  await page.getByTestId("admin-rota-discard-form-submit-button").click();
  await expect(page.getByTestId("admin-rota-no-plan")).toBeVisible();
  await page.getByTestId("admin-rota-draft-form-submit-button").click();
  await expect(page.getByTestId("admin-rota-publish-form")).toBeVisible();

  await page.getByTestId("admin-rota-publish-form-submit-button").click();
  await expect(page.getByTestId("admin-rota-head")).toContainText("Közzétéve");
  await expect(page.getByTestId("admin-rota-publish-form")).toHaveCount(0);
  await expectNoSeriousViolations(page);
});

test("the published rota: parent overview, own duty card, other families refused, teacher overview", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/beosztas");
  await page.getByTestId("admin-rota-draft-form-submit-button").click();
  await page.getByTestId("admin-rota-publish-form-submit-button").click();
  await expect(page.getByTestId("admin-rota-head")).toContainText("Közzétéve");

  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/beosztas");
  await expect(page.getByRole("heading", { name: "Beosztás", level: 1 })).toBeFocused();
  await expect(page.locator(".parent-rota-own").first()).toBeAttached();
  await noSidewaysScroll(page);
  await expectNoSeriousViolations(page);
  await expect(page.getByText("Csere", { exact: false })).toHaveCount(0);

  // The family filter keeps only the caller's own weeks.
  await page.getByTestId("rota-filter-select").selectOption("sajat");
  await page.getByTestId("rota-filter-submit-button").click();
  await expect(page.locator(".parent-rota-week:not(.parent-rota-week-own)")).toHaveCount(0);

  const href = await page.locator('a[href^="/szulo/beosztas/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByTestId("rota-card-no-fixed-day")).toContainText("nincs kijelölt napja");
  await expect(page.getByTestId("rota-card-details")).toContainText("Család");
  await expect(page.getByText(/csere|lemondás/i)).toHaveCount(0);
  await expectNoSeriousViolations(page);

  // Another family and a made-up id both get the refusal, never a card.
  await signInAs(page, world().account("parent-2"));
  await page.goto(href!);
  await expect(page.getByTestId("rota-card-page").getByTestId("rota-denied")).toBeVisible();
  await page.goto("/szulo/beosztas/00000000-0000-4000-8000-000000000000");
  await expect(page.getByTestId("rota-denied")).toBeVisible();

  // The super admin reads the same card in the admin area, read-only (BR24.2); nobody else opens it there.
  const adminCard = `/admin/beosztas/${href!.split("/").pop()}`;
  await signInAs(page, world().account("super-admin"));
  await page.goto(adminCard);
  await expect(page.getByTestId("rota-card-details")).toContainText("Család");
  await expect(page.getByRole("link", { name: "Vissza a beosztáshoz" })).toHaveAttribute(
    "href",
    "/admin/beosztas",
  );
  await expect(page.getByTestId("rota-card-page").getByRole("button")).toHaveCount(0);
  await expectNoSeriousViolations(page);
  for (const tag of ["parent-1", "group-admin-1", "teacher-1"]) {
    await signInAs(page, world().account(tag));
    await page.goto(adminCard);
    await expect(denied(page), `${tag} may not open ${adminCard}`).toBeVisible();
  }

  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/beosztas");
  await expect(page.getByTestId("rota-table")).toBeAttached();
  await expect(page.locator('a[href^="/szulo/beosztas/"]')).toHaveCount(0);
  await expectNoSeriousViolations(page);
});

test("the calendar and planning screens refuse every role but the super admin", async ({
  page,
}) => {
  for (const tag of ["parent-1", "group-admin-1", "teacher-1"]) {
    await signInAs(page, world().account(tag));
    for (const route of ["/admin/tanev", "/admin/beosztas"]) {
      await page.goto(route);
      await expect(denied(page), `${tag} may not open ${route}`).toBeVisible();
    }
  }
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/szulo/beosztas");
  await expect(denied(page)).toBeVisible();
});
