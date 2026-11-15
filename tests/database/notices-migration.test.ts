import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import { bootstrapSql } from "../../scripts/db/worker.ts";
import { ORGANIZATION, uuid } from "./directory-support.ts";
import { asActor, authenticated, count } from "./identity-support.ts";
import { ensureAccount, openDatabase, root } from "./stack-support.ts";

type Item = { id: string; title: string; text: string | null; link: string | null; timing: string };

/**
 * The migration test over seeded data of the Ovis tábla work's U5 (NFR7.8, NFR7.9): a private schema is built up to
 * the file before the change and filled with one notice of every old kind, reminder jobs in every old state and the
 * simulated attempts. The change keeps every notice, gives every notice the same title as before, turns the simulated
 * job states into cancelled and drops the simulated attempts; a forced failure leaves the old shape and every row.
 */
describe("notices and timed run migration over seeded data", () => {
  const schema = "u5_notices_migration";
  const CHANGE = "20261050_notices_and_timed_run.sql";
  const all = readMigrationFiles(`${root}supabase/migrations`);
  const change = all.find((file) => file.name === CHANGE)!;
  const earlier = all.filter((file) => file.name < CHANGE);
  let db: pg.Client;

  const apply = (files: typeof all) =>
    applyMigrations({
      client: db as never,
      schema,
      files,
      log: () => {},
      now: () => Date.now(),
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });
  const dropSchema = async () => {
    await db.query("reset search_path");
    await db.query(`drop schema if exists ${schema} cascade`);
    await db.query(`delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1`, [
      schema,
    ]);
  };

  const ACCOUNT = uuid(72001);
  const YEAR = uuid(72002);
  const FAMILY = uuid(72003);
  const PARENT = uuid(72004);
  const ASSIGNMENT = uuid(72005);
  const REQUEST = uuid(72006);
  const PLAN = uuid(72007);
  const MAIN_TASK = uuid(72010);
  const OLD_STATES = ["queued", "sent", "retryable", "retrying", "stale", "cancelled", "terminal"];
  const jobTask = (state: string) => uuid(72020 + OLD_STATES.indexOf(state));
  const job = (state: string) => uuid(72040 + OLD_STATES.indexOf(state));
  const EXPECTED_STATES: Record<string, string> = {
    queued: "queued",
    sent: "sent",
    retryable: "cancelled",
    retrying: "cancelled",
    stale: "stale",
    cancelled: "cancelled",
    terminal: "cancelled",
  };
  // The Budapest calendar day of an old due moment (2026-12-02 23:30 UTC is 3 December in Budapest).
  const DUE_MOMENT = "2026-12-02T23:30:00Z";

  async function seedOldWorld() {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    await db.query("insert into organizations (id, name) values ($1, 'Régi iskola')", [
      ORGANIZATION,
    ]);
    await db.query(
      "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, 'Régi év', '2026-09-01', '2027-06-30')",
      [YEAR, ORGANIZATION],
    );
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $2, 'Régi család')",
      [FAMILY, ORGANIZATION],
    );
    await ensureAccount(db, { id: ACCOUNT, organization: ORGANIZATION });
    await db.query(
      "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, 'Régi szülő', $4)",
      [PARENT, ORGANIZATION, FAMILY, ACCOUNT],
    );
    await db.query(
      `insert into tasks (id, organization_id, title, capacity, starts_at, ends_at)
       values ($1, $2, 'Régi feladat', 3, now() + interval '5 days', now() + interval '6 days')`,
      [MAIN_TASK, ORGANIZATION],
    );
    for (const state of OLD_STATES) {
      await db.query(
        `insert into tasks (id, organization_id, title, capacity, starts_at, ends_at)
         values ($1, $2, $3, 3, now() + interval '8 days', now() + interval '9 days')`,
        [jobTask(state), ORGANIZATION, `Feladat ${state}`],
      );
      await db.query(
        `insert into reminder_jobs (id, organization_id, task_id, threshold, task_starts_at, scheduled_for, status, attempt, correlation_id)
         values ($1, $2, $3, '24h', now() + interval '8 days', $4, $5, 1, $6)`,
        [job(state), ORGANIZATION, jobTask(state), DUE_MOMENT, state, `corr-${state}`],
      );
      await db.query(
        "insert into reminder_attempts (organization_id, reminder_job_id, attempt_number, outcome) values ($1, $2, 1, 'simulated_sent')",
        [ORGANIZATION, job(state)],
      );
    }
    await db.query(
      "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'parent_sign_up')",
      [ASSIGNMENT, ORGANIZATION, MAIN_TASK, FAMILY, PARENT],
    );
    await db.query(
      `insert into change_requests (id, organization_id, assignment_id, kind, requested_by_parent_id, source_task_id, source_assignment_version)
       values ($1, $2, $3, 'cancellation', $4, $5, 1)`,
      [REQUEST, ORGANIZATION, ASSIGNMENT, PARENT, MAIN_TASK],
    );
    await db.query(
      `insert into rota_plans (id, organization_id, school_year_id, status, published_at, published_by)
       values ($1, $2, $3, 'published', now(), $4)`,
      [PLAN, ORGANIZATION, YEAR, ACCOUNT],
    );
    await db.query(
      "insert into rota_weeks (organization_id, plan_id, week_start, family_id) values ($1, $2, '2026-12-07', $3)",
      [ORGANIZATION, PLAN, FAMILY],
    );
    const notice = (
      kind: string,
      type: string,
      target: string,
      task: string | null,
      jobId?: string,
    ) =>
      db.query(
        `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, reminder_job_id, dedupe_key)
         values ($1, $2, $3, $4, $5, $6, case when $6::uuid is null then null else now() + interval '5 days' end, $7, $8)`,
        [ORGANIZATION, PARENT, kind, type, target, task, jobId ?? null, `old-${kind}`],
      );
    await notice("sign_up_confirmed", "task", MAIN_TASK, MAIN_TASK);
    await notice("place_removed", "task", MAIN_TASK, MAIN_TASK);
    await notice("swap_requested", "change_request", REQUEST, MAIN_TASK);
    await notice("swap_decided", "change_request", REQUEST, MAIN_TASK);
    await notice("cancellation_decided", "change_request", REQUEST, MAIN_TASK);
    await notice("reminder_7d", "task", jobTask("sent"), jobTask("sent"), job("sent"));
    await notice("reminder_24h", "task", jobTask("queued"), jobTask("queued"), job("queued"));
    await notice("rota_published", "rota_plan", PLAN, null);
    await db.query(
      `insert into audit_events (id, actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome)
       values (gen_random_uuid(), $1, 'system', 'role.grant', 'grant', $2, $3, 'success')`,
      [ACCOUNT, uuid(72030), ORGANIZATION],
    );
  }

  /** The parent's notice list as the parent reads it, so the old and the new function are measured the same way. */
  async function listNotices(): Promise<Item[]> {
    const result = await asActor(db, schema, authenticated(ACCOUNT), async () =>
      db.query("select notification_list() as result"),
    );
    return (result.rows[0].result as { items: Item[] }).items;
  }

  before(async () => {
    db = await openDatabase();
    await dropSchema();
    await db.query(`create schema ${schema}`);
    for (const statement of bootstrapSql(schema)) await db.query(statement);
  });
  after(async () => {
    await dropSchema();
    await db.end();
  });

  let before_: Item[] = [];

  it("a forced failure leaves the old shape and every seeded row (NFR7.8)", async () => {
    await apply(earlier);
    await seedOldWorld();
    before_ = await listNotices();
    assert.equal(before_.length, 8, "the old list shows every seeded notice");
    await assert.rejects(
      apply([{ ...change, sql: change.sql.replace(/commit;\s*$/, "select 1 / 0;\ncommit;\n") }]),
    );
    await db.query("rollback").catch(() => undefined);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    assert.equal(await count(db, "notifications"), 8);
    assert.equal(await count(db, "reminder_jobs"), 7);
    assert.equal(await count(db, "reminder_attempts"), 7);
    const added = await db.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name in ('email_deliveries', 'timed_runs', 'notice_kinds')",
      [schema],
    );
    assert.equal(added.rowCount, 0, "no new table survived the failed file");
    assert.deepEqual(
      (await db.query("select status from reminder_jobs order by status")).rows.map(
        (r) => r.status,
      ),
      [...OLD_STATES].sort(),
      "the simulated states are still there",
    );
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1 and filename = $2`,
      [schema, CHANGE],
    );
  });

  it("keeps every notice and its title, turns the simulated job states into cancelled and drops the attempts (NFR7.8, NFR7.9)", async () => {
    const result = await apply([...earlier, change]);
    assert.deepEqual(result.applied, [CHANGE]);
    await db.query(`set search_path to ${schema}, pg_catalog`);
    assert.equal(await count(db, "notifications"), 8, "no notice was lost");
    const after_ = await listNotices();
    assert.equal(after_.length, before_.length);
    const byId = new Map(after_.map((item) => [item.id, item]));
    for (const old of before_) {
      const now = byId.get(old.id);
      assert.ok(now, `notice ${old.id} is still listed`);
      assert.equal(now.title, old.title, `the title of ${old.title} is unchanged`);
      assert.equal(now.text, old.text, "and so is its second line");
      assert.equal(now.timing, old.timing, "and its timing");
    }
    const kindsSeen = (await db.query("select distinct kind from notifications order by kind"))
      .rows;
    assert.equal(kindsSeen.length, 8, "one notice of every old kind was compared");
    for (const state of OLD_STATES) {
      const row = (
        await db.query("select status, due_on::text as due from reminder_jobs where id = $1", [
          job(state),
        ])
      ).rows[0];
      assert.equal(
        row.status,
        EXPECTED_STATES[state],
        `a ${state} job becomes ${EXPECTED_STATES[state]}`,
      );
      assert.equal(row.due, "2026-12-03", "the due date is the Budapest day of the old due moment");
    }
    assert.equal(
      (await db.query("select to_regclass($1) as t", [`${schema}.reminder_attempts`])).rows[0].t,
      null,
      "the simulated attempts are gone",
    );
    for (const table of ["email_deliveries", "email_attempts", "timed_runs", "timed_check_runs"]) {
      assert.equal(
        await count(db, table),
        0,
        `${table} starts empty: nothing is queued for the old notices`,
      );
    }
    assert.equal(await count(db, "notice_kinds"), 8);
    assert.equal(await count(db, "notice_targets"), 3);
    assert.equal(await count(db, "timed_check_registry"), 2);
    assert.equal(await count(db, "audit_events", "action = 'role.grant'"), 1);
  });

  it("the daily run over the migrated data makes no duplicate notice and no email for the old notices (NFR7.9)", async () => {
    await db.query(`set search_path to ${schema}, pg_catalog`);
    const run = (await db.query("select timed_checks_run_system('daily') as result")).rows[0]
      .result as { state: string; checks: { outcome: string }[] };
    assert.equal(run.state, "success");
    assert.ok(run.checks.every((check) => check.outcome === "success"));
    assert.equal(
      await count(db, "notifications", "kind in ('reminder_7d', 'reminder_24h')"),
      2,
      "the old reminder notices are the only ones: the one queued migrated job is not due yet",
    );
    assert.equal(
      await count(db, "email_deliveries"),
      0,
      "an old notice is never emailed after the fact",
    );
  });

  it("runs once", async () => {
    const again = await apply([...earlier, change]);
    assert.deepEqual(again.applied, []);
  });
});
