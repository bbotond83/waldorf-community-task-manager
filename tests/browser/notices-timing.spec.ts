import { expect, test, type Page } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount } from "../../scripts/db/seed/index.ts";
import { bindSchema, openDatabase } from "../database/stack-support.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the parent's notice list, "Kézbesítési hibák" and the daily run on the 30-family set (NFR9.1, NFR9.6). It does
 * nothing unless `NOTICES_TIMING` is set, so ordinary runs never fill the schema with the large set.
 */
test.skip(
  !process.env.NOTICES_TIMING,
  "set NOTICES_TIMING=1 to time the notice pages and the daily run",
);

const world = bindSeededSchema({ seed: false });

test.beforeAll(async () => {
  const schema = world().schema;
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
  await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "large" });
});

async function timed(page: Page, path: string): Promise<number> {
  const started = Date.now();
  await page.goto(path, { waitUntil: "load" });
  return Date.now() - started;
}

/**
 * The large seed holds only a few notices, so a realistic load is added first: 60 notices for every parent with an
 * account (more than the 50 of NFR9.2), each with a failed email and three failed tries, spread over the tasks and two
 * kinds so the failure list has many groups. Everything is invented and goes through the owner connection.
 */
async function addLoad(schema: string): Promise<void> {
  const db = await openDatabase();
  try {
    await bindSchema(db, schema);
    await db.query(`
      insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
      select p.organization_id, p.id, k.kind, 'task', t.id, t.id, t.starts_at, 'timing:' || p.id || ':' || k.kind || ':' || t.id || ':' || n
        from parents p
        cross join (values ('sign_up_confirmed'), ('place_removed')) as k(kind)
        cross join lateral (select id, starts_at from tasks order by id limit 30) t
        cross join generate_series(1, 1) n
       where p.account_id is not null`);
    await db.query(`
      insert into email_deliveries (organization_id, notice_id, parent_id, kind, target_type, target_id, item_date, status,
                                    attempts_in_round, last_attempt_at, finished_at)
      select n.organization_id, n.id, n.parent_id, n.kind, n.target_type, n.target_ref,
             (n.task_starts_at at time zone 'Europe/Budapest')::date, 'failed', 3, now(), now()
        from notifications n
       where n.dedupe_key like 'timing:%'`);
    await db.query(`
      insert into email_attempts (delivery_id, round, attempt_number, outcome, reason_code)
      select d.id, 1, a, 'failed', 'mail_unavailable'
        from email_deliveries d cross join generate_series(1, 3) a
       where d.status = 'failed' and not exists (select 1 from email_attempts x where x.delivery_id = d.id)`);
  } finally {
    await db.end();
  }
}

test("notice list, Kézbesítési hibák and the daily run on the 30-family set", async ({ page }) => {
  const schema = world().schema;
  await addLoad(schema);
  const results: Record<string, number> = {};
  await signInAs(page, seedAccount(schema, "parent-1", "large"));
  results["notice-list"] = Math.max(
    await timed(page, "/szulo/ertesitesek"),
    await timed(page, "/szulo/ertesitesek"),
    await timed(page, "/szulo/ertesitesek"),
  );
  await signInAs(page, seedAccount(schema, "super-admin", "large"));
  results["delivery-problems"] = Math.max(
    await timed(page, "/admin/emlekeztetok"),
    await timed(page, "/admin/emlekeztetok"),
    await timed(page, "/admin/emlekeztetok"),
  );
  const db = await openDatabase();
  try {
    await bindSchema(db, schema);
    const counts = (
      await db.query(
        "select (select count(*) from notifications)::int as notices, (select count(*) from email_deliveries)::int as deliveries, (select count(*) from email_deliveries where status = 'failed')::int as failed",
      )
    ).rows[0];
    const started = Date.now();
    await db.query("select timed_checks_run_system('daily')");
    results["daily-run"] = Date.now() - started;
    console.log(`NOTICES_TIMING ${JSON.stringify({ ...results, ...counts })}`);
  } finally {
    await db.end();
  }
  expect(results["notice-list"]).toBeLessThan(2000);
  expect(results["delivery-problems"]).toBeLessThan(2000);
  expect(results["daily-run"]).toBeLessThan(30000);
});
