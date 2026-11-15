import { expect, test, type Page } from "@playwright/test";
import { bindSchema, openDatabase } from "../database/stack-support.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of "Kézbesítési hibák" and the parent's notice list for the owner's comparison with the Stitch
 * design (team practice: owner review, no automatic picture comparison). It does nothing unless `NOTICES_SCREENSHOTS`
 * names the folder to write to. Every shot first checks that the page is the intended one and not an error or denied page.
 */
const FOLDER = process.env.NOTICES_SCREENSHOTS;
test.skip(!FOLDER, "set NOTICES_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema();

const SIZES = {
  phone: { width: 390, height: 844 },
  computer: { width: 1280, height: 900 },
} as const;

async function shoot(page: Page, name: string, expectHeading: string) {
  await page.waitForLoadState("networkidle");
  const heading = await page.locator("h1").first().innerText();
  expect(heading, `${name}: the page is the intended one`).toBe(expectHeading);
  const body = await page.locator("body").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|This page could not be found|Application error|Internal Server Error/,
  );
  for (const [label, size] of Object.entries(SIZES)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${FOLDER}/${name}-${label}.png`, fullPage: true });
  }
}

test("screenshots of Kézbesítési hibák in each state and the notice list", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  const db = await openDatabase();
  try {
    await bindSchema(db, world().schema);
    await signInAs(page, world().account("super-admin"));

    await page.goto("/admin/emlekeztetok");
    await shoot(page, "1-kezbesitesi-hibak-ures", "Kézbesítési hibák");

    await db.query("delete from email_attempts");
    await db.query(
      `update email_deliveries set status = 'failed', round = 1, attempts_in_round = 3,
              last_attempt_at = now(), finished_at = now()`,
    );
    await db.query(
      `insert into email_attempts (delivery_id, round, attempt_number, outcome, reason_code)
       select d.id, 1, n, 'failed', case when d.id = (select id from email_deliveries order by id limit 1) then 'mail_rejected' else 'mail_unavailable' end
         from email_deliveries d, generate_series(1, 3) n`,
    );
    await page.setViewportSize(SIZES.computer);
    await page.goto("/admin/emlekeztetok");
    await shoot(page, "2-kezbesitesi-hibak-lista", "Kézbesítési hibák");

    const submit = page
      .locator('[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]')
      .first();
    await page.setViewportSize(SIZES.computer);
    await db.query("update email_deliveries set round = 2");
    await submit.click();
    await expect(page.getByText("A lista időközben megváltozott")).toBeVisible();
    await shoot(page, "3-kezbesitesi-hibak-elavult", "Kézbesítési hibák");

    await page.setViewportSize(SIZES.computer);
    await db.query("update email_deliveries set round = 1");
    await page.goto("/admin/emlekeztetok");
    await page.waitForLoadState("networkidle");
    await page
      .locator('[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]')
      .first()
      .click();
    await expect(page.getByText("Az újrapróbálás elindult.")).toBeVisible();
    await shoot(page, "4-kezbesitesi-hibak-siker", "Kézbesítési hibák");

    await page.setViewportSize(SIZES.computer);
    await page.goto("/admin/emlekeztetok");
    await page.waitForLoadState("networkidle");
    await db.query("update email_deliveries set status = 'sent'");
    await page
      .locator('[data-testid^="admin-reminder-retry-"][data-testid$="-submit-button"]')
      .first()
      .click();
    await expect(page.getByText("Ehhez nincs már sikertelen e-mail.")).toBeVisible();
    await shoot(page, "5-kezbesitesi-hibak-nincs-ujraprobalhato", "Kézbesítési hibák");

    await signInAs(page, world().account("parent-1"));
    await page.goto("/szulo/ertesitesek");
    await shoot(page, "6-ertesitesek", "Értesítések");
  } finally {
    await db.end();
  }
});
