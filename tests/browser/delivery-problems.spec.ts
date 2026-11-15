import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type pg from "pg";
import { bindSchema, openDatabase } from "../database/stack-support.ts";
import { bindSeededSchema, SERIOUS, signInAs } from "./support/seeded-schema.ts";

/**
 * "Kézbesítési hibák" (U5): the super admin's list of emails that could not be sent and of the failed timed checks, as
 * the Stitch design shows it. Failed deliveries are made in the seeded schema through the owner connection, because the
 * mail command that would fail them is not part of the web app. The page must show a reason in words and no address,
 * name, phone number or mail-server code.
 */
const world = bindSeededSchema();
let db: pg.Client;

test.beforeEach(async () => {
  await world().reseed();
  db = await openDatabase();
  await bindSchema(db, world().schema);
  await db.query(
    "delete from email_attempts where delivery_id in (select id from email_deliveries)",
  );
  await db.query(
    `update email_deliveries set status = 'failed', round = 1, attempts_in_round = 3,
            last_attempt_at = now(), finished_at = now()`,
  );
  await db.query(
    `insert into email_attempts (delivery_id, round, attempt_number, outcome, reason_code)
     select d.id, 1, n, 'failed', 'mail_unavailable' from email_deliveries d, generate_series(1, 3) n`,
  );
});

test.afterEach(async () => {
  await db.end();
});

async function open(page: Page) {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/emlekeztetok");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("admin-reminder-list")).toBeVisible();
}

test("shows failed email groups with the reason in words and no personal data", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Kézbesítési hibák", level: 1 })).toBeVisible();
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  expect(text).toContain("a levelezőszerver nem elérhető");
  expect(text).toContain("Sikertelen");
  expect(text).toContain("Utolsó próbálkozás");
  expect(text).not.toMatch(/@|\+36|SMTP|mail_unavailable|5\d\d /);
  await expect(page.getByTestId("admin-check-problems")).toContainText("Hibás");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("Újrapróbálás restarts the group and the next visit no longer lists it", async ({ page }) => {
  await open(page);
  const forms = page.locator(
    '[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]',
  );
  const before = await forms.count();
  expect(before).toBeGreaterThan(0);
  const box = await forms.first().boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await forms.first().click();
  await expect(page.getByText("Az újrapróbálás elindult.")).toBeVisible();
  await page.goto("/admin/emlekeztetok");
  await expect(forms).toHaveCount(before - 1);
});

test("keeps stale and nothing-to-retry apart", async ({ page }) => {
  await open(page);
  // Another admin retried and one more try failed: the shown try counts are out of date.
  await db.query("update email_deliveries set round = 2");
  await page
    .locator('[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(
    page.getByText("A lista időközben megváltozott; töltse be újra az oldalt."),
  ).toBeVisible();

  await page.goto("/admin/emlekeztetok");
  await page.waitForLoadState("networkidle");
  await db.query("update email_deliveries set status = 'sent'");
  await page
    .locator('[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]')
    .first()
    .click();
  await expect(page.getByText("Ehhez nincs már sikertelen e-mail.")).toBeVisible();
});

test("works from the keyboard", async ({ page }) => {
  await open(page);
  const button = page
    .locator('[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]')
    .first();
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Az újrapróbálás elindult.")).toBeVisible();
});

test("fits a phone: no sideways scroll, check cards instead of the table, 44 px actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(".admin-delivery-table-wrapper")).toBeHidden();
  await expect(page.locator(".admin-delivery-check-cards")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("a group admin and a parent open no failure content", async ({ page }) => {
  for (const tag of ["group-admin-1", "parent-1"]) {
    await signInAs(page, world().account(tag));
    await page.goto("/admin/emlekeztetok");
    await expect(page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();
    await expect(page.getByTestId("admin-reminder-page")).toHaveCount(0);
  }
});
